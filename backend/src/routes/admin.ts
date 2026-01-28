import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireTwoFactor } from '../middleware/requireTwoFactor.js';
import { hashPassword } from '../utils/password.js';
import { hasSystemDeveloperRole, isSystemDeveloperRole } from '../utils/role.js';
import { getSystemSetting } from '../utils/settings.js';
import { validatePassword, checkPasswordHistory } from '../utils/passwordValidation.js';

export const adminRouter = Router();

const EmailLike = z.string().min(3).regex(/^[^\s@]+@[^\s@]+$/, 'Geçersiz email');
const HexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/, 'Geçersiz renk (hex)'); // #fff veya #ffffff

// Hepsi system-developer tarafından yönetilecek: rol/yetki/kullanıcı
adminRouter.use(requireAuth);
// Kritik admin işlemleri için 2FA zorunlu
adminRouter.use(requireTwoFactor);

// ---- Permissions
adminRouter.get('/permissions', requirePermission('permission.read'), async (_req, res) => {
  const permissions = await prisma.permission.findMany({ orderBy: { code: 'asc' } });
  return res.json({ permissions });
});

adminRouter.post('/permissions', requirePermission('permission.manage'), async (req, res) => {
  const Body = z.object({
    code: z.string().min(2).regex(/^[a-z0-9._-]+$/i),
    name: z.string().min(1),
    description: z.string().optional()
  });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  const permission = await prisma.permission.create({
    data: {
      code: body.data.code,
      name: body.data.name,
      description: body.data.description
    }
  });
  return res.status(201).json({ permission });
});

adminRouter.put('/permissions/:id', requirePermission('permission.manage'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const Body = z.object({
    code: z.string().min(2).regex(/^[a-z0-9._-]+$/i).optional(),
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable()
  });
  const params = Params.safeParse(req.params);
  const body = Body.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const existing = await prisma.permission.findUnique({
    where: { id: params.data.id },
    select: { isSystem: true }
  });
  if (!existing) return res.status(404).json({ message: 'Yetki bulunamadı' });

  // Sistem yetkilerinin code'u değiştirilemez (UI isim/desc güncelleyebilir)
  if (existing.isSystem && body.data.code !== undefined) {
    return res.status(403).json({ message: 'Sistem yetkisinin kodu değiştirilemez' });
  }

  const permission = await prisma.permission.update({
    where: { id: params.data.id },
    data: body.data
  });
  return res.json({ permission });
});

adminRouter.delete('/permissions/:id', requirePermission('permission.manage'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const existing = await prisma.permission.findUnique({
    where: { id: params.data.id },
    select: { isSystem: true, code: true }
  });
  if (!existing) return res.status(404).json({ message: 'Yetki bulunamadı' });
  if (existing.isSystem) return res.status(403).json({ message: 'Sistem yetkisi silinemez', code: existing.code });

  await prisma.permission.delete({ where: { id: params.data.id } });
  return res.status(204).send();
});

// ---- Roles
adminRouter.get('/roles', requirePermission('role.read'), async (_req, res) => {
  const roles = await prisma.role.findMany({
    orderBy: { code: 'asc' },
    include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } }
  });
  return res.json({
    roles: roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      label: r.label,
      color: r.color,
      isSystem: r.isSystem,
      userCount: r._count.users,
      permissions: r.permissions.map((rp) => rp.permission)
    }))
  });
});

