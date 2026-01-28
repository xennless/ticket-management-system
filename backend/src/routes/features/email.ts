import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { requireTwoFactor } from '../../middleware/requireTwoFactor.js';
import { sendEmail, loadEmailConfig, emailTemplates, clearEmailCache } from '../../utils/email.js';

export const emailRouter = Router();

emailRouter.use(requireAuth);
// Email ayarları kritik, 2FA zorunlu
emailRouter.use(requireTwoFactor);

// Email ayarlarını getir
emailRouter.get('/settings', requirePermission('email.settings.read'), async (_req, res) => {
  // SystemSettings'ten direkt oku (cache kullanmadan)
  const settings = await prisma.systemSettings.findMany({
    where: {
      key: {
        in: ['emailEnabled', 'emailHost', 'emailPort', 'emailSecure', 'emailUser', 'emailPassword', 'emailFrom']
      }
    }
  });

  const hasAnySettings = settings.length > 0;
  if (!hasAnySettings) {
    return res.json({
      enabled: false,
      host: '',
      port: 587,
      secure: false,
      user: '',
      from: '',
      configured: false
    });
  }

  const settingsMap: Record<string, any> = {};
  settings.forEach((s) => {
    settingsMap[s.key] = s.value;
  });

  // EmailEnabled false ise ve diğer ayarlar yoksa configured: false döndür
  if (settingsMap.emailEnabled !== true || !settingsMap.emailHost || !settingsMap.emailUser) {
    return res.json({
      enabled: false,
      host: settingsMap.emailHost || '',
      port: settingsMap.emailPort || 587,
      secure: settingsMap.emailSecure === true,
      user: settingsMap.emailUser || '',
      from: settingsMap.emailFrom || settingsMap.emailUser || '',
      configured: false
    });
  }

  return res.json({
    enabled: settingsMap.emailEnabled === true,
    host: settingsMap.emailHost || '',
    port: settingsMap.emailPort || 587,
    secure: settingsMap.emailSecure === true,
    user: settingsMap.emailUser || '',
    from: settingsMap.emailFrom || settingsMap.emailUser || '',
    configured: true
  });
});

// Email ayarlarını test et
emailRouter.post('/settings/test', requirePermission('email.settings.manage'), async (req, res) => {
  const Body = z.object({
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    secure: z.boolean(),
    user: z.string().min(1),
    password: z.string().min(1),
    from: z.string().min(1)
  });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  // Geçici transporter ile test et
  const nodemailer = (await import('nodemailer')).default;
  const testTransporter = nodemailer.createTransport({
    host: body.data.host,
    port: body.data.port,
    secure: body.data.secure,
    auth: {
      user: body.data.user,
      pass: body.data.password
    }
  });

  try {
    await testTransporter.verify();
    return res.json({ success: true, message: 'SMTP bağlantısı başarılı' });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || 'SMTP bağlantısı başarısız' });
  }
});

// Email ayarlarını güncelle
emailRouter.put('/settings', requirePermission('email.settings.manage'), async (req, res) => {
  const userId = req.userId!;
  const Body = z.object({
    enabled: z.boolean().optional(),
    host: z.string().optional(),
    port: z.number().int().min(1).max(65535).optional(),
    secure: z.boolean().optional(),
    user: z.string().optional(),
    password: z.string().optional(),
    from: z.string().optional()
  });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  const updates = [];
  const keyMap: Record<string, string> = {
    enabled: 'emailEnabled',
    host: 'emailHost',
    port: 'emailPort',
    secure: 'emailSecure',
    user: 'emailUser',
    password: 'emailPassword',
    from: 'emailFrom'
  };

  for (const [key, value] of Object.entries(body.data)) {
    if (value !== undefined) {
      const dbKey = keyMap[key] || `email${key.charAt(0).toUpperCase() + key.slice(1)}`;
      updates.push(
        prisma.systemSettings.upsert({
          where: { key: dbKey },
          update: { value: value as any, updatedById: userId },
          create: {
            key: dbKey,
            value: value as any,
            category: 'email',
            updatedById: userId
          }
        })
      );
    }
  }

  await Promise.all(updates);
  
  // Email cache'ini temizle (yeni ayarlar kullanılacak)
  clearEmailCache();
  // Settings cache'ini de temizle
  const { clearSettingsCache } = await import('../../utils/settings.js');
  clearSettingsCache();
  
  return res.json({ success: true });
});

// Test emaili gönder
emailRouter.post('/test', requirePermission('email.send'), async (req, res) => {
  const userId = req.userId!;
  const Body = z.object({
    to: z.string().email(),
    subject: z.string().optional(),
    body: z.string().optional()
  });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  const result = await sendEmail({
    to: body.data.to,
    subject: body.data.subject || 'Test Email',
    html: body.data.body || '<p>Bu bir test emailidir.</p>',
    userId
  });

  if (result.success) {
    return res.json({ success: true, message: 'Test emaili başarıyla gönderildi', messageId: result.messageId });
  } else {
    return res.status(500).json({ success: false, message: result.error || 'Email gönderilemedi' });
  }
});

