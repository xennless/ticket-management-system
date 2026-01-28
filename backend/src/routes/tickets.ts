import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { updateTicketSLA } from '../utils/sla.js';
import { prisma as prismaClient } from '../db/prisma.js';
import { auditWithChanges } from '../lib/audit.js';
import { createTicketActivity } from '../utils/ticketActivity.js';

export const ticketsRouter = Router();

ticketsRouter.use(requireAuth);

// Ticket aktivite geçmişi
ticketsRouter.get('/:id/activities', requirePermission('ticket.activity.read'), async (req, res) => {
  const { id } = req.params;
  
  // Query parameters for pagination
  const Query = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(50)
  });
  const query = Query.safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({ message: 'Geçersiz istek', issues: query.error.issues });
  }
  
  const { page = 1, pageSize = 50 } = query.data;
  const skip = (page - 1) * pageSize;
  
  // Ticket kontrolü
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!ticket) {
    return res.status(404).json({ message: 'Ticket bulunamadı' });
  }

  // TicketActivity tablosundan aktiviteleri çek (pagination ile)
  const [activities, total] = await Promise.all([
    prisma.ticketActivity.findMany({
      where: { ticketId: id },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take: pageSize
    }),
    prisma.ticketActivity.count({ where: { ticketId: id } })
  ]);

  // Frontend formatına dönüştür
  const formattedActivities = activities.map(activity => ({
    type: activity.type,
    timestamp: activity.createdAt,
    user: activity.user ? {
      id: activity.user.id,
      name: activity.user.name,
      email: activity.user.email,
      avatarUrl: activity.user.avatarUrl
    } : undefined,
    data: activity.metadata || {},
    relatedId: activity.relatedId
  }));

  res.json({
    activities: formattedActivities,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  });
});

const TicketStatusSchema = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);
const TicketPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

// Listeleme + filtreleme
ticketsRouter.get('/', requirePermission('ticket.read'), async (req, res) => {
  const Query = z.object({
    status: z.union([TicketStatusSchema, z.string().transform((s) => s.split(','))]).optional(),
    priority: z.union([TicketPrioritySchema, z.string().transform((s) => s.split(','))]).optional(),
    createdById: z.union([z.string().min(1), z.string().transform((s) => s.split(','))]).optional(),
    assignedToId: z.union([z.string().min(1), z.string().transform((s) => s.split(','))]).optional(),
    q: z.string().min(1).optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20)
  });
  const parsed = Query.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: 'Geçersiz istek', issues: parsed.error.issues });

  const { page, pageSize, q, dateFrom, dateTo, ...filters } = parsed.data;
  const skip = (page - 1) * pageSize;

  const assignedToFilter = (() => {
    const raw = filters.assignedToId as any;
    if (!raw) return {};

    const values = Array.isArray(raw) ? raw : [raw];
    const wantsNull = values.includes('null');
    const ids = values.filter((v) => v && v !== 'null');

    if (wantsNull && ids.length > 0) {
      return { OR: [{ assignedToId: null }, { assignedToId: { in: ids } }] };
    }
    if (wantsNull) return { assignedToId: null };
    if (ids.length > 0) return { assignedToId: { in: ids } };
    return {};
  })();

  const categoryFilter = (() => {
    const raw = filters.categoryId as any;
    if (!raw) return {};
    const values = Array.isArray(raw) ? raw : [raw];
    if (values.length > 0) return { categoryId: { in: values } };
    return {};
  })();

  const tagFilter = (() => {
    if (!parsed.data.tagId) return {};
    return {
      tags: {
        some: {
          tagId: parsed.data.tagId
        }
      }
    };
  })();

  const where: any = {
    ...(Array.isArray(filters.status)
      ? { status: { in: filters.status } }
      : filters.status
      ? { status: filters.status }
      : {}),
    ...(Array.isArray(filters.priority)
      ? { priority: { in: filters.priority } }
      : filters.priority
      ? { priority: filters.priority }
      : {}),
    ...(Array.isArray(filters.createdById)
      ? { createdById: { in: filters.createdById } }
      : filters.createdById
      ? { createdById: filters.createdById }
      : {}),
    ...assignedToFilter,
    ...categoryFilter,
    ...tagFilter,
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom + 'T00:00:00.000Z') } : {}),
            ...(dateTo ? { lte: new Date(dateTo + 'T23:59:59.999Z') } : {})
          }
        }
      : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { key: { toString: { contains: q } } }
          ]
        }
      : {})
  };

  const [total, tickets] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      skip,
      take: pageSize,
      select: {
        id: true,
        key: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        firstRespondedAt: true,
        resolvedAt: true,
        slaStatus: true,
        createdBy: { select: { id: true, email: true, name: true, avatarUrl: true } },
        assignedTo: { select: { id: true, email: true, name: true, avatarUrl: true } },
        category: { select: { id: true, name: true, color: true } },
        tags: { include: { tag: true } }
      }
    })
  ]);

  const mapped = tickets.map((t: any) => ({
    ...t,
    tags: t.tags?.map((tr: any) => tr.tag) || []
  }));

  return res.json({ page, pageSize, total, tickets: mapped });
});

