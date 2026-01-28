import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { prisma } from '../db/prisma.js';
import { checkSessionTimeout } from '../utils/sessionSecurity.js';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // API key ile authentication yapılmışsa (apiKeyAuth middleware'inden geliyor)
  if ((req as any).authMethod === 'api-key' && (req as any).user) {
    (req as any).userId = (req as any).user.id;
    return next();
  }

  // Önce Authorization header'dan dene, yoksa query parameter'dan al (dosya indirme için)
  const header = req.header('authorization') ?? '';
  const [scheme, tokenFromHeader] = header.split(' ');
  const tokenFromQuery = req.query.token as string | undefined;
  
  const token = (scheme?.toLowerCase() === 'bearer' && tokenFromHeader) 
    ? tokenFromHeader 
    : tokenFromQuery;
  
  if (!token) {
    return res.status(401).json({ message: 'Yetkisiz: token gerekli' });
  }

  try {
    const payload = verifyAccessToken(token);
    
    // Session'ı kontrol et - Session silinmişse erişimi reddet
    const session = await prisma.session.findFirst({
      where: {
        token,
        expiresAt: { gt: new Date() },
        userId: payload.sub,
        terminatedAt: null
      },
      select: {
        id: true,
        suspiciousActivity: true,
        suspiciousReason: true,
        terminatedAt: true,
        lastActivity: true
      }
    });
    
    // Session bulunamadıysa (silinmiş olabilir) erişimi reddet
    if (!session) {
      return res.status(401).json({ 
        message: 'Oturum sonlandırıldı', 
        code: 'SESSION_TERMINATED' 
      });
    }
    
    // Session timeout kontrolü
    const timeoutCheck = await checkSessionTimeout(session.id);
    if (timeoutCheck.expired) {
      // Session'ı sonlandır
      await prisma.session.update({
        where: { id: session.id },
        data: {
          terminatedAt: new Date(),
          terminatedReason: 'SESSION_TIMEOUT'
        }
      });
      return res.status(401).json({ 
        message: 'Oturum süresi doldu', 
        code: 'SESSION_EXPIRED' 
      });
    }
    
    // Şüpheli aktivite kontrolü
    if (session.suspiciousActivity && !session.terminatedAt) {
      // Şüpheli aktivite tespit edilmiş ama henüz sonlandırılmamış
      // Uyarı gönder ama erişimi engelleme (admin onayı beklenebilir)
      res.setHeader('X-Session-Suspicious', 'true');
      res.setHeader('X-Session-Suspicious-Reason', session.suspiciousReason || 'Şüpheli aktivite tespit edildi');
    }
    
    // lastActivity'yi güncelle (throttle: 1 dakikada bir, sadece header'dan gelen token için)
    if (scheme?.toLowerCase() === 'bearer' && tokenFromHeader) {
      const now = new Date();
      const lastUpdate = session.lastActivity;
      const diff = now.getTime() - lastUpdate.getTime();
      if (diff > 60000) { // 1 dakika
        await prisma.session.update({
          where: { id: session.id },
          data: { lastActivity: now }
        });
      }
    }
    
    req.userId = payload.sub;
    req.sessionId = session.id;
    return next();
  } catch {
    return res.status(401).json({ message: 'Yetkisiz: token geçersiz' });
  }
}
