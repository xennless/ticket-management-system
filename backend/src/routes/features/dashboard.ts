import { Router } from 'express';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

// Dashboard istatistikleri
dashboardRouter.get('/', requirePermission('dashboard.read'), async (_req, res) => {
  const [
    totalUsers,
    activeUsers,
    totalRoles,
    totalPermissions,
    recentUsers,
    recentLogins
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { isActive: true, deletedAt: null } }),
    prisma.role.count(),
    prisma.permission.count(),
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      where: { deletedAt: null },
      select: { id: true, email: true, name: true, createdAt: true }
    }),
    prisma.user.findMany({
      take: 5,
      orderBy: { lastLoginAt: 'desc' },
      where: { lastLoginAt: { not: null }, deletedAt: null },
      select: { id: true, email: true, name: true, lastLoginAt: true }
    })
  ]);

  return res.json({
    stats: {
      totalUsers,
      activeUsers,
      totalRoles,
      totalPermissions
    },
    recentUsers,
    recentLogins
  });
});

