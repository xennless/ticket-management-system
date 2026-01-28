import { useQuery } from '@tanstack/react-query';
import { apiFetch, getToken } from '../../lib/api';
import { config } from '../../config';
import { useAuth } from '../../lib/auth';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { Modal } from '../components/Modal';
import {
  Download,
  FileSpreadsheet,
  X,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Users,
  Shield,
  Activity,
  Ticket,
  Eye,
  Calendar,
  Info
} from 'lucide-react';
import { useState } from 'react';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/PageHeader';
import clsx from 'clsx';

type ReportColumn = {
  key: string;
  label: string;
};

type ReportResult = {
  data: any[];
  columns: ReportColumn[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  report: {
    id: string;
    name: string;
    type: string;
  };
};

type ReportType = {
  value: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
};

type TimePeriod = 'all' | '1d' | '3d' | '1w' | '1m';

// Zaman dönemi seçenekleri
const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: 'all', label: 'Tümü' },
  { value: '1d', label: '1 Gün' },
  { value: '3d', label: '3 Gün' },
  { value: '1w', label: '1 Hafta' },
  { value: '1m', label: '1 Ay' }
];

// Sabit rapor tipleri
const REPORT_TYPES: ReportType[] = [
  {
    value: 'user',
    label: 'Kullanıcı Raporu',
    description: 'Sistemdeki tüm kullanıcıları listeler',
    icon: <Users className="w-6 h-6" />,
    color: 'bg-blue-100 text-blue-700'
  },
  {
    value: 'role',
    label: 'Rol Raporu',
    description: 'Tanımlı rolleri ve kullanıcı sayılarını gösterir',
    icon: <Shield className="w-6 h-6" />,
    color: 'bg-purple-100 text-purple-700'
  },
  {
    value: 'activity',
    label: 'Aktivite Raporu',
    description: 'Son sistem aktivitelerini listeler',
    icon: <Activity className="w-6 h-6" />,
    color: 'bg-green-100 text-green-700'
  },
  {
    value: 'ticket',
    label: 'Ticket Raporu',
    description: 'Tüm ticketları detaylı olarak listeler',
    icon: <Ticket className="w-6 h-6" />,
    color: 'bg-amber-100 text-amber-700'
  },
  {
    value: 'ticketStats',
    label: 'Ticket İstatistikleri',
    description: 'Ticket durumlarına göre istatistikler',
    icon: <BarChart3 className="w-6 h-6" />,
    color: 'bg-rose-100 text-rose-700'
  }
];

// Zaman dönemi hesaplama
function getDateRange(period: TimePeriod): { startDate?: string; endDate?: string } {
  if (period === 'all') return {};
  
  const now = new Date();
  const endDate = now.toISOString().split('T')[0];
  
  let startDate: Date;
  switch (period) {
    case '1d':
      startDate = new Date(now.setDate(now.getDate() - 1));
      break;
    case '3d':
      startDate = new Date(now.setDate(now.getDate() - 3));
      break;
    case '1w':
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case '1m':
      startDate = new Date(now.setMonth(now.getMonth() - 1));
      break;
    default:
      return {};
  }
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate
  };
}

// Nested değer alma yardımcısı
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

// Değer formatlama
function formatCellValue(value: any, key: string): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
  if (key.includes('At') && typeof value === 'string') {
    try {
      return new Date(value).toLocaleString('tr-TR');
    } catch {
      return value;
    }
  }
  if (typeof value === 'number' && key === 'percentage') return `%${value.toFixed(1)}`;
  return String(value);
}

// Durum badge'i
function StatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    OPEN: 'bg-blue-100 text-blue-700',
    IN_PROGRESS: 'bg-amber-100 text-amber-700',
    RESOLVED: 'bg-green-100 text-green-700',
    CLOSED: 'bg-slate-100 text-slate-700'
  };
  const statusLabels: Record<string, string> = {
    OPEN: 'Açık',
    IN_PROGRESS: 'İşlemde',
    RESOLVED: 'Çözüldü',
    CLOSED: 'Kapatıldı'
  };
  return (
    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', statusColors[status] || 'bg-slate-100 text-slate-700')}>
      {statusLabels[status] || status}
    </span>
  );
}

