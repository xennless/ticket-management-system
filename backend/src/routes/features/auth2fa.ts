import { Router } from 'express';
import { z } from 'zod';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { randomBytes } from 'crypto';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { getSystemSetting } from '../../utils/settings.js';

export const auth2faRouter = Router();

auth2faRouter.use(requireAuth);

// 2FA durumunu getir (kullanıcı kendi durumunu görebilir)
auth2faRouter.get('/status', async (req, res) => {
  const userId = req.userId!;
  const twoFA = await prisma.twoFactorAuth.findUnique({
    where: { userId },
    select: { enabled: true, method: true }
  });
  return res.json({ enabled: twoFA?.enabled ?? false, method: twoFA?.method ?? null });
});

// 2FA aktifleştir (method seçimi: TOTP veya EMAIL)
auth2faRouter.post('/enable', requirePermission('auth.2fa.manage'), async (req, res) => {
  const userId = req.userId!;
  const Body = z.object({ method: z.enum(['TOTP', 'EMAIL']).default('TOTP') });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  const user = await prisma.user.findUnique({ 
    where: { id: userId }, 
    select: { email: true, name: true } 
  });
  if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });

  const method = body.data.method;

  // Mevcut 2FA durumunu kontrol et
  const existing2FA = await prisma.twoFactorAuth.findUnique({
    where: { userId },
    select: { enabled: true, method: true }
  });

  // Eğer zaten aktif bir 2FA varsa ve farklı method seçilmişse hata ver
  if (existing2FA?.enabled && existing2FA.method !== method) {
    return res.status(400).json({ 
      message: `Zaten ${existing2FA.method === 'TOTP' ? 'Authenticator uygulaması' : 'Email'} yöntemi aktif. Farklı bir yöntem seçmek için önce mevcut 2FA'yı devre dışı bırakmalısınız.` 
    });
  }

  if (method === 'TOTP') {
    // TOTP secret oluştur
    const secret = speakeasy.generateSecret({
      name: `${user.email}`,
      issuer: await getSystemSetting<string>('companyName', 'Ticket System') || 'Ticket System'
    });

    // Secret'ı veritabanına kaydet (henüz aktif değil)
    await prisma.twoFactorAuth.upsert({
      where: { userId },
      update: { secret: secret.base32, enabled: false, method: 'TOTP' },
      create: { userId, secret: secret.base32, enabled: false, method: 'TOTP', backupCodes: [] }
    });

    // QR code oluştur
    const otpauthUrl = secret.otpauth_url;
    let qrCodeDataUrl = '';
    try {
      qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl || '');
    } catch (error: any) {
      console.error('[2FA] QR kod oluşturma hatası:', error.message);
      return res.status(500).json({ message: 'QR kod oluşturulamadı' });
    }

    return res.json({ 
      method: 'TOTP',
      qrCode: qrCodeDataUrl, 
      secret: secret.base32,
      manualEntryKey: secret.base32 // Manuel giriş için
    });
  } else {
    // EMAIL method - sadece method'u kaydet, secret yok
    await prisma.twoFactorAuth.upsert({
      where: { userId },
      update: { secret: null, enabled: false, method: 'EMAIL' },
      create: { userId, secret: null, enabled: false, method: 'EMAIL', backupCodes: [] }
    });

    return res.json({ 
      method: 'EMAIL',
      message: 'Email yöntemi seçildi. Doğrulama kodları email ile gönderilecek.'
    });
  }
});

// 2FA doğrula ve aktifleştir
auth2faRouter.post('/verify', requirePermission('auth.2fa.manage'), async (req, res) => {
  const userId = req.userId!;
  const Body = z.object({ code: z.string().min(6).max(6) });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  const twoFA = await prisma.twoFactorAuth.findUnique({ where: { userId } });
  if (!twoFA) {
    return res.status(400).json({ message: '2FA henüz kurulmamış' });
  }

  // Method'a göre doğrulama
  if (twoFA.method === 'TOTP') {
    if (!twoFA.secret) {
      return res.status(400).json({ message: 'TOTP secret bulunamadı' });
    }

    // TOTP doğrulama
    const verified = speakeasy.totp.verify({
      secret: twoFA.secret,
      encoding: 'base32',
      token: body.data.code,
      window: 2 // ±2 kod penceresi (zaman farkı toleransı)
    });

    if (!verified) {
      return res.status(400).json({ message: 'Geçersiz kod' });
    }

    // Backup codes oluştur (10 adet, 8 karakter) - sadece TOTP için
    const backupCodes = Array.from({ length: 10 }, () => {
      return randomBytes(4).toString('hex').toUpperCase().substring(0, 8);
    });

    // 2FA'yı aktifleştir
    await prisma.twoFactorAuth.update({
      where: { userId },
      data: { enabled: true, backupCodes }
    });

    return res.json({ 
      success: true, 
      backupCodes
    });
  } else if (twoFA.method === 'EMAIL') {
    // EMAIL method için - email ile kod gönderilmiş olmalı
    // Bu endpoint'e gelmeden önce email ile kod gönderilmeli
    // Şimdilik direkt aktifleştir (email doğrulaması login sırasında yapılacak)
    await prisma.twoFactorAuth.update({
      where: { userId },
      data: { enabled: true, backupCodes: [] }
    });

    return res.json({ 
      success: true, 
      backupCodes: [] // EMAIL için backup code yok
    });
  } else {
    return res.status(400).json({ message: 'Geçersiz 2FA yöntemi' });
  }
});

