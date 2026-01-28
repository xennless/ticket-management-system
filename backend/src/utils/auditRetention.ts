import { prisma } from '../db/prisma.js';
import { logger } from './logger.js';
import { getSystemSetting } from './settings.js';

/**
 * Audit log retention policy uygula
 * Eski logları siler veya arşivler
 */
export async function applyRetentionPolicy(): Promise<{
  deleted: number;
  archived: number;
}> {
  const result = { deleted: 0, archived: 0 };

  try {
    // Retention ayarlarını al
    const retentionDays = await getSystemSetting<number>('auditRetentionDays', 365);
    const retentionAction = await getSystemSetting<string>('auditRetentionAction', 'delete'); // 'delete' veya 'archive'

    if (retentionDays <= 0) {
      logger.info('Audit retention policy devre dışı');
      return result;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    if (retentionAction === 'delete') {
      // Eski logları sil
      const deleted = await prisma.auditLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          }
        }
      });

      result.deleted = deleted.count;
      logger.info('Audit log retention uygulandı', { deleted: result.deleted, cutoffDate });
    } else if (retentionAction === 'archive') {
      // Arşivleme için ayrı bir tablo veya dosya sistemi kullanılabilir
      // Şimdilik sadece log olarak kaydediyoruz
      logger.info('Audit log arşivleme özelliği henüz implement edilmedi');
    }

    return result;
  } catch (error) {
    logger.error('Audit retention policy uygulanırken hata', { error });
    throw error;
  }
}

/**
 * Retention policy'yi manuel olarak çalıştır
 */
export async function runRetentionPolicy(): Promise<void> {
  await applyRetentionPolicy();
}

