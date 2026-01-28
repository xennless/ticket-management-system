import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { FormField } from '../../components/FormField';
import { Skeleton } from '../../components/Skeleton';
import { Shield, Save, Info, AlertTriangle, Activity, TestTube } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '../../components/Toast';
import { Switch } from '../../components/Switch';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/Modal';

type ValidationSettings = {
  xssProtectionEnabled: boolean;
  pathTraversalProtectionEnabled: boolean;
  commandInjectionProtectionEnabled: boolean;
  sqlInjectionProtectionEnabled: boolean;
  urlValidationEnabled: boolean;
  emailValidationEnabled: boolean;
  logValidationEvents: boolean;
  autoBlockSuspiciousInput: boolean;
};

type ValidationLog = {
  type: 'XSS' | 'PATH_TRAVERSAL' | 'COMMAND_INJECTION' | 'SQL_INJECTION' | 'INVALID_URL' | 'INVALID_EMAIL';
  input: string;
  error: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  timestamp: string;
};

type ValidationStats = {
  total: number;
  byType: {
    XSS: number;
    PATH_TRAVERSAL: number;
    COMMAND_INJECTION: number;
    SQL_INJECTION: number;
    INVALID_URL: number;
    INVALID_EMAIL: number;
  };
  last24Hours: number;
  last7Days: number;
};

