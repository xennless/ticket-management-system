import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';

export const ticketTagsRouter = Router();

ticketTagsRouter.use(requireAuth);

// Etiketleri listele
ticketTagsRouter.get('/', requirePermission('ticket.tag.read'), async (_req, res) => {
  const tags = await prisma.ticketTag.findMany({
    orderBy: { name: 'asc' }
  });
  return res.json({ tags });
});

// Etiket oluştur
ticketTagsRouter.post('/', requirePermission('ticket.tag.manage'), async (req, res) => {
  const Body = z.object({
    name: z.string().min(1),
    color: z.string().optional()
  });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  const tag = await prisma.ticketTag.create({
    data: body.data
  });

  return res.status(201).json({ tag });
});

// Etiket güncelle
ticketTagsRouter.put('/:id', requirePermission('ticket.tag.manage'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const Body = z.object({
    name: z.string().min(1).optional(),
    color: z.string().optional()
  });
  const params = Params.safeParse(req.params);
  const body = Body.safeParse(req.body);
  if (!params.success || !body.success) {
    return res.status(400).json({ message: 'Geçersiz istek', issues: params.success ? body.error.issues : params.error.issues });
  }

  const tag = await prisma.ticketTag.update({
    where: { id: params.data.id },
    data: body.data
  });

  return res.json({ tag });
});

// Etiket sil
ticketTagsRouter.delete('/:id', requirePermission('ticket.tag.manage'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  await prisma.ticketTag.delete({ where: { id: params.data.id } });
  return res.json({ success: true });
});

