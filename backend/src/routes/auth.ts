import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { prisma } from '../db/prisma.js';
import { verifyPassword, hashPassword } from '../utils/password.js';
import { signAccessToken } from '../utils/jwt.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { sendEmail, emailTemplates, getEmailTemplate } from '../utils/email.js';
import rateLimit from 'express-rate-limit';
import { validatePassword, checkPasswordHistory, checkPasswordExpiration } from '../utils/passwordValidation.js';
import { detectSuspiciousActivity } from '../utils/sessionSecurity.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
});

const passwordResetLimiter = rateLimit({
  windowMs: 60_000 * 15, // 15 dakika
  limit: 3, // 15 dakikada maksimum 3 istek
  standardHeaders: true,
  legacyHeaders: false
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const Body = z.object({
    // Not: zod .email() bazı "local" domainleri reddedebilir (örn: systemdeveloper@local)
    email: z.string().min(3).regex(/^[^\s@]+@[^\s@]+$/, 'Geçersiz email'),
    password: z.string().min(1),
    twoFactorCode: z.string().optional(), // 2FA kodu (6 haneli TOTP veya 8 haneli backup code)
    tempToken: z.string().optional() // Geçici token (2FA adımı için)
  });

  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  const { getSystemSetting } = await import('../utils/settings.js');
  const lockoutEnabled = await getSystemSetting<boolean>('lockoutEnabled', true);
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  
  // IP bazlı kilitleme kontrolü (sadece aktifse)
  if (lockoutEnabled) {
    const ipLockout = await prisma.ipLockout.findUnique({
      where: { ip: clientIp }
    });
    
    if (ipLockout && ipLockout.lockedUntil && ipLockout.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((ipLockout.lockedUntil.getTime() - Date.now()) / (1000 * 60));
      return res.status(423).json({ 
        message: `IP adresiniz geçici olarak kilitlendi. ${minutesLeft} dakika sonra tekrar deneyebilirsiniz.`,
        code: 'IP_LOCKED',
        lockedUntil: ipLockout.lockedUntil
      });
    }
  }

  const user = await prisma.user.findUnique({
    where: { email: body.data.email.toLowerCase() },
    select: { id: true, email: true, name: true, passwordHash: true, isActive: true, deletedAt: true }
  });

  // Kullanıcı hesap kilitleme kontrolü (sadece aktifse)
  if (user && lockoutEnabled) {
    const accountLockout = await prisma.accountLockout.findUnique({
      where: { userId: user.id }
    });
    
    if (accountLockout && accountLockout.lockedUntil && accountLockout.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((accountLockout.lockedUntil.getTime() - Date.now()) / (1000 * 60));
      return res.status(423).json({ 
        message: `Hesabınız geçici olarak kilitlendi. ${minutesLeft} dakika sonra tekrar deneyebilirsiniz.`,
        code: 'ACCOUNT_LOCKED',
        lockedUntil: accountLockout.lockedUntil
      });
    }
  }

  if (!user || user.deletedAt || !user.isActive) {
    // Başarısız deneme sayacını artır (IP bazlı, sadece aktifse)
    if (lockoutEnabled) {
      await handleFailedLoginAttempt(null, clientIp);
    }
    return res.status(401).json({ message: 'Hatalı email/şifre' });
  }

  const ok = await verifyPassword(body.data.password, user.passwordHash);
  if (!ok) {
    // Başarısız deneme sayacını artır (hem kullanıcı hem IP bazlı, sadece aktifse)
    if (lockoutEnabled) {
      await handleFailedLoginAttempt(user.id, clientIp);
    }
    return res.status(401).json({ message: 'Hatalı email/şifre' });
  }
  
  // Başarılı giriş - kilitleme kayıtlarını temizle
  if (lockoutEnabled) {
    await prisma.accountLockout.upsert({
      where: { userId: user.id },
      update: { failedAttempts: 0, lockedUntil: null, lastFailedAt: null, lastFailedIp: null },
      create: { userId: user.id, failedAttempts: 0 }
    });
    
    // IP kilitleme kaydını da temizle
    const ipLockout = await prisma.ipLockout.findUnique({
      where: { ip: clientIp }
    });
    if (ipLockout) {
      await prisma.ipLockout.update({
        where: { ip: clientIp },
        data: { failedAttempts: 0, lockedUntil: null, lastFailedAt: null }
      });
    }
  }

  // 2FA kontrolü
  const twoFA = await prisma.twoFactorAuth.findUnique({
    where: { userId: user.id },
    select: { enabled: true, method: true }
  });

  const require2FA = await getSystemSetting<boolean>('require2FA', false);

  // 2FA zorunlu mu veya kullanıcı 2FA aktif mi?
  if ((require2FA || twoFA?.enabled) && !body.data.twoFactorCode) {
    // EMAIL 2FA için kod gönder
    if (twoFA?.method === 'EMAIL' && twoFA.enabled) {
      const { generateEmail2FACode } = await import('../utils/twoFactorEmailCode.js');
      const emailCode = generateEmail2FACode(user.id);
      
      // Email gönder
      let emailContent: { subject: string; html: string; text: string };
      try {
        const dbTemplate = await getEmailTemplate('two-factor-code', {
          code: emailCode,
          userName: user.name || undefined
        });
        
        if (dbTemplate) {
          emailContent = dbTemplate;
        } else {
          emailContent = emailTemplates.twoFactorCode(emailCode, user.name || undefined);
        }
      } catch (err) {
        // Template yoksa fallback kullan
        emailContent = emailTemplates.twoFactorCode(emailCode, user.name || undefined);
      }
      
      await sendEmail({
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        userId: user.id,
        metadata: { type: '2fa-email-code', method: 'EMAIL' }
      });
    }
    
    // 2FA kodu gerekli, geçici token oluştur (10 dakika geçerli - EMAIL için daha uzun)
    const tempToken = randomBytes(32).toString('hex');
    await prisma.session.create({
      data: {
        userId: user.id,
        token: tempToken,
        device: 'Temp',
        ip: req.ip || null,
        userAgent: req.get('user-agent') || 'Unknown',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 dakika (EMAIL için)
      }
    });

    return res.status(200).json({
      requiresTwoFactor: true,
      tempToken,
      userId: user.id,
      message: twoFA?.method === 'EMAIL' ? '2FA kodu email ile gönderildi' : '2FA kodu gerekli',
      method: twoFA?.method || 'TOTP'
    });
  }

  // 2FA kodu gönderildiyse doğrula
  if (body.data.twoFactorCode && (require2FA || twoFA?.enabled)) {
    const twoFAData = await prisma.twoFactorAuth.findUnique({
      where: { userId: user.id },
      select: { enabled: true, method: true, secret: true, backupCodes: true }
    });

    if (!twoFAData?.enabled) {
      return res.status(400).json({ message: '2FA aktif değil' });
    }

    const code = body.data.twoFactorCode.toUpperCase();
    let codeValid = false;
    let usedBackupCode = false;

    // Method'a göre doğrulama
    if (twoFAData.method === 'EMAIL') {
      // EMAIL 2FA: Email ile gönderilen kodu doğrula
      const { verifyEmail2FACode } = await import('../utils/twoFactorEmailCode.js');
      codeValid = verifyEmail2FACode(user.id, code);
    } else if (twoFAData.method === 'TOTP') {
      // TOTP 2FA: Backup code veya TOTP kontrolü
      // Backup code kontrolü (8 karakter)
      if (code.length === 8 && twoFAData.backupCodes.includes(code)) {
        codeValid = true;
        usedBackupCode = true;
        // Backup code kullanıldı, listeden kaldır
        const updatedBackupCodes = twoFAData.backupCodes.filter(c => c !== code);
        await prisma.twoFactorAuth.update({
          where: { userId: user.id },
          data: { backupCodes: updatedBackupCodes }
        });
      } else if (code.length === 6 && twoFAData.secret) {
        // TOTP kontrolü (6 karakter)
        const speakeasy = (await import('speakeasy')).default;
        codeValid = speakeasy.totp.verify({
          secret: twoFAData.secret,
          encoding: 'base32',
          token: code,
          window: 2
        });
      }
    } else {
      // Bilinmeyen method
      return res.status(400).json({ message: 'Geçersiz 2FA yöntemi' });
    }

    if (!codeValid) {
      return res.status(401).json({ message: 'Geçersiz 2FA kodu' });
    }
  }

  // Audit: son giriş bilgileri
  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: req.ip
    }
  });

  const token = await signAccessToken({ sub: user.id });
  
  // Session oluştur
  try {
    const sessionTimeout = await getSystemSetting<number>('sessionTimeout', 3600);
    const userAgent = req.get('user-agent') || 'Unknown';
    const device = userAgent.includes('Mobile') ? 'Mobile' : userAgent.includes('Tablet') ? 'Tablet' : 'Desktop';
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + sessionTimeout); // Ayarlardan gelen süre

    // Eski session'ları temizle (aynı token ile)
    await prisma.session.deleteMany({
      where: { token }
    });

    // Geçici token varsa onu da temizle
    if (body.data.tempToken) {
      await prisma.session.deleteMany({
        where: { token: body.data.tempToken }
      });
    }

    // Şüpheli aktivite kontrolü
    const suspiciousCheck = await detectSuspiciousActivity(
      user.id,
      req.ip || 'unknown',
      userAgent
    );

    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        device,
        ip: req.ip || null,
        userAgent,
        expiresAt,
        suspiciousActivity: suspiciousCheck.suspicious,
        suspiciousReason: suspiciousCheck.reason || null
      }
    });
  } catch (sessionError: any) {
    // Session oluşturma hatası login'i engellememeli, sadece log'la
    console.error('[auth/login] Session oluşturma hatası:', sessionError?.message || sessionError);
  }

  // Şifre süresi kontrolü
  const expirationCheck = await checkPasswordExpiration(user.id);
  if (expirationCheck.expired) {
    // Şifre süresi dolmuş, zorunlu değişiklik gerekiyor
    await prisma.user.update({
      where: { id: user.id },
      data: { mustChangePassword: true }
    });
  }

  // mustChangePassword kontrolü
  const userWithPasswordFlag = await prisma.user.findUnique({
    where: { id: user.id },
    select: { mustChangePassword: true }
  });

  if (userWithPasswordFlag?.mustChangePassword) {
    // Zorunlu şifre değişikliği gerekli, geçici token döndür
    const tempToken = randomBytes(32).toString('hex');
    try {
      const { getSystemSetting } = await import('../utils/settings.js');
      const sessionTimeout = await getSystemSetting<number>('sessionTimeout', 3600);
      const userAgent = req.get('user-agent') || 'Unknown';
      const device = userAgent.includes('Mobile') ? 'Mobile' : userAgent.includes('Tablet') ? 'Tablet' : 'Desktop';
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + 5 * 60); // 5 dakika (sadece şifre değiştirme için)

      await prisma.session.create({
        data: {
          userId: user.id,
          token: tempToken,
          device,
          ip: req.ip || null,
          userAgent,
          expiresAt
        }
      });
    } catch (sessionError: any) {
      console.error('[auth/login] Session oluşturma hatası:', sessionError?.message || sessionError);
    }

    return res.status(200).json({
      requiresPasswordChange: true,
      tempToken,
      userId: user.id,
      message: 'Şifre değişikliği zorunlu'
    });
  }

  return res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name }
  });
});

