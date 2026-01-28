import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../../lib/auth';
import { Download, FileText, Trash2, RefreshCw, Shield, Database, Calendar } from 'lucide-react';
import { Input } from '../../components/Input';
import { FormField } from '../../components/FormField';

type AuditLog = {
  id: string;
  userId: string | null;
  user: { id: string; email: string; name: string | null } | null;
  entityType: string;
  entityId: string | null;
  action: string;
  oldValue: any;
  newValue: any;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

type ComplianceReport = {
  period: {
    startDate?: string;
    endDate?: string;
  };
  summary: {
    totalLogs: number;
    recentActivity: number;
    gdprDeletions: number;
  };
  breakdown: {
    byAction: Array<{ action: string; count: number }>;
    byEntity: Array<{ entityType: string; count: number }>;
    byUser: Array<{ userId: string | null; userEmail: string; userName: string; count: number }>;
  };
};

export function CompliancePage() {
  const { has } = useAuth();
  const toast = useToast();
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'xlsx'>('csv');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [gdprUserId, setGdprUserId] = useState('');
  const [confirmGdprDelete, setConfirmGdprDelete] = useState(false);

  // Compliance raporu
  const reportQuery = useQuery({
    queryKey: ['compliance', 'report', startDate, endDate],
    queryFn: () => apiFetch<ComplianceReport>('/api/v1/audit/compliance/report', {
      method: 'GET',
      params: startDate || endDate ? { startDate, endDate } : {}
    }),
    enabled: has('audit.read')
  });

  // Audit log export
  const exportMutation = useMutation({
    mutationFn: async (format: 'csv' | 'json' | 'xlsx') => {
      const params = new URLSearchParams({ format });
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/v1/audit/export?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ticket_token')}`,
          'X-CSRF-Token': localStorage.getItem('csrf_token') || ''
        }
      });

      if (!response.ok) throw new Error('Export başarısız');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format === 'xlsx' ? 'xlsx' : format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast.push({ type: 'success', title: 'Başarılı', message: 'Audit logları export edildi' });
    },
    onError: (error: any) => {
      toast.push({ type: 'error', title: 'Hata', message: error.message || 'Export başarısız' });
    }
  });

  // GDPR veri export
  const gdprExportMutation = useMutation({
    mutationFn: async (userId: string) => {
      const data = await apiFetch<any>(`/api/v1/audit/gdpr/export/${userId}`);
      
      // JSON olarak indir
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user-data-${userId}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast.push({ type: 'success', title: 'Başarılı', message: 'Kullanıcı verileri export edildi' });
    },
    onError: (error: any) => {
      toast.push({ type: 'error', title: 'Hata', message: error.message || 'Export başarısız' });
    }
  });

  // GDPR veri silme
  const gdprDeleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiFetch<{ success: boolean; result: any }>(`/api/v1/audit/gdpr/delete/${userId}`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast.push({ type: 'success', title: 'Başarılı', message: 'Kullanıcı verileri silindi' });
      setConfirmGdprDelete(false);
      setGdprUserId('');
    },
    onError: (error: any) => {
      toast.push({ type: 'error', title: 'Hata', message: error.message || 'Silme başarısız' });
    }
  });

  // Retention policy uygula
  const retentionMutation = useMutation({
    mutationFn: async () => {
      return apiFetch<{ success: boolean; result: { deleted: number; archived: number } }>('/api/v1/audit/retention/apply', {
        method: 'POST'
      });
    },
    onSuccess: (data) => {
      toast.push({ 
        type: 'success', 
        title: 'Başarılı', 
        message: `Retention policy uygulandı. ${data.result.deleted} log silindi.` 
      });
    },
    onError: (error: any) => {
      toast.push({ type: 'error', title: 'Hata', message: error.message || 'Retention policy uygulanamadı' });
    }
  });

  if (!has('audit.read')) {
    return (
      <div className="p-6">
        <Card>
          <div className="text-center py-8">
            <p className="text-slate-600">Bu sayfaya erişim yetkiniz yok.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Compliance & Audit</h1>
          <p className="text-sm text-slate-600 mt-1">GDPR uyumluluğu, audit log yönetimi ve compliance raporları</p>
        </div>
      </div>

      {/* Compliance Raporu */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Compliance Raporu
          </h2>
          <div className="flex gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40"
              placeholder="Başlangıç"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-40"
              placeholder="Bitiş"
            />
            <Button
              variant="secondary"
              onClick={() => reportQuery.refetch()}
              disabled={reportQuery.isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${reportQuery.isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {reportQuery.data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="text-sm text-slate-600">Toplam Log</div>
              <div className="text-2xl font-bold text-slate-900">{reportQuery.data.summary.totalLogs.toLocaleString()}</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="text-sm text-slate-600">Son 24 Saat</div>
              <div className="text-2xl font-bold text-slate-900">{reportQuery.data.summary.recentActivity.toLocaleString()}</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="text-sm text-slate-600">GDPR Silme</div>
              <div className="text-2xl font-bold text-slate-900">{reportQuery.data.summary.gdprDeletions.toLocaleString()}</div>
            </div>
          </div>
        )}

        {reportQuery.data && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Action Bazında</h3>
              <div className="space-y-2">
                {reportQuery.data.breakdown.byAction.map((item) => (
                  <div key={item.action} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <span className="text-sm text-slate-700">{item.action}</span>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Entity Bazında</h3>
              <div className="space-y-2">
                {reportQuery.data.breakdown.byEntity.map((item) => (
                  <div key={item.entityType} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <span className="text-sm text-slate-700">{item.entityType}</span>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Audit Log Export */}
      <Card>
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Download className="w-5 h-5" />
          Audit Log Export
        </h2>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={exportFormat === 'csv' ? 'default' : 'secondary'}
              onClick={() => setExportFormat('csv')}
            >
              CSV
            </Button>
            <Button
              variant={exportFormat === 'json' ? 'default' : 'secondary'}
              onClick={() => setExportFormat('json')}
            >
              JSON
            </Button>
            <Button
              variant={exportFormat === 'xlsx' ? 'default' : 'secondary'}
              onClick={() => setExportFormat('xlsx')}
            >
              Excel
            </Button>
          </div>
          <Button
            onClick={() => exportMutation.mutate(exportFormat)}
            disabled={exportMutation.isPending || !has('audit.export')}
          >
            {exportMutation.isPending ? 'Export ediliyor...' : 'Export Et'}
          </Button>
        </div>
      </Card>

      {/* GDPR İşlemleri */}
      {has('audit.manage') && (
        <>
          <Card>
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              GDPR - Right to Access (Veri Export)
            </h2>
            <div className="space-y-4">
              <FormField label="Kullanıcı ID" hint="Verilerini export etmek istediğiniz kullanıcının ID'si">
                <Input
                  value={gdprUserId}
                  onChange={(e) => setGdprUserId(e.target.value)}
                  placeholder="user_id"
                />
              </FormField>
              <Button
                onClick={() => gdprExportMutation.mutate(gdprUserId)}
                disabled={!gdprUserId || gdprExportMutation.isPending}
              >
                {gdprExportMutation.isPending ? 'Export ediliyor...' : 'Verileri Export Et'}
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              GDPR - Right to be Forgotten (Veri Silme)
            </h2>
            <div className="space-y-4">
              <FormField 
                label="Kullanıcı ID" 
                hint="Tüm verilerini silmek istediğiniz kullanıcının ID'si (DİKKAT: Bu işlem geri alınamaz!)"
              >
                <Input
                  value={gdprUserId}
                  onChange={(e) => setGdprUserId(e.target.value)}
                  placeholder="user_id"
                />
              </FormField>
              {!confirmGdprDelete ? (
                <Button
                  variant="danger"
                  onClick={() => setConfirmGdprDelete(true)}
                  disabled={!gdprUserId}
                >
                  Verileri Sil
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800 font-semibold mb-2">⚠️ DİKKAT!</p>
                    <p className="text-sm text-red-700">
                      Bu işlem kullanıcının tüm kişisel verilerini kalıcı olarak silecektir. 
                      Ticket verileri anonimleştirilecektir. Bu işlem geri alınamaz!
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      onClick={() => gdprDeleteMutation.mutate(gdprUserId)}
                      disabled={!gdprUserId || gdprDeleteMutation.isPending}
                    >
                      {gdprDeleteMutation.isPending ? 'Siliniyor...' : 'Evet, Sil'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setConfirmGdprDelete(false);
                        setGdprUserId('');
                      }}
                    >
                      İptal
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Retention Policy */}
          <Card>
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Database className="w-5 h-5" />
              Audit Log Retention Policy
            </h2>
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Eski audit logları siler veya arşivler. Sistem ayarlarından retention süresini yapılandırabilirsiniz.
              </p>
              <Button
                variant="secondary"
                onClick={() => retentionMutation.mutate()}
                disabled={retentionMutation.isPending}
              >
                {retentionMutation.isPending ? 'Uygulanıyor...' : 'Retention Policy Uygula'}
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