adminRouter.post('/roles', requirePermission('role.manage'), async (req, res) => {
  const Body = z.object({
    code: z.string().min(2).regex(/^[a-z0-9._-]+$/i),
    name: z.string().min(1),
    description: z.string().optional(),
    label: z.string().min(1).optional(),
    color: HexColor.optional(),
    permissionIds: z.array(z.string().min(1)).optional()
  });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  const permissionIds = Array.from(new Set(body.data.permissionIds ?? []));
  if (permissionIds.length) {
    const existing = await prisma.permission.findMany({ where: { id: { in: permissionIds } }, select: { id: true } });
    const existingSet = new Set(existing.map((p) => p.id));
    const missing = permissionIds.filter((id) => !existingSet.has(id));
    if (missing.length) {
      return res.status(400).json({
        message: 'Geçersiz yetki seçimi: bazı permissionId değerleri bulunamadı',
        missingPermissionIds: missing
      });
    }
  }

  const role = await prisma.role.create({
    data: {
      code: body.data.code,
      name: body.data.name,
      description: body.data.description,
      label: body.data.label,
      color: body.data.color,
      isSystem: false,
      permissions: permissionIds.length ? { create: permissionIds.map((permissionId) => ({ permissionId })) }
        : undefined
    },
    include: { permissions: { include: { permission: true } } }
  });

  return res.status(201).json({
    role: {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      label: role.label,
      color: role.color,
      isSystem: role.isSystem,
      permissions: role.permissions.map((rp) => rp.permission)
    }
  });
});

adminRouter.put('/roles/:id', requirePermission('role.manage'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const Body = z.object({
    code: z.string().min(2).regex(/^[a-z0-9._-]+$/i).optional(),
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    label: z.string().min(1).optional().nullable(),
    color: HexColor.optional().nullable()
  });
  const params = Params.safeParse(req.params);
  const body = Body.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const existing = await prisma.role.findUnique({ where: { id: params.data.id }, select: { code: true, isSystem: true } });
  if (!existing) return res.status(404).json({ message: 'Rol bulunamadı' });
  
  // System Developer rolü için özel kontrol: sadece system-developer rolüne sahip kullanıcılar düzenleyebilir
  if (isSystemDeveloperRole(existing.code)) {
    const userHasSystemDeveloper = await hasSystemDeveloperRole(req.userId!);
    if (!userHasSystemDeveloper) {
      return res.status(403).json({ message: 'System Developer rolünü sadece system-developer rolüne sahip kullanıcılar düzenleyebilir' });
    }
  } else if (existing.isSystem) {
    // Diğer sistem rolleri düzenlenemez
    return res.status(403).json({ message: 'Sistem rolü düzenlenemez' });
  }

  const role = await prisma.role.update({ where: { id: params.data.id }, data: body.data });
  return res.json({ role });
});

adminRouter.delete('/roles/:id', requirePermission('role.manage'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const existing = await prisma.role.findUnique({ where: { id: params.data.id }, select: { isSystem: true } });
  if (!existing) return res.status(404).json({ message: 'Rol bulunamadı' });
  if (existing.isSystem) return res.status(403).json({ message: 'Sistem rolü silinemez' });

  await prisma.role.delete({ where: { id: params.data.id } });
  return res.status(204).send();
});

adminRouter.put('/roles/:id/permissions', requirePermission('role.manage'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const Body = z.object({ permissionIds: z.array(z.string().min(1)) });
  const params = Params.safeParse(req.params);
  const body = Body.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const permissionIds = Array.from(new Set(body.data.permissionIds));
  if (permissionIds.length) {
    const existingPerms = await prisma.permission.findMany({ where: { id: { in: permissionIds } }, select: { id: true } });
    const existingSet = new Set(existingPerms.map((p) => p.id));
    const missing = permissionIds.filter((id) => !existingSet.has(id));
    if (missing.length) {
      return res.status(400).json({
        message: 'Geçersiz yetki seçimi: bazı permissionId değerleri bulunamadı',
        missingPermissionIds: missing
      });
    }
  }

  const existing = await prisma.role.findUnique({ where: { id: params.data.id }, select: { code: true, isSystem: true } });
  if (!existing) return res.status(404).json({ message: 'Rol bulunamadı' });
  
  // System Developer rolü için özel kontrol: sadece system-developer rolüne sahip kullanıcılar düzenleyebilir
  if (isSystemDeveloperRole(existing.code)) {
    const userHasSystemDeveloper = await hasSystemDeveloperRole(req.userId!);
    if (!userHasSystemDeveloper) {
      return res.status(403).json({ message: 'System Developer rolünün yetkilerini sadece system-developer rolüne sahip kullanıcılar değiştirebilir' });
    }
  } else if (existing.isSystem) {
    // Diğer sistem rolleri yetkileri değiştirilemez
    return res.status(403).json({ message: 'Sistem rolü yetkileri bu uçtan değiştirilemez' });
  }

  const role = await prisma.role.update({
    where: { id: params.data.id },
    data: {
      permissions: {
        deleteMany: {},
        create: permissionIds.map((permissionId) => ({ permissionId }))
      }
    },
    include: { permissions: { include: { permission: true } } }
  });

  return res.json({
    role: {
      id: role.id,
      code: role.code,
      name: role.name,
      label: role.label,
      color: role.color,
      permissions: role.permissions.map((rp) => rp.permission)
    }
  });
});

