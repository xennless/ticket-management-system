import { prisma } from '../db/prisma.js';
import { logger } from './logger.js';

/**
 * GDPR - Right to be Forgotten
 * Kullanıcının tüm kişisel verilerini siler
 */
export async function deleteUserData(userId: string, requestedBy: string): Promise<{
  success: boolean;
  deleted: {
    user: boolean;
    sessions: number;
    auditLogs: number;
    activityLogs: number;
    notifications: number;
    twoFactorAuth: boolean;
    passwordHistory: number;
    apiKeys: number;
  };
  anonymized: {
    tickets: number;
    ticketMessages: number;
    ticketAttachments: number;
  };
}> {
  const result = {
    success: false,
    deleted: {
      user: false,
      sessions: 0,
      auditLogs: 0,
      activityLogs: 0,
      notifications: 0,
      twoFactorAuth: false,
      passwordHistory: 0,
      apiKeys: 0
    },
    anonymized: {
      tickets: 0,
      ticketMessages: 0,
      ticketAttachments: 0
    }
  };

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Kişisel verileri sil
      // Sessions
      result.deleted.sessions = await tx.session.deleteMany({
        where: { userId }
      }).then(r => r.count);

      // Notifications
      result.deleted.notifications = await tx.notification.deleteMany({
        where: { userId }
      }).then(r => r.count);

      // Two Factor Auth
      const twoFA = await tx.twoFactorAuth.findUnique({ where: { userId } });
      if (twoFA) {
        await tx.twoFactorAuth.delete({ where: { userId } });
        result.deleted.twoFactorAuth = true;
      }

      // Password History
      result.deleted.passwordHistory = await tx.passwordHistory.deleteMany({
        where: { userId }
      }).then(r => r.count);

      // API Keys
      result.deleted.apiKeys = await tx.apiKey.deleteMany({
        where: { userId }
      }).then(r => r.count);

      // 2. Audit ve Activity logları sil (kişisel veri içeriyor)
      result.deleted.auditLogs = await tx.auditLog.deleteMany({
        where: { userId }
      }).then(r => r.count);

      result.deleted.activityLogs = await tx.activityLog.deleteMany({
        where: { userId }
      }).then(r => r.count);

      // 3. Ticket verilerini anonimleştir (iş sürekliliği için)
      // Not: createdById Restrict constraint olduğu için null yapılamaz
      // Bu durumda ticket'lar silinmez, sadece diğer alanlar anonimleştirilir
      // createdById için sistem bir "deleted user" placeholder kullanıcısı oluşturulabilir
      // Şimdilik sadece assignedTo, closedBy, resolvedBy anonimleştiriliyor

      const ticketsAssigned = await tx.ticket.updateMany({
        where: { assignedToId: userId },
        data: { assignedToId: null }
      });

      const ticketsClosed = await tx.ticket.updateMany({
        where: { closedById: userId },
        data: { closedById: null }
      });

      const ticketsResolved = await tx.ticket.updateMany({
        where: { resolvedById: userId },
        data: { resolvedById: null }
      });

      // Ticket Messages - author'ı anonimleştir
      result.anonymized.ticketMessages = await tx.ticketMessage.updateMany({
        where: { authorId: userId },
        data: { authorId: null }
      }).then(r => r.count);

      // Ticket Attachments - uploader'ı anonimleştir
      result.anonymized.ticketAttachments = await tx.ticketAttachment.updateMany({
        where: { uploadedById: userId },
        data: { uploadedById: null }
      }).then(r => r.count);

      // 4. Son olarak kullanıcıyı sil
      await tx.user.delete({
        where: { id: userId }
      });
      result.deleted.user = true;

      // 5. GDPR silme işlemini audit log'a kaydet
      await tx.auditLog.create({
        data: {
          userId: requestedBy,
          entityType: 'User',
          entityId: userId,
          action: 'gdpr_delete',
          newValue: {
            deletedBy: requestedBy,
            deletedAt: new Date(),
            deletedItems: result.deleted,
            anonymizedItems: result.anonymized
          }
        }
      });
    });

    result.success = true;
    logger.info('GDPR veri silme başarılı', { userId, requestedBy, result });

    return result;
  } catch (error) {
    logger.error('GDPR veri silme hatası', { userId, requestedBy, error });
    throw error;
  }
}

/**
 * Kullanıcının tüm verilerini export et (GDPR - Right to Access)
 */
export async function exportUserData(userId: string): Promise<{
  user: any;
  sessions: any[];
  auditLogs: any[];
  activityLogs: any[];
  tickets: any[];
  ticketMessages: any[];
  notifications: any[];
  apiKeys: any[];
}> {
  const [user, sessions, auditLogs, activityLogs, tickets, ticketMessages, notifications, apiKeys] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        lastLoginIp: true,
        roles: {
          select: {
            role: {
              select: {
                id: true,
                code: true,
                name: true
              }
            }
          }
        }
      }
    }),
    prisma.session.findMany({
      where: { userId },
      select: {
        id: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true
      }
    }),
    prisma.auditLog.findMany({
      where: { userId },
      select: {
        id: true,
        entityType: true,
        entityId: true,
        action: true,
        oldValue: true,
        newValue: true,
        ip: true,
        userAgent: true,
        createdAt: true
      }
    }),
    prisma.activityLog.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        description: true,
        metadata: true,
        createdAt: true
      }
    }),
    prisma.ticket.findMany({
      where: {
        OR: [
          { createdById: userId },
          { assignedToId: userId },
          { closedById: userId },
          { resolvedById: userId }
        ]
      },
      select: {
        id: true,
        key: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true
      }
    }),
    prisma.ticketMessage.findMany({
      where: { authorId: userId },
      select: {
        id: true,
        ticketId: true,
        body: true,
        isInternal: true,
        createdAt: true
      }
    }),
    prisma.notification.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        read: true,
        createdAt: true
      }
    }),
    prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true
      }
    })
  ]);

  return {
    user: user ? {
      ...user,
      roles: user.roles?.map((r: any) => r.role) || []
    } : null,
    sessions,
    auditLogs,
    activityLogs,
    tickets,
    ticketMessages,
    notifications,
    apiKeys
  };
}