// Öncelik badge'i
function PriorityBadge({ priority }: { priority: string }) {
  const priorityColors: Record<string, string> = {
    CRITICAL: 'bg-red-100 text-red-700',
    HIGH: 'bg-orange-100 text-orange-700',
    MEDIUM: 'bg-yellow-100 text-yellow-700',
    LOW: 'bg-green-100 text-green-700'
  };
  const priorityLabels: Record<string, string> = {
    CRITICAL: 'Kritik',
    HIGH: 'Yüksek',
    MEDIUM: 'Orta',
    LOW: 'Düşük'
  };
  return (
    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', priorityColors[priority] || 'bg-slate-100 text-slate-700')}>
      {priorityLabels[priority] || priority}
    </span>
  );
}

export function ReportsPage() {
  const { has } = useAuth();
  const toast = useToast();
  const canRead = has('report.read');

  // Modal states
  const [openResults, setOpenResults] = useState(false);
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [resultsPage, setResultsPage] = useState(1);
  const [resultsPageSize] = useState(20);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  const [openInfo, setOpenInfo] = useState(false);

  // URL parametreleri oluştur
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.set('page', String(resultsPage));
    params.set('pageSize', String(resultsPageSize));
    
    const dateRange = getDateRange(timePeriod);
    if (dateRange.startDate) params.set('startDate', dateRange.startDate);
    if (dateRange.endDate) params.set('endDate', dateRange.endDate);
    
    return params.toString();
  };

  // Rapor sonuçları
  const resultsQuery = useQuery<ReportResult>({
    queryKey: ['report-results', selectedType?.value, resultsPage, resultsPageSize, timePeriod],
    enabled: !!selectedType && openResults,
    queryFn: () =>
      apiFetch(`/api/reports/run/${selectedType!.value}?${buildQueryParams()}`)
  });

  // Raporu aç
  const handleOpenResults = (reportType: ReportType) => {
    setSelectedType(reportType);
    setResultsPage(1);
    setTimePeriod('all');
    setOpenResults(true);
  };

  // Zaman dönemi değiştiğinde sayfa 1'e dön
  const handleTimePeriodChange = (period: TimePeriod) => {
    setTimePeriod(period);
    setResultsPage(1);
  };

  // Export fonksiyonları
  const handleExport = async (format: 'csv' | 'excel') => {
    if (!selectedType) return;

    try {
      const token = getToken();
      const dateRange = getDateRange(timePeriod);
      const params = new URLSearchParams();
      if (dateRange.startDate) params.set('startDate', dateRange.startDate);
      if (dateRange.endDate) params.set('endDate', dateRange.endDate);
      
      const queryString = params.toString();
      const url = `${config.apiBaseUrl}/api/reports/export/${selectedType.value}/${format}${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Export başarısız');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const periodLabel = TIME_PERIODS.find(p => p.value === timePeriod)?.label || '';
      a.download = `${selectedType.label}${timePeriod !== 'all' ? ` (${periodLabel})` : ''}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      toast.push({ type: 'success', title: `${format.toUpperCase()} olarak indirildi` });
    } catch (error) {
      toast.push({ type: 'error', title: 'Export başarısız' });
    }
  };

  if (!canRead) {
    return <div className="p-6 text-center text-slate-500">Rapor görüntüleme yetkiniz yok.</div>;
  }

  const results = resultsQuery.data;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Raporlar"
        description="Sistem raporlarını görüntüleyin ve dışa aktarın"
        actions={
          <Button variant="secondary" onClick={() => setOpenInfo(true)} title="Raporlar Bilgisi">
            <Info className="w-4 h-4" />
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORT_TYPES.map((reportType) => (
          <Card key={reportType.value} className="p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className={clsx('p-3 rounded-xl', reportType.color)}>
                {reportType.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 mb-1">{reportType.label}</h3>
                <p className="text-sm text-slate-500 mb-4">{reportType.description}</p>
                <Button
                  variant="primary"
                  onClick={() => handleOpenResults(reportType)}
                  size="sm"
                  className="w-full"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Görüntüle
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Rapor Sonuçları Modal */}
      {openResults && selectedType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setOpenResults(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-[95vw] max-w-7xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className={clsx('p-2 rounded-lg', selectedType.color)}>
                  {selectedType.icon}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{selectedType.label}</h2>
                  <p className="text-sm text-slate-500">
                    {results?.total || 0} kayıt
                    {timePeriod !== 'all' && ` (${TIME_PERIODS.find(p => p.value === timePeriod)?.label})`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => handleExport('csv')}>
                  <Download className="w-4 h-4 mr-2" />
                  CSV
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleExport('excel')}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Excel
                </Button>
                <button
                  onClick={() => setOpenResults(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Time Period Filter */}
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar className="w-4 h-4" />
                  <span>Dönem:</span>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
                  {TIME_PERIODS.map((period) => (
                    <button
                      key={period.value}
                      onClick={() => handleTimePeriodChange(period.value)}
                      className={clsx(
                        'px-3 py-1.5 rounded text-sm font-medium transition-colors',
                        timePeriod === period.value
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      )}
                    >
                      {period.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
              {resultsQuery.isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : resultsQuery.isError ? (
                <div className="text-center py-8 text-red-500">Rapor yüklenirken hata oluştu</div>
              ) : results && results.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        {results.columns.map((col) => (
                          <th
                            key={col.key}
                            className="px-4 py-3 text-left font-medium text-slate-700 whitespace-nowrap"
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {results.data.map((row, rowIndex) => (
                        <tr key={row.id || rowIndex} className="hover:bg-slate-50 transition-colors">
                          {results.columns.map((col) => {
                            const value = getNestedValue(row, col.key);
                            return (
                              <td key={col.key} className="px-4 py-3 whitespace-nowrap">
                                {col.key === 'status' ? (
                                  <StatusBadge status={value} />
                                ) : col.key === 'priority' ? (
                                  <PriorityBadge priority={value} />
                                ) : col.key === 'isActive' ? (
                                  <span
                                    className={clsx(
                                      'px-2 py-0.5 rounded-full text-xs font-medium',
                                      value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                    )}
                                  >
                                    {value ? 'Aktif' : 'Pasif'}
                                  </span>
                                ) : (
                                  <span className="text-slate-700">
                                    {formatCellValue(value, col.key)}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  {timePeriod !== 'all' 
                    ? `Son ${TIME_PERIODS.find(p => p.value === timePeriod)?.label?.toLowerCase()} içinde veri bulunamadı`
                    : 'Veri bulunamadı'
                  }
                </div>
              )}
            </div>

            {/* Footer - Pagination */}
            {results && results.totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50">
                <div className="text-sm text-slate-600">
                  Sayfa {results.page} / {results.totalPages} • Toplam {results.total} kayıt
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setResultsPage((p) => Math.max(1, p - 1))}
                    disabled={results.page <= 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, results.totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (results.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (results.page <= 3) {
                        pageNum = i + 1;
                      } else if (results.page >= results.totalPages - 2) {
                        pageNum = results.totalPages - 4 + i;
                      } else {
                        pageNum = results.page - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setResultsPage(pageNum)}
                          className={clsx(
                            'w-8 h-8 rounded text-sm font-medium transition-colors',
                            results.page === pageNum
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-600 hover:bg-slate-200'
                          )}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setResultsPage((p) => Math.min(results.totalPages, p + 1))}
                    disabled={results.page >= results.totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bilgilendirme Modal */}
      <Modal title="Raporlar Bilgisi" open={openInfo} onClose={() => setOpenInfo(false)}>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              Rapor Sistemi Nasıl Çalışır?
            </h3>
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                Rapor sistemi, sistem verilerini farklı bakış açılarıyla görüntülemenize ve dışa aktarmanıza olanak sağlar. Tüm raporlar sabit tiptir ve zaman dönemine göre filtrelenebilir.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Rapor Türleri:</h4>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li><strong>Kullanıcı Raporu:</strong> Sistemdeki tüm kullanıcıları listeler</li>
                  <li><strong>Rol Raporu:</strong> Tanımlı rolleri ve kullanıcı sayılarını gösterir</li>
                  <li><strong>Aktivite Raporu:</strong> Son sistem aktivitelerini listeler</li>
                  <li><strong>Ticket Raporu:</strong> Tüm ticketları detaylı olarak listeler</li>
                  <li><strong>Ticket İstatistikleri:</strong> Ticket durumlarına göre istatistikler</li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">Özellikler:</h4>
                <ul className="list-disc list-inside space-y-1 text-amber-800">
                  <li>Zaman dönemi filtresi: Tümü, 1 Gün, 3 Gün, 1 Hafta, 1 Ay</li>
                  <li>Sayfalama desteği: Büyük veri setleri için sayfa sayfa görüntüleme</li>
                  <li>Dışa aktarma: CSV ve Excel formatında indirme</li>
                  <li>Raporlar dinamik: Gerçek zamanlı veri gösterimi</li>
                  <li>Detaylı görüntüleme: Rapor sonuçlarını modal içinde görüntüleme</li>
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
