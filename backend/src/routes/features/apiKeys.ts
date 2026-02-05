import { Router } from 'express';
import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// API key oluşturma şeması
const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  userId: z.string().optional(), // Admin başka kullanıcı için oluşturabilir
  expiresAt: z.string().datetime().optional().nullable(),
  permissions: z.record(z.any()).optional()
});

// API key güncelleme şeması
const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().nullable()
});

// Tüm API key'leri listele (admin)
router.get('/', requireAuth, requirePermission('apikey.read'), async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    const isActive = req.query.isActive !== undefined 
      ? req.query.isActive === 'true' 
      : undefined;

    const apiKeys = await prisma.apiKey.findMany({
      where: {
        ...(userId && { userId }),
        ...(isActive !== undefined && { isActive })
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Güvenlik için keyHash'i gösterme, sadece keyPrefix göster
    const safeApiKeys = apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      userId: key.userId,
      user: key.user,
      createdBy: key.createdBy,
      lastUsedAt: key.lastUsedAt,
      lastUsedIp: key.lastUsedIp,
      expiresAt: key.expiresAt,
      isActive: key.isActive,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
      isExpired: key.expiresAt ? new Date(key.expiresAt) < new Date() : false
    }));

    return res.json({ apiKeys: safeApiKeys });
  } catch (error: any) {
    logger.error('[apiKeys] Listeleme hatası', {
      error: error?.message || String(error),
      stack: error?.stack,
      requestId: (req as any).requestId
    });
    return res.status(500).json({ message: 'API key listesi alınamadı', error: error?.message });
  }
});

// Kendi API key'lerini listele
router.get('/my', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const apiKeys = await prisma.apiKey.findMany({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const safeApiKeys = apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      lastUsedAt: key.lastUsedAt,
      lastUsedIp: key.lastUsedIp,
      expiresAt: key.expiresAt,
      isActive: key.isActive,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
      isExpired: key.expiresAt ? new Date(key.expiresAt) < new Date() : false
    }));

    return res.json({ apiKeys: safeApiKeys });
  } catch (error: any) {
    logger.error('[apiKeys] Listeleme hatası', {
      error: error?.message || String(error),
      stack: error?.stack,
      requestId: (req as any).requestId
    });
    return res.status(500).json({ message: 'API key listesi alınamadı', error: error?.message });
  }
});

