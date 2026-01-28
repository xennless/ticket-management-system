import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import * as XLSX from 'xlsx';

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

// Rapor tipleri ve kolonları
const REPORT_TYPES = {
  user: {
    label: 'Kullanıcı Raporu',
    columns: [
      { key: 'email', label: 'Email' },
      { key: 'name', label: 'İsim' },
      { key: 'isActive', label: 'Aktif' },
      { key: 'createdAt', label: 'Oluşturulma' },
      { key: 'lastLoginAt', label: 'Son Giriş' }
    ]
  },
  role: {
    label: 'Rol Raporu',
    columns: [
      { key: 'code', label: 'Kod' },
      { key: 'name', label: 'Rol Adı' },
      { key: 'label', label: 'Etiket' },
      { key: '_count.users', label: 'Kullanıcı Sayısı' },
      { key: 'createdAt', label: 'Oluşturulma' }
    ]
  },
  activity: {
    label: 'Aktivite Raporu',
    columns: [
      { key: 'action', label: 'Aksiyon' },
      { key: 'entity', label: 'Varlık' },
      { key: 'entityId', label: 'Varlık ID' },
      { key: 'user.email', label: 'Kullanıcı' },
      { key: 'createdAt', label: 'Tarih' }
    ]
  },
  ticket: {
    label: 'Ticket Raporu',
    columns: [
      { key: 'key', label: 'Ticket No' },
      { key: 'title', label: 'Başlık' },
      { key: 'status', label: 'Durum' },
      { key: 'priority', label: 'Öncelik' },
      { key: 'category.name', label: 'Kategori' },
      { key: 'assignedTo.name', label: 'Atanan' },
      { key: 'createdBy.name', label: 'Oluşturan' },
      { key: 'createdAt', label: 'Oluşturulma' },
      { key: 'resolvedAt', label: 'Çözüm Tarihi' }
    ]
  },
  ticketStats: {
    label: 'Ticket İstatistikleri',
    columns: [
      { key: 'status', label: 'Durum' },
      { key: 'count', label: 'Adet' },
      { key: 'percentage', label: 'Yüzde' }
    ]
  }
};

// Yardımcı: Tarih filtresi oluştur
function buildDateFilter(startDate?: string, endDate?: string): any {
  const dateFilter: any = {};
  if (startDate) {
    dateFilter.gte = new Date(startDate);
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }
  return Object.keys(dateFilter).length > 0 ? dateFilter : null;
}

// Yardımcı: Nested değer alma
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

// Yardımcı: Değeri formatlama
function formatValue(value: any, key: string): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
  if (value instanceof Date) return value.toLocaleString('tr-TR');
  if (typeof value === 'string' && key.includes('At')) {
    try {
      return new Date(value).toLocaleString('tr-TR');
    } catch {
      return value;
    }
  }
  if (typeof value === 'number' && key === 'percentage') return `%${value.toFixed(1)}`;
  return String(value);
}

// Rapor tipleri listesi
reportsRouter.get('/types', requirePermission('report.read'), async (_req, res) => {
  const types = Object.entries(REPORT_TYPES).map(([key, value]) => ({
    value: key,
    label: value.label,
    columns: value.columns
  }));
  return res.json({ types });
});

// Rapor çalıştır (tip bazlı)
reportsRouter.get('/run/:type', requirePermission('report.read'), async (req, res) => {
  const Params = z.object({ 
    type: z.enum(['user', 'role', 'activity', 'ticket', 'ticketStats']) 
  });
  const Query = z.object({
    page: z.coerce.number().optional().default(1),
    pageSize: z.coerce.number().optional().default(50),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional()
  });

  const params = Params.safeParse(req.params);
  const query = Query.safeParse(req.query);
  
  if (!params.success) {
    return res.status(400).json({ message: 'Geçersiz rapor tipi' });
  }

  const type = params.data.type;
  const filters = query.success ? query.data : { page: 1, pageSize: 50 };
  const skip = (filters.page - 1) * filters.pageSize;

  let data: any[] = [];
  let total = 0;
  const columns = REPORT_TYPES[type]?.columns || [];

  // Tarih filtresi
  const dateFilter = buildDateFilter(filters.startDate, filters.endDate);

  if (type === 'user') {
    const where: any = { deletedAt: null };
    if (dateFilter) where.createdAt = dateFilter;

    [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.pageSize
      }),
      prisma.user.count({ where })
    ]);
  } else if (type === 'role') {
    [data, total] = await Promise.all([
      prisma.role.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          label: true,
          createdAt: true,
          _count: { select: { users: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.pageSize
      }),
      prisma.role.count()
    ]);
  } else if (type === 'activity') {
    const where: any = {};
    if (dateFilter) where.createdAt = dateFilter;

    [data, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          createdAt: true,
          user: { select: { email: true, name: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.pageSize
      }),
      prisma.activityLog.count({ where })
    ]);
  } else if (type === 'ticket') {
    const where: any = {};
    if (dateFilter) where.createdAt = dateFilter;
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;

    [data, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        select: {
          id: true,
          key: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
          resolvedAt: true,
          category: { select: { name: true } },
          assignedTo: { select: { name: true, email: true } },
          createdBy: { select: { name: true, email: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.pageSize
      }),
      prisma.ticket.count({ where })
    ]);
  } else if (type === 'ticketStats') {
    // Ticket istatistikleri - tarih filtreli
    const where: any = {};
    if (dateFilter) where.createdAt = dateFilter;

    const stats = await prisma.ticket.groupBy({
      by: ['status'],
      where,
      _count: { status: true }
    });

    const totalTickets = stats.reduce((sum, s) => sum + s._count.status, 0);

    data = stats.map((s) => ({
      status: s.status,
      count: s._count.status,
      percentage: totalTickets > 0 ? (s._count.status / totalTickets) * 100 : 0
    }));
    total = data.length;
  }

  return res.json({
    data,
    columns,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.ceil(total / filters.pageSize),
    report: {
      id: type,
      name: REPORT_TYPES[type]?.label || type,
      type: type
    }
  });
});

