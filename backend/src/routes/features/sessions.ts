import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { checkSessionTimeout, cleanupExpiredSessions } from '../../utils/sessionSecurity.js';
import { logger } from '../../utils/logger.js';

export const sessionsRouter = Router();

sessionsRouter.use(requireAuth);

// User-Agent parser helper
function parseUserAgent(userAgent: string | null): {
  browser: string;
  os: string;
  device: string;
} {
  if (!userAgent) {
    return { browser: 'Bilinmiyor', os: 'Bilinmiyor', device: 'Bilinmiyor' };
  }

  // Browser detection
  let browser = 'Bilinmiyor';
  if (userAgent.includes('Firefox')) {
    const match = userAgent.match(/Firefox\/(\d+)/);
    browser = `Firefox ${match?.[1] || ''}`.trim();
  } else if (userAgent.includes('Edg/')) {
    const match = userAgent.match(/Edg\/(\d+)/);
    browser = `Edge ${match?.[1] || ''}`.trim();
  } else if (userAgent.includes('Chrome')) {
    const match = userAgent.match(/Chrome\/(\d+)/);
    browser = `Chrome ${match?.[1] || ''}`.trim();
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    const match = userAgent.match(/Version\/(\d+)/);
    browser = `Safari ${match?.[1] || ''}`.trim();
  } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
    const match = userAgent.match(/(?:Opera|OPR)\/(\d+)/);
    browser = `Opera ${match?.[1] || ''}`.trim();
  }

  // OS detection
  let os = 'Bilinmiyor';
  if (userAgent.includes('Windows NT 10')) os = 'Windows 10/11';
  else if (userAgent.includes('Windows NT 6.3')) os = 'Windows 8.1';
  else if (userAgent.includes('Windows NT 6.2')) os = 'Windows 8';
  else if (userAgent.includes('Windows NT 6.1')) os = 'Windows 7';
  else if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac OS X')) {
    const match = userAgent.match(/Mac OS X (\d+[._]\d+)/);
    os = `macOS ${match?.[1]?.replace('_', '.') || ''}`.trim();
  }
  else if (userAgent.includes('Android')) {
    const match = userAgent.match(/Android (\d+(?:\.\d+)?)/);
    os = `Android ${match?.[1] || ''}`.trim();
  }
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    const match = userAgent.match(/OS (\d+[._]\d+)/);
    os = `iOS ${match?.[1]?.replace('_', '.') || ''}`.trim();
  }
  else if (userAgent.includes('Linux')) os = 'Linux';

  // Device type detection
  let device = 'Masaüstü';
  if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
    device = 'Mobil';
  } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
    device = 'Tablet';
  }

  return { browser, os, device };
}

