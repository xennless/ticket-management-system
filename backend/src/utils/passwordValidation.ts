import { getSystemSetting } from './settings.js';
import { prisma } from '../db/prisma.js';
import { verifyPassword } from './password.js';

export type PasswordValidationResult = {
  valid: boolean;
  errors: string[];
};

/**
 * Şifre politikasına göre şifreyi doğrula
 */
export async function validatePassword(password: string): Promise<PasswordValidationResult> {
  const errors: string[] = [];
  
  const minLength = await getSystemSetting<number>('minPasswordLength', 8);
  const requireUppercase = await getSystemSetting<boolean>('passwordRequireUppercase', false);
  const requireLowercase = await getSystemSetting<boolean>('passwordRequireLowercase', false);
  const requireNumber = await getSystemSetting<boolean>('passwordRequireNumber', false);
  const requireSpecialChar = await getSystemSetting<boolean>('passwordRequireSpecialChar', false);
  
  // Minimum uzunluk kontrolü
  if (password.length < minLength) {
    errors.push(`Şifre en az ${minLength} karakter olmalıdır`);
  }
  
  // Büyük harf kontrolü
  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Şifre en az bir büyük harf içermelidir');
  }
  
  // Küçük harf kontrolü
  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Şifre en az bir küçük harf içermelidir');
  }
  
  // Rakam kontrolü
  if (requireNumber && !/\d/.test(password)) {
    errors.push('Şifre en az bir rakam içermelidir');
  }
  
  // Özel karakter kontrolü
  if (requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Şifre en az bir özel karakter içermelidir');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Şifre geçmişini kontrol et (son N şifre tekrarı yasak)
 * @param userId Kullanıcı ID
 * @param newPasswordPlain Yeni şifre (plain text)
 */
export async function checkPasswordHistory(userId: string, newPasswordPlain: string): Promise<boolean> {
  const historyCount = await getSystemSetting<number>('passwordHistoryCount', 0);
  
  // Şifre geçmişi kontrolü kapalıysa
  if (historyCount === 0) {
    return true; // Geçmiş kontrolü yok, geçerli
  }
  
  // Son N şifreyi getir
  const recentPasswords = await prisma.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: historyCount,
    select: { passwordHash: true }
  });
  
  // Yeni şifre, son N şifreden biriyle eşleşiyor mu kontrol et
  for (const oldPassword of recentPasswords) {
    const matches = await verifyPassword(newPasswordPlain, oldPassword.passwordHash);
    if (matches) {
      return false; // Eski şifrelerden biriyle eşleşiyor
    }
  }
  
  return true; // Geçmişte yok, geçerli
}

/**
 * Şifre süresi kontrolü (şifre değiştirme zorunlu mu?)
 */
export async function checkPasswordExpiration(userId: string): Promise<{ expired: boolean; daysRemaining?: number }> {
  const expirationDays = await getSystemSetting<number>('passwordExpirationDays', 0);
  
  // Şifre süresi kontrolü kapalıysa
  if (expirationDays === 0) {
    return { expired: false };
  }
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordChangedAt: true }
  });
  
  if (!user || !user.passwordChangedAt) {
    // Şifre hiç değiştirilmemiş, süresi dolmuş sayılır
    return { expired: true };
  }
  
  const now = new Date();
  const changedAt = user.passwordChangedAt;
  const daysSinceChange = Math.floor((now.getTime() - changedAt.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = expirationDays - daysSinceChange;
  
  return {
    expired: daysSinceChange >= expirationDays,
    daysRemaining: daysRemaining > 0 ? daysRemaining : 0
  };
}

