import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';

export const ticketCategoriesRouter = Router();

ticketCategoriesRouter.use(requireAuth);

// Kategorileri listele
ticketCategoriesRouter.get('/', requirePermission('ticket.category.read'), async (_req, res) => {
  const categories = await prisma.ticketCategory.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' }
  });
  return res.json({ categories });
});

// Tüm kategorileri listele (aktif + pasif - admin için)
ticketCategoriesRouter.get('/all', requirePermission('ticket.category.manage'), async (_req, res) => {
  const categories = await prisma.ticketCategory.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }]
  });
  return res.json({ categories });
});

// Kategori oluştur
ticketCategoriesRouter.post('/', requirePermission('ticket.category.manage'), async (req, res) => {
  const Body = z.object({
    name: z.string().min(1),
    color: z.string().optional(),
    description: z.string().optional()
  });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  const category = await prisma.ticketCategory.create({
    data: body.data
  });

  return res.status(201).json({ category });
});

// Kategori güncelle
ticketCategoriesRouter.put('/:id', requirePermission('ticket.category.manage'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const Body = z.object({
    name: z.string().min(1).optional(),
    color: z.string().optional(),
    description: z.string().optional().nullable(),
    isActive: z.boolean().optional()
  });
  const params = Params.safeParse(req.params);
  const body = Body.safeParse(req.body);
  if (!params.success || !body.success) {
    return res.status(400).json({ message: 'Geçersiz istek', issues: params.success ? body.error.issues : params.error.issues });
  }

  const category = await prisma.ticketCategory.update({
    where: { id: params.data.id },
    data: body.data
  });

  return res.json({ category });
});

// Kategori sil
ticketCategoriesRouter.delete('/:id', requirePermission('ticket.category.manage'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  // Kategori kullanılıyorsa silme, sadece pasif yap
  const ticketCount = await prisma.ticket.count({ where: { categoryId: params.data.id } });
  if (ticketCount > 0) {
    await prisma.ticketCategory.update({
      where: { id: params.data.id },
      data: { isActive: false }
    });
    return res.json({ success: true, message: 'Kategori kullanıldığı için pasif yapıldı' });
  }

  await prisma.ticketCategory.delete({ where: { id: params.data.id } });
  return res.json({ success: true });
});