// 2FA devre dışı bırak
auth2faRouter.post('/disable', requirePermission('auth.2fa.manage'), async (req, res) => {
  const userId = req.userId!;
  const Body = z.object({ 
    password: z.string().min(1, 'Şifre gerekli')
  });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  // Kullanıcı şifresini kontrol et
  const user = await prisma.user.findUnique({ 
    where: { id: userId }, 
    select: { passwordHash: true } 
  });
  if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });

  const { verifyPassword } = await import('../../utils/password.js');
  const passwordValid = await verifyPassword(body.data.password, user.passwordHash);
  if (!passwordValid) {
    return res.status(401).json({ message: 'Geçersiz şifre' });
  }

  // 2FA'yı devre dışı bırak (sadece şifre yeterli)
  await prisma.twoFactorAuth.updateMany({
    where: { userId },
    data: { enabled: false, secret: null, backupCodes: [] }
  });

  return res.json({ success: true });
});

// Backup codes getir
auth2faRouter.get('/backup-codes', requirePermission('auth.2fa.manage'), async (req, res) => {
  const userId = req.userId!;
  const twoFA = await prisma.twoFactorAuth.findUnique({
    where: { userId },
    select: { backupCodes: true }
  });
  return res.json({ codes: twoFA?.backupCodes ?? [] });
});

// Backup codes yeniden oluştur
auth2faRouter.post('/backup-codes/regenerate', requirePermission('auth.2fa.manage'), async (req, res) => {
  const userId = req.userId!;
  const Body = z.object({ 
    password: z.string().min(1, 'Şifre gerekli'),
    code: z.string().optional() // 2FA kodu
  });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  // Kullanıcı şifresini kontrol et
  const user = await prisma.user.findUnique({ 
    where: { id: userId }, 
    select: { passwordHash: true } 
  });
  if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });

  const { verifyPassword } = await import('../../utils/password.js');
  const passwordValid = await verifyPassword(body.data.password, user.passwordHash);
  if (!passwordValid) {
    return res.status(401).json({ message: 'Geçersiz şifre' });
  }

  // 2FA aktifse kod kontrolü
  const twoFA = await prisma.twoFactorAuth.findUnique({ where: { userId } });
  if (twoFA?.enabled) {
    if (!body.data.code || !twoFA.secret) {
      return res.status(400).json({ message: '2FA kodu gerekli' });
    }

    const codeValid = speakeasy.totp.verify({
      secret: twoFA.secret,
      encoding: 'base32',
      token: body.data.code,
      window: 2
    });

    if (!codeValid) {
      return res.status(401).json({ message: 'Geçersiz 2FA kodu' });
    }
  }

  // Yeni backup codes oluştur
  const backupCodes = Array.from({ length: 10 }, () => {
    return randomBytes(4).toString('hex').toUpperCase().substring(0, 8);
  });

  await prisma.twoFactorAuth.update({
    where: { userId },
    data: { backupCodes }
  });

  return res.json({ success: true, backupCodes });
});

// Login için 2FA doğrulama (public endpoint, token ile)
auth2faRouter.post('/verify-login', async (req, res) => {
  const Body = z.object({
    userId: z.string().min(1),
    code: z.string().min(6).max(8), // 6 haneli TOTP veya 8 haneli backup code
    tempToken: z.string().optional() // Geçici token (güvenlik için)
  });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  const twoFA = await prisma.twoFactorAuth.findUnique({ 
    where: { userId: body.data.userId },
    select: { enabled: true, secret: true, backupCodes: true }
  });

  if (!twoFA || !twoFA.enabled) {
    return res.status(400).json({ message: '2FA aktif değil' });
  }

  const code = body.data.code.toUpperCase();
  
  // Backup code kontrolü (8 karakter)
  if (code.length === 8) {
    const isBackupCode = twoFA.backupCodes.includes(code);
    if (isBackupCode) {
      // Backup code kullanıldı, listeden kaldır
      const updatedBackupCodes = twoFA.backupCodes.filter(c => c !== code);
      await prisma.twoFactorAuth.update({
        where: { userId: body.data.userId },
        data: { backupCodes: updatedBackupCodes }
      });
      return res.json({ success: true, usedBackupCode: true });
    }
    return res.status(401).json({ message: 'Geçersiz backup code' });
  }

  // TOTP kontrolü (6 karakter)
  if (twoFA.secret) {
    const verified = speakeasy.totp.verify({
      secret: twoFA.secret,
      encoding: 'base32',
      token: code,
      window: 2
    });

    if (verified) {
      return res.json({ success: true });
    }
  }

  return res.status(401).json({ message: 'Geçersiz kod' });
});
