import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { audit } from '../../lib/audit.js';

export const lockoutRouter = Router();

lockoutRouter.use(requireAuth);

// Kilitli hesapları listele
lockoutRouter.get('/accounts', requirePermission('lockout.read'), async (req, res) => {
  const Query = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
    search: z.string().optional(),
    status: z.enum(['locked', 'unlocked', 'all']).optional().default('locked') // Default: sadece kilitli olanlar
  });
  const query = Query.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: 'Geçersiz istek', issues: query.error.issues });

  const { page = 1, pageSize = 50, search, status = 'locked' } = query.data;
  const skip = (page - 1) * pageSize;

  const where: any = {};
  
  // Status filtresi
  if (status === 'locked') {
    where.lockedUntil = { gt: new Date() }; // Şu anda kilitli olanlar
  } else if (status === 'unlocked') {
    where.OR = [
      { lockedUntil: null },
      { lockedUntil: { lte: new Date() } } // Süresi dolmuş veya null olanlar
    ];
  }
  // 'all' durumunda filtre yok, tüm kayıtlar
  
  if (search) {
    where.user = {
      OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } }
      ]
    };
  }

  const [lockouts, total] = await Promise.all([
    prisma.accountLockout.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            isActive: true
          }
        },
        unlockedBy: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    }),
    prisma.accountLockout.count({ where })
  ]);

  return res.json({
    lockouts,
    total,
    page,
    pageSize
  });
});

// Kilitli IP'leri listele
lockoutRouter.get('/ips', requirePermission('lockout.read'), async (req, res) => {
  const Query = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
    search: z.string().optional(),
    status: z.enum(['locked', 'unlocked', 'all']).optional().default('locked') // Default: sadece kilitli olanlar
  });
  const query = Query.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: 'Geçersiz istek', issues: query.error.issues });

  const { page = 1, pageSize = 50, search, status = 'locked' } = query.data;
  const skip = (page - 1) * pageSize;

  const where: any = {};
  
  // Status filtresi
  if (status === 'locked') {
    where.lockedUntil = { gt: new Date() }; // Şu anda kilitli olanlar
  } else if (status === 'unlocked') {
    where.OR = [
      { lockedUntil: null },
      { lockedUntil: { lte: new Date() } } // Süresi dolmuş veya null olanlar
    ];
  }
  // 'all' durumunda filtre yok, tüm kayıtlar
  
  if (search) {
    where.ip = { contains: search, mode: 'insensitive' };
  }

  const [lockouts, total] = await Promise.all([
    prisma.ipLockout.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { updatedAt: 'desc' }
    }),
    prisma.ipLockout.count({ where })
  ]);

  return res.json({
    lockouts,
    total,
    page,
    pageSize
  });
});