// Token refresh endpoint
authRouter.post('/refresh', requireAuth, async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ message: 'Yetkisiz: token gerekli' });

  // Kullanıcının aktif olduğunu kontrol et
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true, deletedAt: true }
  });

  if (!user || user.deletedAt || !user.isActive) {
    return res.status(403).json({ message: 'Hesap pasif' });
  }

  // Yeni token oluştur
  const newToken = await signAccessToken({ sub: userId });

  return res.json({ token: newToken });
});

authRouter.get('/me', requireAuth, requirePermission('profile.read'), async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ message: 'Yetkisiz: token gerekli' });

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      isActive: true,
      deletedAt: true,
      lastLoginAt: true,
      lastLoginIp: true,
      activatedAt: true,
      activatedBy: { select: { id: true, email: true, name: true } },
      deactivatedAt: true,
      deactivatedBy: { select: { id: true, email: true, name: true } },
      createdAt: true,
      updatedAt: true,
      roles: {
        select: {
          role: {
            select: {
              id: true,
              code: true,
              name: true,
              label: true,
              color: true,
              permissions: { select: { permission: { select: { code: true, name: true } } } }
            }
          }
        }
      }
    }
  });

  if (!me) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
  if (me.deletedAt || !me.isActive) return res.status(403).json({ message: 'Hesap pasif' });

  const roles = me.roles.map((r) => r.role);
  const permissions = Array.from(
    new Map(
      roles.flatMap((r) => r.permissions.map((p) => [p.permission.code, p.permission] as const))
    ).values()
  );

  return res.json({
    user: {
      id: me.id,
      email: me.email,
      name: me.name,
      avatarUrl: me.avatarUrl,
      isActive: me.isActive,
      lastLoginAt: me.lastLoginAt,
      lastLoginIp: me.lastLoginIp,
      activatedAt: me.activatedAt,
      activatedBy: me.activatedBy,
      deactivatedAt: me.deactivatedAt,
      deactivatedBy: me.deactivatedBy,
      createdAt: me.createdAt,
      updatedAt: me.updatedAt
    },
    roles: roles.map((r) => ({ id: r.id, code: r.code, name: r.name, label: r.label, color: r.color })),
    permissions
  });
});

