import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';

export const fileUploadLogsRouter = Router();

fileUploadLogsRouter.use(requireAuth);

// Dosya yükleme loglarını listele
fileUploadLogsRouter.get('/', requirePermission('fileUploadLog.read'), async (req, res) => {
  const Query = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.enum(['SUCCESS', 'FAILED', 'DELETED']).optional(),
    userId: z.string().optional(),
    ticketId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional()
  });

  const query = Query.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const { page, pageSize, status, userId, ticketId, startDate, endDate } = query.data;
  const skip = (page - 1) * pageSize;

  // Filtre oluştur
  const where: any = {};
  if (status) where.status = status;
  if (userId) where.userId = userId;
  if (ticketId) where.ticketId = ticketId;
  
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const [logs, total] = await Promise.all([
    prisma.fileUploadLog.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, name: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize
    }),
    prisma.fileUploadLog.count({ where })
  ]);

  return res.json({
    logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  });
});

// İstatistikler
fileUploadLogsRouter.get('/stats', requirePermission('fileUploadLog.read'), async (req, res) => {
  const Query = z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional()
  });

  const query = Query.safeParse(req.query);
  const filters = query.success ? query.data : {};

  // Tarih filtresi
  const where: any = {};
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  // Duruma göre sayımlar
  const [successCount, failedCount, deletedCount, totalSize] = await Promise.all([
    prisma.fileUploadLog.count({ where: { ...where, status: 'SUCCESS' } }),
    prisma.fileUploadLog.count({ where: { ...where, status: 'FAILED' } }),
    prisma.fileUploadLog.count({ where: { ...where, status: 'DELETED' } }),
    prisma.fileUploadLog.aggregate({
      where: { ...where, status: 'SUCCESS' },
      _sum: { fileSize: true }
    })
  ]);

  // Son 7 günlük trend
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentLogs = await prisma.fileUploadLog.groupBy({
    by: ['status'],
    where: {
      createdAt: { gte: sevenDaysAgo }
    },
    _count: { status: true }
  });

  const recentStats = {
    success: recentLogs.find((l) => l.status === 'SUCCESS')?._count.status || 0,
    failed: recentLogs.find((l) => l.status === 'FAILED')?._count.status || 0,
    deleted: recentLogs.find((l) => l.status === 'DELETED')?._count.status || 0
  };

  // En çok hata veren kullanıcılar
  const topFailedUsers = await prisma.fileUploadLog.groupBy({
    by: ['userId'],
    where: { status: 'FAILED', userId: { not: null } },
    _count: { userId: true },
    orderBy: { _count: { userId: 'desc' } },
    take: 5
  });

  // Kullanıcı bilgilerini al
  const userIds = topFailedUsers.map((u) => u.userId!).filter(Boolean);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, name: true }
  });

  const topFailedWithUsers = topFailedUsers.map((u) => ({
    user: users.find((user) => user.id === u.userId),
    count: u._count.userId
  }));

  return res.json({
    totals: {
      success: successCount,
      failed: failedCount,
      deleted: deletedCount,
      totalSize: totalSize._sum.fileSize || 0,
      totalSizeMB: Math.round((totalSize._sum.fileSize || 0) / 1024 / 1024)
    },
    recentStats,
    topFailedUsers: topFailedWithUsers
  });
});

// Tek log detayı
fileUploadLogsRouter.get('/:id', requirePermission('fileUploadLog.read'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const log = await prisma.fileUploadLog.findUnique({
    where: { id: params.data.id },
    include: {
      user: { select: { id: true, email: true, name: true } }
    }
  });

  if (!log) return res.status(404).json({ message: 'Log bulunamadı' });

  return res.json({ log });
});

