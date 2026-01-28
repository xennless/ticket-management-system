import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { audit } from '../../lib/audit.js';

export const navigationRouter = Router();

// Sistemdeki tüm route'lar (Router'dan otomatik senkronize edilir)
// Permission önerileri path'e göre otomatik tahmin edilir veya null olabilir
const SYSTEM_ROUTES = [
  { path: '/dashboard', name: 'Dashboard', description: 'Ana kontrol paneli', suggestedPermission: 'dashboard.read' },
  { path: '/tickets', name: 'Tickets', description: 'Destek talepleri listesi', suggestedPermission: 'ticket.read' },
  { path: '/tickets/new', name: 'Yeni Ticket', description: 'Yeni destek talebi oluştur', suggestedPermission: 'ticket.create' },
  { path: '/tickets/:id', name: 'Ticket Detay', description: 'Ticket detay sayfası (dinamik ID)', suggestedPermission: 'ticket.read' },
  { path: '/profile', name: 'Profil', description: 'Kullanıcı profil sayfası', suggestedPermission: 'profile.read' },
  { path: '/notifications', name: 'Bildirimler', description: 'Bildirim merkezi', suggestedPermission: 'notification.read' },
  { path: '/sessions', name: 'Oturumlar', description: 'Aktif oturum yönetimi', suggestedPermission: 'session.read' },
  { path: '/settings', name: 'Ayarlar', description: 'Sistem ayarları', suggestedPermission: 'settings.read' },
  { path: '/2fa', name: '2FA', description: 'İki faktörlü doğrulama', suggestedPermission: 'auth.2fa.manage' },
  { path: '/logs', name: 'Loglar ve İzleme', description: 'Sistem logları, audit logları, aktiviteler ve monitoring', suggestedPermission: 'log.read' },
  { path: '/groups', name: 'Tüm Gruplar', description: 'Sistemdeki tüm grupları yönetme (admin)', suggestedPermission: 'group.read' },
  { path: '/my-groups', name: 'Grubum', description: 'Kendi grubunu ve üyeliklerini yönetme', suggestedPermission: 'group.own' },
  { path: '/bulk', name: 'Toplu İşlemler', description: 'Toplu kullanıcı/rol işlemleri', suggestedPermission: 'user.bulk' },
  { path: '/import-export', name: 'İçe/Dışa Aktar', description: 'Veri aktarım işlemleri', suggestedPermission: 'user.import' },
  { path: '/reports', name: 'Raporlar', description: 'Sistem raporları', suggestedPermission: 'report.read' },
  { path: '/admin/permissions', name: 'Yetkiler', description: 'Yetki yönetimi', suggestedPermission: 'permission.read' },
  { path: '/admin/permission-templates', name: 'Yetki Şablonları', description: 'Yetki şablon yönetimi', suggestedPermission: 'permissionTemplate.read' },
  { path: '/admin/roles', name: 'Roller', description: 'Rol yönetimi', suggestedPermission: 'role.read' },
  { path: '/admin/users', name: 'Kullanıcılar', description: 'Kullanıcı yönetimi', suggestedPermission: 'user.read' },
  { path: '/admin/navigation', name: 'Navigasyon', description: 'Menü yapısı yönetimi', suggestedPermission: 'navigation.read' },
  { path: '/admin/slas', name: 'SLA Yönetimi', description: 'Service Level Agreement yönetimi', suggestedPermission: 'sla.read' },
  { path: '/admin/ticket-categories', name: 'Ticket Kategorileri', description: 'Ticket kategori yönetimi', suggestedPermission: 'ticket.category.read' },
  { path: '/admin/email', name: 'Email Yönetimi', description: 'Email ayarları ve logları', suggestedPermission: 'email.settings.read' },
  { path: '/admin/2fa', name: '2FA Yönetimi', description: 'Kullanıcı 2FA durumu yönetimi', suggestedPermission: 'user.read' },
  { path: '/admin/lockout', name: 'Hesap Kilitleme', description: 'Kilitli hesapları ve IP adreslerini yönetme', suggestedPermission: 'lockout.read' },
  { path: '/admin/quarantine', name: 'Dosya Karantinası', description: 'Karantinaya alınmış dosyaları yönetme', suggestedPermission: 'quarantine.read' },
  { path: '/admin/api-keys', name: 'API Key Yönetimi', description: 'API key oluşturma ve yönetimi', suggestedPermission: 'apikey.read' },
  { path: '/admin/validation', name: 'Input Validation', description: 'Input validation ve sanitization ayarları', suggestedPermission: 'validation.read' },
  { path: '/admin/compliance', name: 'Compliance & Audit', description: 'GDPR uyumluluğu, audit log yönetimi ve compliance raporları', suggestedPermission: 'audit.read' }
];

// Route listesini getir
navigationRouter.get('/routes', requireAuth, (_req, res) => {
  return res.json({ routes: SYSTEM_ROUTES });
});

// Public endpoint - sidebar için navigasyon verisi
navigationRouter.get('/', requireAuth, async (_req, res) => {
  const sections = await prisma.navSection.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
    include: {
      items: {
        where: { isActive: true },
        orderBy: { order: 'asc' }
      }
    }
  });

  const standaloneItems = await prisma.navItem.findMany({
    where: { isActive: true, sectionId: null },
    orderBy: { order: 'asc' }
  });

  return res.json({ sections, standaloneItems });
});