// Kullanıcının aktif sessionlarını getir
sessionsRouter.get('/', requirePermission('session.read'), async (req, res) => {
  try {
    const userId = req.userId!;
    const currentSessionId = req.sessionId;
    const Query = z.object({
      includeHistory: z.coerce.boolean().optional().default(false) // Geçmiş sessionları da getir
    });
    const query = Query.safeParse(req.query);
    const includeHistory = query.success ? query.data.includeHistory : false;

    // Timeout olan session'ları temizle
    await cleanupExpiredSessions();

    const where: any = {
      userId
    };

    if (!includeHistory) {
      // Sadece aktif sessionlar
      where.expiresAt = { gt: new Date() };
      where.terminatedAt = null;
    }

    const sessions = await prisma.session.findMany({
      where,
      orderBy: { lastActivity: 'desc' },
      select: {
        id: true,
        device: true,
        ip: true,
        userAgent: true,
        location: true,
        lastActivity: true,
        createdAt: true,
        expiresAt: true,
        suspiciousActivity: true,
        suspiciousReason: true,
        terminatedAt: true,
        terminatedReason: true
      }
    });

    const sessionsWithDetails = sessions.map((s) => {
      const parsed = parseUserAgent(s.userAgent);
      const now = new Date();
      const expiresAt = new Date(s.expiresAt);
      const createdAt = new Date(s.createdAt);
      const lastActivity = new Date(s.lastActivity);
      const isActive = !s.terminatedAt && expiresAt > now;
      
      // Session yaşı
      const ageMs = now.getTime() - createdAt.getTime();
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      const ageHours = Math.floor((ageMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      // Kalan süre (sadece aktif sessionlar için)
      let remaining = 'Süresi doldu';
      if (isActive) {
        const remainingMs = expiresAt.getTime() - now.getTime();
        const remainingDays = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
        const remainingHours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        remaining = remainingDays > 0 ? `${remainingDays} gün ${remainingHours} saat` : `${remainingHours} saat`;
      }
      
      // Son aktiviteden bu yana geçen süre
      const inactiveMs = now.getTime() - lastActivity.getTime();
      const inactiveMinutes = Math.floor(inactiveMs / (1000 * 60));
      const inactiveHours = Math.floor(inactiveMinutes / 60);

      // Timeout kontrolü (aktif sessionlar için) - async olmadan
      let timeoutWarning = false;

      return {
        id: s.id,
        current: s.id === currentSessionId,
        active: isActive,
        browser: parsed.browser,
        os: parsed.os,
        deviceType: parsed.device,
        device: s.device || `${parsed.browser} - ${parsed.os}`,
        ip: s.ip || 'Bilinmiyor',
        location: s.location,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        lastActivity: s.lastActivity,
        expiresAt: s.expiresAt,
        suspiciousActivity: s.suspiciousActivity,
        suspiciousReason: s.suspiciousReason,
        terminatedAt: s.terminatedAt,
        terminatedReason: s.terminatedReason,
        age: ageDays > 0 ? `${ageDays} gün ${ageHours} saat` : `${ageHours} saat`,
        remaining,
        inactive: inactiveHours > 0 
          ? `${inactiveHours} saat ${inactiveMinutes % 60} dakika önce` 
          : inactiveMinutes > 0 
            ? `${inactiveMinutes} dakika önce`
            : 'Az önce',
        timeoutWarning
      };
    });

    return res.json({ sessions: sessionsWithDetails });
  } catch (error: any) {
    logger.error('[sessions] Hata', {
      error: error?.message || String(error),
      stack: error?.stack,
      requestId: (req as any).requestId,
      userId: (req as any).userId
    });
    return res.status(500).json({ message: 'Session listesi alınamadı', error: error?.message });
  }
});

// Session iptal et
sessionsRouter.delete('/:id', requirePermission('session.manage'), async (req, res) => {
  const userId = req.userId!;
  const currentSessionId = req.sessionId;
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  // Kendi session'ını silmeye çalışıyorsa engelle
  if (params.data.id === currentSessionId) {
    return res.status(400).json({ message: 'Kendi oturumunuzu bu şekilde sonlandıramazsınız. Lütfen çıkış yapın.' });
  }

  const result = await prisma.session.deleteMany({
    where: { id: params.data.id, userId }
  });

  if (result.count === 0) {
    return res.status(404).json({ message: 'Session bulunamadı' });
  }

  return res.json({ success: true, message: 'Session sonlandırıldı' });
});

// Tüm sessionları iptal et (mevcut hariç)
sessionsRouter.delete('/', requirePermission('session.manage'), async (req, res) => {
  const userId = req.userId!;
  const currentSessionId = req.sessionId;
  
  // Session'ları silmek yerine terminated olarak işaretle (geçmiş için)
  const result = await prisma.session.updateMany({
    where: {
      userId,
      ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
      terminatedAt: null
    },
    data: {
      terminatedAt: new Date(),
      terminatedBy: userId,
      terminatedReason: 'USER_LOGOUT_ALL'
    }
  });

  return res.json({ 
    success: true, 
    message: `${result.count} session sonlandırıldı`,
    count: result.count
  });
});

// Session geçmişi (tüm sessionlar, aktif olmayanlar dahil)
sessionsRouter.get('/history', requirePermission('session.read'), async (req, res) => {
  try {
    const userId = req.userId!;
    const Query = z.object({
      page: z.coerce.number().int().min(1).optional().default(1),
      pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
      status: z.enum(['active', 'expired', 'terminated', 'all']).optional().default('all')
    });
    const query = Query.safeParse(req.query);
    if (!query.success) {
      return res.status(400).json({ message: 'Geçersiz istek', issues: query.error.issues });
    }

    const { page, pageSize, status } = query.data;
    const skip = (page - 1) * pageSize;
    const now = new Date();

    const where: any = { userId };
    
    if (status === 'active') {
      where.expiresAt = { gt: now };
      where.terminatedAt = null;
    } else if (status === 'expired') {
      where.expiresAt = { lte: now };
      where.terminatedAt = null;
    } else if (status === 'terminated') {
      where.terminatedAt = { not: null };
    }

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          device: true,
          ip: true,
          userAgent: true,
          location: true,
          lastActivity: true,
          createdAt: true,
          expiresAt: true,
          suspiciousActivity: true,
          suspiciousReason: true,
          terminatedAt: true,
          terminatedReason: true
        }
      }),
      prisma.session.count({ where })
    ]);

    const sessionsWithDetails = sessions.map((s) => {
      const parsed = parseUserAgent(s.userAgent);
      const expiresAt = new Date(s.expiresAt);
      const createdAt = new Date(s.createdAt);
      const lastActivity = new Date(s.lastActivity);
      const isActive = !s.terminatedAt && expiresAt > now;
      
      const ageMs = now.getTime() - createdAt.getTime();
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      const ageHours = Math.floor((ageMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      return {
        id: s.id,
        active: isActive,
        browser: parsed.browser,
        os: parsed.os,
        deviceType: parsed.device,
        device: s.device || `${parsed.browser} - ${parsed.os}`,
        ip: s.ip || 'Bilinmiyor',
        location: s.location,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        lastActivity: s.lastActivity,
        expiresAt: s.expiresAt,
        suspiciousActivity: s.suspiciousActivity,
        suspiciousReason: s.suspiciousReason,
        terminatedAt: s.terminatedAt,
        terminatedReason: s.terminatedReason,
        age: ageDays > 0 ? `${ageDays} gün ${ageHours} saat` : `${ageHours} saat`,
        status: s.terminatedAt ? 'terminated' : (expiresAt > now ? 'active' : 'expired')
      };
    });

    return res.json({
      sessions: sessionsWithDetails,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error: any) {
    logger.error('[sessions/history] Hata', {
      error: error?.message || String(error),
      stack: error?.stack,
      requestId: (req as any).requestId,
      userId: (req as any).userId
    });
    return res.status(500).json({ message: 'Session geçmişi alınamadı', error: error?.message });
  }
});

// Session timeout durumunu kontrol et
sessionsRouter.get('/timeout-check', requireAuth, async (req, res) => {
  try {
    const sessionId = req.sessionId;
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID bulunamadı' });
    }

    const timeoutCheck = await checkSessionTimeout(sessionId);
    
    return res.json({
      expired: timeoutCheck.expired,
      warning: timeoutCheck.warning,
      remainingSeconds: timeoutCheck.remainingSeconds
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Timeout kontrolü yapılamadı', error: error?.message });
  }
});
