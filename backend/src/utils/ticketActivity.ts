import { PrismaClient } from '@prisma/client';

/**
 * Ticket aktivitesi kaydet
 */
export async function createTicketActivity(
  prisma: PrismaClient,
  data: {
    ticketId: string;
    type: string;
    userId?: string | null;
    metadata?: any;
    relatedId?: string | null;
  }
): Promise<void> {
  try {
    await prisma.ticketActivity.create({
      data: {
        ticketId: data.ticketId,
        type: data.type,
        userId: data.userId || null,
        metadata: data.metadata || null,
        relatedId: data.relatedId || null
      }
    });
  } catch (error) {
    // Aktivite kaydetme hatası uygulamayı durdurmamalı
    console.error('[ticketActivity] Aktivite kaydetme hatası:', error);
  }
}

