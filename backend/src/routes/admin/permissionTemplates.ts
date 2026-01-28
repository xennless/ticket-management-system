import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';

export const permissionTemplatesRouter = Router();

permissionTemplatesRouter.use(requireAuth);

// Tüm şablonları listele
permissionTemplatesRouter.get('/', requirePermission('permissionTemplate.read'), async (_req, res) => {
  const templates = await prisma.permissionTemplate.findMany({
    include: {
      permissions: {
        include: {
          permission: {
            select: { id: true, code: true, name: true }
          }
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  const result = templates.map((t) => ({
    id: t.id,
    code: t.code,
    name: t.name,
    description: t.description,
    color: t.color,
    icon: t.icon,
    isSystem: t.isSystem,
    permissionIds: t.permissions.map((p) => p.permissionId),
    permissions: t.permissions.map((p) => p.permission),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt
  }));

  return res.json({ templates: result });
});

// Tek şablon getir
permissionTemplatesRouter.get('/:id', requirePermission('permissionTemplate.read'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const template = await prisma.permissionTemplate.findUnique({
    where: { id: params.data.id },
    include: {
      permissions: {
        include: {
          permission: {
            select: { id: true, code: true, name: true }
          }
        }
      }
    }
  });

  if (!template) return res.status(404).json({ message: 'Şablon bulunamadı' });

  return res.json({
    template: {
      id: template.id,
      code: template.code,
      name: template.name,
      description: template.description,
      color: template.color,
      icon: template.icon,
      isSystem: template.isSystem,
      permissionIds: template.permissions.map((p) => p.permissionId),
      permissions: template.permissions.map((p) => p.permission),
      createdAt: template.createdAt,
      updatedAt: template.updatedAt
    }
  });
});

// Yeni şablon oluştur
permissionTemplatesRouter.post('/', requirePermission('permissionTemplate.manage'), async (req, res) => {
  const Body = z.object({
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    color: z.string().max(20).optional(),
    icon: z.string().max(50).optional(),
    permissionIds: z.array(z.string()).optional().default([])
  });

  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', errors: body.error.errors });

  // Kod benzersizliği kontrolü
  const existing = await prisma.permissionTemplate.findUnique({ where: { code: body.data.code } });
  if (existing) return res.status(400).json({ message: 'Bu kod zaten kullanılıyor' });

  const template = await prisma.permissionTemplate.create({
    data: {
      code: body.data.code,
      name: body.data.name,
      description: body.data.description,
      color: body.data.color,
      icon: body.data.icon,
      permissions: {
        create: body.data.permissionIds.map((permissionId) => ({
          permissionId
        }))
      }
    },
    include: {
      permissions: {
        include: {
          permission: {
            select: { id: true, code: true, name: true }
          }
        }
      }
    }
  });

  return res.status(201).json({
    template: {
      id: template.id,
      code: template.code,
      name: template.name,
      description: template.description,
      color: template.color,
      icon: template.icon,
      isSystem: template.isSystem,
      permissionIds: template.permissions.map((p) => p.permissionId),
      permissions: template.permissions.map((p) => p.permission)
    }
  });
});

// Şablon güncelle
permissionTemplatesRouter.put('/:id', requirePermission('permissionTemplate.manage'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const Body = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional().nullable(),
    color: z.string().max(20).optional().nullable(),
    icon: z.string().max(50).optional().nullable(),
    permissionIds: z.array(z.string()).optional()
  });

  const params = Params.safeParse(req.params);
  const body = Body.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const template = await prisma.permissionTemplate.findUnique({ where: { id: params.data.id } });
  if (!template) return res.status(404).json({ message: 'Şablon bulunamadı' });
  if (template.isSystem) return res.status(400).json({ message: 'Sistem şablonları düzenlenemez' });

  // Şablon bilgilerini güncelle
  const updateData: any = {};
  if (body.data.name !== undefined) updateData.name = body.data.name;
  if (body.data.description !== undefined) updateData.description = body.data.description;
  if (body.data.color !== undefined) updateData.color = body.data.color;
  if (body.data.icon !== undefined) updateData.icon = body.data.icon;

  // Yetkileri güncelle
  if (body.data.permissionIds !== undefined) {
    // Önce mevcut yetkileri sil
    await prisma.permissionTemplateItem.deleteMany({
      where: { templateId: params.data.id }
    });

    // Yeni yetkileri ekle
    await prisma.permissionTemplateItem.createMany({
      data: body.data.permissionIds.map((permissionId) => ({
        templateId: params.data.id,
        permissionId
      }))
    });
  }

  const updated = await prisma.permissionTemplate.update({
    where: { id: params.data.id },
    data: updateData,
    include: {
      permissions: {
        include: {
          permission: {
            select: { id: true, code: true, name: true }
          }
        }
      }
    }
  });

  return res.json({
    template: {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      description: updated.description,
      color: updated.color,
      icon: updated.icon,
      isSystem: updated.isSystem,
      permissionIds: updated.permissions.map((p) => p.permissionId),
      permissions: updated.permissions.map((p) => p.permission)
    }
  });
});

// Şablon sil
permissionTemplatesRouter.delete('/:id', requirePermission('permissionTemplate.manage'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const template = await prisma.permissionTemplate.findUnique({ where: { id: params.data.id } });
  if (!template) return res.status(404).json({ message: 'Şablon bulunamadı' });
  if (template.isSystem) return res.status(400).json({ message: 'Sistem şablonları silinemez' });

  await prisma.permissionTemplate.delete({ where: { id: params.data.id } });
  return res.status(204).send();
});

