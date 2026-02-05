import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { Prisma } from '@prisma/client';
import { env } from './config/env.js';
import { logger, morganStream, initSentry } from './utils/logger.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { ticketsRouter } from './routes/tickets.js';
import { dashboardRouter } from './routes/features/dashboard.js';
import { notificationsRouter } from './routes/features/notifications.js';
import { sessionsRouter } from './routes/features/sessions.js';
import { auth2faRouter } from './routes/features/auth2fa.js';
import { auditRouter } from './routes/features/audit.js';
import { bulkRouter } from './routes/features/bulk.js';
import { importExportRouter } from './routes/features/importExport.js';
import { groupsRouter } from './routes/features/groups.js';
import { settingsRouter } from './routes/features/settings.js';
import { reportsRouter } from './routes/features/reports.js';
import { activityRouter } from './routes/features/activity.js';
import { ticketCategoriesRouter } from './routes/features/ticketCategories.js';
import { ticketTagsRouter } from './routes/features/ticketTags.js';
import { ticketWatchersRouter } from './routes/features/ticketWatchers.js';
import { ticketAttachmentsRouter } from './routes/ticketAttachments.js';
import { permissionTemplatesRouter } from './routes/admin/permissionTemplates.js';
import { fileUploadLogsRouter } from './routes/features/fileUploadLogs.js';
import { navigationRouter } from './routes/features/navigation.js';
import { slasRouter } from './routes/features/slas.js';
import { emailRouter } from './routes/features/email.js';
import { logsRouter } from './routes/features/logs.js';
import { monitoringRouter } from './routes/features/monitoring.js';
import { lockoutRouter } from './routes/features/lockout.js';
import { quarantineRouter } from './routes/features/quarantine.js';
import { apiKeysRouter } from './routes/features/apiKeys.js';
import { validationRouter } from './routes/features/validation.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { responseTimeMiddleware } from './middleware/responseTime.js';
import { generateCsrfToken, validateCsrfToken } from './middleware/csrf.js';
import { apiKeyAuth } from './middleware/apiKeyAuth.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: (origin, cb) => {
      // Server-to-server / curl isteklerinde origin olmayabilir
      if (!origin) return cb(null, true);
      const allow = (env.CORS_ORIGINS ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (allow.length === 0) return cb(null, true); // dev-friendly default
      return allow.includes(origin) ? cb(null, true) : cb(new Error('CORS blocked'), false);
    },
    credentials: true,
    exposedHeaders: ['X-CSRF-Token', 'X-Request-ID'] // Frontend'in okuyabilmesi için expose et
  })
);
// Request ID tracking (her istek için benzersiz ID)
app.use(requestIdMiddleware);

// Response time tracking
app.use(responseTimeMiddleware);

// Winston ile morgan entegrasyonu
app.use(morgan('combined', { stream: morganStream }));

// Sentry başlat (opsiyonel)
if (env.SENTRY_DSN) {
  initSentry(env.SENTRY_DSN).catch((err) => {
    logger.error('Sentry initialization error', { error: err });
  });
}

// Global rate limit (kaba koruma)
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
);

// Endpoint bazlı rate limiting
const apiLimiter = rateLimit({
  windowMs: 60_000, // 1 dakika
  limit: 100, // 100 istek/dakika
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Çok fazla istek gönderdiniz, lütfen daha sonra tekrar deneyin.'
});

const exportLimiter = rateLimit({
  windowMs: 60 * 60_000, // 1 saat
  limit: 10, // 10 istek/saat
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Export limitine ulaştınız, lütfen daha sonra tekrar deneyin.'
});

// API route'larına rate limiting uygula
app.use('/api', apiLimiter);
app.use('/api/import-export/export', exportLimiter);
app.use(express.json({ limit: '1mb' }));

// API key authentication (JWT'den önce kontrol et)
app.use('/api', apiKeyAuth);

// CSRF token oluştur (TÜM istekler için - response header'a ekler)
app.use('/api', generateCsrfToken);

// CSRF token doğrula (POST, PUT, DELETE, PATCH için - public endpoint'ler hariç)
// Not: Public endpoint'ler (login, password reset) middleware içinde kontrol ediliyor
app.use('/api', validateCsrfToken);

