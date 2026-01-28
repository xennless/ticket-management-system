import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { Bell, Check, CheckCheck, Info } from 'lucide-react';
import { useToast } from '../components/Toast';
import { Link } from 'react-router-dom';
import { Switch } from '../components/Switch';
import { useState } from 'react';
import { Pagination } from '../components/Pagination';
import { Select } from '../components/Select';
import { PageHeader } from '../components/PageHeader';

type Notification = {
  id: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

export function NotificationsPage() {
  const { has } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const canRead = has('notification.read');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const { data, isLoading } = useQuery<{ notifications: Notification[]; total: number; page: number; pageSize: number }>({
    queryKey: ['notifications', { unreadOnly, page, pageSize }],
    enabled: canRead,
    queryFn: () =>
      apiFetch(`/api/notifications?unreadOnly=${unreadOnly ? 'true' : 'false'}&page=${page}&pageSize=${pageSize}`)
  });

  const readM = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/notifications/${id}/read`, { method: 'PUT' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.push({ type: 'success', title: 'Bildirim okundu olarak işaretlendi' });
    }
  });

  const readAllM = useMutation({
    mutationFn: () => apiFetch('/api/notifications/read-all', { method: 'PUT' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.push({ type: 'success', title: 'Tüm bildirimler okundu olarak işaretlendi' });
    }
  });

  if (!canRead) {
    return <div className="p-6 text-center text-slate-500">Bildirim görüntüleme yetkiniz yok.</div>;
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const notifications = data?.notifications || [];
  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bildirimler"
        description={unreadCount > 0 ? `${unreadCount} okunmamış bildirim` : 'Tüm bildirimler okundu'}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setShowInfoModal(true)}>
              <Info className="w-4 h-4 mr-2" />
              Bilgi
            </Button>
          <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <span className="text-sm text-slate-700">Sadece okunmamış</span>
            <Switch
              checked={unreadOnly}
              onChange={(v: boolean) => {
                setUnreadOnly(v);
                setPage(1);
              }}
            />
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <span className="text-sm text-slate-700">Sayfa</span>
            <Select
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setPage(1);
              }}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </Select>
          </div>
          <Link to="/profile#notifications">
            <Button variant="secondary">Bildirim Tercihleri</Button>
          </Link>
          {unreadCount > 0 && (
            <Button variant="secondary" onClick={() => readAllM.mutate()} disabled={readAllM.isPending}>
              <CheckCheck className="w-4 h-4 mr-2" />
              Tümünü Okundu İşaretle
            </Button>
          )}
          </div>
        }
      />

      {notifications.length === 0 ? (
        <Card className="p-8 text-center">
          <Bell className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <div className="text-slate-500">Henüz bildirim yok.</div>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <Card key={n.id} className={`p-4 ${!n.readAt ? 'border-l-4 border-l-blue-500' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">{n.title}</div>
                  <div className="text-sm text-slate-600 mt-1">{n.message}</div>
                  <div className="text-xs text-slate-400 mt-2">{new Date(n.createdAt).toLocaleString()}</div>
                </div>
                {!n.readAt && (
                  <Button
                    variant="secondary"
                    onClick={() => readM.mutate(n.id)}
                    disabled={readM.isPending}
                    className="ml-4"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}

          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(p) => setPage(p)}
            className="pt-2"
          />
        </div>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <Modal title="Bildirimler Hakkında" open={showInfoModal} onClose={() => setShowInfoModal(false)}>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Info className="w-5 h-5" />
                Bildirimler Nedir?
              </h3>
              <p className="text-sm text-blue-800">
                Bildirimler sayfası, sistemdeki tüm bildirimlerinizi görüntülemenize, okundu olarak işaretlemenize ve bildirim tercihlerinizi yönetmenize olanak sağlar.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900 text-sm">Özellikler:</h4>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">1</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Bildirim Listesi</p>
                    <p className="text-sm text-slate-600">Tüm bildirimlerinizi görüntüleyebilir, okunmamış bildirimleri filtreleyebilir ve sayfalama yapabilirsiniz.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">2</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Okundu İşaretleme</p>
                    <p className="text-sm text-slate-600">Bildirimleri tek tek veya toplu olarak okundu olarak işaretleyebilirsiniz. Tüm bildirimleri tek seferde okundu olarak işaretleyebilirsiniz.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">3</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Bildirim Tercihleri</p>
                    <p className="text-sm text-slate-600">Profil sayfasından hangi olaylarda bildirim almak istediğinizi ayarlayabilirsiniz. Uygulama içi ve email bildirimleri için ayrı tercihler belirleyebilirsiniz.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

