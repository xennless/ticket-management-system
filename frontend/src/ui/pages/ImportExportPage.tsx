import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { config } from '../../config';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { FormField } from '../components/FormField';
import { FileUp, FileDown, Download, Upload, Info } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';

export function ImportExportPage() {
  const { has } = useAuth();
  const toast = useToast();
  const canImport = has('user.import');
  const canExport = has('user.export');
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'pdf'>('csv');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importFormat, setImportFormat] = useState<'csv' | 'excel'>('csv');
  const [openInfo, setOpenInfo] = useState(false);

  const exportM = useMutation({
    mutationFn: async (format: string) => {
      const token = localStorage.getItem('ticket_token');
      const response = await fetch(`${config.apiBaseUrl}/api/import-export/users/export?format=${format}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      
      if (!response.ok) throw new Error('Export hatası');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || `kullanicilar.${format === 'excel' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv'}`
        : `kullanicilar.${format === 'excel' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv'}`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast.push({ type: 'success', title: 'Export başarılı', description: 'Dosya indirildi' });
    },
    onError: () => {
      toast.push({ type: 'error', title: 'Export hatası', description: 'Dosya indirilemedi' });
    }
  });

  const importM = useMutation({
    mutationFn: async (file: File) => {
      if (importFormat === 'csv') {
        const text = await file.text();
        return apiFetch('/api/import-export/users/import', {
          method: 'POST',
          json: { data: text, format: 'csv', filename: file.name }
        });
      } else {
        // Excel için base64 encoding
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const base64 = btoa(String.fromCharCode(...uint8Array));
        return apiFetch('/api/import-export/users/import', {
          method: 'POST',
          json: { data: base64, format: 'excel', filename: file.name }
        });
      }
    },
    onSuccess: (data: any) => {
      const errorCount = data.errors?.length || 0;
      toast.push({
        type: errorCount > 0 ? 'info' : 'success',
        title: 'Import tamamlandı',
        description: `${data.imported || 0} kullanıcı içe aktarıldı${errorCount > 0 ? `, ${errorCount} hata` : ''}`
      });
      if (errorCount > 0 && data.errors) {
        console.error('Import hataları:', data.errors);
      }
      setImportFile(null);
    },
    onError: (error: any) => {
      toast.push({ type: 'error', title: 'Import hatası', description: error.message || 'Dosya işlenirken bir hata oluştu' });
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  const handleImport = () => {
    if (!importFile) {
      toast.push({ type: 'error', title: 'Dosya seçin' });
      return;
    }
    importM.mutate(importFile);
  };

  if (!canImport && !canExport) {
    return <div className="p-6 text-center text-slate-500">Import/Export yetkiniz yok.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="İçe/Dışa Aktarma" 
        description="Kullanıcıları içe veya dışa aktarın"
        actions={
          <Button variant="secondary" onClick={() => setOpenInfo(true)} title="İçe/Dışa Aktarma Bilgisi">
            <Info className="w-4 h-4" />
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {canExport && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileDown className="w-6 h-6 text-slate-500" />
              <h2 className="text-lg font-semibold text-slate-900">Dışa Aktarma</h2>
            </div>
            <p className="text-sm text-slate-600 mb-4">Kullanıcıları CSV, Excel veya PDF formatında dışa aktarın.</p>

            <FormField label="Format">
              <Select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as any)}>
                <option value="csv">CSV</option>
                <option value="excel">Excel (.xlsx)</option>
                <option value="pdf">PDF</option>
              </Select>
            </FormField>

            <Button onClick={() => exportM.mutate(exportFormat)} disabled={exportM.isPending} className="mt-4 w-full">
              <Download className="w-4 h-4 mr-2" />
              Dışa Aktar
            </Button>

            <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-xs text-green-800">
                <strong>✓ Hazır:</strong> CSV, Excel ve PDF formatlarında export yapabilirsiniz. Dosya otomatik olarak indirilecektir.
              </p>
            </div>
          </Card>
        )}

        {canImport && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileUp className="w-6 h-6 text-slate-500" />
              <h2 className="text-lg font-semibold text-slate-900">İçe Aktarma</h2>
            </div>
            <p className="text-sm text-slate-600 mb-4">Kullanıcıları CSV veya Excel dosyasından içe aktarın.</p>

            <FormField label="Format">
              <Select value={importFormat} onChange={(e) => setImportFormat(e.target.value as any)}>
                <option value="csv">CSV</option>
                <option value="excel">Excel (.xlsx)</option>
              </Select>
            </FormField>

            <FormField label="Dosya Seç">
              <input
                type="file"
                accept={importFormat === 'csv' ? '.csv' : '.xlsx,.xls'}
                onChange={handleFileSelect}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
              />
            </FormField>

            {importFile && (
              <div className="mt-2 p-2 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600">
                  <strong>Seçili dosya:</strong> {importFile.name} ({(importFile.size / 1024).toFixed(2)} KB)
                </p>
              </div>
            )}

            <Button onClick={handleImport} disabled={!importFile || importM.isPending} className="mt-4 w-full">
              <Upload className="w-4 h-4 mr-2" />
              İçe Aktar
            </Button>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-800">
                <strong>Dosya Formatı:</strong> CSV veya Excel dosyasında şu sütunlar olmalıdır: <code className="bg-white text-slate-900 px-1 rounded">email</code>, <code className="bg-white text-slate-900 px-1 rounded">name</code> (opsiyonel), <code className="bg-white text-slate-900 px-1 rounded">password</code> (min 8 karakter). Email benzersiz olmalıdır.
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Bilgilendirme Modal */}
      <Modal title="İçe/Dışa Aktarma Bilgisi" open={openInfo} onClose={() => setOpenInfo(false)}>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              İçe/Dışa Aktarma Nasıl Çalışır?
            </h3>
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                İçe/Dışa aktarma sistemi, kullanıcı verilerini farklı formatlarda dışa aktarmanıza ve içe aktarmanıza olanak sağlar.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Dışa Aktarma:</h4>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li><strong>CSV Formatı:</strong> Virgülle ayrılmış değerler, Excel'de açılabilir</li>
                  <li><strong>Excel Formatı:</strong> .xlsx uzantılı dosya, tüm özellikleri korur</li>
                  <li><strong>PDF Formatı:</strong> Yazdırılabilir format, raporlama için uygun</li>
                  <li>Dosya otomatik olarak indirilir</li>
                  <li>Tüm kullanıcı verileri dışa aktarılır</li>
                </ul>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">İçe Aktarma:</h4>
                <ul className="list-disc list-inside space-y-1 text-green-800">
                  <li><strong>CSV Formatı:</strong> Virgülle ayrılmış değerler, basit format</li>
                  <li><strong>Excel Formatı:</strong> .xlsx uzantılı dosya, gelişmiş özellikler</li>
                  <li>Dosya seçildikten sonra otomatik işlenir</li>
                  <li>Hatalı satırlar raporlanır, başarılı olanlar eklenir</li>
                  <li>Mevcut kullanıcılar güncellenmez, yeni kullanıcılar eklenir</li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">Önemli Notlar:</h4>
                <ul className="list-disc list-inside space-y-1 text-amber-800">
                  <li>Dışa aktarma tüm kullanıcı verilerini içerir</li>
                  <li>İçe aktarma sırasında hatalar konsola yazdırılır</li>
                  <li>Email adresleri benzersiz olmalıdır</li>
                  <li>Şifreler içe aktarma sırasında otomatik oluşturulur</li>
                  <li>Büyük dosyalar işlenirken zaman alabilir</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button variant="secondary" onClick={() => setOpenInfo(false)}>
              Kapat
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

