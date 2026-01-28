import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { hashPassword } from './password.js';
import { prisma } from '../db/prisma.js';
import { getSystemSetting } from './settings.js';

type ImportUser = {
  email: string;
  name?: string;
  password?: string;
};

type ImportResult = {
  imported: number;
  errors: Array<{ row: number; error: string }>;
};

export async function importFromCSV(csvData: string): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, errors: [] };
  const minPasswordLength = await getSystemSetting<number>('minPasswordLength', 8);

  return new Promise((resolve) => {
    Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          try {
            const email = (row.email || row.Email || '').trim().toLowerCase();
            const name = (row.name || row.Name || row.İsim || '').trim() || null;
            const password = (row.password || row.Password || row.Şifre || '').trim();

            if (!email || !email.includes('@')) {
              result.errors.push({ row: i + 2, error: 'Geçersiz email' });
              continue;
            }

            if (!password || password.length < minPasswordLength) {
              result.errors.push({ row: i + 2, error: `Şifre en az ${minPasswordLength} karakter olmalı` });
              continue;
            }

            // Kullanıcı zaten var mı kontrol et
            const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
            if (existing) {
              result.errors.push({ row: i + 2, error: 'Email zaten kullanılıyor' });
              continue;
            }

            const passwordHash = await hashPassword(password);

            await prisma.user.create({
              data: {
                email,
                name,
                passwordHash,
                isActive: true
              }
            });

            result.imported++;
          } catch (error: any) {
            result.errors.push({ row: i + 2, error: error.message || 'Bilinmeyen hata' });
          }
        }

        resolve(result);
      },
      error: (error: Error) => {
        result.errors.push({ row: 0, error: `CSV parse hatası: ${error.message}` });
        resolve(result);
      }
    });
  });
}

export async function importFromExcel(excelBuffer: Buffer): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, errors: [] };
  const minPasswordLength = await getSystemSetting<number>('minPasswordLength', 8);

  try {
    const workbook = XLSX.read(excelBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet) as any[];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const email = (row.email || row.Email || '').toString().trim().toLowerCase();
        const name = (row.name || row.Name || row.İsim || '').toString().trim() || null;
        const password = (row.password || row.Password || row.Şifre || '').toString().trim();

        if (!email || !email.includes('@')) {
          result.errors.push({ row: i + 2, error: 'Geçersiz email' });
          continue;
        }

        if (!password || password.length < minPasswordLength) {
          result.errors.push({ row: i + 2, error: `Şifre en az ${minPasswordLength} karakter olmalı` });
          continue;
        }

        // Kullanıcı zaten var mı kontrol et
        const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
        if (existing) {
          result.errors.push({ row: i + 2, error: 'Email zaten kullanılıyor' });
          continue;
        }

        const passwordHash = await hashPassword(password);

        await prisma.user.create({
          data: {
            email,
            name,
            passwordHash,
            isActive: true
          }
        });

        result.imported++;
      } catch (error: any) {
        result.errors.push({ row: i + 2, error: error.message || 'Bilinmeyen hata' });
      }
    }
  } catch (error: any) {
    result.errors.push({ row: 0, error: `Excel parse hatası: ${error.message}` });
  }

  return result;
}