// Profil güncelleme
// Zorunlu şifre değişikliği endpoint'i (login'den sonra)
authRouter.post('/change-password-required', async (req, res) => {
  const Body = z.object({
    userId: z.string().min(1),
    tempToken: z.string().optional(),
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, 'Yeni şifre en az 8 karakter olmalıdır')
  });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  const user = await prisma.user.findUnique({
    where: { id: body.data.userId },
    select: { id: true, email: true, passwordHash: true, mustChangePassword: true }
  });

  if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });

  if (!user.mustChangePassword) {
    return res.status(400).json({ message: 'Şifre değişikliği zorunlu değil' });
  }

  // Geçici token varsa doğrula
  let tempTokenValid = false;
  if (body.data.tempToken) {
    const tempSession = await prisma.session.findFirst({
      where: {
        token: body.data.tempToken,
        userId: user.id,
        expiresAt: { gt: new Date() }
      }
    });
    tempTokenValid = !!tempSession;
  }

  // Eğer geçici token geçerli değilse, mevcut şifreyi kontrol et
  if (!tempTokenValid) {
    const ok = await verifyPassword(body.data.currentPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Mevcut şifre hatalı veya geçici token geçersiz' });
  }

  // Şifre politikası kontrolü
  const validation = await validatePassword(body.data.newPassword);
  if (!validation.valid) {
    return res.status(400).json({ 
      message: 'Şifre politikası gereksinimlerini karşılamıyor', 
      issues: validation.errors.map(err => ({ message: err, path: ['newPassword'] }))
    });
  }

  // Şifre geçmişi kontrolü
  const historyValid = await checkPasswordHistory(user.id, body.data.newPassword);
  if (!historyValid) {
    return res.status(400).json({ 
      message: 'Bu şifre daha önce kullanılmış. Lütfen farklı bir şifre seçin.',
      issues: [{ message: 'Bu şifre daha önce kullanılmış', path: ['newPassword'] }]
    });
  }

  // Eski şifreyi geçmişe ekle
  const historyCount = await getSystemSetting<number>('passwordHistoryCount', 0);
  if (historyCount > 0) {
    await prisma.passwordHistory.create({
      data: {
        userId: user.id,
        passwordHash: user.passwordHash
      }
    });
  }

  // Yeni şifre hash'le
  const newPasswordHash = await hashPassword(body.data.newPassword);

  // Şifreyi güncelle, mustChangePassword'u false yap ve passwordChangedAt'ı güncelle
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newPasswordHash,
      mustChangePassword: false,
      passwordChangedAt: new Date()
    }
  });

  // Geçici token'ı temizle
  if (body.data.tempToken) {
    await prisma.session.deleteMany({
      where: { token: body.data.tempToken }
    });
  }

  // Normal token oluştur
  const token = await signAccessToken({ sub: user.id });
  
  // Session oluştur
  try {
    const { getSystemSetting } = await import('../utils/settings.js');
    const sessionTimeout = await getSystemSetting<number>('sessionTimeout', 3600);
    const userAgent = req.get('user-agent') || 'Unknown';
    const device = userAgent.includes('Mobile') ? 'Mobile' : userAgent.includes('Tablet') ? 'Tablet' : 'Desktop';
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + sessionTimeout);

    // Şüpheli aktivite kontrolü
    const suspiciousCheck = await detectSuspiciousActivity(
      user.id,
      req.ip || 'unknown',
      userAgent
    );

    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        device,
        ip: req.ip || null,
        userAgent,
        expiresAt,
        suspiciousActivity: suspiciousCheck.suspicious,
        suspiciousReason: suspiciousCheck.reason || null
      }
    });
  } catch (sessionError: any) {
    console.error('[auth/change-password-required] Session oluşturma hatası:', sessionError?.message || sessionError);
  }

  return res.json({
    success: true,
    token,
    user: { id: user.id, email: user.email, name: user.name }
  });
});

