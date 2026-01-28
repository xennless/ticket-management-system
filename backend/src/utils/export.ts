import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';

type UserExportData = {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
};

export function exportToCSV(users: UserExportData[]): string {
  const headers = ['ID', 'Email', 'İsim', 'Aktif', 'Oluşturulma', 'Son Giriş'];
  const rows = users.map((u) => [
    u.id,
    u.email,
    u.name || '',
    u.isActive ? 'Evet' : 'Hayır',
    u.createdAt.toISOString(),
    u.lastLoginAt ? u.lastLoginAt.toISOString() : ''
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

  return csvContent;
}

export function exportToExcel(users: UserExportData[]): Buffer {
  const worksheetData = [
    ['ID', 'Email', 'İsim', 'Aktif', 'Oluşturulma', 'Son Giriş'],
    ...users.map((u) => [
      u.id,
      u.email,
      u.name || '',
      u.isActive ? 'Evet' : 'Hayır',
      u.createdAt.toISOString(),
      u.lastLoginAt ? u.lastLoginAt.toISOString() : ''
    ])
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Kullanıcılar');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}

export function exportToPDF(users: UserExportData[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Başlık
    doc.fontSize(20).text('Kullanıcı Listesi', { align: 'center' });
    doc.moveDown();

    // Tarih
    doc.fontSize(10).text(`Oluşturulma: ${new Date().toLocaleString('tr-TR')}`, { align: 'right' });
    doc.moveDown(2);

    // Tablo başlıkları
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('Email', 50, doc.y);
    doc.text('İsim', 250, doc.y);
    doc.text('Aktif', 400, doc.y);
    doc.text('Oluşturulma', 480, doc.y);
    doc.moveDown();

    // Veriler
    doc.font('Helvetica').fontSize(10);
    users.forEach((u, index) => {
      if (doc.y > 700) {
        doc.addPage();
        // Yeni sayfada başlıkları tekrar yaz
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('Email', 50, 50);
        doc.text('İsim', 250, 50);
        doc.text('Aktif', 400, 50);
        doc.text('Oluşturulma', 480, 50);
        doc.moveDown();
        doc.font('Helvetica').fontSize(10);
      }

      doc.text(u.email, 50, doc.y);
      doc.text(u.name || '—', 250, doc.y);
      doc.text(u.isActive ? 'Evet' : 'Hayır', 400, doc.y);
      doc.text(u.createdAt.toLocaleDateString('tr-TR'), 480, doc.y);
      doc.moveDown(0.5);
    });

    doc.end();
  });
}

