import type { Response, NextFunction } from 'express';
import type { Request } from 'express';
import { prisma } from '../db/prisma.js';

/**
 * Middleware: Kullanıcının 2FA'sının aktif olmasını zorunlu kılar
 * Kritik işlemler için kullanılır (admin sayfaları, ayarlar, vb.)
 */
export async function requireTwoFactor(req: Request, res: Response, next: NextFunction) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Yetkisiz: token gerekli' });
  }

  const twoFA = await prisma.twoFactorAuth.findUnique({
    where: { userId },
    select: { enabled: true }
  });

  if (!twoFA?.enabled) {
    return res.status(403).json({
      message: 'Güvenlik sebebiyle bu özelliğe sadece 2FA açık kullanıcılar erişebilir',
      requiresTwoFactor: true
    });
  }

  return next();
}

