import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Skeleton } from '../../components/Skeleton';
import { Shield, CheckCircle, XCircle, Search, Info, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/Modal';

type User2FA = {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  deletedAt: string | null;
  twoFactorEnabled: boolean;
  twoFactorMethod: string | null;
  twoFactorCreatedAt: string | null;
  twoFactorUpdatedAt: string | null;
};

export function Admin2FAPage() {
  const { has } = useAuth();
  const canRead = has('user.read');
  const [qText, setQText] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [showInfoModal, setShowInfoModal] = useState(false);

  const { data, isLoading, refetch } = useQuery<{ users: User2FA[] }>({
    queryKey: ['admin', '2fa', 'users'],
    enabled: canRead,
    queryFn: () => apiFetch('/api/admin/2fa/users')
  });

  const filteredUsers = useMemo(() => {
    if (!data?.users) return [];
    let users = data.users;

    // Filtre: aktif/pasif
    if (filterStatus === 'enabled') {
      users = users.filter((u) => u.twoFactorEnabled);
    } else if (filterStatus === 'disabled') {
      users = users.filter((u) => !u.twoFactorEnabled);
    }

    // Arama
    const needle = qText.trim().toLowerCase();
    if (needle) {
      users = users.filter(
        (u) =>
          u.email.toLowerCase().includes(needle) ||
          (u.name && u.name.toLowerCase().includes(needle))
      );
    }

    return users;
  }, [data?.users, qText, filterStatus]);

  const stats = useMemo(() => {
    if (!data?.users) return { total: 0, enabled: 0, disabled: 0 };
    const total = data.users.filter((u) => !u.deletedAt && u.isActive).length;
    const enabled = data.users.filter(
      (u) => !u.deletedAt && u.isActive && u.twoFactorEnabled
    ).length;
    const disabled = total - enabled;
    return { total, enabled, disabled };
  }, [data?.users]);

  if (!canRead) {
    return <div className="p-6 text-center text-slate-500">2FA yönetimi yetkiniz yok.</div>;
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="2FA Yönetimi"
        description="Tüm kullanıcıların 2FA durumunu görüntüleyin ve yönetin"
        actions={
          <Button variant="secondary" onClick={() => setShowInfoModal(true)}>
            <Info className="w-4 h-4 mr-2" />
            Bilgi
          </Button>
        }
      />

      {/* İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-600">Toplam Aktif Kullanıcı</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</div>
            </div>
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
              <Shield className="w-6 h-6 text-slate-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-600">2FA Aktif</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">{stats.enabled}</div>
              <div className="text-xs text-slate-500 mt-1">
                {stats.total > 0 ? `${Math.round((stats.enabled / stats.total) * 100)}%` : '0%'}
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-600">2FA Pasif</div>
              <div className="text-2xl font-bold text-red-600 mt-1">{stats.disabled}</div>
              <div className="text-xs text-slate-500 mt-1">
                {stats.total > 0 ? `${Math.round((stats.disabled / stats.total) * 100)}%` : '0%'}
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filtreler ve Arama */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              placeholder="Kullanıcı ara (email, ad)..."
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filterStatus === 'all' ? 'primary' : 'secondary'}
              onClick={() => setFilterStatus('all')}
            >
              Tümü
            </Button>
            <Button
              variant={filterStatus === 'enabled' ? 'primary' : 'secondary'}
              onClick={() => setFilterStatus('enabled')}
            >
              2FA Aktif
            </Button>
            <Button
              variant={filterStatus === 'disabled' ? 'primary' : 'secondary'}
              onClick={() => setFilterStatus('disabled')}
            >
              2FA Pasif
            </Button>
            <Button variant="secondary" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Kullanıcı Listesi */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Kullanıcı
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Durum
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  2FA Durumu
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  2FA Yöntemi
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  2FA Tarihi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                    Kullanıcı bulunamadı
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-slate-900">
                          {u.name || 'Ad belirtilmemiş'}
                        </div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {u.deletedAt || !u.isActive ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 border border-red-200/70 w-fit">
                          <XCircle className="w-3 h-3" />
                          Pasif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200/70 w-fit">
                          <CheckCircle className="w-3 h-3" />
                          Aktif
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {u.twoFactorEnabled ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm font-medium text-emerald-700">Aktif</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-600">Pasif</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {u.twoFactorEnabled && u.twoFactorMethod ? (
                        <span className="text-sm text-slate-700">
                          {u.twoFactorMethod === 'TOTP' ? 'Authenticator' : u.twoFactorMethod === 'EMAIL' ? 'Email' : u.twoFactorMethod}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {u.twoFactorEnabled && u.twoFactorCreatedAt ? (
                        <div className="flex flex-col">
                          <div className="text-xs text-slate-600">
                            {new Date(u.twoFactorCreatedAt).toLocaleDateString('tr-TR')}
                          </div>
                          {u.twoFactorUpdatedAt && u.twoFactorUpdatedAt !== u.twoFactorCreatedAt && (
                            <div className="text-xs text-slate-400">
                              Güncellendi: {new Date(u.twoFactorUpdatedAt).toLocaleDateString('tr-TR')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredUsers.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/50 text-xs text-slate-600">
            {filteredUsers.length} kullanıcı gösteriliyor
          </div>
        )}
      </Card>

      {/* Info Modal */}
      {showInfoModal && (
        <Modal title="2FA Yönetimi Hakkında" open={showInfoModal} onClose={() => setShowInfoModal(false)}>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Info className="w-5 h-5" />
                2FA Yönetimi
              </h3>
              <p className="text-sm text-blue-800">
                Bu sayfada tüm kullanıcıların 2FA durumunu görüntüleyebilirsiniz. İstatistikler ve filtreleme
                özellikleri ile kullanıcıların güvenlik durumunu takip edebilirsiniz.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Özellikler:</h4>
                <ul className="space-y-1 text-sm text-slate-600">
                  <li>• Tüm kullanıcıların 2FA durumunu görüntüleme</li>
                  <li>• 2FA aktif/pasif kullanıcı istatistikleri</li>
                  <li>• Email ve ad ile arama yapma</li>
                  <li>• 2FA durumuna göre filtreleme</li>
                  <li>• 2FA aktivasyon tarihlerini görüntüleme</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Not:</h4>
                <p className="text-sm text-slate-600">
                  Kullanıcılar kendi 2FA ayarlarını{' '}
                  <strong className="text-slate-900">Profil → 2FA</strong> sayfasından yönetebilirler.
                  Admin olarak bu sayfada sadece durumu görüntüleyebilirsiniz.
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