// Detay
ticketsRouter.get('/:id', requirePermission('ticket.read'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.data.id },
    select: {
      id: true,
      key: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      createdAt: true,
      updatedAt: true,
      firstRespondedAt: true,
      resolvedAt: true,
      resolvedById: true,
      resolvedBy: { select: { id: true, email: true, name: true } },
      resolutionNote: true,
      slaStatus: true,
      firstResponseSLA: true,
      resolutionSLA: true,
      closedAt: true,
      closedById: true,
      createdBy: { select: { id: true, email: true, name: true, avatarUrl: true } },
      assignedTo: { select: { id: true, email: true, name: true, avatarUrl: true } },
      closedBy: { select: { id: true, email: true, name: true } },
      category: { select: { id: true, name: true, color: true } },
      tags: { include: { tag: true } },
      watchers: { include: { user: { select: { id: true, email: true, name: true } } } },
      rating: {
        include: {
          ratedBy: { select: { id: true, email: true, name: true, avatarUrl: true } }
        }
      }
    }
  });
  if (!ticket) return res.status(404).json({ message: 'Ticket bulunamadı' });

  return res.json({
    ticket: {
      ...ticket,
      tags: (ticket as any).tags?.map((tr: any) => tr.tag) || []
    }
  });
});

// Oluştur
ticketsRouter.post('/', requirePermission('ticket.create'), async (req, res) => {
  const Body = z.object({
    title: z.string().min(3),
    description: z.string().optional(),
    priority: TicketPrioritySchema.optional(),
    dueAt: z.string().datetime().optional(),
    categoryId: z.string().optional(),
    tagIds: z.array(z.string()).optional()
  });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  const userId = req.userId!;
  const priority = body.data.priority ?? 'MEDIUM';
  const createdAt = new Date();

  // SLA hesapla (dinamik)
  const slaData = await updateTicketSLA(prisma, {
    priority,
    categoryId: body.data.categoryId || null,
    createdAt,
    firstRespondedAt: null,
    resolvedAt: null
  });

  const ticket = await prisma.ticket.create({
    data: {
      title: body.data.title,
      description: body.data.description,
      priority,
      categoryId: body.data.categoryId,
      createdById: userId,
      firstResponseSLA: slaData.firstResponseSLA,
      resolutionSLA: slaData.resolutionSLA,
      slaStatus: slaData.slaStatus,
      slaId: slaData.slaId,
      tags: body.data.tagIds && body.data.tagIds.length > 0 ? {
        create: body.data.tagIds.map(tagId => ({ tagId }))
      } : undefined
    },
    include: {
      createdBy: { select: { id: true, email: true, name: true, avatarUrl: true } },
      assignedTo: { select: { id: true, email: true, name: true, avatarUrl: true } },
      category: { select: { id: true, name: true, color: true } },
      tags: { include: { tag: true } }
    }
  });

  // Aktivite kaydet: Ticket oluşturuldu
  await createTicketActivity(prisma, {
    ticketId: ticket.id,
    type: 'ticket_created',
    userId: userId,
    metadata: { ticketKey: ticket.key, title: ticket.title }
  });

  return res.status(201).json({
    ticket: {
      ...ticket,
      tags: (ticket as any).tags?.map((tr: any) => tr.tag) || []
    }
  });
});

