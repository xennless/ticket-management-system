import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { createTicketActivity } from '../utils/ticketActivity.js';
import { getSystemSetting } from '../utils/settings.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { sanitizeFileName, validateFileContent, scanFileForVirus, moveToQuarantine } from '../utils/fileSecurity.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads');

// Uploads klasörünü oluştur
fs.mkdir(uploadsDir, { recursive: true }).catch(() => {});

// MIME type mapping (uzantı -> MIME type)
const MIME_TYPE_MAP: Record<string, string[]> = {
  'jpg': ['image/jpeg'],
  'jpeg': ['image/jpeg'],
  'png': ['image/png'],
  'gif': ['image/gif'],
  'webp': ['image/webp'],
  'bmp': ['image/bmp'],
  'svg': ['image/svg+xml'],
  'pdf': ['application/pdf'],
  'doc': ['application/msword'],
  'docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  'xls': ['application/vnd.ms-excel'],
  'xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  'ppt': ['application/vnd.ms-powerpoint'],
  'pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  'txt': ['text/plain'],
  'csv': ['text/csv'],
  'html': ['text/html'],
  'xml': ['text/xml'],
  'json': ['application/json'],
  'zip': ['application/zip'],
  'rar': ['application/x-rar-compressed'],
  '7z': ['application/x-7z-compressed'],
  'gz': ['application/gzip']
};

