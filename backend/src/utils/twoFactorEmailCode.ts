/**
 * EMAIL 2FA kodlarını geçici olarak saklamak için memory cache
 */

interface Email2FACode {
  code: string;
  userId: string;
  expiresAt: number; // timestamp
}

// Memory cache: userId -> Email2FACode
const email2FACodeCache = new Map<string, Email2FACode>();

// Cache temizleme: 1 dakikada bir süresi dolan kodları temizle
setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of email2FACodeCache.entries()) {
    if (data.expiresAt < now) {
      email2FACodeCache.delete(userId);
    }
  }
}, 60 * 1000); // 1 dakika

/**
 * EMAIL 2FA kodu oluştur ve cache'e kaydet
 */
export function generateEmail2FACode(userId: string): string {
  // 6 haneli kod oluştur
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Cache'e kaydet (10 dakika geçerli)
  email2FACodeCache.set(userId, {
    code,
    userId,
    expiresAt: Date.now() + 10 * 60 * 1000 // 10 dakika
  });
  
  return code;
}

/**
 * EMAIL 2FA kodunu doğrula
 */
export function verifyEmail2FACode(userId: string, code: string): boolean {
  const cached = email2FACodeCache.get(userId);
  
  if (!cached) {
    return false; // Kod bulunamadı
  }
  
  if (cached.expiresAt < Date.now()) {
    email2FACodeCache.delete(userId);
    return false; // Kod süresi dolmuş
  }
  
  if (cached.code !== code) {
    return false; // Kod eşleşmiyor
  }
  
  // Kod doğru, cache'den kaldır (tek kullanımlık)
  email2FACodeCache.delete(userId);
  return true;
}

/**
 * Kullanıcının EMAIL 2FA kodunu cache'den kaldır
 */
export function clearEmail2FACode(userId: string): void {
  email2FACodeCache.delete(userId);
}