// Admin endpoints
navigationRouter.get('/admin/sections', requireAuth, requirePermission('navigation.read'), async (_req, res) => {
  const sections = await prisma.navSection.findMany({
    orderBy: { order: 'asc' },
    include: {
      items: { orderBy: { order: 'asc' } },
      _count: { select: { items: true } }
    }
  });
  return res.json({ sections });
});

navigationRouter.get('/admin/items', requireAuth, requirePermission('navigation.read'), async (_req, res) => {
  const items = await prisma.navItem.findMany({
    orderBy: { order: 'asc' },
    include: {
      section: { select: { id: true, name: true } }
    }
  });
  return res.json({ items });
});

// Section CRUD
const SectionSchema = z.object({
  code: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Kod sadece küçük harf, rakam ve tire içerebilir'),
  name: z.string().min(1),
  icon: z.string().optional().nullable(),
  order: z.number().int().optional(),
  isActive: z.boolean().optional(),
  isCollapsible: z.boolean().optional(),
  defaultOpen: z.boolean().optional()
});

navigationRouter.post('/admin/sections', requireAuth, requirePermission('navigation.manage'), async (req, res) => {
  const body = SectionSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz veri', issues: body.error.issues });

  try {
    const section = await prisma.navSection.create({ data: body.data });
    await audit(req, 'create', 'NavSection', section.id, { name: section.name });
    return res.status(201).json({ section });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Bu kodda bir bölüm zaten mevcut' });
    }
    throw error;
  }
});

navigationRouter.put('/admin/sections/:id', requireAuth, requirePermission('navigation.manage'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const UpdateSchema = SectionSchema.partial().omit({ code: true });
  const body = UpdateSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz veri', issues: body.error.issues });

  const section = await prisma.navSection.update({
    where: { id: params.data.id },
    data: body.data,
    include: { items: { orderBy: { order: 'asc' } } }
  });

  await audit(req, 'update', 'NavSection', section.id, body.data);
  return res.json({ section });
});

navigationRouter.delete('/admin/sections/:id', requireAuth, requirePermission('navigation.manage'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  // Items'ları standalone yap
  await prisma.navItem.updateMany({
    where: { sectionId: params.data.id },
    data: { sectionId: null }
  });

  await prisma.navSection.delete({ where: { id: params.data.id } });
  await audit(req, 'delete', 'NavSection', params.data.id, {});
  return res.status(204).send();
});

// Item CRUD
const ItemSchema = z.object({
  code: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Kod sadece küçük harf, rakam ve tire içerebilir'),
  name: z.string().min(1),
  path: z.string().min(1),
  icon: z.string().optional().nullable(),
  permission: z.string().optional().nullable(),
  order: z.number().int().optional(),
  isActive: z.boolean().optional(),
  sectionId: z.string().optional().nullable()
});

navigationRouter.post('/admin/items', requireAuth, requirePermission('navigation.manage'), async (req, res) => {
  const body = ItemSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz veri', issues: body.error.issues });

  try {
    const item = await prisma.navItem.create({
      data: body.data,
      include: { section: { select: { id: true, name: true } } }
    });
    await audit(req, 'create', 'NavItem', item.id, { name: item.name, path: item.path });
    return res.status(201).json({ item });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Bu kodda bir öğe zaten mevcut' });
    }
    throw error;
  }
});

navigationRouter.put('/admin/items/:id', requireAuth, requirePermission('navigation.manage'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const UpdateSchema = ItemSchema.partial().omit({ code: true });
  const body = UpdateSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz veri', issues: body.error.issues });

  const item = await prisma.navItem.update({
    where: { id: params.data.id },
    data: body.data,
    include: { section: { select: { id: true, name: true } } }
  });

  await audit(req, 'update', 'NavItem', item.id, body.data);
  return res.json({ item });
});

navigationRouter.delete('/admin/items/:id', requireAuth, requirePermission('navigation.manage'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  await prisma.navItem.delete({ where: { id: params.data.id } });
  await audit(req, 'delete', 'NavItem', params.data.id, {});
  return res.status(204).send();
});

// Sıralama güncelleme
navigationRouter.put('/admin/reorder', requireAuth, requirePermission('navigation.manage'), async (req, res) => {
  const Body = z.object({
    sections: z.array(z.object({ id: z.string(), order: z.number() })).optional(),
    items: z.array(z.object({ id: z.string(), order: z.number(), sectionId: z.string().nullable() })).optional()
  });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz veri' });

  // Sections sıralaması
  if (body.data.sections) {
    for (const s of body.data.sections) {
      await prisma.navSection.update({
        where: { id: s.id },
        data: { order: s.order }
      });
    }
  }

  // Items sıralaması ve section atama
  if (body.data.items) {
    for (const i of body.data.items) {
      await prisma.navItem.update({
        where: { id: i.id },
        data: { order: i.order, sectionId: i.sectionId }
      });
    }
  }

  await audit(req, 'update', 'Navigation', 'reorder', { sections: body.data.sections?.length, items: body.data.items?.length });
  return res.json({ success: true });
});