// Dinamik upload middleware oluştur
async function createUploadMiddleware() {
  const maxFileSizeMB = await getSystemSetting<number>('maxFileSize', 50);
  const allowedFileTypes = await getSystemSetting<string[]>('allowedFileTypes', ['jpg', 'png', 'pdf', 'txt', 'doc', 'docx']);
  const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

  // İzin verilen MIME type'ları oluştur
  const allowedMimeTypes: string[] = [];
  allowedFileTypes.forEach(ext => {
    const mimeTypes = MIME_TYPE_MAP[ext.toLowerCase()];
    if (mimeTypes) {
      allowedMimeTypes.push(...mimeTypes);
    }
  });

  const sanitizeNames = await getSystemSetting<boolean>('fileSanitizeNames', true);
  
  const storage = multer.diskStorage({
    destination: async (_req, _file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      const originalName = file.originalname;
      const sanitized = sanitizeNames ? sanitizeFileName(originalName) : originalName;
      const baseName = path.basename(sanitized, ext);
      cb(null, `ticket-${uniqueSuffix}_${baseName}${ext}`);
    }
  });

  return multer({
    storage,
    limits: {
      fileSize: maxFileSizeBytes
    },
    fileFilter: (_req, file, cb) => {
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Bu dosya türü desteklenmiyor: ${file.mimetype}`));
      }
    }
  });
}

export const ticketAttachmentsRouter = Router();

ticketAttachmentsRouter.use(requireAuth);

// Dosya yükleme logu oluştur
async function logFileUpload(data: {
  fileName: string;
  fileSize: number;
  mimeType?: string;
  status: 'SUCCESS' | 'FAILED' | 'DELETED';
  errorMessage?: string;
  ticketId?: string;
  attachmentId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
}) {
  try {
    await prisma.fileUploadLog.create({
      data: {
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        status: data.status,
        errorMessage: data.errorMessage,
        ticketId: data.ticketId,
        attachmentId: data.attachmentId,
        userId: data.userId,
        ip: data.ip,
        userAgent: data.userAgent
      }
    });
  } catch (err) {
    logger.error('Dosya yükleme logu oluşturulamadı', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      ticketId,
      userId
    });
  }
}

// Ticket'a dosya yükle
ticketAttachmentsRouter.post(
  '/:ticketId/upload',
  requirePermission('ticket.attachment.create'),
  async (req, res, next) => {
    const upload = await createUploadMiddleware();
    upload.single('file')(req, res, async (err) => {
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const fileName = req.file?.originalname || 'unknown';
      const fileSize = req.file?.size || 0;
      const mimeType = req.file?.mimetype;

      if (err) {
        // Dosya yükleme hatası logla
        await logFileUpload({
          fileName,
          fileSize,
          mimeType,
          status: 'FAILED',
          errorMessage: err.message,
          ticketId: req.params.ticketId,
          userId: req.userId,
          ip,
          userAgent
        });

        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            const maxFileSizeMB = await getSystemSetting<number>('maxFileSize', 50);
            return res.status(400).json({ 
              message: `Dosya boyutu çok büyük. Maksimum: ${maxFileSizeMB}MB` 
            });
          }
          return res.status(400).json({ message: `Yükleme hatası: ${err.message}` });
        }
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    const Params = z.object({ ticketId: z.string().min(1) });
    const params = Params.safeParse(req.params);
    
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    if (!params.success) {
      return res.status(400).json({ message: 'Geçersiz istek' });
    }

    if (!req.file) {
      await logFileUpload({
        fileName: 'unknown',
        fileSize: 0,
        status: 'FAILED',
        errorMessage: 'Dosya yüklenmedi',
        ticketId: params.data.ticketId,
        userId: req.userId,
        ip,
        userAgent
      });
      return res.status(400).json({ message: 'Dosya yüklenmedi' });
    }

    // Ticket'ın var olup olmadığını kontrol et
    const ticket = await prisma.ticket.findUnique({
      where: { id: params.data.ticketId }
    });
    
    if (!ticket) {
      // Yüklenen dosyayı sil
      await fs.unlink(req.file.path).catch(() => {});
      
      await logFileUpload({
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        status: 'FAILED',
        errorMessage: 'Ticket bulunamadı',
        ticketId: params.data.ticketId,
        userId: req.userId,
        ip,
        userAgent
      });
      
      return res.status(404).json({ message: 'Ticket bulunamadı' });
    }

    // Dosya güvenlik kontrolleri
    const scanEnabled = await getSystemSetting<boolean>('fileScanEnabled', false);
    const scanMagicBytes = await getSystemSetting<boolean>('fileScanMagicBytes', true);
    const scanVirus = await getSystemSetting<boolean>('fileScanVirus', false);
    const quarantineEnabled = await getSystemSetting<boolean>('fileQuarantineEnabled', true);
    const autoQuarantine = await getSystemSetting<boolean>('fileAutoQuarantine', true);
    
    let scanStatus: 'PENDING' | 'CLEAN' | 'QUARANTINED' | 'SCAN_FAILED' = 'PENDING' as any;
    let detectedMimeType: string | null = null;
    let scanResult: string | null = null;
    let quarantineId: string | null = null;
    let shouldQuarantine = false;
    let quarantineReason: string | null = null;
    let scannedAt: Date | null = null;
    
    // Magic bytes kontrolü
    if (scanEnabled && scanMagicBytes) {
      const contentValidation = await validateFileContent(req.file.path, req.file.mimetype);
      detectedMimeType = contentValidation.detectedMimeType || null;
      
      if (!contentValidation.valid) {
        scanStatus = 'QUARANTINED';
        scanResult = contentValidation.error || 'MIME type uyuşmazlığı';
        shouldQuarantine = true;
        quarantineReason = 'MIME_TYPE_MISMATCH';
      } else if (contentValidation.error) {
        // Uyarı var ama engelleme yok
        scanResult = contentValidation.error;
      }
    }
    
    // Virus taraması
    if (scanEnabled && scanVirus && !shouldQuarantine) {
      const virusScan = await scanFileForVirus(req.file.path);
      
      if (!virusScan.clean) {
        scanStatus = 'QUARANTINED';
        scanResult = virusScan.virusName 
          ? `Virus tespit edildi: ${virusScan.virusName}` 
          : virusScan.error || 'Virus taraması başarısız';
        shouldQuarantine = true;
        quarantineReason = virusScan.virusName ? 'VIRUS' : 'SCAN_FAILED';
      } else if (virusScan.error && autoQuarantine) {
        // Tarama hatası, otomatik karantinaya al
        scanStatus = 'QUARANTINED';
        scanResult = virusScan.error;
        shouldQuarantine = true;
        quarantineReason = 'SCAN_FAILED';
      } else {
        scanStatus = 'CLEAN';
        scannedAt = new Date();
      }
    } else if (!scanEnabled) {
      scanStatus = 'CLEAN'; // Tarama kapalıysa temiz kabul et
      scannedAt = new Date();
    }
    
    // Quarantine işlemi
    let finalFilePath = req.file.filename;
    if (shouldQuarantine && quarantineEnabled) {
      const quarantineDir = path.isAbsolute(env.QUARANTINE_DIR) 
        ? env.QUARANTINE_DIR 
        : path.join(__dirname, '../../', env.QUARANTINE_DIR);
      const quarantinePath = await moveToQuarantine(
        req.file.path,
        req.file.originalname,
        quarantineDir
      );
      finalFilePath = path.relative(path.dirname(quarantineDir), quarantinePath);
      
      // Quarantine kaydı oluştur
      const quarantine = await prisma.quarantineFile.create({
        data: {
          fileName: req.file.originalname,
          sanitizedFileName: sanitizeFileName(req.file.originalname),
          originalPath: req.file.path,
          quarantinePath: quarantinePath,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          detectedMimeType: detectedMimeType,
          scanResult: scanResult,
          reason: quarantineReason || 'SUSPICIOUS',
          ticketId: params.data.ticketId,
          uploadedById: req.userId
        }
      });
      quarantineId = quarantine.id;
    }
    
    const sanitizedFileName = await getSystemSetting<boolean>('fileSanitizeNames', true)
      ? sanitizeFileName(req.file.originalname)
      : req.file.originalname;

    const attachment = await prisma.ticketAttachment.create({
      data: {
        ticketId: params.data.ticketId,
        fileName: req.file.originalname,
        sanitizedFileName: sanitizedFileName,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        detectedMimeType: detectedMimeType,
        filePath: finalFilePath,
        uploadedById: req.userId!,
        scanStatus: scanStatus,
        scanResult: scanResult,
        scannedAt: scannedAt,
        quarantineId: quarantineId
      },
      include: {
        uploadedBy: { select: { id: true, email: true, name: true } }
      }
    });

    // Başarılı yükleme logu
    await logFileUpload({
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      status: 'SUCCESS',
      ticketId: params.data.ticketId,
      attachmentId: attachment.id,
      userId: req.userId,
      ip,
      userAgent
    });

    // Aktivite kaydet: Dosya yüklendi
    await createTicketActivity(prisma, {
      ticketId: params.data.ticketId,
      type: 'file_uploaded',
      userId: req.userId!,
      relatedId: attachment.id,
      metadata: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      }
    });

    return res.status(201).json({ attachment });
  }
);

// Ticket'ın dosyalarını listele
ticketAttachmentsRouter.get(
  '/:ticketId',
  requirePermission('ticket.attachment.read'),
  async (req, res) => {
    const Params = z.object({ ticketId: z.string().min(1) });
    const params = Params.safeParse(req.params);
    if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

    const attachments = await prisma.ticketAttachment.findMany({
      where: { ticketId: params.data.ticketId },
      include: {
        uploadedBy: { select: { id: true, email: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ attachments });
  }
);

// Dosya görüntüle/indir
ticketAttachmentsRouter.get(
  '/:ticketId/download/:attachmentId',
  requirePermission('ticket.attachment.read'),
  async (req, res) => {
    const Params = z.object({
      ticketId: z.string().min(1),
      attachmentId: z.string().min(1)
    });
    const Query = z.object({
      inline: z.coerce.boolean().optional()
    });
    
    const params = Params.safeParse(req.params);
    const query = Query.safeParse(req.query);
    
    if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

    const attachment = await prisma.ticketAttachment.findFirst({
      where: {
        id: params.data.attachmentId,
        ticketId: params.data.ticketId
      }
    });

    if (!attachment) {
      return res.status(404).json({ message: 'Dosya bulunamadı' });
    }

    // Quarantine'de mi kontrol et
    if (attachment.quarantineId) {
      return res.status(403).json({ 
        message: 'Bu dosya güvenlik nedeniyle karantinaya alınmıştır',
        scanStatus: attachment.scanStatus,
        scanResult: attachment.scanResult
      });
    }
    
    // Dosya yolu belirle (normal veya quarantine)
    let filePath: string;
    if (attachment.scanStatus === 'QUARANTINED' && attachment.quarantineId) {
      const quarantine = await prisma.quarantineFile.findUnique({
        where: { id: attachment.quarantineId }
      });
      if (quarantine) {
        filePath = quarantine.quarantinePath;
      } else {
        filePath = path.join(uploadsDir, attachment.filePath);
      }
    } else {
      filePath = path.join(uploadsDir, attachment.filePath);
    }
    
    try {
      await fs.access(filePath);
      
      // Türkçe karakter desteği için RFC 5987 encoding
      const isInline = query.success && query.data.inline === true;
      const dispositionType = isInline ? 'inline' : 'attachment';
      
      const encodedFileName = encodeURIComponent(attachment.fileName);
      const asciiFileName = attachment.fileName.replace(/[^\x20-\x7E]/g, '_');
      const contentDisposition = `${dispositionType}; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`;
      
      res.setHeader('Content-Type', attachment.mimeType);
      res.setHeader('Content-Disposition', contentDisposition);
      
      return res.sendFile(filePath);
    } catch {
      return res.status(404).json({ message: 'Dosya bulunamadı' });
    }
  }
);

// Dosya sil
ticketAttachmentsRouter.delete(
  '/:ticketId/:attachmentId',
  requirePermission('ticket.attachment.delete'),
  async (req, res) => {
    const Params = z.object({
      ticketId: z.string().min(1),
      attachmentId: z.string().min(1)
    });
    const params = Params.safeParse(req.params);
    if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const attachment = await prisma.ticketAttachment.findFirst({
      where: {
        id: params.data.attachmentId,
        ticketId: params.data.ticketId
      }
    });

    if (!attachment) {
      return res.status(404).json({ message: 'Dosya bulunamadı' });
    }

    // Dosyayı sil
    const filePath = path.join(uploadsDir, attachment.filePath);
    await fs.unlink(filePath).catch(() => {});

    // Veritabanından sil
    await prisma.ticketAttachment.delete({
      where: { id: params.data.attachmentId }
    });

    // Silme logu
    await logFileUpload({
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      status: 'DELETED',
      ticketId: params.data.ticketId,
      attachmentId: params.data.attachmentId,
      userId: req.userId,
      ip,
      userAgent
    });

    return res.json({ success: true });
  }
);

// Dosya yükleme ayarlarını getir
ticketAttachmentsRouter.get('/settings/info', requireAuth, async (_req, res) => {
  const maxFileSizeMB = await getSystemSetting<number>('maxFileSize', 50);
  const allowedFileTypes = await getSystemSetting<string[]>('allowedFileTypes', ['jpg', 'png', 'pdf', 'txt', 'doc', 'docx']);
  
  // MIME type'ları oluştur
  const allowedMimeTypes: string[] = [];
  allowedFileTypes.forEach(ext => {
    const mimeTypes = MIME_TYPE_MAP[ext.toLowerCase()];
    if (mimeTypes) {
      allowedMimeTypes.push(...mimeTypes);
    }
  });

  return res.json({
    maxFileSize: maxFileSizeMB * 1024 * 1024,
    maxFileSizeMB,
    allowedFileTypes,
    allowedMimeTypes
  });
});
