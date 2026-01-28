import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { exportToCSV, exportToExcel, exportToPDF } from '../../utils/export.js';
import { importFromCSV, importFromExcel } from '../../utils/import.js';

export const importExportRouter = Router();

importExportRouter.use(requireAuth);

// Kullanıcıları dışa aktar
importExportRouter.get('/users/export', requirePermission('user.export'), async (req, res) => {
  const Query = z.object({
    format: z.enum(['csv', 'excel', 'pdf']).optional().default('csv')
  });
  const query = Query.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      createdAt: true,
      lastLoginAt: true
    },
    orderBy: { createdAt: 'desc' }
  });

  const format = query.data.format;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

  if (format === 'csv') {
    const csv = exportToCSV(users);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="kullanicilar-${timestamp}.csv"`);
    return res.send('\ufeff' + csv); // BOM for Excel UTF-8 support
  } else if (format === 'excel') {
    const excel = exportToExcel(users);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="kullanicilar-${timestamp}.xlsx"`);
    return res.send(excel);
  } else if (format === 'pdf') {
    const pdf = await exportToPDF(users);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="kullanicilar-${timestamp}.pdf"`);
    return res.send(pdf);
  }

  return res.status(400).json({ message: 'Geçersiz format' });
});

// Kullanıcıları içe aktar
importExportRouter.post('/users/import', requirePermission('user.import'), async (req, res) => {
  const Body = z.object({
    data: z.string(), // CSV data (base64 encoded for Excel)
    format: z.enum(['csv', 'excel']).optional().default('csv'),
    filename: z.string().optional()
  });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek' });

  try {
    let result;

    if (body.data.format === 'csv') {
      result = await importFromCSV(body.data.data);
    } else if (body.data.format === 'excel') {
      // Excel data base64 encoded olarak geliyor
      const buffer = Buffer.from(body.data.data, 'base64');
      result = await importFromExcel(buffer);
    } else {
      return res.status(400).json({ message: 'Geçersiz format' });
    }

    return res.json({
      success: true,
      imported: result.imported,
      errors: result.errors,
      total: result.imported + result.errors.length
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Import hatası', error: error.message });
  }
});

