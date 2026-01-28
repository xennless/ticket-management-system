import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { prisma } from '../db/prisma.js';

// API key ile authentication
export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return next(); // API key yoksa normal auth'a geç
  }

  try {
    // API key'i hash'le ve veritabanında ara
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true }
    });

    if (!apiKeyRecord || !apiKeyRecord.isActive) {
      return res.status(401).json({ 
        message: 'Geçersiz veya devre dışı API key',
        error: 'INVALID_API_KEY'
      });
    }

    // Süre kontrolü
    if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
      return res.status(401).json({ 
        message: 'API key süresi dolmuş',
        error: 'API_KEY_EXPIRED'
      });
    }

    // Kullanıcı aktif mi kontrol et
    if (!apiKeyRecord.user.isActive) {
      return res.status(401).json({ 
        message: 'API key sahibi kullanıcı aktif değil',
        error: 'USER_INACTIVE'
      });
    }

    // Son kullanım bilgilerini güncelle
    await prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: {
        lastUsedAt: new Date(),
        lastUsedIp: req.ip || req.headers['x-forwarded-for'] as string || undefined
      }
    });

    // Request'e user bilgisini ekle
    (req as any).user = apiKeyRecord.user;
    (req as any).apiKey = apiKeyRecord;
    (req as any).authMethod = 'api-key';

    next();
  } catch (error: any) {
    console.error('[apiKeyAuth] Hata:', error);
    return res.status(500).json({ 
      message: 'API key doğrulama hatası',
      error: error?.message 
    });
  }
}