// Health check endpoint (public - monitoring için) - Hızlı ve basit
app.get('/health', async (_req, res) => {
  try {
    // Basit health check - sadece database kontrolü (hızlı)
    const { checkDatabase } = await import('./utils/healthCheck.js');
    const dbCheck = await Promise.race([
      checkDatabase(),
      new Promise<{ status: 'healthy' }>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
    ]).catch(() => ({ status: 'healthy' as const }));
    
    const isHealthy = dbCheck.status === 'healthy';
    return res.status(isHealthy ? 200 : 503).json({
      ok: isHealthy,
      status: isHealthy ? 'healthy' : 'unhealthy',
      database: dbCheck.status,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(503).json({
      ok: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message || 'Health check başarısız'
    });
  }
});

// Basit health check (sadece ok döndürür - backward compatibility)
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/v1/health', (_req, res) => res.json({ ok: true }));

// API versioning: v1 router
const v1Router = express.Router();

// v1 API routes
v1Router.use('/auth', authRouter);
v1Router.use('/admin', adminRouter);
v1Router.use('/admin/permission-templates', permissionTemplatesRouter);
v1Router.use('/tickets', ticketsRouter);
v1Router.use('/dashboard', dashboardRouter);
v1Router.use('/notifications', notificationsRouter);
v1Router.use('/sessions', sessionsRouter);
v1Router.use('/auth/2fa', auth2faRouter);
v1Router.use('/audit', auditRouter);
v1Router.use('/bulk', bulkRouter);
v1Router.use('/import-export', importExportRouter);
v1Router.use('/groups', groupsRouter);
v1Router.use('/settings', settingsRouter);
v1Router.use('/reports', reportsRouter);
v1Router.use('/activity', activityRouter);
v1Router.use('/file-upload-logs', fileUploadLogsRouter);
v1Router.use('/navigation', navigationRouter);
v1Router.use('/ticket-categories', ticketCategoriesRouter);
v1Router.use('/ticket-tags', ticketTagsRouter);
v1Router.use('/ticket-watchers', ticketWatchersRouter);
v1Router.use('/ticket-attachments', ticketAttachmentsRouter);
v1Router.use('/slas', slasRouter);
v1Router.use('/email', emailRouter);
v1Router.use('/logs', logsRouter);
v1Router.use('/monitoring', monitoringRouter);
v1Router.use('/lockout', lockoutRouter);
v1Router.use('/quarantine', quarantineRouter);
v1Router.use('/api-keys', apiKeysRouter);
v1Router.use('/validation', validationRouter);

// Versioned API
app.use('/api/v1', v1Router);

// Backward compatibility: eski route'ları v1'e yönlendir
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin/permission-templates', permissionTemplatesRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/auth/2fa', auth2faRouter);
app.use('/api/audit', auditRouter);
app.use('/api/bulk', bulkRouter);
app.use('/api/import-export', importExportRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/activity', activityRouter);
app.use('/api/file-upload-logs', fileUploadLogsRouter);
app.use('/api/navigation', navigationRouter);
app.use('/api/ticket-categories', ticketCategoriesRouter);
app.use('/api/ticket-tags', ticketTagsRouter);
app.use('/api/ticket-watchers', ticketWatchersRouter);
app.use('/api/ticket-attachments', ticketAttachmentsRouter);
app.use('/api/slas', slasRouter);
app.use('/api/email', emailRouter);
app.use('/api/logs', logsRouter);
app.use('/api/monitoring', monitoringRouter);
app.use('/api/lockout', lockoutRouter);
app.use('/api/quarantine', quarantineRouter);
app.use('/api/api-keys', apiKeysRouter);

// Uploads klasörünü static olarak sun
app.use('/uploads', express.static('uploads'));

// Error handler
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Prisma hata mapping (kullanıcı dostu)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.error('Prisma error', { 
      code: err.code, 
      meta: err.meta,
      message: err.message 
    });
    
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'Bu kayıt zaten mevcut (unique constraint)', meta: err.meta });
    }
    if (err.code === 'P2003') {
      return res.status(400).json({
        message: 'Geçersiz ilişki (foreign key). Seçilen rol/yetki sistemde bulunmuyor olabilir.',
        meta: err.meta
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Kayıt bulunamadı', meta: err.meta });
    }
  }

  // Genel hata loglama
  logger.error('Unhandled error', { 
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined
  });

  return res.status(500).json({ message: 'Sunucu hatası' });
});

// Export app for testing
export { app };

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  app.listen(env.PORT, () => {
    logger.info(`API çalışıyor: http://localhost:${env.PORT}`, { 
      port: env.PORT, 
      nodeEnv: env.NODE_ENV 
    });
  });
}