// Hesap kilidini aç
lockoutRouter.post('/accounts/:userId/unlock', requirePermission('lockout.manage'), async (req, res) => {
  const Params = z.object({ userId: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const userId = req.userId!;

  const lockout = await prisma.accountLockout.findUnique({
    where: { userId: params.data.userId },
    include: { user: { select: { email: true, name: true } } }
  });

  if (!lockout) {
    return res.status(404).json({ message: 'Kilit kaydı bulunamadı' });
  }

  await prisma.accountLockout.update({
    where: { userId: params.data.userId },
    data: {
      failedAttempts: 0,
      lockedUntil: null,
      unlockedAt: new Date(),
      unlockedById: userId
    }
  });

  // Kullanıcının IP'sinin kilidini de aç
  if (lockout.lastFailedIp) {
    await prisma.ipLockout.updateMany({
      where: {
        ip: lockout.lastFailedIp,
        lockedUntil: { gt: new Date() }
      },
      data: {
        failedAttempts: 0,
        lockedUntil: null
      }
    });
  }

  await audit(req, 'update', 'AccountLockout', lockout.id, {
    action: 'unlock',
    userId: params.data.userId,
    userEmail: lockout.user.email,
    ipUnlocked: lockout.lastFailedIp || null
  });

  return res.json({ success: true, message: 'Hesap kilidi açıldı' + (lockout.lastFailedIp ? ` ve IP (${lockout.lastFailedIp}) kilidi de açıldı` : '') });
});

// IP kilidini aç
lockoutRouter.post('/ips/:ip/unlock', requirePermission('lockout.manage'), async (req, res) => {
  const Params = z.object({ ip: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const lockout = await prisma.ipLockout.findUnique({
    where: { ip: params.data.ip }
  });

  if (!lockout) {
    return res.status(404).json({ message: 'IP kilit kaydı bulunamadı' });
  }

  await prisma.ipLockout.update({
    where: { ip: params.data.ip },
    data: {
      failedAttempts: 0,
      lockedUntil: null
    }
  });

  await audit(req, 'update', 'IpLockout', lockout.id, {
    action: 'unlock',
    ip: params.data.ip
  });

  return res.json({ success: true, message: 'IP kilidi açıldı' });
});

// Tüm hesapları kilitleme kayıtlarını temizle
lockoutRouter.post('/accounts/clear-all', requirePermission('lockout.manage'), async (req, res) => {
  await prisma.accountLockout.updateMany({
    data: {
      failedAttempts: 0,
      lockedUntil: null,
      unlockedAt: new Date()
    }
  });

  await audit(req, 'update', 'AccountLockout', 'all', { action: 'clear-all' });

  return res.json({ success: true, message: 'Tüm hesap kilitleme kayıtları temizlendi' });
});

// Tüm IP kilitleme kayıtlarını temizle
lockoutRouter.post('/ips/clear-all', requirePermission('lockout.manage'), async (req, res) => {
  await prisma.ipLockout.updateMany({
    data: {
      failedAttempts: 0,
      lockedUntil: null
    }
  });

  await audit(req, 'update', 'IpLockout', 'all', { action: 'clear-all' });

  return res.json({ success: true, message: 'Tüm IP kilitleme kayıtları temizlendi' });
});

// İstatistikler
lockoutRouter.get('/stats', requirePermission('lockout.read'), async (_req, res) => {
  const now = new Date();
  
  // Hesap kilitleme istatistikleri
  const [
    totalAccounts,
    lockedAccounts,
    unlockedAccounts,
    totalFailedAttemptsAccounts,
    accountsLockedLast24h
  ] = await Promise.all([
    prisma.accountLockout.count(),
    prisma.accountLockout.count({ where: { lockedUntil: { gt: now } } }),
    prisma.accountLockout.count({
      where: {
        OR: [
          { lockedUntil: null },
          { lockedUntil: { lte: now } }
        ]
      }
    }),
    prisma.accountLockout.aggregate({
      _sum: { failedAttempts: true }
    }),
    prisma.accountLockout.count({
      where: {
        lockedUntil: { gt: now },
        updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    })
  ]);

  // IP kilitleme istatistikleri
  const [
    totalIps,
    lockedIps,
    unlockedIps,
    totalFailedAttemptsIps,
    ipsLockedLast24h
  ] = await Promise.all([
    prisma.ipLockout.count(),
    prisma.ipLockout.count({ where: { lockedUntil: { gt: now } } }),
    prisma.ipLockout.count({
      where: {
        OR: [
          { lockedUntil: null },
          { lockedUntil: { lte: now } }
        ]
      }
    }),
    prisma.ipLockout.aggregate({
      _sum: { failedAttempts: true }
    }),
    prisma.ipLockout.count({
      where: {
        lockedUntil: { gt: now },
        updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    })
  ]);

  return res.json({
    accounts: {
      total: totalAccounts,
      locked: lockedAccounts,
      unlocked: unlockedAccounts,
      totalFailedAttempts: totalFailedAttemptsAccounts._sum.failedAttempts || 0,
      lockedLast24h: accountsLockedLast24h
    },
    ips: {
      total: totalIps,
      locked: lockedIps,
      unlocked: unlockedIps,
      totalFailedAttempts: totalFailedAttemptsIps._sum.failedAttempts || 0,
      lockedLast24h: ipsLockedLast24h
    }
  });
});

