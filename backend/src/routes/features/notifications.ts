import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

// Kullanıcının bildirimlerini getir
notificationsRouter.get('/', requirePermission('notification.read'), async (req, res) => {
  const userId = req.userId!;
  const Query = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
    unreadOnly: z.coerce.boolean().optional().default(false)
  });
  const query = Query.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const { page, pageSize, unreadOnly } = query.data;
  const skip = (page - 1) * pageSize;

  const where: any = { userId };
  if (unreadOnly) where.readAt = null;

  const [total, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize
    })
  ]);

  return res.json({ page, pageSize, total, notifications });
});

// Bildirimi okundu olarak işaretle
notificationsRouter.put('/:id/read', requirePermission('notification.read'), async (req, res) => {
  const userId = req.userId!;
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  await prisma.notification.updateMany({
    where: { id: params.data.id, userId },
    data: { readAt: new Date() }
  });

  return res.json({ success: true });
});

// Tüm bildirimleri okundu olarak işaretle
notificationsRouter.put('/read-all', requirePermission('notification.read'), async (req, res) => {
  const userId = req.userId!;
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() }
  });
  return res.json({ success: true });
});

// Bildirim tercihlerini getir (her kullanıcı kendi tercihlerini görebilir)
notificationsRouter.get('/settings', async (req, res) => {
  const userId = req.userId!;

  const pref =
    (await prisma.notificationPreference.findUnique({ where: { userId } })) ??
    (await prisma.notificationPreference.create({ data: { userId } }));

  return res.json({
    preferences: {
      inAppEnabled: pref.inAppEnabled,
      emailEnabled: pref.emailEnabled,
      onAssigned: pref.onAssigned,
      onStatusChange: pref.onStatusChange,
      onMention: pref.onMention
    }
  });
});

// Bildirim tercihlerini güncelle (her kullanıcı kendi tercihlerini güncelleyebilir)
notificationsRouter.put('/settings', async (req, res) => {
  const userId = req.userId!;

  const Body = z.object({
    inAppEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    onAssigned: z.boolean().optional(),
    onStatusChange: z.boolean().optional(),
    onMention: z.boolean().optional()
  });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  const pref = await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...body.data },
    update: { ...body.data }
  });

  return res.json({
    success: true,
    preferences: {
      inAppEnabled: pref.inAppEnabled,
      emailEnabled: pref.emailEnabled,
      onAssigned: pref.onAssigned,
      onStatusChange: pref.onStatusChange,
      onMention: pref.onMention
    }
  });
});

