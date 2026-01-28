import path from 'path';
import { z } from 'zod';

/**
 * XSS koruması - HTML içeriğini temizle
 * Basit bir HTML sanitization (production'da DOMPurify gibi bir kütüphane kullanılabilir)
 */
export function sanitizeHtml(html: string): string {
  // Tehlikeli HTML tag'lerini ve attribute'ları temizle
  return html
    // Script tag'lerini kaldır
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Event handler'ları kaldır (onclick, onerror, vb.)
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
    // JavaScript: protocol'ünü kaldır
    .replace(/javascript:/gi, '')
    // data: URL'lerini kontrol et (sadece güvenli MIME type'lar)
    .replace(/data:(?!image\/(png|jpeg|gif|webp|svg\+xml);base64,)/gi, '')
    // iframe'leri kaldır
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    // Object ve embed tag'lerini kaldır
    .replace(/<(object|embed)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '');
}

/**
 * XSS koruması - String içeriğini temizle (HTML olmayan)
 */
export function sanitizeString(input: string): string {
  return input
    // Null byte'ları kaldır
    .replace(/\0/g, '')
    // Kontrol karakterlerini kaldır (0x00-0x1F, 0x7F)
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Trim
    .trim();
}

/**
 * Path traversal koruması - Dosya yolu güvenli mi kontrol et
 */
export function validatePath(filePath: string, baseDir: string): { valid: boolean; error?: string; normalizedPath?: string } {
  try {
    // Path'i normalize et
    const normalized = path.normalize(filePath);
    
    // Absolute path kontrolü
    if (path.isAbsolute(normalized)) {
      // Base directory'ye göre resolve et
      const resolved = path.resolve(baseDir, normalized);
      const baseResolved = path.resolve(baseDir);
      
      // Path traversal kontrolü - base directory dışına çıkmamalı
      if (!resolved.startsWith(baseResolved + path.sep) && resolved !== baseResolved) {
        return { valid: false, error: 'Path traversal tespit edildi' };
      }
      
      return { valid: true, normalizedPath: resolved };
    }
    
    // Relative path için
    const resolved = path.resolve(baseDir, normalized);
    const baseResolved = path.resolve(baseDir);
    
    if (!resolved.startsWith(baseResolved + path.sep) && resolved !== baseResolved) {
      return { valid: false, error: 'Path traversal tespit edildi' };
    }
    
    return { valid: true, normalizedPath: resolved };
  } catch (error: any) {
    return { valid: false, error: `Path validation hatası: ${error.message}` };
  }
}

/**
 * Command injection koruması - Shell command'lerinde tehlikeli karakterleri kontrol et
 */
export function validateCommand(input: string): { valid: boolean; error?: string; sanitized?: string } {
  // Tehlikeli karakterler ve pattern'ler
  const dangerousPatterns = [
    /[;&|`$(){}[\]]/,  // Command chaining
    /\$\(/,            // Command substitution
    /`/,               // Backtick
    /\$\{/,            // Variable expansion
    /<|>/,             // Redirection
    /\n/,              // Newline injection
    /\r/,              // Carriage return
    /&&|\|\|/,         // Logical operators
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(input)) {
      return { valid: false, error: 'Command injection tespit edildi' };
    }
  }
  
  // Sanitize et
  const sanitized = input
    .replace(/[;&|`$(){}[\]<>]/g, '')
    .replace(/\n|\r/g, '')
    .trim();
  
  return { valid: true, sanitized };
}

/**
 * SQL injection koruması - Prisma kullanıyoruz ama ek kontrol için
 * Sadece basit pattern kontrolü (Prisma zaten parametrize query kullanıyor)
 */
export function validateSqlInput(input: string): { valid: boolean; error?: string } {
  // SQL injection pattern'leri
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/i,
    /(--|#|\/\*|\*\/)/,  // SQL comments
    /(;|\||&)/,          // Command separators
    /('|"|`)/,            // Quote injection
    /(\bor\b|\band\b)/i, // SQL operators (basit kontrol)
  ];
  
  for (const pattern of sqlPatterns) {
    if (pattern.test(input)) {
      return { valid: false, error: 'SQL injection pattern tespit edildi' };
    }
  }
  
  return { valid: true };
}

/**
 * URL validation - Güvenli URL kontrolü
 */
export function validateUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    
    // Sadece HTTP ve HTTPS protokollerine izin ver
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Sadece HTTP ve HTTPS protokolleri desteklenir' };
    }
    
    // JavaScript ve data URL'lerini engelle
    if (parsed.protocol === 'javascript:' || parsed.protocol === 'data:') {
      return { valid: false, error: 'Güvensiz protokol' };
    }
    
    return { valid: true };
  } catch {
    return { valid: false, error: 'Geçersiz URL formatı' };
  }
}

/**
 * Email validation - Zod ile birlikte kullanılabilir
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  // Basit email regex (Zod'da zaten var ama ek kontrol için)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Geçersiz email formatı' };
  }
  
  // Email uzunluk kontrolü
  if (email.length > 254) {
    return { valid: false, error: 'Email çok uzun' };
  }
  
  return { valid: true };
}

/**
 * File name sanitization - Dosya adı güvenli mi kontrol et
 */
export function sanitizeFileName(fileName: string): string {
  // Tehlikeli karakterleri temizle
  return fileName
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')  // Windows/Linux yasak karakterler
    .replace(/\s+/g, '_')                     // Boşlukları alt çizgi ile değiştir
    .replace(/_{2,}/g, '_')                   // Çoklu alt çizgileri tek yap
    .replace(/^_+|_+$/g, '')                  // Başta ve sonda alt çizgileri kaldır
    .substring(0, 255);                       // Max uzunluk
}

/**
 * Zod schema extension - XSS koruması ile string validation
 */
export const safeString = z.string().transform((val) => sanitizeString(val));

/**
 * Zod schema extension - HTML sanitization ile
 */
export const safeHtml = z.string().transform((val) => sanitizeHtml(val));

/**
 * Zod schema extension - Path validation ile
 */
export function safePath(baseDir: string) {
  return z.string().refine(
    (val) => {
      const result = validatePath(val, baseDir);
      return result.valid;
    },
    { message: 'Geçersiz dosya yolu' }
  );
}

/**
 * Input validation log - Güvenlik olaylarını logla
 */
export interface ValidationLog {
  type: 'XSS' | 'PATH_TRAVERSAL' | 'COMMAND_INJECTION' | 'SQL_INJECTION' | 'INVALID_URL' | 'INVALID_EMAIL';
  input: string;
  error: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  timestamp: Date;
}

// Log storage (production'da database'e kaydedilebilir)
const validationLogs: ValidationLog[] = [];

export function logValidation(log: ValidationLog): void {
  validationLogs.push(log);
  // Production'da logger'a gönder
  if (process.env.NODE_ENV === 'production') {
    console.warn('[VALIDATION]', log);
  }
}

export function getValidationLogs(limit: number = 100): ValidationLog[] {
  return validationLogs.slice(-limit);
}

