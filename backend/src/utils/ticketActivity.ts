import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

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
    logger.error('[ticketActivity] Aktivite kaydetme hatası', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ticketId: data.ticketId,
      userId: data.userId
    });
  }
}

