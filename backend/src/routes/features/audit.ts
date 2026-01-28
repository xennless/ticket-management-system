import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { deleteUserData, exportUserData } from '../../utils/gdpr.js';
import { applyRetentionPolicy } from '../../utils/auditRetention.js';
import * as XLSX from 'xlsx';

export const auditRouter = Router();

auditRouter.use(requireAuth);

// Audit logları getir
auditRouter.get('/', requirePermission('audit.read'), async (req, res) => {
  const Query = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
    userId: z.string().optional(),
    entityType: z.string().optional(),
    action: z.string().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional()
  });
  const query = Query.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const { page, pageSize, userId, entityType, action, startDate, endDate } = query.data;
  const skip = (page - 1) * pageSize;

  const where: any = {};
  if (userId) where.userId = userId;
  if (entityType) where.entityType = entityType;
  if (action) where.action = action;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        user: { select: { id: true, email: true, name: true } }
      }
    })
  ]);

  return res.json({ page, pageSize, total, logs });
});

// Audit log export
auditRouter.get('/export', requirePermission('audit.export'), async (req, res) => {
  const Query = z.object({
    format: z.enum(['csv', 'json', 'xlsx']).optional().default('csv'),
    userId: z.string().optional(),
    entityType: z.string().optional(),
    action: z.string().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional()
  });
  const query = Query.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: 'Geçersiz istek', issues: query.error.issues });

  const { format, userId, entityType, action, startDate, endDate } = query.data;

  const where: any = {};
  if (userId) where.userId = userId;
  if (entityType) where.entityType = entityType;
  if (action) where.action = action;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, email: true, name: true } }
    }
  });

  if (format === 'json') {
    return res.json({ logs });
  }

  // CSV veya Excel için veriyi düzleştir
  const flatLogs = logs.map((log: any) => ({
    id: log.id,
    userId: log.userId || '',
    userEmail: log.user?.email || '',
    userName: log.user?.name || '',
    entityType: log.entityType || '',
    entityId: log.entityId || '',
    action: log.action || '',
    ip: log.ip || '',
    userAgent: log.userAgent || '',
    createdAt: log.createdAt.toISOString(),
    oldValue: log.oldValue ? JSON.stringify(log.oldValue) : '',
    newValue: log.newValue ? JSON.stringify(log.newValue) : ''
  }));

  if (format === 'csv') {
    // CSV oluştur
    const headers = Object.keys(flatLogs[0] || {});
    const csvRows = [
      headers.join(','),
      ...flatLogs.map((row: any) =>
        headers.map((header) => {
          const value = row[header] || '';
          // CSV için özel karakterleri escape et
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    return res.send('\ufeff' + csvRows.join('\n')); // BOM ekle (Excel için UTF-8 desteği)
  }

  if (format === 'xlsx') {
    // Excel oluştur
    const worksheet = XLSX.utils.json_to_sheet(flatLogs);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Logs');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.xlsx"`);
    return res.send(buffer);
  }

  return res.status(400).json({ message: 'Geçersiz format' });
});

// GDPR - Kullanıcı verilerini export et
auditRouter.get('/gdpr/export/:userId', requirePermission('audit.export'), async (req, res) => {
  const Params = z.object({
    userId: z.string().min(1)
  });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  try {
    const data = await exportUserData(params.data.userId);
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ message: 'Veri export edilemedi', error: error.message });
  }
});

// GDPR - Kullanıcı verilerini sil (Right to be Forgotten)
auditRouter.post('/gdpr/delete/:userId', requirePermission('audit.manage'), async (req, res) => {
  const Params = z.object({
    userId: z.string().min(1)
  });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const userId = req.userId;
  if (!userId) return res.status(401).json({ message: 'Yetkisiz' });

  try {
    const result = await deleteUserData(params.data.userId, userId);
    return res.json({ success: true, result });
  } catch (error: any) {
    return res.status(500).json({ message: 'Veri silinemedi', error: error.message });
  }
});

// Audit log retention policy uygula
auditRouter.post('/retention/apply', requirePermission('audit.manage'), async (req, res) => {
  try {
    const result = await applyRetentionPolicy();
    return res.json({ success: true, result });
  } catch (error: any) {
    return res.status(500).json({ message: 'Retention policy uygulanamadı', error: error.message });
  }
});

// Compliance raporları
auditRouter.get('/compliance/report', requirePermission('audit.read'), async (req, res) => {
  const Query = z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional()
  });
  const query = Query.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: 'Geçersiz istek', issues: query.error.issues });

  const { startDate, endDate } = query.data;

  const where: any = {};
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [
    totalLogs,
    logsByAction,
    logsByEntity,
    logsByUser,
    gdprDeletions,
    recentActivity
  ] = await Promise.all([
    // Toplam log sayısı
    prisma.auditLog.count({ where }),
    // Action bazında
    prisma.auditLog.groupBy({
      by: ['action'],
      where,
      _count: { action: true }
    }),
    // Entity type bazında
    prisma.auditLog.groupBy({
      by: ['entityType'],
      where,
      _count: { entityType: true }
    }),
    // User bazında (top 10)
    prisma.auditLog.groupBy({
      by: ['userId'],
      where,
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 10
    }),
    // GDPR silme işlemleri
    prisma.auditLog.count({
      where: {
        ...where,
        action: 'gdpr_delete'
      }
    }),
    // Son 24 saat aktivite
    prisma.auditLog.count({
      where: {
        ...where,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    })
  ]);

  // User bilgilerini al
  const userIds = logsByUser.map((l: any) => l.userId).filter(Boolean);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, name: true }
  });
  const userMap = new Map(users.map((u: any) => [u.id, u]));

  return res.json({
    period: {
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString()
    },
    summary: {
      totalLogs,
      recentActivity,
      gdprDeletions
    },
    breakdown: {
      byAction: logsByAction.map((l: any) => ({
        action: l.action,
        count: l._count.action
      })),
      byEntity: logsByEntity.map((l: any) => ({
        entityType: l.entityType,
        count: l._count.entityType
      })),
      byUser: logsByUser.map((l: any) => {
        const user = userMap.get(l.userId || '');
        return {
          userId: l.userId,
          userEmail: user?.email || 'Unknown',
          userName: user?.name || 'Unknown',
          count: l._count.userId
        };
      })
    }
  });
});

