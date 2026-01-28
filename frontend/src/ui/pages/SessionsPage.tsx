import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { Badge } from '../components/Badge';
import { 
  Smartphone, 
  Trash2, 
  LogOut, 
  Monitor, 
  Tablet, 
  Globe, 
  Clock, 
  Calendar, 
  Timer,
  Shield,
  Chrome,
  Laptop,
  Info,
  History as HistoryIcon,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/PageHeader';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { useState } from 'react';
import clsx from 'clsx';

type Session = {
  id: string;
  current: boolean;
  active?: boolean;
  browser: string;
  os: string;
  deviceType: string;
  device: string;
  ip: string;
  location?: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActivity: string;
  expiresAt: string;
  suspiciousActivity?: boolean;
  suspiciousReason?: string | null;
  terminatedAt?: string | null;
  terminatedReason?: string | null;
  age: string;
  remaining: string;
  inactive: string;
  timeoutWarning?: boolean;
};

// Device type icon
function DeviceIcon({ type }: { type: string }) {
  switch (type) {
    case 'Mobil':
      return <Smartphone className="w-6 h-6" />;
    case 'Tablet':
      return <Tablet className="w-6 h-6" />;
    default:
      return <Monitor className="w-6 h-6" />;
  }
}

// Browser icon (simplified)
function BrowserIcon({ browser }: { browser: string }) {
  if (browser.includes('Chrome')) return <Chrome className="w-4 h-4" />;
  if (browser.includes('Edge')) return <Globe className="w-4 h-4" />;
  if (browser.includes('Firefox')) return <Globe className="w-4 h-4" />;
  if (browser.includes('Safari')) return <Globe className="w-4 h-4" />;
  return <Globe className="w-4 h-4" />;
}

export function SessionsPage() {
  const { has } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const canRead = has('session.read');
  const canManage = has('session.manage');

  const [confirmDelete, setConfirmDelete] = useState<Session | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [openInfo, setOpenInfo] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { data, isLoading, error } = useQuery<{ sessions: Session[] }>({
    queryKey: ['sessions'],
    enabled: canRead,
    refetchInterval: 30000, // 30 saniyede bir yenile
    queryFn: () => apiFetch<{ sessions: Session[] }>('/api/sessions')
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      toast.push({ type: 'success', title: 'Oturum sonlandırıldı', description: 'Session başarıyla kapatıldı.' });
      setConfirmDelete(null);
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message || 'Session kapatılamadı.' });
    }
  });

  const deleteAllM = useMutation({
    mutationFn: () => apiFetch<{ count: number }>('/api/sessions', { method: 'DELETE' }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      toast.push({ 
        type: 'success', 
        title: 'Oturumlar sonlandırıldı', 
        description: `${data.count} oturum kapatıldı.` 
      });
      setConfirmDeleteAll(false);
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message || 'Sessionlar kapatılamadı.' });
    }
  });

  if (!canRead) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title="Aktif Oturumlar" description="Yetkiniz yok" />
        <Card className="p-8 text-center text-slate-500">
          <Shield className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <div>Session görüntüleme yetkiniz yok.</div>
          <div className="text-xs text-slate-400 mt-2">session.read yetkisi gerekli</div>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title="Aktif Oturumlar" description="Hata oluştu" />
        <Card className="p-8 text-center">
          <div className="text-red-600">Hata: {(error as any)?.message ?? 'Bilinmeyen hata'}</div>
        </Card>
      </div>
    );
  }

  const sessions = data?.sessions || [];
  const otherSessions = sessions.filter(s => !s.current);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Aktif Oturumlar"
        description={`${sessions.length} aktif oturum bulunuyor`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setShowHistory(!showHistory)} title="Geçmiş Oturumlar">
              <HistoryIcon className="w-4 h-4 mr-2" />
              {showHistory ? 'Aktif Oturumlar' : 'Geçmiş'}
            </Button>
            <Button variant="secondary" onClick={() => setOpenInfo(true)} title="Oturum Yönetimi Bilgisi">
              <Info className="w-4 h-4" />
            </Button>
            {canManage && otherSessions.length > 0 && (
              <Button 
                variant="danger" 
                onClick={() => setConfirmDeleteAll(true)} 
                disabled={deleteAllM.isPending}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Diğer Oturumları Kapat ({otherSessions.length})
              </Button>
            )}
          </div>
        }
      />

      {/* Bilgi kartı */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <div className="font-medium text-blue-900">Oturum Güvenliği</div>
            <div className="text-sm text-blue-700 mt-1">
              Burada hesabınıza bağlı tüm aktif oturumları görebilirsiniz. 
              Tanımadığınız bir oturum görürseniz, hemen kapatın ve şifrenizi değiştirin.
            </div>
          </div>
        </div>
      </Card>

      {sessions.length === 0 ? (
        <Card className="p-8 text-center">
          <Laptop className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <div className="text-slate-500">Aktif oturum bulunamadı.</div>
        </Card>
      ) : (
        <div className="space-y-4">
          {sessions.map((s) => (
            <Card 
              key={s.id} 
              className={clsx(
                'p-5 transition-all',
                s.current 
                  ? 'border-2 border-green-500 bg-green-50/50' 
                  : 'hover:shadow-md'
              )}
            >
              <div className="flex items-start gap-4">
                {/* Device Icon */}
                <div className={clsx(
                  'p-3 rounded-xl',
                  s.current 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-slate-100 text-slate-500'
                )}>
                  <DeviceIcon type={s.deviceType} />
                </div>

                {/* Session Info */}
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="font-semibold text-slate-900">{s.device}</span>
                    {s.current && (
                      <Badge variant="success" className="text-xs">
                        Bu Cihaz
                      </Badge>
                    )}
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                    {/* Browser & OS */}
                    <div className="flex items-center gap-2 text-slate-600">
                      <BrowserIcon browser={s.browser} />
                      <span>{s.browser}</span>
                      <span className="text-slate-300">|</span>
                      <span>{s.os}</span>
                    </div>

                    {/* IP */}
                    <div className="flex items-center gap-2 text-slate-600">
                      <Globe className="w-4 h-4 text-slate-400" />
                      <span>IP: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{s.ip}</code></span>
                      {s.location && (
                        <span className="text-xs text-slate-400">({s.location})</span>
                      )}
                    </div>

                    {/* Last Activity */}
                    <div className="flex items-center gap-2 text-slate-600">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span>Son aktivite: <span className="font-medium">{s.inactive}</span></span>
                    </div>

                    {/* Session Age */}
                    <div className="flex items-center gap-2 text-slate-600">
                      <Timer className="w-4 h-4 text-slate-400" />
                      <span>Oturum yaşı: <span className="font-medium">{s.age}</span></span>
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Oluşturulma: {new Date(s.createdAt).toLocaleString('tr-TR')}
                    </div>
                    <div className="flex items-center gap-1">
                      <Timer className="w-3 h-3" />
                      Kalan süre: {s.remaining}
                    </div>
                    {s.suspiciousReason && (
                      <div className="flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="w-3 h-3" />
                        {s.suspiciousReason}
                      </div>
                    )}
                    {s.terminatedReason && (
                      <div className="flex items-center gap-1 text-slate-500">
                        <XCircle className="w-3 h-3" />
                        Sonlandırma: {s.terminatedReason}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action */}
                {canManage && !s.current && (
                  <Button 
                    variant="danger" 
                    onClick={() => setConfirmDelete(s)} 
                    disabled={deleteM.isPending}
                    className="shrink-0"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Sonlandır
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Confirm Delete Single Session */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Oturumu sonlandır"
        description={
          confirmDelete
            ? `"${confirmDelete.device}" cihazındaki oturumu sonlandırmak istediğinize emin misiniz? Bu cihazda giriş yapan kullanıcı otomatik olarak çıkış yapacaktır.`
            : ''
        }
        danger
        confirmText="Sonlandır"
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => { if (confirmDelete) deleteM.mutate(confirmDelete.id); }}
      />

      {/* Confirm Delete All Sessions */}
      <ConfirmDialog
        open={confirmDeleteAll}
        title="Tüm diğer oturumları sonlandır"
        description={`${otherSessions.length} oturumu sonlandırmak istediğinize emin misiniz? Bu cihazlar otomatik olarak çıkış yapacaktır.`}
        danger
        confirmText={`${otherSessions.length} Oturumu Sonlandır`}
        onClose={() => setConfirmDeleteAll(false)}
        onConfirm={() => { deleteAllM.mutate(); }}
      />

      {/* Bilgilendirme Modal */}
      <Modal title="Oturum Yönetimi Bilgisi" open={openInfo} onClose={() => setOpenInfo(false)}>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              Oturum Yönetimi Nasıl Çalışır?
            </h3>
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                Oturum yönetimi, aktif kullanıcı oturumlarını görüntülemenize ve yönetmenize olanak sağlar. Güvenlik için tüm oturumları kontrol edebilirsiniz.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Oturum Bilgileri:</h4>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li><strong>Cihaz Bilgisi:</strong> Tarayıcı, işletim sistemi ve cihaz tipi</li>
                  <li><strong>IP Adresi:</strong> Oturumun bağlandığı IP adresi</li>
                  <li><strong>Oluşturulma Tarihi:</strong> Oturumun açıldığı tarih ve saat</li>
                  <li><strong>Son Aktivite:</strong> Son işlem zamanı</li>
                  <li><strong>Kalan Süre:</strong> Oturumun ne kadar süre daha aktif kalacağı</li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">Özellikler:</h4>
                <ul className="list-disc list-inside space-y-1 text-amber-800">
                  <li>Oturum Sonlandırma: Tek bir oturumu veya tüm oturumları sonlandırabilirsiniz</li>
                  <li>Otomatik Güncelleme: Oturum listesi 30 saniyede bir otomatik güncellenir</li>
                  <li>Güvenlik: Bir oturum sonlandırıldığında, o cihazdan otomatik olarak çıkış yapılır</li>
                  <li>Mevcut Oturum: Şu anda kullandığınız oturum "Mevcut" olarak işaretlenir</li>
                  <li>Çoklu Cihaz: Aynı anda birden fazla cihazdan oturum açabilirsiniz</li>
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