// Email logları
emailRouter.get('/logs', requirePermission('email.logs.read'), async (req, res) => {
  // Query parametrelerini manuel olarak işle (boş string'leri filtrele)
  const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
  const pageSize = req.query.pageSize ? parseInt(String(req.query.pageSize), 10) : 20;
  const statusParam = req.query.status;
  const toParam = req.query.to;
  const typeParam = req.query.type;

  // Validation
  if (isNaN(page) || page < 1) {
    return res.status(400).json({ message: 'Geçersiz page parametresi' });
  }
  if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
    return res.status(400).json({ message: 'Geçersiz pageSize parametresi' });
  }

  // Status kontrolü - boş string veya geçersiz değerleri filtrele
  let status: 'PENDING' | 'SENT' | 'FAILED' | undefined = undefined;
  if (statusParam && typeof statusParam === 'string' && statusParam.trim() !== '') {
    const statusVal = statusParam.trim();
    if (['PENDING', 'SENT', 'FAILED'].includes(statusVal)) {
      status = statusVal as 'PENDING' | 'SENT' | 'FAILED';
    }
  }

  // To kontrolü - boş string'leri filtrele
  let to: string | undefined = undefined;
  if (toParam && typeof toParam === 'string' && toParam.trim() !== '') {
    to = toParam.trim();
  }

  // Type kontrolü - boş string'leri filtrele
  let emailType: string | undefined = undefined;
  if (typeParam && typeof typeParam === 'string' && typeParam.trim() !== '') {
    emailType = typeParam.trim();
  }

  const skip = (page - 1) * pageSize;

  const where: any = {};
  if (status) where.status = status;
  if (to) where.to = { contains: to, mode: 'insensitive' };
  
  // Type filtresi - metadata.type'a göre
  if (emailType) {
    if (emailType === 'other') {
      // Diğer: metadata yok veya type yok veya bilinmeyen type'lar
      where.OR = [
        { metadata: null },
        {
          AND: [
            { metadata: { not: null } },
            {
              NOT: {
                OR: [
                  { metadata: { path: ['type'], equals: 'ticket' } },
                  { metadata: { path: ['type'], equals: 'password-reset' } },
                  { metadata: { path: ['type'], equals: 'password-changed' } },
                  { metadata: { path: ['type'], equals: '2fa-email-code' } },
                  { metadata: { path: ['type'], equals: 'test' } }
                ]
              }
            }
          ]
        }
      ];
    } else {
      // Belirli bir type
      where.metadata = {
        path: ['type'],
        equals: emailType
      };
    }
  }

  const [total, logs] = await Promise.all([
    prisma.emailLog.count({ where }),
    prisma.emailLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true } }
      }
    })
  ]);

  return res.json({ page, pageSize, total, logs });
});

// Email log detayı
emailRouter.get('/logs/:id', requirePermission('email.logs.read'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const log = await prisma.emailLog.findUnique({
    where: { id: params.data.id },
    include: {
      user: { select: { id: true, email: true, name: true } }
    }
  });

  if (!log) return res.status(404).json({ message: 'Log bulunamadı' });

  return res.json({ log });
});

// Email istatistikleri
emailRouter.get('/stats', requirePermission('email.logs.read'), async (_req, res) => {
  const [total, sent, failed, pending] = await Promise.all([
    prisma.emailLog.count(),
    prisma.emailLog.count({ where: { status: 'SENT' } }),
    prisma.emailLog.count({ where: { status: 'FAILED' } }),
    prisma.emailLog.count({ where: { status: 'PENDING' } })
  ]);

  return res.json({
    total,
    sent,
    failed,
    pending,
    successRate: total > 0 ? ((sent / total) * 100).toFixed(2) : 0
  });
});

// Email şablonlarını listele
emailRouter.get('/templates', requirePermission('email.settings.read'), async (_req, res) => {
  const templates = await prisma.emailTemplate.findMany({
    orderBy: { name: 'asc' },
    include: {
      updatedBy: { select: { id: true, email: true, name: true } }
    }
  });

  return res.json({ templates });
});