authRouter.put('/profile', requireAuth, requirePermission('profile.update'), async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ message: 'Yetkisiz: token gerekli' });

  const Body = z.object({
    name: z.string().min(1).optional().nullable(),
    password: z.string().min(8).optional(),
    avatarUrl: z.string().url().optional().nullable()
  });

  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  const updateData: { name?: string | null; passwordHash?: string; avatarUrl?: string | null; passwordChangedAt?: Date } = {};
  if (body.data.name !== undefined) updateData.name = body.data.name;
  if (body.data.password) {
    // Şifre politikası kontrolü
    const validation = await validatePassword(body.data.password);
    if (!validation.valid) {
      return res.status(400).json({ 
        message: 'Şifre politikası gereksinimlerini karşılamıyor', 
        issues: validation.errors.map(err => ({ message: err, path: ['password'] }))
      });
    }

    // Şifre geçmişi kontrolü
    const historyValid = await checkPasswordHistory(userId, body.data.password);
    if (!historyValid) {
      return res.status(400).json({ 
        message: 'Bu şifre daha önce kullanılmış. Lütfen farklı bir şifre seçin.',
        issues: [{ message: 'Bu şifre daha önce kullanılmış', path: ['password'] }]
      });
    }

    // Eski şifreyi geçmişe ekle
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true }
    });
    
    const historyCount = await getSystemSetting<number>('passwordHistoryCount', 0);
    if (historyCount > 0 && currentUser) {
      await prisma.passwordHistory.create({
        data: {
          userId,
          passwordHash: currentUser.passwordHash
        }
      });
    }

    updateData.passwordHash = await hashPassword(body.data.password);
    updateData.passwordChangedAt = new Date();
  }
  if (body.data.avatarUrl !== undefined) updateData.avatarUrl = body.data.avatarUrl;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      isActive: true,
      updatedAt: true
    }
  });

  return res.json({ user: updated });
});

