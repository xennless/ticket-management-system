import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { requireTwoFactor } from '../../middleware/requireTwoFactor.js';
import { getSystemSettings, updateSystemSettings, clearSettingsCache } from '../../utils/settings.js';

export const settingsRouter = Router();

settingsRouter.use(requireAuth);
// Sistem ayarları kritik, 2FA zorunlu
settingsRouter.use(requireTwoFactor);

// Sistem ayarlarını getir
settingsRouter.get('/', requirePermission('settings.read'), async (_req, res) => {
  const settings = await getSystemSettings();
  return res.json(settings);
});

// Sistem ayarlarını güncelle
settingsRouter.put('/', requirePermission('settings.manage'), async (req, res) => {
  const userId = req.userId!;
  const Body = z.object({
    siteName: z.string().optional(),
    companyName: z.string().optional(),
    minPasswordLength: z.number().int().min(6).max(32).optional(),
    sessionTimeout: z.number().int().min(300).optional(),
    sessionTimeoutWarning: z.number().int().min(60).max(3600).optional(), // 1 dakika - 1 saat
    sessionMaxConcurrent: z.number().int().min(1).max(50).optional(),
    sessionSuspiciousActivityEnabled: z.boolean().optional(),
    sessionAutoLogoutOnTimeout: z.boolean().optional(),
    require2FA: z.boolean().optional(),
    maxFileSize: z.number().int().optional(), // MB cinsinden
    allowedFileTypes: z.array(z.string()).optional(),
    // Hesap kilitleme ayarları
    lockoutEnabled: z.boolean().optional(),
    lockoutMaxAttempts: z.number().int().min(3).max(10).optional(),
    lockoutDuration: z.number().int().min(5).max(1440).optional(), // 5 dakika - 24 saat
    lockoutNotifyAdmins: z.boolean().optional(),
    lockoutNotificationEmail: z.string().email().optional().or(z.literal('')),
    lockoutIpLockoutThreshold: z.number().int().min(2).max(5).optional(),
    // Şifre politikası ayarları
    passwordRequireUppercase: z.boolean().optional(),
    passwordRequireLowercase: z.boolean().optional(),
    passwordRequireNumber: z.boolean().optional(),
    passwordRequireSpecialChar: z.boolean().optional(),
    passwordHistoryCount: z.number().int().min(0).max(10).optional(), // 0 = kapalı
    passwordExpirationDays: z.number().int().min(0).max(365).optional(), // 0 = süresiz
    // Dosya güvenlik ayarları
    fileScanEnabled: z.boolean().optional(),
    fileScanVirus: z.boolean().optional(),
    fileScanMagicBytes: z.boolean().optional(),
    fileSanitizeNames: z.boolean().optional(),
    fileQuarantineEnabled: z.boolean().optional(),
    fileAutoQuarantine: z.boolean().optional()
  });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  // Sadece tanımlı alanları güncelle
  const updates: Record<string, any> = {};
  for (const [key, value] of Object.entries(body.data)) {
    if (value !== undefined) {
      updates[key] = value;
    }
  }

  await updateSystemSettings(updates, userId);
  
  return res.json({ success: true });
});

// Sistem ayarlarını kategori bazlı getir
settingsRouter.get('/:category', requirePermission('settings.read'), async (req, res) => {
  const Params = z.object({ category: z.string() });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const allSettings = await getSystemSettings();
  const categorySettings: Record<string, any> = {};
  
  // Kategoriye göre filtrele
  const category = params.data.category;
  for (const [key, value] of Object.entries(allSettings)) {
    const settingCategory = key.startsWith('email') ? 'email' : 'general';
    if (settingCategory === category) {
      categorySettings[key] = value;
    }
  }

  return res.json(categorySettings);
});