// Güncelle (kapalı ticket kısıtı)
ticketsRouter.put('/:id', requirePermission('ticket.update'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const Body = z.object({
    title: z.string().min(3).optional(),
    description: z.string().optional().nullable(),
    priority: TicketPrioritySchema.optional(),
    status: TicketStatusSchema.optional(),
    categoryId: z.string().nullable().optional(),
    tagIds: z.array(z.string()).optional(),
    resolutionNote: z.string().optional().nullable()
  });
  const params = Params.safeParse(req.params);
  const body = Body.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ message: 'Geçersiz istek' });

  // Mevcut ticket'ı al (SLA hesaplama ve audit log için)
  const currentTicket = await prisma.ticket.findUnique({
    where: { id: params.data.id },
    select: { 
      id: true,
      status: true, 
      priority: true, 
      categoryId: true, 
      title: true,
      createdAt: true, 
      firstRespondedAt: true, 
      resolvedAt: true,
      assignedToId: true
    }
  });
  if (!currentTicket) return res.status(404).json({ message: 'Ticket bulunamadı' });
  if (currentTicket.status === 'CLOSED') return res.status(409).json({ message: 'Kapalı ticket güncellenemez' });

  // Eski değerleri kaydet (audit log için)
  const oldValue: any = {
    status: currentTicket.status,
    priority: currentTicket.priority,
    categoryId: currentTicket.categoryId,
    title: currentTicket.title,
    assignedToId: currentTicket.assignedToId
  };

  // Basit status geçiş kuralı:
  // - CLOSED sadece /close ile olur (buradan kapatma yok)
  // - CLOSED -> OPEN sadece /reopen ile olur
  if (body.data.status === 'CLOSED') {
    return res.status(409).json({ message: 'Kapatma işlemi için /close kullanın' });
  }

  // Tag'leri güncelle
  if (body.data.tagIds !== undefined) {
    // Mevcut tag'leri sil
    await prisma.ticketTagRelation.deleteMany({ where: { ticketId: params.data.id } });
    // Yeni tag'leri ekle
    if (body.data.tagIds.length > 0) {
      await prisma.ticketTagRelation.createMany({
        data: body.data.tagIds.map(tagId => ({ ticketId: params.data.id, tagId })),
        skipDuplicates: true
      });
    }
  }

  const updateData: any = {
    ...body.data
  };
  delete updateData.tagIds;

  // Status değiştiyse firstRespondedAt veya resolvedAt güncelle
  if (body.data.status === 'IN_PROGRESS' && currentTicket.status !== 'IN_PROGRESS' && !currentTicket.firstRespondedAt) {
    updateData.firstRespondedAt = new Date();
  }
  if (body.data.status === 'RESOLVED' && currentTicket.status !== 'RESOLVED' && !currentTicket.resolvedAt) {
    updateData.resolvedAt = new Date();
    updateData.resolvedById = req.userId!;
  }
  
  // Resolution note güncelle
  if (body.data.resolutionNote !== undefined) {
    updateData.resolutionNote = body.data.resolutionNote;
  }

  // SLA güncelle (dinamik)
  const priority = body.data.priority ?? currentTicket.priority;
  const firstRespondedAt = updateData.firstRespondedAt ?? currentTicket.firstRespondedAt;
  const resolvedAt = updateData.resolvedAt ?? currentTicket.resolvedAt;
  const categoryId = body.data.categoryId !== undefined ? body.data.categoryId : currentTicket.categoryId;
  
  const slaData = await updateTicketSLA(prisma, {
    priority,
    categoryId: categoryId || null,
    createdAt: currentTicket.createdAt,
    firstRespondedAt,
    resolvedAt
  });
  updateData.firstResponseSLA = slaData.firstResponseSLA;
  updateData.resolutionSLA = slaData.resolutionSLA;
  updateData.slaStatus = slaData.slaStatus;
  updateData.slaId = slaData.slaId;

  const ticket = await prisma.ticket.update({
    where: { id: params.data.id },
    data: updateData,
    include: {
      category: { select: { id: true, name: true, color: true } },
      tags: { include: { tag: true } }
    }
  });

  // Audit log oluştur (değişiklikler varsa)
  const newValue: any = {
    status: body.data.status !== undefined ? body.data.status : currentTicket.status,
    priority: body.data.priority !== undefined ? body.data.priority : currentTicket.priority,
    categoryId: body.data.categoryId !== undefined ? body.data.categoryId : currentTicket.categoryId,
    title: body.data.title !== undefined ? body.data.title : currentTicket.title,
    assignedToId: currentTicket.assignedToId
  };

  // Sadece değişiklik varsa audit log oluştur
  if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
    await auditWithChanges(req, 'update', 'Ticket', ticket.id, oldValue, newValue);

    // Status değişikliği
    if (body.data.status !== undefined && body.data.status !== currentTicket.status) {
      await createTicketActivity(prisma, {
        ticketId: ticket.id,
        type: 'status_changed',
        userId: req.userId!,
        metadata: { from: currentTicket.status, to: body.data.status }
      });
    }

    // Priority değişikliği
    if (body.data.priority !== undefined && body.data.priority !== currentTicket.priority) {
      await createTicketActivity(prisma, {
        ticketId: ticket.id,
        type: 'priority_changed',
        userId: req.userId!,
        metadata: { from: currentTicket.priority, to: body.data.priority }
      });
    }

    // Category değişikliği
    if (body.data.categoryId !== undefined && body.data.categoryId !== currentTicket.categoryId) {
      await createTicketActivity(prisma, {
        ticketId: ticket.id,
        type: 'category_changed',
        userId: req.userId!,
        metadata: { fromCategoryId: currentTicket.categoryId, toCategoryId: body.data.categoryId }
      });
    }

    // Title değişikliği
    if (body.data.title !== undefined && body.data.title !== currentTicket.title) {
      await createTicketActivity(prisma, {
        ticketId: ticket.id,
        type: 'title_changed',
        userId: req.userId!,
        metadata: { from: currentTicket.title, to: body.data.title }
      });
    }

    // İlk yanıt (status IN_PROGRESS'e geçtiyse ve firstRespondedAt yoksa)
    if (body.data.status === 'IN_PROGRESS' && currentTicket.status !== 'IN_PROGRESS' && !currentTicket.firstRespondedAt) {
      await createTicketActivity(prisma, {
        ticketId: ticket.id,
        type: 'first_response',
        userId: req.userId!,
        metadata: {}
      });
    }

    // Çözüm (status RESOLVED'e geçtiyse)
    if (body.data.status === 'RESOLVED' && currentTicket.status !== 'RESOLVED') {
      await createTicketActivity(prisma, {
        ticketId: ticket.id,
        type: 'ticket_resolved',
        userId: req.userId!,
        metadata: {}
      });
    }
  }

  return res.json({
    ticket: {
      ...ticket,
      tags: (ticket as any).tags?.map((tr: any) => tr.tag) || []
    }
  });
});