// Şifre sıfırlama isteği (email gönderimi)
authRouter.post('/password-reset/request', passwordResetLimiter, async (req, res) => {
  const Body = z.object({
    email: z.string().min(3).regex(/^[^\s@]+@[^\s@]+$/, 'Geçersiz email')
  });

  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  const email = body.data.email.toLowerCase();
  
  // Kullanıcıyı bul (güvenlik için her zaman başarılı mesajı döndür)
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, isActive: true, deletedAt: true }
  });

  // Kullanıcı yoksa veya pasifse, güvenlik için başarılı mesajı döndür
  if (!user || user.deletedAt || !user.isActive) {
    return res.json({ message: 'Eğer bu email adresi sistemde kayıtlıysa, şifre sıfırlama linki gönderildi' });
  }

  // Token oluştur
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1); // 1 saat geçerli

  // Eski token'ları iptal et (kullanılmamış olanlar)
  await prisma.passwordResetToken.updateMany({
    where: {
      userId: user.id,
      used: false
    },
    data: {
      used: true
    }
  });

  // Yeni token oluştur
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt
    }
  });

  // Frontend URL'i oluştur
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${token}`;

  // Email gönder - önce veritabanından template yükle, yoksa fallback kullan
  let emailContent: { subject: string; html: string; text: string };
  const dbTemplate = await getEmailTemplate('password-reset', {
    resetLink,
    userName: user.name || 'Kullanıcı',
    name: user.name || 'Kullanıcı'
  });

  if (dbTemplate) {
    emailContent = dbTemplate;
  } else {
    // Fallback: hardcoded template
    emailContent = emailTemplates.passwordReset(resetLink, user.name || undefined);
  }

  await sendEmail({
    to: user.email,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
    metadata: { type: 'password-reset', userId: user.id }
  });

  return res.json({ message: 'Eğer bu email adresi sistemde kayıtlıysa, şifre sıfırlama linki gönderildi' });
});

// Şifre sıfırlama (token ile)
authRouter.post('/password-reset/reset', passwordResetLimiter, async (req, res) => {
  const Body = z.object({
    token: z.string().min(1),
    password: z.string().min(8, 'Şifre en az 8 karakter olmalıdır')
  });

  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  // Token'ı bul
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token: body.data.token },
    include: { user: { select: { id: true, email: true, name: true, isActive: true, deletedAt: true } } }
  });

  // Token geçersiz veya kullanılmış
  if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
    return res.status(400).json({ message: 'Geçersiz veya süresi dolmuş token' });
  }

  // Kullanıcı kontrolü
  if (!resetToken.user || resetToken.user.deletedAt || !resetToken.user.isActive) {
    return res.status(400).json({ message: 'Kullanıcı bulunamadı veya hesap pasif' });
  }

  // Şifre politikası kontrolü
  const validation = await validatePassword(body.data.password);
  if (!validation.valid) {
    return res.status(400).json({ 
      message: 'Şifre politikası gereksinimlerini karşılamıyor', 
      issues: validation.errors.map(err => ({ message: err, path: ['password'] }))
    });
  }

  // Şifre geçmişi kontrolü
  const historyValid = await checkPasswordHistory(resetToken.userId, body.data.password);
  if (!historyValid) {
    return res.status(400).json({ 
      message: 'Bu şifre daha önce kullanılmış. Lütfen farklı bir şifre seçin.',
      issues: [{ message: 'Bu şifre daha önce kullanılmış', path: ['password'] }]
    });
  }

  // Eski şifreyi geçmişe ekle
  const currentUser = await prisma.user.findUnique({
    where: { id: resetToken.userId },
    select: { passwordHash: true }
  });
  
  const historyCount = await getSystemSetting<number>('passwordHistoryCount', 0);
  if (historyCount > 0 && currentUser) {
    await prisma.passwordHistory.create({
      data: {
        userId: resetToken.userId,
        passwordHash: currentUser.passwordHash
      }
    });
  }

  // Şifreyi güncelle
  const passwordHash = await hashPassword(body.data.password);
  await prisma.user.update({
    where: { id: resetToken.userId },
    data: { 
      passwordHash,
      passwordChangedAt: new Date()
    }
  });

  // Token'ı kullanılmış olarak işaretle
  await prisma.passwordResetToken.update({
    where: { id: resetToken.id },
    data: { used: true }
  });

  // Kullanıcının diğer aktif token'larını da iptal et (güvenlik)
  await prisma.passwordResetToken.updateMany({
    where: {
      userId: resetToken.userId,
      used: false,
      id: { not: resetToken.id }
    },
    data: {
      used: true
    }
  });

  // Şifre değişikliği bildirim email'i gönder - önce veritabanından template yükle, yoksa fallback kullan
  try {
    const userAgent = req.get('user-agent') || undefined;
    const ip = req.ip || undefined;
    const userName = resetToken.user.name || 'Kullanıcı';
    
    let emailContent: { subject: string; html: string; text: string };
    const dbTemplate = await getEmailTemplate('password-changed', {
      userName,
      name: userName,
      ip: ip || '',
      userAgent: userAgent || '',
      date: new Date().toLocaleString('tr-TR')
    });

    if (dbTemplate) {
      emailContent = dbTemplate;
    } else {
      // Fallback: hardcoded template
      emailContent = emailTemplates.passwordChanged(
        resetToken.user.name || undefined,
        ip,
        userAgent
      );
    }

    await sendEmail({
      to: resetToken.user.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      metadata: { type: 'password-changed', userId: resetToken.userId }
    });
  } catch (emailError: any) {
    // Email gönderim hatası şifre sıfırlamayı engellememeli, sadece log'la
    console.error('[auth/password-reset] Email gönderim hatası:', emailError?.message || emailError);
  }

  return res.json({ message: 'Şifreniz başarıyla sıfırlandı' });
});

// Başarısız giriş denemesi işleme fonksiyonu
async function handleFailedLoginAttempt(userId: string | null, ip: string) {
  const { getSystemSetting } = await import('../utils/settings.js');
  const maxAttempts = await getSystemSetting<number>('lockoutMaxAttempts', 5);
  const lockoutDuration = await getSystemSetting<number>('lockoutDuration', 30); // dakika
  const notificationEmail = await getSystemSetting<string>('lockoutNotificationEmail', '');
  
  // Kullanıcı bazlı kilitleme
  if (userId) {
    const accountLockout = await prisma.accountLockout.upsert({
      where: { userId },
      update: {
        failedAttempts: { increment: 1 },
        lastFailedAt: new Date(),
        lastFailedIp: ip
      },
      create: {
        userId,
        failedAttempts: 1,
        lastFailedAt: new Date(),
        lastFailedIp: ip
      }
    });
    
    // Maksimum deneme sayısına ulaşıldı mı?
    if (accountLockout.failedAttempts >= maxAttempts) {
      const lockedUntil = new Date();
      lockedUntil.setMinutes(lockedUntil.getMinutes() + lockoutDuration);
      
      await prisma.accountLockout.update({
        where: { userId },
        data: { lockedUntil }
      });
      
      // Admin bildirimi
      if (notificationEmail) {
        try {

          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, name: true }
          });
          
          if (user) {
            // Email template kullan
            const { getEmailTemplate } = await import('../utils/email.js');
            let emailContent: { subject: string; html: string; text: string };
            
            try {
              const dbTemplate = await getEmailTemplate('account-lockout', {
                userName: user.name || user.email,
                userEmail: user.email,
                ip: ip,
                lockoutDuration: lockoutDuration.toString(),
                maxAttempts: maxAttempts.toString(),
                date: new Date().toLocaleString('tr-TR')
              });
              
              if (dbTemplate) {
                emailContent = dbTemplate;
              } else {
                // Fallback template
                emailContent = {
                  subject: `Hesap Kilitleme Uyarısı - ${user.email}`,
                  html: `
                    <h2>Hesap Kilitleme Uyarısı</h2>
                    <p><strong>Kullanıcı:</strong> ${user.name || user.email}</p>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>IP Adresi:</strong> ${ip}</p>
                    <p><strong>Kilitlenme Süresi:</strong> ${lockoutDuration} dakika</p>
                    <p><strong>Zaman:</strong> ${new Date().toLocaleString('tr-TR')}</p>
                    <p>Hesap ${maxAttempts} başarısız giriş denemesinden sonra otomatik olarak kilitlendi.</p>
                  `,
                  text: `Hesap Kilitleme Uyarısı\n\nKullanıcı: ${user.name || user.email}\nEmail: ${user.email}\nIP: ${ip}\nKilitlenme Süresi: ${lockoutDuration} dakika\nZaman: ${new Date().toLocaleString('tr-TR')}\n\nHesap ${maxAttempts} başarısız giriş denemesinden sonra otomatik olarak kilitlendi.`
                };
              }
              
              await sendEmail({
                to: notificationEmail,
                subject: emailContent.subject,
                html: emailContent.html,
                text: emailContent.text,
                metadata: { type: 'account-lockout', userId, ip }
              });
            } catch (emailError: any) {
              console.error('[auth] Admin bildirim email hatası:', emailError?.message || emailError);
            }
          }
        } catch (error: any) {
          console.error('[auth] Admin bildirim hatası:', error?.message || error);
        }
      }
    }
  }
  
  // IP bazlı kilitleme - sadece hesap kilitlendikten sonra say
  if (userId) {
    // Bu IP'den kaç hesap kilitlendi?
    const lockedAccountsFromIp = await prisma.accountLockout.count({
      where: {
        lastFailedIp: ip,
        lockedUntil: { gt: new Date() } // Şu anda kilitli olanlar
      }
    });
    
    const ipLockoutThreshold = await getSystemSetting<number>('lockoutIpLockoutThreshold', 2);
    
    // Eğer bu IP'den yeterince hesap kilitlendiyse, IP'yi de kilitle
    if (lockedAccountsFromIp >= ipLockoutThreshold) {
      const ipLockout = await prisma.ipLockout.upsert({
        where: { ip },
        update: {
          failedAttempts: { increment: 1 },
          lastFailedAt: new Date(),
          lockedUntil: (() => {
            const lockedUntil = new Date();
            lockedUntil.setMinutes(lockedUntil.getMinutes() + lockoutDuration);
            return lockedUntil;
          })()
        },
        create: {
          ip,
          failedAttempts: 1,
          lastFailedAt: new Date(),
          lockedUntil: (() => {
            const lockedUntil = new Date();
            lockedUntil.setMinutes(lockedUntil.getMinutes() + lockoutDuration);
            return lockedUntil;
          })()
        }
      });
    } else {
      // Sadece sayaç artır, kilitleme
      await prisma.ipLockout.upsert({
        where: { ip },
        update: {
          failedAttempts: { increment: 1 },
          lastFailedAt: new Date()
        },
        create: {
          ip,
          failedAttempts: 1,
          lastFailedAt: new Date()
        }
      });
    }
  }
}

