import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';

export const bulkRouter = Router();

bulkRouter.use(requireAuth);

// Toplu kullanıcı işlemleri
bulkRouter.post('/users', requirePermission('user.bulk'), async (req, res) => {
  const Body = z.object({
    userIds: z.array(z.string().min(1)),
    action: z.enum(['activate', 'deactivate', 'delete', 'assignRole', 'removeRole']),
    roleId: z.string().optional()
  });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const { userIds, action, roleId } = body.data;
  const userId = req.userId!;

  let processed = 0;

  if (action === 'activate') {
    const result = await prisma.user.updateMany({
      where: { id: { in: userIds }, deletedAt: null },
      data: { isActive: true, activatedAt: new Date(), activatedById: userId }
    });
    processed = result.count;
  } else if (action === 'deactivate') {
    const result = await prisma.user.updateMany({
      where: { id: { in: userIds }, deletedAt: null },
      data: { isActive: false, deactivatedAt: new Date(), deactivatedById: userId }
    });
    processed = result.count;
  } else if (action === 'delete') {
    const result = await prisma.user.updateMany({
      where: { id: { in: userIds }, deletedAt: null, isActive: false },
      data: { deletedAt: new Date() }
    });
    processed = result.count;
  } else if (action === 'assignRole' && roleId) {
    // Rol atama
    await prisma.userRole.createMany({
      data: userIds.map((uid) => ({ userId: uid, roleId })),
      skipDuplicates: true
    });
    processed = userIds.length;
  } else if (action === 'removeRole' && roleId) {
    // Rol kaldırma
    const result = await prisma.userRole.deleteMany({
      where: { userId: { in: userIds }, roleId }
    });
    processed = result.count;
  }

  return res.json({ success: true, processed });
});

// Toplu rol işlemleri
bulkRouter.post('/roles', requirePermission('role.bulk'), async (req, res) => {
  const Body = z.object({
    roleIds: z.array(z.string().min(1)),
    action: z.enum(['delete', 'assignPermission', 'removePermission']),
    permissionId: z.string().optional()
  });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const { roleIds, action, permissionId } = body.data;
  let processed = 0;

  if (action === 'delete') {
    // Sistem rolleri silinemez
    const result = await prisma.role.deleteMany({
      where: { id: { in: roleIds }, isSystem: false }
    });
    processed = result.count;
  } else if (action === 'assignPermission' && permissionId) {
    await prisma.rolePermission.createMany({
      data: roleIds.map((rid) => ({ roleId: rid, permissionId })),
      skipDuplicates: true
    });
    processed = roleIds.length;
  } else if (action === 'removePermission' && permissionId) {
    const result = await prisma.rolePermission.deleteMany({
      where: { roleId: { in: roleIds }, permissionId }
    });
    processed = result.count;
  }

  return res.json({ success: true, processed });
});

