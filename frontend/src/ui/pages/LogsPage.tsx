import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { Input } from '../components/Input';
import { Skeleton } from '../components/Skeleton';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { FileText, Calendar, Activity, User, Shield, ClipboardList, Upload, CheckCircle, XCircle, Trash2, HardDrive, Info, FileCode, BarChart3, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';

type LogTab = 'audit' | 'activity' | 'fileUpload' | 'system' | 'monitoring';

type AuditLog = {
  id: string;
  entityType: string;
  entityId: string | null;
  action: string;
  oldValue: any;
  newValue: any;
  ip: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null } | null;
};

type ActivityLog = {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  metadata: any;
  ip: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null };
};

type FileUploadLog = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string | null;
  status: 'SUCCESS' | 'FAILED' | 'DELETED';
  errorMessage: string | null;
  ticketId: string | null;
  attachmentId: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null } | null;
};

type FileUploadStats = {
  totals: {
    success: number;
    failed: number;
    deleted: number;
    totalSize: number;
    totalSizeMB: number;
  };
  recentStats: {
    success: number;
    failed: number;
    deleted: number;
  };
};

const TAB_CONFIG: { value: LogTab; label: string; icon: React.ReactNode; description: string; permission?: string }[] = [
  {
    value: 'audit',
    label: 'Audit Log',
    icon: <Shield className="w-5 h-5" />,
    description: 'Sistem değişiklik geçmişi',
    permission: 'audit.read'
  },
  {
    value: 'activity',
    label: 'Aktivite Log',
    icon: <Activity className="w-5 h-5" />,
    description: 'Kullanıcı aktivite geçmişi',
    permission: 'activity.read'
  },
  {
    value: 'fileUpload',
    label: 'Dosya Yükleme',
    icon: <Upload className="w-5 h-5" />,
    description: 'Dosya yükleme geçmişi',
    permission: 'fileUploadLog.read'
  },
  {
    value: 'system',
    label: 'Sistem Logları',
    icon: <FileCode className="w-5 h-5" />,
    description: 'Winston sistem logları',
    permission: 'log.read'
  },
  {
    value: 'monitoring',
    label: 'Monitoring',
    icon: <BarChart3 className="w-5 h-5" />,
    description: 'Sistem izleme ve performans metrikleri',
    permission: 'monitoring.read'
  }
];

