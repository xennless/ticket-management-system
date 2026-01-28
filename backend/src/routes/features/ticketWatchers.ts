import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';

export const ticketWatchersRouter = Router();

ticketWatchersRouter.use(requireAuth);

// Ticket'ın izleyicilerini getir
ticketWatchersRouter.get('/ticket/:ticketId', requirePermission('ticket.read'), async (req, res) => {
  const Params = z.object({ ticketId: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const watchers = await prisma.ticketWatcher.findMany({
    where: { ticketId: params.data.ticketId },
    include: {
      user: { select: { id: true, email: true, name: true, avatarUrl: true } }
    },
    orderBy: { createdAt: 'asc' }
  });

  return res.json({ watchers });
});

// İzleyici ekle
ticketWatchersRouter.post('/ticket/:ticketId', requirePermission('ticket.watcher.manage'), async (req, res) => {
  const Params = z.object({ ticketId: z.string().min(1) });
  const Body = z.object({
    userId: z.string().min(1)
  });
  const params = Params.safeParse(req.params);
  const body = Body.safeParse(req.body);
  if (!params.success || !body.success) {
    return res.status(400).json({ message: 'Geçersiz istek', issues: params.success ? body.error.issues : params.error.issues });
  }

  // Ticket'ın var olduğunu kontrol et
  const ticket = await prisma.ticket.findUnique({ where: { id: params.data.ticketId }, select: { id: true } });
  if (!ticket) return res.status(404).json({ message: 'Ticket bulunamadı' });

  const watcher = await prisma.ticketWatcher.create({
    data: {
      ticketId: params.data.ticketId,
      userId: body.data.userId
    },
    include: {
      user: { select: { id: true, email: true, name: true, avatarUrl: true } }
    }
  });

  return res.status(201).json({ watcher });
});

// İzleyici çıkar
ticketWatchersRouter.delete('/ticket/:ticketId/user/:userId', requirePermission('ticket.watcher.manage'), async (req, res) => {
  const Params = z.object({
    ticketId: z.string().min(1),
    userId: z.string().min(1)
  });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  await prisma.ticketWatcher.deleteMany({
    where: {
      ticketId: params.data.ticketId,
      userId: params.data.userId
    }
  });

  return res.json({ success: true });
});

