import { prisma } from '../db/prisma.js';

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
  console.log('🔄 Yetkiler senkronize ediliyor...');
  
  const permissions = await loadDefaultPermissions();
  if (!permissions) {
    console.error('   ❌ DEFAULT_PERMISSIONS yüklenemedi');
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
      console.log(`   ✅ Yeni yetki eklendi: ${perm.code} - ${perm.name}`);
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
        console.log(`   🔄 Yetki güncellendi: ${perm.code} - ${perm.name}`);
      }
    }
  }

  if (addedCount === 0 && updatedCount === 0) {
    console.log('   ✓ Tüm yetkiler güncel');
  } else {
    console.log(`   📊 ${addedCount} yetki eklendi, ${updatedCount} yetki güncellendi`);
  }
}