// API key oluştur
router.post('/', requireAuth, requirePermission('apikey.manage'), async (req, res) => {
  try {
    const body = createApiKeySchema.parse(req.body);
    const currentUser = (req as any).user;

    // Target user ID (admin başka kullanıcı için oluşturabilir)
    const targetUserId = body.userId || currentUser.id;

    // Admin kontrolü (başka kullanıcı için oluşturuyorsa)
    if (body.userId && body.userId !== currentUser.id) {
      const hasPermission = await prisma.user.findFirst({
        where: {
          id: currentUser.id,
          roles: {
            some: {
              role: {
                permissions: {
                  some: {
                    permission: {
                      code: 'apikey.manage'
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!hasPermission) {
        return res.status(403).json({ message: 'Bu işlem için yetkiniz yok' });
      }
    }

    // API key oluştur
    const rawKey = `tk_${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 12); // İlk 12 karakter

    const apiKey = await prisma.apiKey.create({
      data: {
        name: body.name,
        keyHash,
        keyPrefix,
        userId: targetUserId,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        permissions: body.permissions || null,
        createdById: currentUser.id
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    // Sadece oluşturma anında raw key'i döndür (bir daha gösterilmez)
    return res.status(201).json({
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        key: rawKey, // Sadece bu seferlik göster
        keyPrefix: apiKey.keyPrefix,
        userId: apiKey.userId,
        user: apiKey.user,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt
      },
      message: 'API key oluşturuldu. Lütfen key\'i güvenli bir yere kaydedin, bir daha gösterilmeyecek.'
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Geçersiz veri', errors: error.errors });
    }
    logger.error('[apiKeys] Oluşturma hatası', {
      error: error?.message || String(error),
      stack: error?.stack,
      requestId: (req as any).requestId
    });
    return res.status(500).json({ message: 'API key oluşturulamadı', error: error?.message });
  }
});

// API key güncelle
router.put('/:id', requireAuth, requirePermission('apikey.manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const body = updateApiKeySchema.parse(req.body);
    const currentUser = (req as any).user;

    // API key'i bul
    const apiKey = await prisma.apiKey.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!apiKey) {
      return res.status(404).json({ message: 'API key bulunamadı' });
    }

    // Yetki kontrolü (kendi key'i veya admin)
    if (apiKey.userId !== currentUser.id) {
      const hasPermission = await prisma.user.findFirst({
        where: {
          id: currentUser.id,
          roles: {
            some: {
              role: {
                permissions: {
                  some: {
                    permission: {
                      code: 'apikey.manage'
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!hasPermission) {
        return res.status(403).json({ message: 'Bu API key\'i güncelleme yetkiniz yok' });
      }
    }

    // Güncelle
    const updated = await prisma.apiKey.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.expiresAt !== undefined && { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null })
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    return res.json({
      apiKey: {
        id: updated.id,
        name: updated.name,
        keyPrefix: updated.keyPrefix,
        userId: updated.userId,
        user: updated.user,
        expiresAt: updated.expiresAt,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt
      }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Geçersiz veri', errors: error.errors });
    }
    logger.error('[apiKeys] Güncelleme hatası', {
      error: error?.message || String(error),
      stack: error?.stack,
      requestId: (req as any).requestId
    });
    return res.status(500).json({ message: 'API key güncellenemedi', error: error?.message });
  }
});

// API key sil
router.delete('/:id', requireAuth, requirePermission('apikey.manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = (req as any).user;

    // API key'i bul
    const apiKey = await prisma.apiKey.findUnique({
      where: { id }
    });

    if (!apiKey) {
      return res.status(404).json({ message: 'API key bulunamadı' });
    }

    // Yetki kontrolü (kendi key'i veya admin)
    if (apiKey.userId !== currentUser.id) {
      const hasPermission = await prisma.user.findFirst({
        where: {
          id: currentUser.id,
          roles: {
            some: {
              role: {
                permissions: {
                  some: {
                    permission: {
                      code: 'apikey.manage'
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!hasPermission) {
        return res.status(403).json({ message: 'Bu API key\'i silme yetkiniz yok' });
      }
    }

    await prisma.apiKey.delete({
      where: { id }
    });

    return res.json({ message: 'API key silindi' });
  } catch (error: any) {
    logger.error('[apiKeys] Silme hatası', {
      error: error?.message || String(error),
      stack: error?.stack,
      requestId: (req as any).requestId
    });
    return res.status(500).json({ message: 'API key silinemedi', error: error?.message });
  }
});

// API key detay
router.get('/:id', requireAuth, requirePermission('apikey.read'), async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = (req as any).user;

    const apiKey = await prisma.apiKey.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    if (!apiKey) {
      return res.status(404).json({ message: 'API key bulunamadı' });
    }

    // Yetki kontrolü (kendi key'i veya admin)
    if (apiKey.userId !== currentUser.id) {
      const hasPermission = await prisma.user.findFirst({
        where: {
          id: currentUser.id,
          roles: {
            some: {
              role: {
                permissions: {
                  some: {
                    permission: {
                      code: 'apikey.read'
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!hasPermission) {
        return res.status(403).json({ message: 'Bu API key\'i görüntüleme yetkiniz yok' });
      }
    }

    return res.json({
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        userId: apiKey.userId,
        user: apiKey.user,
        createdBy: apiKey.createdBy,
        lastUsedAt: apiKey.lastUsedAt,
        lastUsedIp: apiKey.lastUsedIp,
        expiresAt: apiKey.expiresAt,
        isActive: apiKey.isActive,
        createdAt: apiKey.createdAt,
        updatedAt: apiKey.updatedAt,
        isExpired: apiKey.expiresAt ? new Date(apiKey.expiresAt) < new Date() : false
      }
    });
  } catch (error: any) {
    logger.error('[apiKeys] Detay hatası', {
      error: error?.message || String(error),
      stack: error?.stack,
      requestId: (req as any).requestId
    });
    return res.status(500).json({ message: 'API key detayı alınamadı', error: error?.message });
  }
});

export { router as apiKeysRouter };