// Rapor export (CSV) - tip bazlı
reportsRouter.get('/export/:type/csv', requirePermission('report.read'), async (req, res) => {
  const Params = z.object({ 
    type: z.enum(['user', 'role', 'activity', 'ticket', 'ticketStats']) 
  });
  const Query = z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional()
  });

  const params = Params.safeParse(req.params);
  const query = Query.safeParse(req.query);
  
  if (!params.success) {
    return res.status(400).json({ message: 'Geçersiz rapor tipi' });
  }

  const type = params.data.type;
  const filters = query.success ? query.data : {};
  const reportConfig = REPORT_TYPES[type];
  
  if (!reportConfig) {
    return res.status(404).json({ message: 'Rapor tipi bulunamadı' });
  }

  // Tüm veriyi çek (sayfalama yok)
  const allData = await fetchAllReportData(type, filters.startDate, filters.endDate);
  const columns = reportConfig.columns;

  // CSV oluştur
  const headers = columns.map((c) => c.label);
  const rows = allData.map((row) =>
    columns.map((col) => formatValue(getNestedValue(row, col.key), col.key))
  );

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `${reportConfig.label.replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ\s]/g, '')}-${timestamp}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
  return res.send('\ufeff' + csvContent); // BOM for Excel UTF-8 support
});

// Rapor export (Excel) - tip bazlı
reportsRouter.get('/export/:type/excel', requirePermission('report.read'), async (req, res) => {
  const Params = z.object({ 
    type: z.enum(['user', 'role', 'activity', 'ticket', 'ticketStats']) 
  });
  const Query = z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional()
  });

  const params = Params.safeParse(req.params);
  const query = Query.safeParse(req.query);
  
  if (!params.success) {
    return res.status(400).json({ message: 'Geçersiz rapor tipi' });
  }

  const type = params.data.type;
  const filters = query.success ? query.data : {};
  const reportConfig = REPORT_TYPES[type];
  
  if (!reportConfig) {
    return res.status(404).json({ message: 'Rapor tipi bulunamadı' });
  }

  // Tüm veriyi çek
  const allData = await fetchAllReportData(type, filters.startDate, filters.endDate);
  const columns = reportConfig.columns;

  // Excel oluştur
  const headers = columns.map((c) => c.label);
  const rows = allData.map((row) =>
    columns.map((col) => formatValue(getNestedValue(row, col.key), col.key))
  );

  const worksheetData = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  
  // Kolon genişliklerini ayarla
  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map((r) => String(r[i] || '').length)
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, reportConfig.label.slice(0, 31));

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `${reportConfig.label.replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ\s]/g, '')}-${timestamp}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
  return res.send(buffer);
});

// Yardımcı: Tüm rapor verisini çek (tarih filtreli)
async function fetchAllReportData(type: string, startDate?: string, endDate?: string): Promise<any[]> {
  const dateFilter = buildDateFilter(startDate, endDate);

  if (type === 'user') {
    const where: any = { deletedAt: null };
    if (dateFilter) where.createdAt = dateFilter;

    return prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
  } else if (type === 'role') {
    return prisma.role.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        label: true,
        createdAt: true,
        _count: { select: { users: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  } else if (type === 'activity') {
    const where: any = {};
    if (dateFilter) where.createdAt = dateFilter;

    return prisma.activityLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        createdAt: true,
        user: { select: { email: true, name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 10000 // Aktivite için limit
    });
  } else if (type === 'ticket') {
    const where: any = {};
    if (dateFilter) where.createdAt = dateFilter;

    return prisma.ticket.findMany({
      where,
      select: {
        id: true,
        key: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
        resolvedAt: true,
        category: { select: { name: true } },
        assignedTo: { select: { name: true, email: true } },
        createdBy: { select: { name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  } else if (type === 'ticketStats') {
    const where: any = {};
    if (dateFilter) where.createdAt = dateFilter;

    const stats = await prisma.ticket.groupBy({
      by: ['status'],
      where,
      _count: { status: true }
    });
    const totalTickets = stats.reduce((sum, s) => sum + s._count.status, 0);
    return stats.map((s) => ({
      status: s.status,
      count: s._count.status,
      percentage: totalTickets > 0 ? (s._count.status / totalTickets) * 100 : 0
    }));
  }
  return [];
}
