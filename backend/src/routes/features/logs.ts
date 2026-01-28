import { Router } from 'express';
import { z } from 'zod';
import { readFile, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { logger } from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logDir = path.join(__dirname, '../../../logs');

export const logsRouter = Router();

// Sistem loglarını listele
logsRouter.get('/system', requireAuth, requirePermission('log.read'), async (req, res) => {
  const Query = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
    level: z.enum(['error', 'warn', 'info', 'debug']).optional(),
    date: z.string().optional() // YYYY-MM-DD formatında
  });

  const query = Query.safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({ message: 'Geçersiz istek', issues: query.error.issues });
  }

  const { page, pageSize, level, date } = query.data;

  try {
    // Log dosyalarını listele
    if (!existsSync(logDir)) {
      return res.json({ logs: [], total: 0, page, pageSize });
    }

    const files = await readdir(logDir);
    
    // Tarih filtresi varsa o günün dosyasını seç
    let targetFile = 'combined';
    if (date) {
      targetFile = `combined-${date}`;
    } else {
      // En son combined dosyasını bul
      const combinedFiles = files
        .filter(f => f.startsWith('combined-') && f.endsWith('.log'))
        .sort()
        .reverse();
      if (combinedFiles.length > 0) {
        targetFile = combinedFiles[0].replace('.log', '');
      }
    }

    const logFilePath = path.join(logDir, `${targetFile}.log`);
    
    if (!existsSync(logFilePath)) {
      return res.json({ logs: [], total: 0, page, pageSize });
    }

    // Log dosyasını oku
    const fileContent = await readFile(logFilePath, 'utf-8');
    const lines = fileContent.split('\n').filter(Boolean);

    // JSON logları parse et ve filtrele
    const parsedLogs: Array<{
      timestamp: string;
      level: string;
      message: string;
      service?: string;
      [key: string]: any;
    }> = [];

    for (const line of lines) {
      try {
        const log = JSON.parse(line);
        // Seviye filtresi
        if (level && log.level !== level) continue;
        
        parsedLogs.push({
          timestamp: log.timestamp || '',
          level: log.level || 'info',
          message: log.message || '',
          service: log.service,
          ...log
        });
      } catch {
        // JSON parse edilemeyen satırları atla
        continue;
      }
    }

    // Ters sıralama (en yeni önce)
    parsedLogs.reverse();

    // Sayfalama
    const skip = (page - 1) * pageSize;
    const paginatedLogs = parsedLogs.slice(skip, skip + pageSize);

    return res.json({
      logs: paginatedLogs,
      total: parsedLogs.length,
      page,
      pageSize
    });
  } catch (error: any) {
    logger.error('Log okuma hatası', { error: error.message });
    return res.status(500).json({ message: 'Log dosyası okunamadı', error: error.message });
  }
});

// Log dosyalarını listele
logsRouter.get('/files', requireAuth, requirePermission('log.read'), async (_req, res) => {
  try {
    if (!existsSync(logDir)) {
      return res.json({ files: [] });
    }

    const files = await readdir(logDir);
    const logFiles = (await Promise.all(
      files
        .filter(f => f.endsWith('.log') || f.endsWith('.log.gz'))
        .map(async f => {
          const stats = await stat(path.join(logDir, f));
          return {
            name: f,
            size: stats.size,
            modified: stats.mtime,
            type: f.endsWith('.gz') ? 'compressed' : 'log'
          };
        })
    )).sort((a, b) => b.modified.getTime() - a.modified.getTime());

    return res.json({ files: logFiles });
  } catch (error: any) {
    logger.error('Log dosyaları listeleme hatası', { error: error.message });
    return res.status(500).json({ message: 'Log dosyaları listelenemedi', error: error.message });
  }
});

// Belirli bir log dosyasını indir
logsRouter.get('/files/:filename/download', requireAuth, requirePermission('log.export'), async (req, res) => {
  const Params = z.object({ filename: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ message: 'Geçersiz dosya adı' });
  }

  const filename = params.data.filename;
  const filePath = path.join(logDir, filename);

  // Güvenlik: sadece log dizinindeki dosyalar
  if (!filePath.startsWith(logDir) || !existsSync(filePath)) {
    return res.status(404).json({ message: 'Dosya bulunamadı' });
  }

  try {
    res.download(filePath, filename);
  } catch (error: any) {
    logger.error('Log dosyası indirme hatası', { error: error.message, filename });
    return res.status(500).json({ message: 'Dosya indirilemedi' });
  }
});

