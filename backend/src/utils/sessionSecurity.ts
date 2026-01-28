import { prisma } from '../db/prisma.js';
import { getSystemSetting } from './settings.js';

/**
 * Şüpheli aktivite tespiti
 */
export async function detectSuspiciousActivity(
  userId: string,
  currentIp: string,
  currentUserAgent: string | null
): Promise<{
  suspicious: boolean;
  reason?: string;
}> {
  const suspiciousActivityEnabled = await getSystemSetting<boolean>('sessionSuspiciousActivityEnabled', true);
  
  if (!suspiciousActivityEnabled) {
    return { suspicious: false };
  }

  // Son 24 saatteki session'ları kontrol et
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const recentSessions = await prisma.session.findMany({
    where: {
      userId,
      createdAt: { gte: twentyFourHoursAgo }
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      ip: true,
      userAgent: true,
      createdAt: true
    }
  });

  if (recentSessions.length === 0) {
    return { suspicious: false };
  }

  // IP değişikliği kontrolü
  const uniqueIps = new Set(recentSessions.map(s => s.ip).filter(Boolean));
  if (uniqueIps.size > 3 && !uniqueIps.has(currentIp)) {
    // Son 24 saatte 3'ten fazla farklı IP'den giriş yapılmış ve şu anki IP bunlardan biri değil
    return {
      suspicious: true,
      reason: `Son 24 saatte ${uniqueIps.size} farklı IP adresinden giriş yapıldı. Bu şüpheli bir aktivite olabilir.`
    };
  }

  // User-Agent değişikliği kontrolü (çok farklı cihazlar)
  if (currentUserAgent) {
    const userAgents = recentSessions
      .map(s => s.userAgent)
      .filter(Boolean) as string[];
    
    // User-Agent'lerin benzerliğini kontrol et
    const isSignificantlyDifferent = userAgents.every(ua => {
      // Basit benzerlik kontrolü (browser ve OS bilgisi)
      const currentBrowser = extractBrowser(currentUserAgent);
      const currentOS = extractOS(currentUserAgent);
      const otherBrowser = extractBrowser(ua);
      const otherOS = extractOS(ua);
      
      return currentBrowser !== otherBrowser || currentOS !== otherOS;
    });

    if (isSignificantlyDifferent && userAgents.length > 2) {
      return {
        suspicious: true,
        reason: 'Farklı tarayıcı ve işletim sistemlerinden giriş yapıldı. Bu şüpheli bir aktivite olabilir.'
      };
    }
  }

  // Çok sayıda eşzamanlı session kontrolü
  const maxConcurrent = await getSystemSetting<number>('sessionMaxConcurrent', 10);
  const activeSessions = await prisma.session.count({
    where: {
      userId,
      expiresAt: { gt: new Date() }
    }
  });
  
  // terminatedAt kontrolünü manuel yap
  const activeSessionsData = await prisma.session.findMany({
    where: {
      userId,
      expiresAt: { gt: new Date() }
    },
    select: { terminatedAt: true }
  });
  
  const actuallyActiveSessions = activeSessionsData.filter(s => !s.terminatedAt).length;

  if (actuallyActiveSessions >= maxConcurrent) {
    return {
      suspicious: true,
      reason: `${actuallyActiveSessions} aktif oturum tespit edildi. Bu normalden fazla olabilir.`
    };
  }

  return { suspicious: false };
}

/**
 * User-Agent'tan browser bilgisini çıkar
 */
function extractBrowser(userAgent: string): string {
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Edg/')) return 'Edge';
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
  if (userAgent.includes('Opera') || userAgent.includes('OPR')) return 'Opera';
  return 'Unknown';
}

/**
 * User-Agent'tan OS bilgisini çıkar
 */
function extractOS(userAgent: string): string {
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac OS X')) return 'macOS';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
  if (userAgent.includes('Linux')) return 'Linux';
  return 'Unknown';
}

/**
 * Session timeout kontrolü
 */
export async function checkSessionTimeout(sessionId: string): Promise<{
  expired: boolean;
  warning?: boolean;
  remainingSeconds?: number;
}> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { expiresAt: true, lastActivity: true }
  });

  if (!session) {
    return { expired: true };
  }

  const now = new Date();
  const expiresAt = new Date(session.expiresAt);
  const remainingSeconds = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);

  if (remainingSeconds <= 0) {
    return { expired: true };
  }

  const warningThreshold = await getSystemSetting<number>('sessionTimeoutWarning', 300);
  const warning = remainingSeconds <= warningThreshold;

  return {
    expired: false,
    warning,
    remainingSeconds
  };
}

/**
 * Timeout olan session'ları temizle
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const autoLogout = await getSystemSetting<boolean>('sessionAutoLogoutOnTimeout', true);
  
  if (!autoLogout) {
    return 0;
  }

  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: { lte: new Date() }
    }
  });

  return result.count;
}