// Atama
ticketsRouter.put('/:id/assign', requirePermission('ticket.assign'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const Body = z.object({ assignedToId: z.string().min(1).nullable() });
  const params = Params.safeParse(req.params);
  const body = Body.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const existing = await prisma.ticket.findUnique({ 
    where: { id: params.data.id }, 
    select: { id: true, status: true, assignedToId: true }
  });
  if (!existing) return res.status(404).json({ message: 'Ticket bulunamadı' });
  if (existing.status === 'CLOSED') return res.status(409).json({ message: 'Kapalı ticket atanamaz' });

  // Eski atama bilgisini kaydet
  const oldValue = { assignedToId: existing.assignedToId };
  const newValue = { assignedToId: body.data.assignedToId };

  const ticket = await prisma.ticket.update({
    where: { id: params.data.id },
    data: { assignedToId: body.data.assignedToId }
  });

  // Audit log oluştur
  await auditWithChanges(req, 'update', 'Ticket', ticket.id, oldValue, newValue);

  // Aktivite kaydet: Ticket atandı
  await createTicketActivity(prisma, {
    ticketId: ticket.id,
    type: 'ticket_assigned',
    userId: req.userId!,
    metadata: {
      fromUserId: existing.assignedToId,
      toUserId: body.data.assignedToId
    }
  });

  return res.json({ ticket });
});

