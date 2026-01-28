import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const quarantineRouter = Router();

quarantineRouter.use(requireAuth);

// Quarantine dosyalarını listele
quarantineRouter.get('/', requirePermission('quarantine.read'), async (req, res) => {
  const Query = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
    reason: z.enum(['VIRUS', 'MIME_TYPE_MISMATCH', 'SUSPICIOUS', 'SCAN_FAILED', 'MANUAL']).optional(),
    search: z.string().optional()
  });
  
  const query = Query.safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({ message: 'Geçersiz istek', issues: query.error.issues });
  }
  
  const { page, pageSize, reason, search } = query.data;
  const skip = (page - 1) * pageSize;
  
  const where: any = {
    deletedAt: null
  };
  
  if (reason) {
    where.reason = reason;
  }
  
  if (search) {
    where.OR = [
      { fileName: { contains: search, mode: 'insensitive' } },
      { sanitizedFileName: { contains: search, mode: 'insensitive' } },
      { scanResult: { contains: search, mode: 'insensitive' } }
    ];
  }
  
  const [files, total] = await Promise.all([
    prisma.quarantineFile.findMany({
      where,
      include: {
        uploadedBy: { select: { id: true, email: true, name: true } },
        releasedBy: { select: { id: true, email: true, name: true } },
        attachment: {
          include: {
            ticket: { select: { id: true, key: true, title: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize
    }),
    prisma.quarantineFile.count({ where })
  ]);
  
  return res.json({
    files,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  });
});

// Quarantine istatistikleri
quarantineRouter.get('/stats', requirePermission('quarantine.read'), async (_req, res) => {
  const [total, byReason, byStatus] = await Promise.all([
    prisma.quarantineFile.count({ where: { deletedAt: null } }),
    prisma.quarantineFile.groupBy({
      by: ['reason'],
      where: { deletedAt: null },
      _count: true
    }),
    prisma.ticketAttachment.groupBy({
      by: ['scanStatus'],
      _count: true
    })
  ]);
  
  const released = await prisma.quarantineFile.count({
    where: { deletedAt: null, releasedAt: { not: null } }
  });
  
  return res.json({
    total,
    released,
    active: total - released,
    byReason: byReason.reduce((acc, item) => {
      acc[item.reason] = item._count;
      return acc;
    }, {} as Record<string, number>),
    byStatus: byStatus.reduce((acc, item) => {
      acc[item.scanStatus] = item._count;
      return acc;
    }, {} as Record<string, number>)
  });
});

// Quarantine dosyasını serbest bırak (release)
quarantineRouter.post('/:id/release', requirePermission('quarantine.manage'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  
  if (!params.success) {
    return res.status(400).json({ message: 'Geçersiz istek' });
  }
  
  const quarantine = await prisma.quarantineFile.findUnique({
    where: { id: params.data.id },
    include: { attachment: true }
  });
  
  if (!quarantine) {
    return res.status(404).json({ message: 'Quarantine kaydı bulunamadı' });
  }
  
  if (quarantine.releasedAt) {
    return res.status(400).json({ message: 'Bu dosya zaten serbest bırakılmış' });
  }
  
  if (quarantine.deletedAt) {
    return res.status(400).json({ message: 'Bu dosya silinmiş' });
  }
  
  // Dosyayı normal uploads klasörüne taşı
  const uploadsDir = path.join(__dirname, '../../../uploads');
  const fileName = path.basename(quarantine.quarantinePath);
  const newPath = path.join(uploadsDir, fileName);
  
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.rename(quarantine.quarantinePath, newPath);
    
    // Attachment'ı güncelle
    if (quarantine.attachmentId) {
      await prisma.ticketAttachment.update({
        where: { id: quarantine.attachmentId },
        data: {
          scanStatus: 'CLEAN',
          filePath: fileName,
          quarantineId: null
        }
      });
    }
    
    // Quarantine kaydını güncelle
    await prisma.quarantineFile.update({
      where: { id: params.data.id },
      data: {
        releasedAt: new Date(),
        releasedById: req.userId
      }
    });
    
    return res.json({ success: true, message: 'Dosya serbest bırakıldı' });
  } catch (error: any) {
    return res.status(500).json({ message: 'Dosya taşıma hatası', error: error.message });
  }
});

// Quarantine dosyasını kalıcı olarak sil
quarantineRouter.delete('/:id', requirePermission('quarantine.manage'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  
  if (!params.success) {
    return res.status(400).json({ message: 'Geçersiz istek' });
  }
  
  const quarantine = await prisma.quarantineFile.findUnique({
    where: { id: params.data.id }
  });
  
  if (!quarantine) {
    return res.status(404).json({ message: 'Quarantine kaydı bulunamadı' });
  }
  
  if (quarantine.deletedAt) {
    return res.status(400).json({ message: 'Bu dosya zaten silinmiş' });
  }
  
  try {
    // Dosyayı fiziksel olarak sil
    await fs.unlink(quarantine.quarantinePath).catch(() => {});
    
    // Attachment'ı sil
    if (quarantine.attachmentId) {
      await prisma.ticketAttachment.delete({
        where: { id: quarantine.attachmentId }
      }).catch(() => {});
    }
    
    // Quarantine kaydını güncelle
    await prisma.quarantineFile.update({
      where: { id: params.data.id },
      data: {
        deletedAt: new Date(),
        deletedById: req.userId
      }
    });
    
    return res.json({ success: true, message: 'Dosya kalıcı olarak silindi' });
  } catch (error: any) {
    return res.status(500).json({ message: 'Silme hatası', error: error.message });
  }
});

// Quarantine dosyasını indir (sadece görüntüleme için)
quarantineRouter.get('/:id/download', requirePermission('quarantine.read'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  
  if (!params.success) {
    return res.status(400).json({ message: 'Geçersiz istek' });
  }
  
  const quarantine = await prisma.quarantineFile.findUnique({
    where: { id: params.data.id }
  });
  
  if (!quarantine) {
    return res.status(404).json({ message: 'Quarantine kaydı bulunamadı' });
  }
  
  try {
    await fs.access(quarantine.quarantinePath);
    
    const encodedFileName = encodeURIComponent(quarantine.fileName);
    const asciiFileName = quarantine.fileName.replace(/[^\x20-\x7E]/g, '_');
    const contentDisposition = `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`;
    
    res.setHeader('Content-Type', quarantine.mimeType);
    res.setHeader('Content-Disposition', contentDisposition);
    res.setHeader('X-Quarantine-Status', 'QUARANTINED');
    res.setHeader('X-Quarantine-Reason', quarantine.reason);
    
    return res.sendFile(quarantine.quarantinePath);
  } catch {
    return res.status(404).json({ message: 'Dosya bulunamadı' });
  }
});

