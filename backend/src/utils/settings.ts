import { prisma } from '../db/prisma.js';

// Sistem ayarları için varsayılan değerler
const DEFAULT_SETTINGS: Record<string, any> = {
  siteName: 'Ticket System',
  companyName: '',
  minPasswordLength: 8,
  sessionTimeout: 3600, // saniye cinsinden
  sessionTimeoutWarning: 300, // Timeout'tan önce uyarı verilecek süre (saniye)
  sessionMaxConcurrent: 10, // Maksimum eşzamanlı session sayısı
  sessionSuspiciousActivityEnabled: true, // Şüpheli aktivite tespiti aktif mi?
  sessionAutoLogoutOnTimeout: true, // Timeout'ta otomatik çıkış
  require2FA: false,
  maxFileSize: 50, // MB cinsinden
  allowedFileTypes: ['jpg', 'png', 'pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar'],
  emailEnabled: false,
  emailFrom: '',
  emailHost: '',
  emailPort: 587,
  emailUser: '',
  emailPassword: '',
  emailSecure: false,
  // Hesap kilitleme ayarları
  lockoutEnabled: true,
  lockoutMaxAttempts: 5,
  lockoutDuration: 30, // dakika
  lockoutNotifyAdmins: true,
  lockoutNotificationEmail: '', // Bildirim gönderilecek email adresi
  lockoutIpLockoutThreshold: 2, // Kaç hesap kilitlendikten sonra IP kilitlensin
  // Şifre politikası ayarları
  passwordRequireUppercase: false,
  passwordRequireLowercase: false,
  passwordRequireNumber: false,
  passwordRequireSpecialChar: false,
  passwordHistoryCount: 0, // Son N şifre tekrarı yasak (0 = kapalı)
  passwordExpirationDays: 0, // Şifre süresi (0 = süresiz)
  // Dosya güvenlik ayarları
  fileScanEnabled: false, // Dosya taraması aktif mi?
  fileScanVirus: false, // Virus taraması aktif mi? (ClamAV gerekli)
  fileScanMagicBytes: true, // Magic bytes kontrolü aktif mi?
  fileSanitizeNames: true, // Dosya adı sanitization aktif mi?
  fileQuarantineEnabled: true, // Quarantine mekanizması aktif mi?
  fileAutoQuarantine: true, // Şüpheli dosyaları otomatik karantinaya al
  // Audit ve compliance ayarları
  auditRetentionDays: 365, // Audit logların saklanma süresi (gün)
  auditRetentionAction: 'delete' // 'delete' veya 'archive'
};

// Cache için
let settingsCache: Record<string, any> | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 60 * 1000; // 1 dakika

/**
 * Sistem ayarlarını veritabanından yükle (cache'li)
 */
export async function getSystemSettings(): Promise<Record<string, any>> {
  const now = Date.now();
  
  // Cache geçerliyse kullan
  if (settingsCache && (now - cacheTimestamp) < CACHE_TTL) {
    return settingsCache;
  }

  const settings = await prisma.systemSettings.findMany();
  const settingsMap: Record<string, any> = { ...DEFAULT_SETTINGS };

  settings.forEach((s) => {
    settingsMap[s.key] = s.value;
  });

  // Cache'i güncelle
  settingsCache = settingsMap;
  cacheTimestamp = now;

  return settingsMap;
}

/**
 * Belirli bir ayarı getir
 */
export async function getSystemSetting<T = any>(key: string, defaultValue?: T): Promise<T> {
  const settings = await getSystemSettings();
  return (settings[key] as T) ?? (defaultValue as T);
}

/**
 * Cache'i temizle (ayarlar güncellendiğinde çağrılmalı)
 */
export function clearSettingsCache() {
  settingsCache = null;
  cacheTimestamp = 0;
}

/**
 * Tek bir sistem ayarını güncelle
 */
export async function setSystemSetting(
  key: string,
  value: any,
  userId?: string
): Promise<void> {
  const category = key.startsWith('email') 
    ? 'email' 
    : key.startsWith('lockout') || key.startsWith('password') || key.startsWith('file') || key.startsWith('session') || key.startsWith('xss') || key.startsWith('path') || key.startsWith('command') || key.startsWith('sql') || key.startsWith('url') || key.startsWith('validation') || key.startsWith('log') || key.startsWith('auto')
      ? 'security'
      : 'general';

  await prisma.systemSettings.upsert({
    where: { key },
    update: { value: value as any, updatedById: userId || null },
    create: {
      key,
      value: value as any,
      category,
      updatedById: userId || null
    }
  });
  
  // Cache'i temizle
  clearSettingsCache();
}

/**
 * Sistem ayarlarını güncelle
 */
export async function updateSystemSettings(
  updates: Record<string, any>,
  userId?: string
): Promise<void> {
  const promises = Object.entries(updates).map(([key, value]) =>
    prisma.systemSettings.upsert({
      where: { key },
      update: { value: value as any, updatedById: userId || null },
      create: {
        key,
        value: value as any,
        category: key.startsWith('email') 
          ? 'email' 
          : key.startsWith('lockout') || key.startsWith('password') || key.startsWith('file') || key.startsWith('session') || key.startsWith('xss') || key.startsWith('path') || key.startsWith('command') || key.startsWith('sql') || key.startsWith('url') || key.startsWith('validation') || key.startsWith('log') || key.startsWith('auto')
            ? 'security'
            : 'general',
        updatedById: userId || null
      }
    })
  );

  await Promise.all(promises);
  
  // Cache'i temizle
  clearSettingsCache();
}