// Kapat
ticketsRouter.put('/:id/close', requirePermission('ticket.close'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const existing = await prisma.ticket.findUnique({ 
    where: { id: params.data.id }, 
    select: { id: true, status: true }
  });
  if (!existing) return res.status(404).json({ message: 'Ticket bulunamadı' });
  if (existing.status === 'CLOSED') return res.status(409).json({ message: 'Ticket zaten kapalı' });

  const oldValue = { status: existing.status };
  const newValue = { status: 'CLOSED' };

  const ticket = await prisma.ticket.update({
    where: { id: params.data.id },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
      closedById: req.userId!
    }
  });

  // Audit log oluştur
  await auditWithChanges(req, 'update', 'Ticket', ticket.id, oldValue, newValue);

  // Aktivite kaydet: Ticket kapatıldı
  await createTicketActivity(prisma, {
    ticketId: ticket.id,
    type: 'ticket_closed',
    userId: req.userId!,
    metadata: {}
  });

  return res.json({ ticket });
});

// Yeniden aç
ticketsRouter.put('/:id/reopen', requirePermission('ticket.reopen'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const existing = await prisma.ticket.findUnique({ 
    where: { id: params.data.id }, 
    select: { id: true, status: true }
  });
  if (!existing) return res.status(404).json({ message: 'Ticket bulunamadı' });
  if (existing.status !== 'CLOSED') return res.status(409).json({ message: 'Sadece kapalı ticket yeniden açılabilir' });

  const oldValue = { status: existing.status };
  const newValue = { status: 'OPEN' };

  const ticket = await prisma.ticket.update({
    where: { id: params.data.id },
    data: { status: 'OPEN', closedAt: null, closedById: null }
  });

  // Audit log oluştur
  await auditWithChanges(req, 'update', 'Ticket', ticket.id, oldValue, newValue);

  return res.json({ ticket });
});

// Mesajları listele
ticketsRouter.get('/:id/messages', requirePermission('ticket.message.read'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const ticket = await prisma.ticket.findUnique({ where: { id: params.data.id }, select: { id: true } });
  if (!ticket) return res.status(404).json({ message: 'Ticket bulunamadı' });

  const messages = await prisma.ticketMessage.findMany({
    where: { ticketId: ticket.id },
    orderBy: { createdAt: 'asc' },
    include: { author: { select: { id: true, email: true, name: true } } }
  });
  return res.json({ messages });
});

// Değerlendirme görüntüle
ticketsRouter.get('/:id/rating', requirePermission('ticket.rating.read'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const ticket = await prisma.ticket.findUnique({ 
    where: { id: params.data.id }, 
    select: { id: true } 
  });
  if (!ticket) return res.status(404).json({ message: 'Ticket bulunamadı' });

  const rating = await prisma.ticketRating.findUnique({
    where: { ticketId: ticket.id },
    include: {
      ratedBy: { select: { id: true, email: true, name: true, avatarUrl: true } }
    }
  });

  return res.json({ rating });
});

// Değerlendirme oluştur/güncelle
ticketsRouter.post('/:id/rating', requirePermission('ticket.rating.create'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const Body = z.object({ 
    rating: z.number().int().min(1).max(5),
    comment: z.string().optional()
  });
  const params = Params.safeParse(req.params);
  const body = Body.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const ticket = await prisma.ticket.findUnique({ 
    where: { id: params.data.id }, 
    select: { id: true, status: true, createdById: true } 
  });
  if (!ticket) return res.status(404).json({ message: 'Ticket bulunamadı' });

  // Sadece ticket oluşturan kullanıcı değerlendirme yapabilir (veya CLOSED/RESOLVED durumunda)
  const canRate = ticket.createdById === req.userId || ticket.status === 'CLOSED' || ticket.status === 'RESOLVED';
  if (!canRate) {
    return res.status(403).json({ message: 'Sadece ticket oluşturan kullanıcı veya çözülmüş/kapatılmış ticketlar için değerlendirme yapılabilir' });
  }

  // Mevcut değerlendirmeyi kontrol et
  const existingRating = await prisma.ticketRating.findUnique({
    where: { ticketId: ticket.id }
  });

  // Kullanıcı kendi değerlendirmesini güncelleyebilir veya yeni değerlendirme yapabilir
  if (existingRating && existingRating.ratedById !== req.userId) {
    return res.status(409).json({ message: 'Bu ticket zaten değerlendirilmiş' });
  }

  const rating = await prisma.ticketRating.upsert({
    where: { ticketId: ticket.id },
    update: {
      rating: body.data.rating,
      comment: body.data.comment || null,
      ratedById: req.userId!
    },
    create: {
      ticketId: ticket.id,
      rating: body.data.rating,
      comment: body.data.comment || null,
      ratedById: req.userId!
    },
    include: {
      ratedBy: { select: { id: true, email: true, name: true, avatarUrl: true } }
    }
  });

  // Aktivite kaydet: Değerlendirme yapıldı
  await createTicketActivity(prisma, {
    ticketId: ticket.id,
    type: 'ticket_rated',
    userId: req.userId!,
    metadata: { rating: body.data.rating, comment: body.data.comment || null }
  });

  return res.json({ rating });
});