export function ValidationPage() {
  const { has } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const canRead = has('validation.read');
  const canManage = has('validation.manage');

  const { data: settings, isLoading: settingsLoading } = useQuery<{ settings: ValidationSettings }>({
    queryKey: ['validation', 'settings'],
    enabled: canRead,
    queryFn: () => apiFetch('/api/v1/validation/settings')
  });

  const { data: logs, isLoading: logsLoading } = useQuery<{ logs: ValidationLog[]; count: number }>({
    queryKey: ['validation', 'logs'],
    enabled: canRead,
    queryFn: () => apiFetch('/api/v1/validation/logs?limit=100')
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{ stats: ValidationStats }>({
    queryKey: ['validation', 'stats'],
    enabled: canRead,
    queryFn: () => apiFetch('/api/v1/validation/stats')
  });

  const [formData, setFormData] = useState<ValidationSettings | null>(null);
  const [openInfo, setOpenInfo] = useState(false);
  const [openTest, setOpenTest] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testType, setTestType] = useState<'XSS' | 'PATH_TRAVERSAL' | 'COMMAND_INJECTION' | 'SQL_INJECTION' | 'URL' | 'EMAIL'>('XSS');
  const [testResult, setTestResult] = useState<any>(null);

  const updateM = useMutation({
    mutationFn: (data: Partial<ValidationSettings>) => 
      apiFetch('/api/v1/validation/settings', { method: 'PUT', json: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['validation'] });
      toast.push({ type: 'success', title: 'Validation ayarları güncellendi' });
      setFormData(null);
    }
  });

  const testM = useMutation({
    mutationFn: (data: { input: string; type: string }) => 
      apiFetch('/api/v1/validation/test', { method: 'POST', json: data }),
    onSuccess: (data) => {
      setTestResult(data.result);
      toast.push({ type: 'success', title: 'Test tamamlandı' });
    }
  });

  if (!canRead) {
    return <div className="p-6 text-center text-slate-500">Validation ayarlarını görüntüleme yetkiniz yok.</div>;
  }

  if (settingsLoading || logsLoading || statsLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const currentSettings = formData || settings?.settings!;

  const typeColors: Record<string, string> = {
    XSS: 'bg-red-100 text-red-800',
    PATH_TRAVERSAL: 'bg-orange-100 text-orange-800',
    COMMAND_INJECTION: 'bg-yellow-100 text-yellow-800',
    SQL_INJECTION: 'bg-purple-100 text-purple-800',
    INVALID_URL: 'bg-blue-100 text-blue-800',
    INVALID_EMAIL: 'bg-green-100 text-green-800'
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Input Validation & Sanitization" 
        description="XSS, SQL injection, path traversal ve command injection koruması"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setOpenInfo(true)} title="Validation Bilgisi">
              <Info className="w-4 h-4" />
            </Button>
            {canManage && (
              <Button variant="secondary" onClick={() => setOpenTest(true)} title="Validation Test">
                <TestTube className="w-4 h-4" />
                Test
              </Button>
            )}
          </div>
        }
      />

      {/* İstatistikler */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-slate-500">Toplam Olay</div>
            <div className="text-2xl font-bold">{stats.stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">Son 24 Saat</div>
            <div className="text-2xl font-bold">{stats.stats.last24Hours}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">Son 7 Gün</div>
            <div className="text-2xl font-bold">{stats.stats.last7Days}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">XSS Tespitleri</div>
            <div className="text-2xl font-bold text-red-600">{stats.stats.byType.XSS}</div>
          </Card>
        </div>
      )}

      {/* Ayarlar */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Validation Ayarları
          </h2>
          {canManage && formData && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setFormData(null)}>
                İptal
              </Button>
              <Button 
                onClick={() => updateM.mutate(formData)}
                disabled={updateM.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                Kaydet
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <FormField label="XSS Koruması">
            <Switch
              checked={currentSettings.xssProtectionEnabled}
              onCheckedChange={(checked) => {
                if (canManage) {
                  setFormData({ ...currentSettings, xssProtectionEnabled: checked });
                }
              }}
              disabled={!canManage}
            />
            <p className="text-sm text-slate-500 mt-1">HTML içeriğini temizle ve XSS saldırılarını engelle</p>
          </FormField>

          <FormField label="Path Traversal Koruması">
            <Switch
              checked={currentSettings.pathTraversalProtectionEnabled}
              onCheckedChange={(checked) => {
                if (canManage) {
                  setFormData({ ...currentSettings, pathTraversalProtectionEnabled: checked });
                }
              }}
              disabled={!canManage}
            />
            <p className="text-sm text-slate-500 mt-1">Dosya yolu manipülasyon saldırılarını engelle</p>
          </FormField>

          <FormField label="Command Injection Koruması">
            <Switch
              checked={currentSettings.commandInjectionProtectionEnabled}
              onCheckedChange={(checked) => {
                if (canManage) {
                  setFormData({ ...currentSettings, commandInjectionProtectionEnabled: checked });
                }
              }}
              disabled={!canManage}
            />
            <p className="text-sm text-slate-500 mt-1">Shell command injection saldırılarını engelle</p>
          </FormField>

          <FormField label="SQL Injection Koruması">
            <Switch
              checked={currentSettings.sqlInjectionProtectionEnabled}
              onCheckedChange={(checked) => {
                if (canManage) {
                  setFormData({ ...currentSettings, sqlInjectionProtectionEnabled: checked });
                }
              }}
              disabled={!canManage}
            />
            <p className="text-sm text-slate-500 mt-1">SQL injection pattern'lerini tespit et (Prisma zaten koruyor)</p>
          </FormField>

          <FormField label="URL Validation">
            <Switch
              checked={currentSettings.urlValidationEnabled}
              onCheckedChange={(checked) => {
                if (canManage) {
                  setFormData({ ...currentSettings, urlValidationEnabled: checked });
                }
              }}
              disabled={!canManage}
            />
            <p className="text-sm text-slate-500 mt-1">URL'lerin güvenli protokolleri kullandığını kontrol et</p>
          </FormField>

          <FormField label="Email Validation">
            <Switch
              checked={currentSettings.emailValidationEnabled}
              onCheckedChange={(checked) => {
                if (canManage) {
                  setFormData({ ...currentSettings, emailValidationEnabled: checked });
                }
              }}
              disabled={!canManage}
            />
            <p className="text-sm text-slate-500 mt-1">Email formatını doğrula</p>
          </FormField>

          <FormField label="Validation Olaylarını Logla">
            <Switch
              checked={currentSettings.logValidationEvents}
              onCheckedChange={(checked) => {
                if (canManage) {
                  setFormData({ ...currentSettings, logValidationEvents: checked });
                }
              }}
              disabled={!canManage}
            />
            <p className="text-sm text-slate-500 mt-1">Tespit edilen güvenlik olaylarını logla</p>
          </FormField>

          <FormField label="Şüpheli Input'u Otomatik Engelle">
            <Switch
              checked={currentSettings.autoBlockSuspiciousInput}
              onCheckedChange={(checked) => {
                if (canManage) {
                  setFormData({ ...currentSettings, autoBlockSuspiciousInput: checked });
                }
              }}
              disabled={!canManage}
            />
            <p className="text-sm text-slate-500 mt-1">Tespit edilen şüpheli input'u otomatik olarak engelle</p>
          </FormField>
        </div>
      </Card>

      {/* Loglar */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Validation Logları
          </h2>
        </div>

        {logs && logs.logs.length > 0 ? (
          <div className="space-y-2">
            {logs.logs.map((log, idx) => (
              <div key={idx} className="p-3 border rounded-lg bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${typeColors[log.type] || 'bg-gray-100 text-gray-800'}`}>
                    {log.type}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(log.timestamp).toLocaleString('tr-TR')}
                  </span>
                </div>
                <div className="text-sm font-mono bg-white p-2 rounded border mb-1 break-all">
                  {log.input.substring(0, 200)}{log.input.length > 200 ? '...' : ''}
                </div>
                <div className="text-sm text-red-600">{log.error}</div>
                {log.ip && (
                  <div className="text-xs text-slate-500 mt-1">
                    IP: {log.ip} {log.userAgent && `• ${log.userAgent.substring(0, 50)}`}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-slate-500 py-8">
            Henüz validation logu yok
          </div>
        )}
      </Card>

      {/* Bilgi Modal */}
      <Modal open={openInfo} onClose={() => setOpenInfo(false)} title="Input Validation & Sanitization">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Bu sayfa, sistemin input validation ve sanitization ayarlarını yönetmenizi sağlar.
          </p>
          <div className="space-y-2">
            <h3 className="font-semibold">XSS Koruması</h3>
            <p className="text-sm text-slate-600">
              HTML içeriğindeki tehlikeli tag'leri ve script'leri temizler.
            </p>
            <h3 className="font-semibold">Path Traversal Koruması</h3>
            <p className="text-sm text-slate-600">
              Dosya yolu manipülasyon saldırılarını (../ gibi) engeller.
            </p>
            <h3 className="font-semibold">Command Injection Koruması</h3>
            <p className="text-sm text-slate-600">
              Shell command injection saldırılarını engeller.
            </p>
            <h3 className="font-semibold">SQL Injection Koruması</h3>
            <p className="text-sm text-slate-600">
              SQL injection pattern'lerini tespit eder (Prisma zaten parametrize query kullanıyor).
            </p>
          </div>
        </div>
      </Modal>

      {/* Test Modal */}
      <Modal open={openTest} onClose={() => setOpenTest(false)} title="Validation Test">
        <div className="space-y-4">
          <FormField label="Test Tipi">
            <select
              value={testType}
              onChange={(e) => setTestType(e.target.value as any)}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="XSS">XSS</option>
              <option value="PATH_TRAVERSAL">Path Traversal</option>
              <option value="COMMAND_INJECTION">Command Injection</option>
              <option value="SQL_INJECTION">SQL Injection</option>
              <option value="URL">URL</option>
              <option value="EMAIL">Email</option>
            </select>
          </FormField>

          <FormField label="Test Input">
            <Input
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="Test edilecek input'u girin"
            />
          </FormField>

          <Button
            onClick={() => testM.mutate({ input: testInput, type: testType })}
            disabled={!testInput || testM.isPending}
            className="w-full"
          >
            Test Et
          </Button>

          {testResult && (
            <div className="p-4 bg-slate-50 rounded border">
              <h4 className="font-semibold mb-2">Sonuç:</h4>
              <pre className="text-xs overflow-auto">{JSON.stringify(testResult, null, 2)}</pre>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

