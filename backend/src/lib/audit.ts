import type { Request } from 'express';
import { prisma } from '../db/prisma.js';
import { logger } from '../utils/logger.js';

/**
 * Audit log oluşturur
 * @param req Express request objesi (userId ve IP için)
 * @param action Yapılan işlem (create, update, delete)
 * @param entityType Entity tipi (User, Role, Group, Ticket, vb.)
 * @param entityId Entity ID
 * @param data Ek veriler (eski/yeni değerler)
 */
export async function audit(
  req: Request,
  action: string,
  entityType: string,
  entityId: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    const userId = req.userId;
    const ip = req.ip || req.socket?.remoteAddress || null;

    await prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId,
        userId,
        ip,
        newValue: data || null
      }
    });
  } catch (error) {
    // Audit log hatası uygulamayı durdurmamalı
    logger.error('[audit] Log oluşturma hatası', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      action,
      entityType,
      entityId
    });
  }
}

/**
 * Değişiklikleri karşılaştırarak audit log oluşturur
 */
export async function auditWithChanges(
  req: Request,
  action: string,
  entityType: string,
  entityId: string,
  oldValue: Record<string, any> | null,
  newValue: Record<string, any> | null
): Promise<void> {
  try {
    const userId = req.userId;
    const ip = req.ip || req.socket?.remoteAddress || null;

    await prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId,
        userId,
        ip,
        oldValue,
        newValue
      }
    });
  } catch (error) {
    logger.error('[audit] Log oluşturma hatası', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      action,
      entityType,
      entityId,
      changes: data
    });
  }
}