// Değerlendirme güncelle
ticketsRouter.put('/:id/rating', requirePermission('ticket.rating.update'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const Body = z.object({ 
    rating: z.number().int().min(1).max(5).optional(),
    comment: z.string().optional()
  });
  const params = Params.safeParse(req.params);
  const body = Body.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const ticket = await prisma.ticket.findUnique({ 
    where: { id: params.data.id }, 
    select: { id: true } 
  });
  if (!ticket) return res.status(404).json({ message: 'Ticket bulunamadı' });

  const existingRating = await prisma.ticketRating.findUnique({
    where: { ticketId: ticket.id }
  });

  if (!existingRating) {
    return res.status(404).json({ message: 'Değerlendirme bulunamadı' });
  }

  // Kullanıcı sadece kendi değerlendirmesini güncelleyebilir
  if (existingRating.ratedById !== req.userId) {
    return res.status(403).json({ message: 'Sadece kendi değerlendirmenizi güncelleyebilirsiniz' });
  }

  const updateData: any = {};
  if (body.data.rating !== undefined) updateData.rating = body.data.rating;
  if (body.data.comment !== undefined) updateData.comment = body.data.comment || null;

  const rating = await prisma.ticketRating.update({
    where: { ticketId: ticket.id },
    data: updateData,
    include: {
      ratedBy: { select: { id: true, email: true, name: true, avatarUrl: true } }
    }
  });

  // Aktivite kaydet: Değerlendirme güncellendi
  await createTicketActivity(prisma, {
    ticketId: ticket.id,
    type: 'ticket_rating_updated',
    userId: req.userId!,
    metadata: updateData
  });

  return res.json({ rating });
});

// Mesaj ekle
ticketsRouter.post('/:id/messages', requirePermission('ticket.message.create'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const Body = z.object({ body: z.string().min(1), isInternal: z.boolean().optional().default(false) });
  const params = Params.safeParse(req.params);
  const body = Body.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const existing = await prisma.ticket.findUnique({ where: { id: params.data.id }, select: { status: true } });
  if (!existing) return res.status(404).json({ message: 'Ticket bulunamadı' });
  if (existing.status === 'CLOSED') return res.status(409).json({ message: 'Kapalı ticket’a mesaj eklenemez' });

  const message = await prisma.ticketMessage.create({
    data: {
      ticketId: params.data.id,
      authorId: req.userId!,
      body: body.data.body,
      isInternal: body.data.isInternal
    },
    include: { author: { select: { id: true, email: true, name: true } } }
  });

  // İlk yanıt kontrolü
  const ticket = await prisma.ticket.findUnique({
    where: { id: params.data.id },
    select: { firstRespondedAt: true }
  });
  
  if (!ticket?.firstRespondedAt && !body.data.isInternal) {
    // İlk yanıt - ticket'ı güncelle
    await prisma.ticket.update({
      where: { id: params.data.id },
      data: { firstRespondedAt: new Date() }
    });

    // Aktivite kaydet: İlk yanıt
    await createTicketActivity(prisma, {
      ticketId: params.data.id,
      type: 'first_response',
      userId: req.userId!,
      relatedId: message.id,
      metadata: {}
    });
  }

  // Aktivite kaydet: Mesaj eklendi
  await createTicketActivity(prisma, {
    ticketId: params.data.id,
    type: body.data.isInternal ? 'internal_message' : 'public_message',
    userId: req.userId!,
    relatedId: message.id,
    metadata: {
      body: body.data.body.substring(0, 100) + (body.data.body.length > 100 ? '...' : ''),
      isInternal: body.data.isInternal
    }
  });

  return res.status(201).json({ message });
});


