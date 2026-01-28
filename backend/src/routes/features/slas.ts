import express from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';

const TicketPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const slasRouter = express.Router();
slasRouter.use(requireAuth);

// Listeleme
slasRouter.get('/', requirePermission('sla.read'), async (req, res) => {
  const slas = await prisma.ticketSLA.findMany({
    include: {
      category: { select: { id: true, name: true, color: true } },
      _count: { select: { tickets: true } }
    },
    orderBy: [
      { priority: 'asc' },
      { createdAt: 'desc' }
    ]
  });

  return res.json({ slas });
});

// Detay
slasRouter.get('/:id', requirePermission('sla.read'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const sla = await prisma.ticketSLA.findUnique({
    where: { id: params.data.id },
    include: {
      category: { select: { id: true, name: true, color: true } },
      _count: { select: { tickets: true } }
    }
  });

  if (!sla) return res.status(404).json({ message: 'SLA bulunamadı' });

  return res.json({ sla });
});

// Oluştur
slasRouter.post('/', requirePermission('sla.manage'), async (req, res) => {
  const Body = z.object({
    name: z.string().min(1),
    priority: TicketPrioritySchema.nullable().optional(),
    categoryId: z.string().nullable().optional(),
    firstResponseTime: z.number().int().positive().nullable().optional(), // dakika
    resolutionTime: z.number().int().positive().nullable().optional(), // saat
    isActive: z.boolean().optional().default(true)
  });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  // En az bir kriter (priority veya category) olmalı
  if (!body.data.priority && !body.data.categoryId) {
    return res.status(400).json({ message: 'Öncelik veya kategori seçilmelidir' });
  }

  // Kategori kontrolü
  if (body.data.categoryId) {
    const category = await prisma.ticketCategory.findUnique({
      where: { id: body.data.categoryId }
    });
    if (!category) return res.status(404).json({ message: 'Kategori bulunamadı' });
  }

  // Aynı öncelik ve kategori kombinasyonu kontrolü
  const existing = await prisma.ticketSLA.findFirst({
    where: {
      priority: body.data.priority || null,
      categoryId: body.data.categoryId || null,
      isActive: true
    }
  });

  if (existing) {
    return res.status(409).json({ message: 'Bu öncelik ve kategori kombinasyonu için zaten aktif bir SLA mevcut' });
  }

  const sla = await prisma.ticketSLA.create({
    data: {
      name: body.data.name,
      priority: body.data.priority || null,
      categoryId: body.data.categoryId || null,
      firstResponseTime: body.data.firstResponseTime || null,
      resolutionTime: body.data.resolutionTime || null,
      isActive: body.data.isActive
    },
    include: {
      category: { select: { id: true, name: true, color: true } }
    }
  });

  return res.status(201).json({ sla });
});

// Güncelle
slasRouter.put('/:id', requirePermission('sla.manage'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const Body = z.object({
    name: z.string().min(1).optional(),
    priority: TicketPrioritySchema.nullable().optional(),
    categoryId: z.string().nullable().optional(),
    firstResponseTime: z.number().int().positive().nullable().optional(),
    resolutionTime: z.number().int().positive().nullable().optional(),
    isActive: z.boolean().optional()
  });
  const params = Params.safeParse(req.params);
  const body = Body.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const existing = await prisma.ticketSLA.findUnique({
    where: { id: params.data.id }
  });

  if (!existing) return res.status(404).json({ message: 'SLA bulunamadı' });

  // Kategori kontrolü
  if (body.data.categoryId) {
    const category = await prisma.ticketCategory.findUnique({
      where: { id: body.data.categoryId }
    });
    if (!category) return res.status(404).json({ message: 'Kategori bulunamadı' });
  }

  // Aynı öncelik ve kategori kombinasyonu kontrolü (kendisi hariç)
  const priority = body.data.priority !== undefined ? body.data.priority : existing.priority;
  const categoryId = body.data.categoryId !== undefined ? body.data.categoryId : existing.categoryId;

  const duplicate = await prisma.ticketSLA.findFirst({
    where: {
      priority: priority || null,
      categoryId: categoryId || null,
      isActive: true,
      NOT: { id: params.data.id }
    }
  });

  if (duplicate) {
    return res.status(409).json({ message: 'Bu öncelik ve kategori kombinasyonu için zaten aktif bir SLA mevcut' });
  }

  const sla = await prisma.ticketSLA.update({
    where: { id: params.data.id },
    data: {
      ...(body.data.name && { name: body.data.name }),
      ...(body.data.priority !== undefined && { priority: body.data.priority }),
      ...(body.data.categoryId !== undefined && { categoryId: body.data.categoryId }),
      ...(body.data.firstResponseTime !== undefined && { firstResponseTime: body.data.firstResponseTime }),
      ...(body.data.resolutionTime !== undefined && { resolutionTime: body.data.resolutionTime }),
      ...(body.data.isActive !== undefined && { isActive: body.data.isActive })
    },
    include: {
      category: { select: { id: true, name: true, color: true } }
    }
  });

  return res.json({ sla });
});

// Sil
slasRouter.delete('/:id', requirePermission('sla.manage'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const existing = await prisma.ticketSLA.findUnique({
    where: { id: params.data.id },
    include: { _count: { select: { tickets: true } } }
  });

  if (!existing) return res.status(404).json({ message: 'SLA bulunamadı' });

  // Bu SLA'ya bağlı ticket varsa silme
  if (existing._count.tickets > 0) {
    return res.status(409).json({ message: `Bu SLA'ya bağlı ${existing._count.tickets} ticket bulunmaktadır. Önce ticket'ları güncelleyin.` });
  }

  await prisma.ticketSLA.delete({
    where: { id: params.data.id }
  });

  return res.json({ message: 'SLA silindi' });
});