// ---- Users (register yok: system-developer kullanıcı açar)
adminRouter.get('/users', requirePermission('user.read'), async (req, res) => {
  const Query = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
    search: z.string().optional()
  });
  const query = Query.safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({ message: 'Geçersiz istek', issues: query.error.issues });
  }
  
  const { page = 1, pageSize = 50, search } = query.data;
  const skip = (page - 1) * pageSize;
  
  // Search filter
  const where = search ? {
    OR: [
      { email: { contains: search, mode: 'insensitive' as const } },
      { name: { contains: search, mode: 'insensitive' as const } }
    ]
  } : {};
  
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        deletedAt: true,
        lastLoginAt: true,
        lastLoginIp: true,
        mustChangePassword: true,
        deactivatedAt: true,
        deactivatedBy: { select: { id: true, email: true, name: true } },
        activatedAt: true,
        activatedBy: { select: { id: true, email: true, name: true } },
        createdAt: true,
      roles: { select: { role: { select: { id: true, code: true, name: true, label: true, color: true } } } }
    },
      skip,
      take: pageSize
    }),
    prisma.user.count({ where })
  ]);
  
  return res.json({
    users: users.map((u: any) => ({
      ...u,
      roles: u.roles?.map((r: { role: { id: string; code: string; name: string; label: string | null; color: string | null } }) => r.role) || []
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  });
});

adminRouter.post('/users', requirePermission('user.manage'), async (req, res) => {
  const minPasswordLength = await getSystemSetting<number>('minPasswordLength', 8);
  const Body = z.object({
    email: EmailLike,
    name: z.string().optional(),
    password: z.string().min(minPasswordLength, `Şifre en az ${minPasswordLength} karakter olmalı`),
    roleIds: z.array(z.string().min(1)).optional().default([]),
    mustChangePassword: z.boolean().optional().default(false) // Girişte zorunlu şifre değişikliği
  });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  const roleIds = Array.from(new Set(body.data.roleIds));
  if (roleIds.length) {
    const existing = await prisma.role.findMany({ where: { id: { in: roleIds } }, select: { id: true } });
    const existingSet = new Set(existing.map((r) => r.id));
    const missing = roleIds.filter((id) => !existingSet.has(id));
    if (missing.length) {
      return res.status(400).json({
        message: 'Geçersiz rol seçimi: bazı roleId değerleri bulunamadı',
        missingRoleIds: missing
      });
    }
  }

  // Şifre politikası kontrolü
  const validation = await validatePassword(body.data.password);
  if (!validation.valid) {
    return res.status(400).json({ 
      message: 'Şifre politikası gereksinimlerini karşılamıyor', 
      issues: validation.errors.map(err => ({ message: err, path: ['password'] }))
    });
  }

  const passwordHash = await hashPassword(body.data.password);
  const user = await prisma.user.create({
    data: {
      email: body.data.email.toLowerCase(),
      name: body.data.name,
      passwordHash,
      isActive: true,
      deletedAt: null,
      mustChangePassword: body.data.mustChangePassword ?? false,
      passwordChangedAt: new Date(), // Yeni kullanıcı için şifre değişikliği tarihi
      roles: roleIds.length ? { create: roleIds.map((roleId) => ({ roleId })) } : undefined
    },
    select: { id: true, email: true, name: true, isActive: true, deletedAt: true }
  });

  return res.status(201).json({ user });
});

adminRouter.put('/users/:id', requirePermission('user.manage'), async (req, res) => {
  const minPasswordLength = await getSystemSetting<number>('minPasswordLength', 8);
  const Params = z.object({ id: z.string().min(1) });
  const Body = z.object({
    name: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
    password: z.string().min(minPasswordLength, `Şifre en az ${minPasswordLength} karakter olmalı`).optional(),
    mustChangePassword: z.boolean().optional(), // Şifre değiştirildiğinde girişte zorunlu şifre değişikliği
    roleIds: z.array(z.string().min(1)).optional(),
    // soft-delete geri alma için opsiyonel
    deletedAt: z.coerce.date().optional().nullable()
  });
  const params = Params.safeParse(req.params);
  const body = Body.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ message: 'Geçersiz istek' });

  if (body.data.roleIds !== undefined) {
    const roleIds = Array.from(new Set(body.data.roleIds));
    if (roleIds.length) {
      const existing = await prisma.role.findMany({ where: { id: { in: roleIds } }, select: { id: true } });
      const existingSet = new Set(existing.map((r) => r.id));
      const missing = roleIds.filter((id) => !existingSet.has(id));
      if (missing.length) {
        return res.status(400).json({
          message: 'Geçersiz rol seçimi: bazı roleId değerleri bulunamadı',
          missingRoleIds: missing
        });
      }
    }
  }

  const updateData: { name?: string | null; isActive?: boolean; passwordHash?: string; mustChangePassword?: boolean; deletedAt?: Date | null; passwordChangedAt?: Date } = {};
  if (body.data.name !== undefined) updateData.name = body.data.name;
  if (body.data.isActive !== undefined) updateData.isActive = body.data.isActive;
  if (body.data.password) {
    // Şifre politikası kontrolü
    const validation = await validatePassword(body.data.password);
    if (!validation.valid) {
      return res.status(400).json({ 
        message: 'Şifre politikası gereksinimlerini karşılamıyor', 
        issues: validation.errors.map(err => ({ message: err, path: ['password'] }))
      });
    }

    // Şifre geçmişi kontrolü
    const historyValid = await checkPasswordHistory(params.data.id, body.data.password);
    if (!historyValid) {
      return res.status(400).json({ 
        message: 'Bu şifre daha önce kullanılmış. Lütfen farklı bir şifre seçin.',
        issues: [{ message: 'Bu şifre daha önce kullanılmış', path: ['password'] }]
      });
    }

    // Eski şifreyi geçmişe ekle
    const currentUser = await prisma.user.findUnique({
      where: { id: params.data.id },
      select: { passwordHash: true }
    });
    
    const historyCount = await getSystemSetting<number>('passwordHistoryCount', 0);
    if (historyCount > 0 && currentUser) {
      await prisma.passwordHistory.create({
        data: {
          userId: params.data.id,
          passwordHash: currentUser.passwordHash
        }
      });
    }

    updateData.passwordHash = await hashPassword(body.data.password);
    updateData.passwordChangedAt = new Date();
    // Şifre değiştirildiğinde mustChangePassword ayarını kontrol et
    if (body.data.mustChangePassword !== undefined) {
      updateData.mustChangePassword = body.data.mustChangePassword;
    }
  }
  // Şifre değiştirilmediyse ama mustChangePassword güncellenmişse
  if (!body.data.password && body.data.mustChangePassword !== undefined) {
    updateData.mustChangePassword = body.data.mustChangePassword;
  }
  if (body.data.deletedAt !== undefined) updateData.deletedAt = body.data.deletedAt;

  const updated = await prisma.user.update({
    where: { id: params.data.id },
    data: {
      ...updateData,
      roles:
        body.data.roleIds !== undefined
          ? {
              deleteMany: {},
              create: Array.from(new Set(body.data.roleIds)).map((roleId) => ({ roleId }))
            }
          : undefined
    },
    select: { id: true, email: true, name: true, isActive: true, deletedAt: true }
  });

  return res.json({ user: updated });
});

