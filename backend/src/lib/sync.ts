import { prisma } from '../db/prisma.js';
import { logger } from '../utils/logger.js';

// DEFAULT_PERMISSIONS'ı seed.ts'den import ediyoruz
// Seed dosyası ES module olduğu için dynamic import kullanıyoruz
let DEFAULT_PERMISSIONS: Array<{ code: string; name: string; description: string }> | null = null;

async function loadDefaultPermissions() {
  if (!DEFAULT_PERMISSIONS) {
    const seedModule = await import('../../prisma/seed.js');
    DEFAULT_PERMISSIONS = seedModule.DEFAULT_PERMISSIONS;
  }
  return DEFAULT_PERMISSIONS;
}

/**
 * Sistem başlangıcında permission'ları senkronize et
 * Yeni eklenen permission'ları otomatik olarak veritabanına ekler
 * Mevcut permission'ların isim ve açıklamalarını günceller
 */
export async function syncPermissions() {
  logger.info('🔄 Yetkiler senkronize ediliyor...');
  
  const permissions = await loadDefaultPermissions();
  if (!permissions) {
    logger.error('DEFAULT_PERMISSIONS yüklenemedi');
    return;
  }
  
  let addedCount = 0;
  let updatedCount = 0;

  for (const perm of permissions) {
    const existing = await prisma.permission.findUnique({
      where: { code: perm.code }
    });

    if (!existing) {
      // Yeni yetki ekle
      await prisma.permission.create({
        data: {
          code: perm.code,
          name: perm.name,
          description: perm.description,
          isSystem: true
        }
      });
      addedCount++;
      logger.info('Yeni yetki eklendi', { code: perm.code, name: perm.name });
    } else {
      // Mevcut yetkinin isim ve açıklamasını güncelle (sistem yetkileri için)
      if (existing.isSystem && (
        existing.name !== perm.name || 
        existing.description !== perm.description
      )) {
        await prisma.permission.update({
          where: { code: perm.code },
          data: {
            name: perm.name,
            description: perm.description
          }
        });
        updatedCount++;
        logger.info('Yetki güncellendi', { code: perm.code, name: perm.name });
      }
    }
  }

  if (addedCount === 0 && updatedCount === 0) {
    logger.info('Tüm yetkiler güncel');
  } else {
    logger.info('Yetki senkronizasyonu tamamlandı', { added: addedCount, updated: updatedCount });
  }
}

