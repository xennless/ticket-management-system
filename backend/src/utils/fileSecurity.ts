import fs from 'fs/promises';
import path from 'path';

// Magic bytes (file signatures) - Dosya içeriği doğrulama için
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46], [0x57, 0x45, 0x42, 0x50]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
  'application/zip': [[0x50, 0x4B, 0x03, 0x04], [0x50, 0x4B, 0x05, 0x06], [0x50, 0x4B, 0x07, 0x08]],
  'application/x-rar-compressed': [[0x52, 0x61, 0x72, 0x21, 0x1A, 0x07]],
  'application/msword': [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [[0x50, 0x4B, 0x03, 0x04]],
  'application/vnd.ms-excel': [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [[0x50, 0x4B, 0x03, 0x04]],
  'text/plain': [] // Text dosyaları için magic bytes yok
};

/**
 * Dosya adını sanitize et (güvenli karakterlere çevir)
 */
export function sanitizeFileName(fileName: string): string {
  // Dosya adından uzantıyı ayır
  const ext = path.extname(fileName);
  const nameWithoutExt = path.basename(fileName, ext);
  
  // Tehlikeli karakterleri temizle
  let sanitized = nameWithoutExt
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') // Windows/Linux yasak karakterler
    .replace(/\s+/g, '_') // Boşlukları alt çizgi ile değiştir
    .replace(/_{2,}/g, '_') // Çoklu alt çizgileri tek yap
    .replace(/^_+|_+$/g, ''); // Başta ve sonda alt çizgileri kaldır
  
  // Çok uzun dosya adlarını kısalt (max 200 karakter)
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 200);
  }
  
  // Boşsa varsayılan ad ver
  if (!sanitized) {
    sanitized = 'file';
  }
  
  return sanitized + ext;
}

/**
 * Dosyanın magic bytes'ını oku ve MIME type'ını tespit et
 */
export async function detectMimeTypeFromContent(filePath: string): Promise<string | null> {
  try {
    const buffer = Buffer.alloc(16); // İlk 16 byte yeterli
    const fileHandle = await fs.open(filePath, 'r');
    const { bytesRead } = await fileHandle.read(buffer, 0, 16, 0);
    await fileHandle.close();
    
    if (bytesRead === 0) return null;
    
    const fileBytes = Array.from(buffer.slice(0, bytesRead));
    
    // Her MIME type için kontrol et
    for (const [mimeType, signatures] of Object.entries(MAGIC_BYTES)) {
      if (signatures.length === 0) continue; // Text dosyaları için atla
      
      for (const signature of signatures) {
        if (fileBytes.length >= signature.length) {
          const matches = signature.every((byte, index) => fileBytes[index] === byte);
          if (matches) {
            return mimeType;
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('MIME type tespit hatası:', error);
    return null;
  }
}

/**
 * Dosya içeriği ile bildirilen MIME type'ı karşılaştır
 */
export async function validateFileContent(
  filePath: string,
  reportedMimeType: string
): Promise<{ valid: boolean; detectedMimeType: string | null; error?: string }> {
  const detectedMimeType = await detectMimeTypeFromContent(filePath);
  
  if (!detectedMimeType) {
    // Magic bytes ile tespit edilemedi, bildirilen MIME type'ı kabul et
    return { valid: true, detectedMimeType: null };
  }
  
  // MIME type'ları karşılaştır (base type'ları kontrol et)
  const reportedBase = reportedMimeType.split('/')[0];
  const detectedBase = detectedMimeType.split('/')[0];
  
  if (reportedBase !== detectedBase) {
    return {
      valid: false,
      detectedMimeType,
      error: `Dosya içeriği bildirilen MIME type ile uyuşmuyor. Bildirilen: ${reportedMimeType}, Tespit edilen: ${detectedMimeType}`
    };
  }
  
  // Aynı base type ama farklı subtype (örn: image/jpeg vs image/png)
  // Bu durumda uyarı ver ama engelleme
  if (reportedMimeType !== detectedMimeType) {
    return {
      valid: true,
      detectedMimeType,
      error: `MIME type uyarısı: Bildirilen ${reportedMimeType}, tespit edilen ${detectedMimeType}`
    };
  }
  
  return { valid: true, detectedMimeType };
}

/**
 * ClamAV ile virus taraması (opsiyonel - ClamAV yüklü değilse false döner)
 */
export async function scanFileForVirus(filePath: string): Promise<{
  clean: boolean;
  virusName?: string;
  error?: string;
}> {
  try {
    // ClamAV'nin yüklü olup olmadığını kontrol et
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    try {
      await execAsync('clamdscan --version');
    } catch {
      // ClamAV yüklü değil, tarama yapılamaz
      return { clean: true, error: 'ClamAV yüklü değil, tarama atlandı' };
    }
    
    // ClamAV ile tarama yap
    const { stdout, stderr } = await execAsync(`clamdscan "${filePath}"`);
    
    if (stderr && stderr.includes('FOUND')) {
      // Virus bulundu
      const virusMatch = stderr.match(/FOUND: (.+)/);
      const virusName = virusMatch ? virusMatch[1] : 'Bilinmeyen virus';
      return { clean: false, virusName };
    }
    
    if (stdout && stdout.includes('OK')) {
      return { clean: true };
    }
    
    return { clean: true, error: 'Tarama sonucu belirsiz' };
  } catch (error: any) {
    // ClamAV hatası, güvenli tarafta kal ve dosyayı karantinaya al
    return { clean: false, error: `Tarama hatası: ${error.message}` };
  }
}

/**
 * Dosyayı quarantine klasörüne taşı
 */
export async function moveToQuarantine(
  originalPath: string,
  fileName: string,
  quarantineDir: string
): Promise<string> {
  // Quarantine klasörünü oluştur
  await fs.mkdir(quarantineDir, { recursive: true });
  
  // Quarantine dosya adı oluştur
  const timestamp = Date.now();
  const sanitized = sanitizeFileName(fileName);
  const quarantineFileName = `${timestamp}_${sanitized}`;
  const quarantinePath = path.join(quarantineDir, quarantineFileName);
  
  // Dosyayı taşı
  await fs.rename(originalPath, quarantinePath);
  
  return quarantinePath;
}