// Soft delete (DB'den fiziksel silme yerine)
adminRouter.delete('/users/:id', requirePermission('user.manage'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  await prisma.user.update({
    where: { id: params.data.id },
    // Yeni davranış: "soft delete" sadece pasif etme
    data: { isActive: false, deactivatedAt: new Date(), deactivatedById: req.userId ?? null }
  });
  return res.status(204).send();
});

adminRouter.put('/users/:id/restore', requirePermission('user.manage'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const user = await prisma.user.update({
    where: { id: params.data.id },
    // UI'da "Aktif Et" olarak kullanılacak
    data: { isActive: true, deletedAt: null, activatedAt: new Date(), activatedById: req.userId ?? null },
    select: { id: true, email: true, name: true, isActive: true, deletedAt: true }
  });
  return res.json({ user });
});

// Kalıcı silme (sadece pasif kullanıcılar için önerilir)
adminRouter.delete('/users/:id/hard', requirePermission('user.manage'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const user = await prisma.user.findUnique({
    where: { id: params.data.id },
    select: { id: true, isActive: true }
  });
  if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
  if (user.isActive) {
    return res.status(409).json({ message: 'Kalıcı silme için önce kullanıcıyı pasif yapın' });
  }

  await prisma.user.delete({ where: { id: user.id } });
  return res.status(204).send();
});