// Dosya boyutunu formatla
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function LogsPage() {
  const { has } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canReadAudit = has('audit.read');
  const canReadActivity = has('activity.read');
  const canReadFileUpload = has('fileUploadLog.read');
  const canReadSystemLogs = has('log.read');
  const canReadMonitoring = has('monitoring.read');

  // URL'den tab'ı oku
  const urlTab = searchParams.get('tab') as LogTab | null;
  const defaultTab = canReadAudit ? 'audit' : canReadActivity ? 'activity' : canReadFileUpload ? 'fileUpload' : canReadSystemLogs ? 'system' : 'monitoring';
  const [activeTab, setActiveTab] = useState<LogTab>(urlTab && TAB_CONFIG.some(t => t.value === urlTab) ? urlTab : defaultTab);

  // URL'deki tab değişikliğini dinle
  useEffect(() => {
    const urlTab = searchParams.get('tab') as LogTab | null;
    if (urlTab && TAB_CONFIG.some(t => t.value === urlTab)) {
      setActiveTab(urlTab);
    }
  }, [searchParams]);

  // Tab değiştiğinde URL'yi güncelle
  const handleTabChange = (tab: LogTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Audit state
  const [auditPage, setAuditPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const [auditAction, setAuditAction] = useState('');

  // Activity state
  const [activityPage, setActivityPage] = useState(1);
  const [activityAction, setActivityAction] = useState('');

  // File Upload state
  const [fileUploadPage, setFileUploadPage] = useState(1);
  const [fileUploadStatus, setFileUploadStatus] = useState('');
  const [openInfo, setOpenInfo] = useState(false);

  // System Logs state
  const [systemLogsPage, setSystemLogsPage] = useState(1);
  const [systemLogsLevel, setSystemLogsLevel] = useState('');
  const [systemLogsDate, setSystemLogsDate] = useState('');

  // Audit query
  const auditQuery = useQuery<{ logs: AuditLog[]; total: number; page: number; pageSize: number }>({
    queryKey: ['audit', { page: auditPage, entityType, action: auditAction }],
    enabled: canReadAudit && activeTab === 'audit',
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', auditPage.toString());
      if (entityType) params.set('entityType', entityType);
      if (auditAction) params.set('action', auditAction);
      return apiFetch(`/api/audit?${params}`);
    }
  });

  // Activity query
  const activityQuery = useQuery<{ activities: ActivityLog[]; total: number; page: number; pageSize: number }>({
    queryKey: ['activity', { page: activityPage, action: activityAction }],
    enabled: canReadActivity && activeTab === 'activity',
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', activityPage.toString());
      if (activityAction) params.set('action', activityAction);
      return apiFetch(`/api/activity?${params}`);
    }
  });

  // File Upload query
  const fileUploadQuery = useQuery<{ logs: FileUploadLog[]; total: number; page: number; pageSize: number }>({
    queryKey: ['file-upload-logs', { page: fileUploadPage, status: fileUploadStatus }],
    enabled: canReadFileUpload && activeTab === 'fileUpload',
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', fileUploadPage.toString());
      if (fileUploadStatus) params.set('status', fileUploadStatus);
      return apiFetch(`/api/file-upload-logs?${params}`);
    }
  });

  // File Upload Stats
  const fileUploadStatsQuery = useQuery<FileUploadStats>({
    queryKey: ['file-upload-stats'],
    enabled: canReadFileUpload && activeTab === 'fileUpload',
    queryFn: () => apiFetch('/api/file-upload-logs/stats')
  });

  // System Logs query
  const systemLogsQuery = useQuery<{ logs: Array<{ timestamp: string; level: string; message: string; [key: string]: any }>; total: number; page: number; pageSize: number }>({
    queryKey: ['system-logs', { page: systemLogsPage, level: systemLogsLevel, date: systemLogsDate }],
    enabled: canReadSystemLogs && activeTab === 'system',
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', systemLogsPage.toString());
      if (systemLogsLevel) params.set('level', systemLogsLevel);
      if (systemLogsDate) params.set('date', systemLogsDate);
      return apiFetch(`/api/logs/system?${params}`);
    }
  });

  // Monitoring query
  const monitoringQuery = useQuery<{
    system: {
      cpu: { cores: number; usage: number; model: string };
      memory: { total: number; used: number; free: number; usagePercent: number; totalGB: string; usedGB: string; freeGB: string };
      uptime: { seconds: number; hours: string; days: string };
      platform: string;
      arch: string;
      hostname: string;
    };
    disk?: {
      status: string;
      total: number;
      free: number;
      used: number;
      usagePercent: number;
      totalGB: string;
      freeGB: string;
      usedGB: string;
    };
    database?: {
      status: string;
      responseTime?: number;
    };
    databaseStats: {
      users: { total: number; active: number; inactive: number };
      tickets: { total: number; open: number; closed: number };
    };
    activity: {
      last24Hours: { tickets: number; users: number; logins: number };
    };
    timestamp: string;
  }>({
    queryKey: ['monitoring', 'stats'],
    enabled: canReadMonitoring && activeTab === 'monitoring',
    queryFn: () => apiFetch('/api/v1/monitoring/stats'),
    refetchInterval: 30000 // 30 saniyede bir güncelle
  });

  // Health check query
  const healthCheckQuery = useQuery<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    checks: {
      database: { status: string; responseTime?: number; error?: string };
      disk: { status: string; usagePercent: number; totalGB: string; freeGB: string; usedGB: string };
      memory: { status: string; usagePercent: number; totalGB: string; usedGB: string; freeGB: string };
      cpu: { status: string; usage: number; cores: number };
    };
    uptime: { system: number; process: number };
    version: { node: string; platform: string; arch: string };
  }>({
    queryKey: ['monitoring', 'health'],
    enabled: canReadMonitoring && activeTab === 'monitoring',
    queryFn: () => apiFetch('/api/v1/monitoring/health'),
    refetchInterval: 30000 // 30 saniyede bir güncelle
  });

  // Monitoring Performance query
  const monitoringPerformanceQuery = useQuery<{
    process: {
      memory: { rss: number; heapTotal: number; heapUsed: number; external: number; rssMB: string; heapTotalMB: string; heapUsedMB: string };
      uptime: number;
      pid: number;
      nodeVersion: string;
    };
    system: {
      memory: { total: number; used: number; free: number; usagePercent: number; status: string };
      cpu: { cores: number; usage: number; status: string; loadAverage: number[] };
      database: { status: string; responseTime?: number };
    };
    responseTime?: {
      summary: {
        total: number;
        average: number;
        min: number;
        max: number;
        byPath: Record<string, { count: number; totalTime: number; avgTime: number }>;
        byStatusCode: Record<number, number>;
      };
    };
    timestamp: string;
  }>({
    queryKey: ['monitoring', 'performance'],
    enabled: canReadMonitoring && activeTab === 'monitoring',
    queryFn: () => apiFetch('/api/v1/monitoring/performance'),
    refetchInterval: 10000 // 10 saniyede bir güncelle
  });

  // Yetki kontrolü
  if (!canReadAudit && !canReadActivity && !canReadFileUpload && !canReadSystemLogs && !canReadMonitoring) {
    return <div className="p-6 text-center text-slate-500">Log görüntüleme yetkiniz yok.</div>;
  }

  const auditLogs = auditQuery.data?.logs || [];
  const auditTotal = auditQuery.data?.total || 0;
  const activities = activityQuery.data?.activities || [];
  const activityTotal = activityQuery.data?.total || 0;
  const fileUploadLogs = fileUploadQuery.data?.logs || [];
  const fileUploadTotal = fileUploadQuery.data?.total || 0;
  const fileUploadStats = fileUploadStatsQuery.data;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Loglar ve İzleme"
        description="Sistem logları, audit logları, aktiviteler, dosya yüklemeleri ve monitoring"
        actions={
          <Button variant="secondary" onClick={() => setOpenInfo(true)} title="Loglar Bilgisi">
            <Info className="w-4 h-4" />
          </Button>
        }
      />

      {/* Tab Seçimi */}
      <div className="flex items-center gap-2 p-1 rounded-lg border border-slate-200 bg-white w-fit flex-wrap">
        {TAB_CONFIG.map((tab) => {
          const canAccess = tab.permission ? has(tab.permission) : false;
          if (!canAccess) return null;
          
          return (
            <button
              key={tab.value}
              onClick={() => handleTabChange(tab.value)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                activeTab === tab.value
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Audit Log Tab */}
      {activeTab === 'audit' && canReadAudit && (
        <div className="space-y-4">
          {/* Filtreler */}
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Select
                  value={entityType}
                  onChange={(e) => {
                    setEntityType(e.target.value);
                    setAuditPage(1);
                  }}
                >
                  <option value="">Tüm Entity Tipleri</option>
                  <option value="User">Kullanıcı</option>
                  <option value="Role">Rol</option>
                  <option value="Permission">Yetki</option>
                  <option value="Ticket">Ticket</option>
                </Select>
              </div>
              <div>
                <Select
                  value={auditAction}
                  onChange={(e) => {
                    setAuditAction(e.target.value);
                    setAuditPage(1);
                  }}
                >
                  <option value="">Tüm Aksiyonlar</option>
                  <option value="create">Oluştur</option>
                  <option value="update">Güncelle</option>
                  <option value="delete">Sil</option>
                </Select>
              </div>
            </div>
          </Card>

          {/* Loading */}
          {auditQuery.isLoading && (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          )}

          {/* Empty */}
          {!auditQuery.isLoading && auditLogs.length === 0 && (
            <Card className="p-8 text-center">
              <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <div className="text-slate-500">Audit log bulunamadı.</div>
            </Card>
          )}

          {/* Liste */}
          {!auditQuery.isLoading && auditLogs.length > 0 && (
            <div className="space-y-3">
              {auditLogs.map((log) => (
                <Card key={log.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-slate-100">
                      <ClipboardList className="w-4 h-4 text-slate-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-900">{log.action}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
                          {log.entityType}
                        </span>
                        {log.user && (
                          <span className="text-sm text-slate-500">
                            — {log.user.name || log.user.email}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        {log.ip && <span>IP: {log.ip}</span>}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(log.createdAt).toLocaleString('tr-TR')}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {auditTotal > 0 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-500">Toplam {auditTotal} kayıt</div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                  disabled={auditPage === 1}
                >
                  Önceki
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setAuditPage((p) => p + 1)}
                  disabled={auditPage * 20 >= auditTotal}
                >
                  Sonraki
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Activity Log Tab */}
      {activeTab === 'activity' && canReadActivity && (
        <div className="space-y-4">
          {/* Filtreler */}
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Select
                  value={activityAction}
                  onChange={(e) => {
                    setActivityAction(e.target.value);
                    setActivityPage(1);
                  }}
                >
                  <option value="">Tüm Aksiyonlar</option>
                  <option value="page_view">Sayfa Görüntüleme</option>
                  <option value="click">Tıklama</option>
                  <option value="create">Oluşturma</option>
                  <option value="update">Güncelleme</option>
                  <option value="delete">Silme</option>
                  <option value="login">Giriş</option>
                  <option value="logout">Çıkış</option>
                </Select>
              </div>
            </div>
          </Card>

          {/* Loading */}
          {activityQuery.isLoading && (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          )}

          {/* Empty */}
          {!activityQuery.isLoading && activities.length === 0 && (
            <Card className="p-8 text-center">
              <Activity className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <div className="text-slate-500">Aktivite log bulunamadı.</div>
            </Card>
          )}

          {/* Liste */}
          {!activityQuery.isLoading && activities.length > 0 && (
            <div className="space-y-3">
              {activities.map((a) => (
                <Card key={a.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-green-100">
                      <Activity className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-900">{a.action}</span>
                        {a.entity && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
                            {a.entity}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {a.user.name || a.user.email}
                        </span>
                        {a.ip && <span>IP: {a.ip}</span>}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(a.createdAt).toLocaleString('tr-TR')}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {activityTotal > 0 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-500">Toplam {activityTotal} kayıt</div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                  disabled={activityPage === 1}
                >
                  Önceki
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setActivityPage((p) => p + 1)}
                  disabled={activityPage * 20 >= activityTotal}
                >
                  Sonraki
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* File Upload Log Tab */}
      {activeTab === 'fileUpload' && canReadFileUpload && (
        <div className="space-y-4">
          {/* İstatistikler */}
          {fileUploadStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900">{fileUploadStats.totals.success}</div>
                    <div className="text-xs text-slate-500">Başarılı</div>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100">
                    <XCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900">{fileUploadStats.totals.failed}</div>
                    <div className="text-xs text-slate-500">Başarısız</div>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-100">
                    <Trash2 className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900">{fileUploadStats.totals.deleted}</div>
                    <div className="text-xs text-slate-500">Silinen</div>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <HardDrive className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900">{fileUploadStats.totals.totalSizeMB} MB</div>
                    <div className="text-xs text-slate-500">Toplam Boyut</div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Filtreler */}
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Select
                  value={fileUploadStatus}
                  onChange={(e) => {
                    setFileUploadStatus(e.target.value);
                    setFileUploadPage(1);
                  }}
                >
                  <option value="">Tüm Durumlar</option>
                  <option value="SUCCESS">Başarılı</option>
                  <option value="FAILED">Başarısız</option>
                  <option value="DELETED">Silinen</option>
                </Select>
              </div>
            </div>
          </Card>

          {/* Loading */}
          {fileUploadQuery.isLoading && (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          )}

          {/* Empty */}
          {!fileUploadQuery.isLoading && fileUploadLogs.length === 0 && (
            <Card className="p-8 text-center">
              <Upload className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <div className="text-slate-500">Dosya yükleme logu bulunamadı.</div>
            </Card>
          )}

          {/* Liste */}
          {!fileUploadQuery.isLoading && fileUploadLogs.length > 0 && (
            <div className="space-y-3">
              {fileUploadLogs.map((log) => (
                <Card key={log.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={clsx(
                      'p-2 rounded-lg',
                      log.status === 'SUCCESS' && 'bg-green-100',
                      log.status === 'FAILED' && 'bg-red-100',
                      log.status === 'DELETED' && 'bg-slate-100'
                    )}>
                      {log.status === 'SUCCESS' && <CheckCircle className="w-4 h-4 text-green-600" />}
                      {log.status === 'FAILED' && <XCircle className="w-4 h-4 text-red-600" />}
                      {log.status === 'DELETED' && <Trash2 className="w-4 h-4 text-slate-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-slate-900 truncate max-w-xs" title={log.fileName}>
                          {log.fileName}
                        </span>
                        <span className="text-xs text-slate-500">
                          ({formatFileSize(log.fileSize)})
                        </span>
                        <Badge 
                          variant={log.status === 'SUCCESS' ? 'success' : log.status === 'FAILED' ? 'danger' : 'default'}
                          className="text-[10px]"
                        >
                          {log.status === 'SUCCESS' ? 'Başarılı' : log.status === 'FAILED' ? 'Başarısız' : 'Silindi'}
                        </Badge>
                      </div>
                      {log.errorMessage && (
                        <div className="text-xs text-red-600 mb-1">
                          Hata: {log.errorMessage}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                        {log.user && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {log.user.name || log.user.email}
                          </span>
                        )}
                        {log.ticketId && (
                          <span>Ticket: #{log.ticketId.slice(-6)}</span>
                        )}
                        {log.mimeType && (
                          <span>{log.mimeType}</span>
                        )}
                        {log.ip && <span>IP: {log.ip}</span>}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(log.createdAt).toLocaleString('tr-TR')}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {fileUploadTotal > 0 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-500">Toplam {fileUploadTotal} kayıt</div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setFileUploadPage((p) => Math.max(1, p - 1))}
                  disabled={fileUploadPage === 1}
                >
                  Önceki
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setFileUploadPage((p) => p + 1)}
                  disabled={fileUploadPage * 20 >= fileUploadTotal}
                >
                  Sonraki
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sistem Logları Tab */}
      {activeTab === 'system' && canReadSystemLogs && (
        <div className="space-y-4">
          {/* Filtreler */}
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Select
                  value={systemLogsLevel}
                  onChange={(e) => {
                    setSystemLogsLevel(e.target.value);
                    setSystemLogsPage(1);
                  }}
                >
                  <option value="">Tüm Seviyeler</option>
                  <option value="error">Error</option>
                  <option value="warn">Warning</option>
                  <option value="info">Info</option>
                  <option value="debug">Debug</option>
                </Select>
              </div>
              <div>
                <Input
                  type="date"
                  value={systemLogsDate}
                  onChange={(e) => {
                    setSystemLogsDate(e.target.value);
                    setSystemLogsPage(1);
                  }}
                  placeholder="Tarih seçin (YYYY-MM-DD)"
                />
              </div>
              <div className="flex items-center">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSystemLogsDate('');
                    setSystemLogsLevel('');
                    setSystemLogsPage(1);
                  }}
                >
                  Filtreleri Temizle
                </Button>
              </div>
            </div>
          </Card>

          {/* Loading */}
          {systemLogsQuery.isLoading && (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          )}

          {/* Empty */}
          {!systemLogsQuery.isLoading && (!systemLogsQuery.data?.logs || systemLogsQuery.data.logs.length === 0) && (
            <Card className="p-8 text-center">
              <FileCode className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <div className="text-slate-500">Sistem logu bulunamadı.</div>
            </Card>
          )}

          {/* Liste */}
          {!systemLogsQuery.isLoading && systemLogsQuery.data?.logs && systemLogsQuery.data.logs.length > 0 && (
            <div className="space-y-3">
              {systemLogsQuery.data.logs.map((log, idx) => {
                const levelColor = 
                  log.level === 'error' ? 'bg-red-100 text-red-700' :
                  log.level === 'warn' ? 'bg-amber-100 text-amber-700' :
                  log.level === 'info' ? 'bg-blue-100 text-blue-700' :
                  'bg-slate-100 text-slate-700';
                
                return (
                  <Card key={idx} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`px-2 py-1 rounded text-xs font-semibold uppercase ${levelColor}`}>
                        {log.level}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 mb-1 break-words">
                          {log.message}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {log.timestamp ? new Date(log.timestamp).toLocaleString('tr-TR') : 'Tarih yok'}
                          </span>
                          {log.service && (
                            <span>Service: {log.service}</span>
                          )}
                        </div>
                        {log.stack && (
                          <details className="mt-2">
                            <summary className="text-xs text-slate-500 cursor-pointer">Stack Trace</summary>
                            <pre className="mt-2 text-xs bg-slate-50 p-2 rounded overflow-auto max-h-40">
                              {log.stack}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {systemLogsQuery.data && systemLogsQuery.data.total > 0 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-500">Toplam {systemLogsQuery.data.total} kayıt</div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSystemLogsPage((p) => Math.max(1, p - 1))}
                  disabled={systemLogsPage === 1}
                >
                  Önceki
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSystemLogsPage((p) => p + 1)}
                  disabled={systemLogsPage * 50 >= systemLogsQuery.data.total}
                >
                  Sonraki
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Monitoring Tab */}
      {activeTab === 'monitoring' && canReadMonitoring && (
        <div className="space-y-6">
          {/* Sistem Metrikleri */}
          {monitoringQuery.data && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* CPU */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">CPU Kullanımı</span>
                  <span className="text-xs text-slate-400">{monitoringQuery.data.system.cpu.cores} Core</span>
                </div>
                <div className="text-2xl font-bold text-slate-900 mb-1">
                  {monitoringQuery.data.system.cpu.usage.toFixed(1)}%
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      monitoringQuery.data.system.cpu.usage > 80 ? 'bg-red-500' :
                      monitoringQuery.data.system.cpu.usage > 60 ? 'bg-amber-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, monitoringQuery.data.system.cpu.usage)}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500 mt-1 truncate" title={monitoringQuery.data.system.cpu.model}>
                  {monitoringQuery.data.system.cpu.model}
                </div>
              </Card>

              {/* Memory */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">Bellek Kullanımı</span>
                  <span className="text-xs text-slate-400">{monitoringQuery.data.system.memory.totalGB} GB Toplam</span>
                </div>
                <div className="text-2xl font-bold text-slate-900 mb-1">
                  {monitoringQuery.data.system.memory.usagePercent.toFixed(1)}%
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      monitoringQuery.data.system.memory.usagePercent > 80 ? 'bg-red-500' :
                      monitoringQuery.data.system.memory.usagePercent > 60 ? 'bg-amber-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, monitoringQuery.data.system.memory.usagePercent)}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {monitoringQuery.data.system.memory.usedGB} GB / {monitoringQuery.data.system.memory.totalGB} GB
                </div>
              </Card>

              {/* Uptime */}
              <Card className="p-4">
                <div className="text-sm text-slate-600 mb-2">Sistem Çalışma Süresi</div>
                <div className="text-2xl font-bold text-slate-900 mb-1">
                  {parseFloat(monitoringQuery.data.system.uptime.days).toFixed(1)} gün
                </div>
                <div className="text-xs text-slate-500">
                  {parseFloat(monitoringQuery.data.system.uptime.hours).toFixed(1)} saat
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {monitoringQuery.data.system.hostname}
                </div>
              </Card>

              {/* Disk Space */}
              {monitoringQuery.data?.disk && (
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">Disk Kullanımı</span>
                    <Badge variant={monitoringQuery.data.disk.status === 'critical' ? 'danger' : monitoringQuery.data.disk.status === 'warning' ? 'warning' : 'success'}>
                      {monitoringQuery.data.disk.status}
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mb-1">
                    {monitoringQuery.data.disk.usagePercent.toFixed(1)}%
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        monitoringQuery.data.disk.usagePercent > 90 ? 'bg-red-500' :
                        monitoringQuery.data.disk.usagePercent > 80 ? 'bg-amber-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, monitoringQuery.data.disk.usagePercent)}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {monitoringQuery.data.disk.usedGB} GB / {monitoringQuery.data.disk.totalGB} GB
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Boş: {monitoringQuery.data.disk.freeGB} GB
                  </div>
                </Card>
              )}

              {/* Database Health */}
              {monitoringQuery.data?.database && (
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">Database</span>
                    <Badge variant={monitoringQuery.data.database.status === 'healthy' ? 'success' : 'danger'}>
                      {monitoringQuery.data.database.status}
                    </Badge>
                  </div>
                  {monitoringQuery.data.database.responseTime !== undefined && (
                    <>
                      <div className="text-2xl font-bold text-slate-900 mb-1">
                        {monitoringQuery.data.database.responseTime}ms
                      </div>
                      <div className="text-xs text-slate-500">Response Time</div>
                    </>
                  )}
                </Card>
              )}

              {/* Process Memory */}
              {monitoringPerformanceQuery.data && (
                <Card className="p-4">
                  <div className="text-sm text-slate-600 mb-2">Process Memory</div>
                  <div className="text-2xl font-bold text-slate-900 mb-1">
                    {monitoringPerformanceQuery.data.process.memory.heapUsedMB} MB
                  </div>
                  <div className="text-xs text-slate-500">
                    Heap: {monitoringPerformanceQuery.data.process.memory.heapTotalMB} MB
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Node: {monitoringPerformanceQuery.data.process.nodeVersion}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Health Check Status */}
          {healthCheckQuery.data && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Sistem Sağlık Durumu</h3>
                <Badge variant={healthCheckQuery.data.status === 'healthy' ? 'success' : healthCheckQuery.data.status === 'degraded' ? 'warning' : 'danger'}>
                  {healthCheckQuery.data.status === 'healthy' ? 'Sağlıklı' : healthCheckQuery.data.status === 'degraded' ? 'Bozuk' : 'Sağlıksız'}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-3 border rounded-lg">
                  <div className="text-sm text-slate-600 mb-1">Database</div>
                  <Badge variant={healthCheckQuery.data.checks.database.status === 'healthy' ? 'success' : 'danger'} className="text-xs">
                    {healthCheckQuery.data.checks.database.status}
                  </Badge>
                  {healthCheckQuery.data.checks.database.responseTime && (
                    <div className="text-xs text-slate-500 mt-1">{healthCheckQuery.data.checks.database.responseTime}ms</div>
                  )}
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-sm text-slate-600 mb-1">Disk</div>
                  <Badge variant={healthCheckQuery.data.checks.disk.status === 'healthy' ? 'success' : healthCheckQuery.data.checks.disk.status === 'warning' ? 'warning' : 'danger'} className="text-xs">
                    {healthCheckQuery.data.checks.disk.status}
                  </Badge>
                  <div className="text-xs text-slate-500 mt-1">{healthCheckQuery.data.checks.disk.usagePercent.toFixed(1)}% kullanım</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-sm text-slate-600 mb-1">Memory</div>
                  <Badge variant={healthCheckQuery.data.checks.memory.status === 'healthy' ? 'success' : healthCheckQuery.data.checks.memory.status === 'warning' ? 'warning' : 'danger'} className="text-xs">
                    {healthCheckQuery.data.checks.memory.status}
                  </Badge>
                  <div className="text-xs text-slate-500 mt-1">{healthCheckQuery.data.checks.memory.usagePercent.toFixed(1)}% kullanım</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-sm text-slate-600 mb-1">CPU</div>
                  <Badge variant={healthCheckQuery.data.checks.cpu.status === 'healthy' ? 'success' : healthCheckQuery.data.checks.cpu.status === 'warning' ? 'warning' : 'danger'} className="text-xs">
                    {healthCheckQuery.data.checks.cpu.status}
                  </Badge>
                  <div className="text-xs text-slate-500 mt-1">{healthCheckQuery.data.checks.cpu.usage.toFixed(1)}% kullanım</div>
                </div>
              </div>
            </Card>
          )}

          {/* Database İstatistikleri */}
          {monitoringQuery.data && (
            <Card className="p-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Veritabanı İstatistikleri</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-slate-600 mb-2">Kullanıcılar</div>
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-2xl font-bold text-slate-900">{monitoringQuery.data.databaseStats.users.total}</div>
                      <div className="text-xs text-slate-500">Toplam</div>
                    </div>
                    <div>
                      <div className="text-xl font-semibold text-emerald-600">{monitoringQuery.data.databaseStats.users.active}</div>
                      <div className="text-xs text-slate-500">Aktif</div>
                    </div>
                    <div>
                      <div className="text-xl font-semibold text-red-600">{monitoringQuery.data.databaseStats.users.inactive}</div>
                      <div className="text-xs text-slate-500">Pasif</div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-600 mb-2">Ticketlar</div>
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-2xl font-bold text-slate-900">{monitoringQuery.data.databaseStats.tickets.total}</div>
                      <div className="text-xs text-slate-500">Toplam</div>
                    </div>
                    <div>
                      <div className="text-xl font-semibold text-amber-600">{monitoringQuery.data.databaseStats.tickets.open}</div>
                      <div className="text-xs text-slate-500">Açık</div>
                    </div>
                    <div>
                      <div className="text-xl font-semibold text-slate-600">{monitoringQuery.data.databaseStats.tickets.closed}</div>
                      <div className="text-xs text-slate-500">Kapalı</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Response Time Metrikleri */}
          {monitoringPerformanceQuery.data?.responseTime && (
            <Card className="p-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Response Time Metrikleri</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="text-sm text-slate-600">Ortalama</div>
                  <div className="text-xl font-bold text-slate-900">{monitoringPerformanceQuery.data.responseTime.summary.average.toFixed(2)}ms</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="text-sm text-slate-600">Minimum</div>
                  <div className="text-xl font-bold text-slate-900">{monitoringPerformanceQuery.data.responseTime.summary.min}ms</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="text-sm text-slate-600">Maksimum</div>
                  <div className="text-xl font-bold text-slate-900">{monitoringPerformanceQuery.data.responseTime.summary.max}ms</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="text-sm text-slate-600">Toplam İstek</div>
                  <div className="text-xl font-bold text-slate-900">{monitoringPerformanceQuery.data.responseTime.summary.total}</div>
                </div>
              </div>
              {Object.keys(monitoringPerformanceQuery.data.responseTime.summary.byPath).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Path Bazında Ortalama Response Time</h4>
                  <div className="space-y-2">
                    {Object.entries(monitoringPerformanceQuery.data.responseTime.summary.byPath)
                      .sort((a, b) => b[1].avgTime - a[1].avgTime)
                      .slice(0, 10)
                      .map(([path, stats]) => (
                        <div key={path} className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm">
                          <code className="text-xs">{path}</code>
                          <div className="flex items-center gap-4">
                            <span className="text-slate-600">{stats.avgTime.toFixed(2)}ms</span>
                            <span className="text-slate-400">({stats.count} istek)</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Son 24 Saat Aktivite */}
          {monitoringQuery.data && (
            <Card className="p-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Son 24 Saat Aktivite</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{monitoringQuery.data.activity.last24Hours.tickets}</div>
                  <div className="text-sm text-slate-600">Yeni Ticket</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{monitoringQuery.data.activity.last24Hours.users}</div>
                  <div className="text-sm text-slate-600">Yeni Kullanıcı</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{monitoringQuery.data.activity.last24Hours.logins}</div>
                  <div className="text-sm text-slate-600">Giriş</div>
                </div>
              </div>
            </Card>
          )}

          {/* Loading */}
          {monitoringQuery.isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          )}

          {/* Error */}
          {monitoringQuery.error && (
            <Card className="p-8 text-center">
              <XCircle className="w-12 h-12 mx-auto text-red-300 mb-3" />
              <div className="text-red-500">Monitoring verileri alınamadı.</div>
            </Card>
          )}

          {/* Son Güncelleme */}
          {monitoringQuery.data && (
            <div className="text-xs text-slate-400 text-center">
              Son güncelleme: {new Date(monitoringQuery.data.timestamp).toLocaleString('tr-TR')}
            </div>
          )}
        </div>
      )}

      {/* Bilgilendirme Modal */}
      <Modal title="Loglar Bilgisi" open={openInfo} onClose={() => setOpenInfo(false)}>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              Log Sistemi Nasıl Çalışır?
            </h3>
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                Log sistemi, sistem aktivitelerini, değişiklikleri, dosya yüklemelerini ve sistem performansını kaydeder. Beş farklı log türü bulunur.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Log Türleri:</h4>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li><strong>Audit Log:</strong> Sistem değişiklik geçmişi (kullanıcı, rol, yetki, ticket değişiklikleri)</li>
                  <li><strong>Aktivite Log:</strong> Kullanıcı aktivite geçmişi (giriş, çıkış, işlemler)</li>
                  <li><strong>Dosya Yükleme Log:</strong> Dosya yükleme geçmişi (başarılı, başarısız, silinen dosyalar)</li>
                  <li><strong>Sistem Logları:</strong> Winston ile kaydedilen sistem logları (error, warn, info, debug)</li>
                  <li><strong>Monitoring:</strong> Sistem izleme ve performans metrikleri (CPU, bellek, disk, API performansı)</li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">Özellikler:</h4>
                <ul className="list-disc list-inside space-y-1 text-amber-800">
                  <li>Filtreleme: Entity type, action, status gibi filtrelerle arama</li>
                  <li>Sayfalama: Büyük log listeleri için sayfa sayfa görüntüleme</li>
                  <li>Detaylı Bilgi: Her log kaydı için IP adresi, kullanıcı, tarih bilgileri</li>
                  <li>İstatistikler: Dosya yükleme logları için toplam boyut ve istatistikler</li>
                  <li>Güvenlik: Tüm işlemler loglanır, denetim için saklanır</li>
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