// Email şablonu getir
emailRouter.get('/templates/:code', requirePermission('email.settings.read'), async (req, res) => {
  const Params = z.object({ code: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const template = await prisma.emailTemplate.findUnique({
    where: { code: params.data.code },
    include: {
      updatedBy: { select: { id: true, email: true, name: true } }
    }
  });

  if (!template) return res.status(404).json({ message: 'Şablon bulunamadı' });

  return res.json({ template });
});

// Email şablonu oluştur
emailRouter.post('/templates', requirePermission('email.settings.manage'), async (req, res) => {
  const userId = req.userId!;
  const Body = z.object({
    code: z.string().min(1).regex(/^[a-z0-9-_]+$/, 'Kod sadece küçük harf, rakam, tire ve alt çizgi içerebilir'),
    name: z.string().min(1),
    description: z.string().optional().nullable(),
    subject: z.string().min(1),
    html: z.string().min(1),
    text: z.string().optional().nullable(),
    variables: z.record(z.string()).optional().nullable()
  });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  // Kod zaten var mı kontrol et
  const existing = await prisma.emailTemplate.findUnique({
    where: { code: body.data.code }
  });
  if (existing) return res.status(400).json({ message: 'Bu kod zaten kullanılıyor' });

  const template = await prisma.emailTemplate.create({
    data: {
      ...body.data,
      updatedById: userId
    },
    include: {
      updatedBy: { select: { id: true, email: true, name: true } }
    }
  });

  return res.status(201).json({ template });
});

// Email şablonu güncelle
emailRouter.put('/templates/:code', requirePermission('email.settings.manage'), async (req, res) => {
  const userId = req.userId!;
  const Params = z.object({ code: z.string().min(1) });
  const Body = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    subject: z.string().min(1).optional(),
    html: z.string().min(1).optional(),
    text: z.string().optional().nullable(),
    variables: z.record(z.string()).optional().nullable(),
    isActive: z.boolean().optional()
  });
  const params = Params.safeParse(req.params);
  const body = Body.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error?.issues });

  const existing = await prisma.emailTemplate.findUnique({
    where: { code: params.data.code },
    select: { isSystem: true }
  });
  if (!existing) return res.status(404).json({ message: 'Şablon bulunamadı' });

  const template = await prisma.emailTemplate.update({
    where: { code: params.data.code },
    data: {
      ...body.data,
      updatedById: userId
    },
    include: {
      updatedBy: { select: { id: true, email: true, name: true } }
    }
  });

  return res.json({ template });
});

// Global email değişkenlerini getir
emailRouter.get('/variables', requirePermission('email.settings.read'), async (_req, res) => {
  // Sistem değişkenleri
  const systemVariables = {
    year: 'Mevcut yıl (örn: 2025)',
    currentYear: 'Mevcut yıl (örn: 2025)',
    companyName: 'Şirket adı (Ayarlar sayfasından ayarlanır)',
    company: 'Şirket adı (Ayarlar sayfasından ayarlanır)'
  };

  // Veritabanından global değişkenleri al
  const globalVariablesSetting = await prisma.systemSettings.findUnique({
    where: { key: 'emailTemplateVariables' }
  });

  const globalVariables = globalVariablesSetting?.value as Record<string, string> | null || {};

  // Tüm template'lerden değişkenleri topla
  const templates = await prisma.emailTemplate.findMany({
    select: { variables: true }
  });

  const templateVariables: Record<string, string> = {};
  templates.forEach(template => {
    if (template.variables && typeof template.variables === 'object') {
      Object.assign(templateVariables, template.variables as Record<string, string>);
    }
  });

  // Birleştir: sistem değişkenleri + global değişkenler + template değişkenleri
  const allVariables = {
    ...systemVariables,
    ...globalVariables,
    ...templateVariables
  };

  return res.json({ 
    variables: allVariables,
    globalVariables // Sadece global (düzenlenebilir) değişkenler
  });
});

// Global email değişkenlerini güncelle
emailRouter.put('/variables', requirePermission('email.settings.manage'), async (req, res) => {
  const userId = req.userId!;
  const Body = z.object({
    variables: z.record(z.string()).optional() // { variableName: 'Açıklama' }
  });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  // SystemSettings'te sakla
  await prisma.systemSettings.upsert({
    where: { key: 'emailTemplateVariables' },
    update: { 
      value: body.data.variables || {},
      updatedById: userId,
      category: 'email'
    },
    create: {
      key: 'emailTemplateVariables',
      value: body.data.variables || {},
      category: 'email',
      updatedById: userId
    }
  });

  return res.json({ success: true });
});

// Email şablonu sil
emailRouter.delete('/templates/:code', requirePermission('email.settings.manage'), async (req, res) => {
  const Params = z.object({ code: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const existing = await prisma.emailTemplate.findUnique({
    where: { code: params.data.code },
    select: { isSystem: true }
  });
  if (!existing) return res.status(404).json({ message: 'Şablon bulunamadı' });
  if (existing.isSystem) return res.status(403).json({ message: 'Sistem şablonu silinemez' });

  await prisma.emailTemplate.delete({
    where: { code: params.data.code }
  });

  return res.status(204).send();
});