// ---- 2FA Yönetimi (Admin)
// Tüm kullanıcıların 2FA durumunu listele
adminRouter.get('/2fa/users', requirePermission('user.read'), async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      deletedAt: true,
      twoFactorAuth: {
        select: {
          enabled: true,
          method: true,
          createdAt: true,
          updatedAt: true
        }
      }
    }
  });

  const usersWith2FA = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    isActive: u.isActive,
    deletedAt: u.deletedAt,
    twoFactorEnabled: u.twoFactorAuth?.enabled ?? false,
    twoFactorMethod: u.twoFactorAuth?.method ?? null,
    twoFactorCreatedAt: u.twoFactorAuth?.createdAt ?? null,
    twoFactorUpdatedAt: u.twoFactorAuth?.updatedAt ?? null
  }));

  return res.json({ users: usersWith2FA });
});

// Başka kullanıcının profilini görüntüleme
adminRouter.get('/users/:id/profile', requirePermission('profile.read'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const user = await prisma.user.findUnique({
    where: { id: params.data.id },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      isActive: true,
      deletedAt: true,
      lastLoginAt: true,
      lastLoginIp: true,
      activatedAt: true,
      activatedBy: { select: { id: true, email: true, name: true } },
      deactivatedAt: true,
      deactivatedBy: { select: { id: true, email: true, name: true } },
      createdAt: true,
      updatedAt: true,
      roles: {
        select: {
          role: {
            select: {
              id: true,
              code: true,
              name: true,
              label: true,
              color: true,
              permissions: { select: { permission: { select: { code: true, name: true } } } }
            }
          }
        }
      }
    }
  });

  if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });

  const roles = user.roles.map((r) => r.role);
  const permissions = Array.from(
    new Map(
      roles.flatMap((r) => r.permissions.map((p) => [p.permission.code, p.permission] as const))
    ).values()
  );

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      lastLoginIp: user.lastLoginIp,
      activatedAt: user.activatedAt,
      activatedBy: user.activatedBy,
      deactivatedAt: user.deactivatedAt,
      deactivatedBy: user.deactivatedBy,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    },
    roles: roles.map((r) => ({ id: r.id, code: r.code, name: r.name, label: r.label, color: r.color })),
    permissions
  });
});


