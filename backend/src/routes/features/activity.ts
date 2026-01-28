import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';

export const activityRouter = Router();

activityRouter.use(requireAuth);

// Aktivite loglarını getir
activityRouter.get('/', requirePermission('activity.read'), async (req, res) => {
  const Query = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
    userId: z.string().optional(),
    action: z.string().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional()
  });
  const query = Query.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const { page, pageSize, userId, action, startDate, endDate } = query.data;
  const skip = (page - 1) * pageSize;

  const where: any = {};
  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [total, activities] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        user: { select: { id: true, email: true, name: true } }
      }
    })
  ]);

  return res.json({ page, pageSize, total, activities });
});

