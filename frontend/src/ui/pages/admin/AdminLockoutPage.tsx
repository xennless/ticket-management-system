import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { getErrorMessage } from '../../../lib/errors';
import { useAuth } from '../../../lib/auth';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Skeleton } from '../../components/Skeleton';
import { Lock, Unlock, Search, Info, RefreshCw, AlertTriangle, Trash2, BarChart3, Shield, Globe } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Badge } from '../../components/Badge';

type AccountLockout = {
  id: string;
  userId: string;
  failedAttempts: number;
  lockedUntil: string | null;
  lastFailedAt: string | null;
  lastFailedIp: string | null;
  unlockedAt: string | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    isActive: boolean;
  };
  unlockedBy: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

type IpLockout = {
  id: string;
  ip: string;
  failedAttempts: number;
  lockedUntil: string | null;
  lastFailedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function AdminLockoutPage() {
  const { has } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const canRead = has('lockout.read');
  const canManage = has('lockout.manage');

  const [activeTab, setActiveTab] = useState<'accounts' | 'ips'>('accounts');
  const [qText, setQText] = useState('');
  const [accountPage, setAccountPage] = useState(1);
  const [ipPage, setIpPage] = useState(1);
  const [accountStatusFilter, setAccountStatusFilter] = useState<'locked' | 'unlocked' | 'all'>('locked');
  const [ipStatusFilter, setIpStatusFilter] = useState<'locked' | 'unlocked' | 'all'>('locked');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [confirmUnlockAccount, setConfirmUnlockAccount] = useState<{ userId: string; email: string } | null>(null);
  const [confirmUnlockIp, setConfirmUnlockIp] = useState<{ ip: string } | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState<'accounts' | 'ips' | null>(null);

  const accountsQuery = useQuery<{ lockouts: AccountLockout[]; total: number; page: number; pageSize: number }>({
    queryKey: ['lockout', 'accounts', { page: accountPage, search: qText, status: accountStatusFilter }],
    enabled: canRead && activeTab === 'accounts',
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', accountPage.toString());
      params.set('status', accountStatusFilter);
      if (qText) params.set('search', qText);
      return apiFetch(`/api/lockout/accounts?${params}`);
    }
  });

  const ipsQuery = useQuery<{ lockouts: IpLockout[]; total: number; page: number; pageSize: number }>({
    queryKey: ['lockout', 'ips', { page: ipPage, search: qText, status: ipStatusFilter }],
    enabled: canRead && activeTab === 'ips',
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', ipPage.toString());
      params.set('status', ipStatusFilter);
      if (qText) params.set('search', qText);
      return apiFetch(`/api/lockout/ips?${params}`);
    }
  });

  const statsQuery = useQuery<{
    accounts: {
      total: number;
      locked: number;
      unlocked: number;
      totalFailedAttempts: number;
      lockedLast24h: number;
    };
    ips: {
      total: number;
      locked: number;
      unlocked: number;
      totalFailedAttempts: number;
      lockedLast24h: number;
    };
  }>({
    queryKey: ['lockout', 'stats'],
    enabled: canRead,
    queryFn: () => apiFetch('/api/lockout/stats'),
    refetchInterval: 30000 // 30 saniyede bir güncelle
  });

  const unlockAccountM = useMutation({
    mutationFn: (userId: string) =>
      apiFetch<{ success: boolean; message: string }>(`/api/lockout/accounts/${userId}/unlock`, {
        method: 'POST'
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lockout'] });
      toast.push({ type: 'success', title: 'Hesap kilidi açıldı' });
      setConfirmUnlockAccount(null);
    },
    onError: (err) => {
      toast.push({ type: 'error', title: 'Hata', description: getErrorMessage(err) });
    }
  });

  const unlockIpM = useMutation({
    mutationFn: (ip: string) =>
      apiFetch<{ success: boolean; message: string }>(`/api/lockout/ips/${encodeURIComponent(ip)}/unlock`, {
        method: 'POST'
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lockout'] });
      toast.push({ type: 'success', title: 'IP kilidi açıldı' });
      setConfirmUnlockIp(null);
    },
    onError: (err) => {
      toast.push({ type: 'error', title: 'Hata', description: getErrorMessage(err) });
    }
  });

  const clearAllM = useMutation({
    mutationFn: (type: 'accounts' | 'ips') =>
      apiFetch<{ success: boolean; message: string }>(`/api/lockout/${type}/clear-all`, {
        method: 'POST'
      }),
    onSuccess: (_, type) => {
      qc.invalidateQueries({ queryKey: ['lockout'] });
      toast.push({ type: 'success', title: `Tüm ${type === 'accounts' ? 'hesap' : 'IP'} kilitleme kayıtları temizlendi` });
      setConfirmClearAll(null);
    },
    onError: (err) => {
      toast.push({ type: 'error', title: 'Hata', description: getErrorMessage(err) });
    }
  });

  const filteredAccounts = useMemo(() => {
    if (!accountsQuery.data?.lockouts) return [];
    // Backend'den zaten filtrelenmiş geliyor, direkt döndür
    return accountsQuery.data.lockouts;
  }, [accountsQuery.data?.lockouts]);

  const filteredIps = useMemo(() => {
    if (!ipsQuery.data?.lockouts) return [];
    // Backend'den zaten filtrelenmiş geliyor, direkt döndür
    return ipsQuery.data.lockouts;
  }, [ipsQuery.data?.lockouts]);

  const lockedAccountsCount = useMemo(() => {
    return statsQuery.data?.accounts.locked || 0;
  }, [statsQuery.data?.accounts.locked]);

  const lockedIpsCount = useMemo(() => {
    return statsQuery.data?.ips.locked || 0;
  }, [statsQuery.data?.ips.locked]);

  if (!canRead) {
    return <div className="p-6 text-center text-slate-500">Kilitleme kayıtlarını görüntüleme yetkiniz yok.</div>;
  }

  const isLoading = activeTab === 'accounts' ? accountsQuery.isLoading : ipsQuery.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hesap Kilitleme Yönetimi"
        description="Kilitli hesapları ve IP adreslerini görüntüleyin ve yönetin"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowInfoModal(true)}>
              <Info className="w-4 h-4 mr-2" />
              Bilgi
            </Button>
            {canManage && (
              <Button
                variant="secondary"
                onClick={() => {
                  if (activeTab === 'accounts') {
                    setConfirmClearAll('accounts');
                  } else {
                    setConfirmClearAll('ips');
                  }
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Tümünü Temizle
              </Button>
            )}
          </>
        }
      />

      {/* İstatistikler */}
      {statsQuery.data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600">Kilitli Hesaplar</span>
              <Shield className="w-5 h-5 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{statsQuery.data.accounts.locked}</div>
            <div className="text-xs text-slate-500 mt-1">
              Son 24 saat: {statsQuery.data.accounts.lockedLast24h} yeni kilit
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600">Kilitli IP'ler</span>
              <Globe className="w-5 h-5 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{statsQuery.data.ips.locked}</div>
            <div className="text-xs text-slate-500 mt-1">
              Son 24 saat: {statsQuery.data.ips.lockedLast24h} yeni kilit
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600">Toplam Başarısız Deneme (Hesap)</span>
              <BarChart3 className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{statsQuery.data.accounts.totalFailedAttempts}</div>
            <div className="text-xs text-slate-500 mt-1">
              {statsQuery.data.accounts.total} toplam kayıt
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600">Toplam Başarısız Deneme (IP)</span>
              <BarChart3 className="w-5 h-5 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{statsQuery.data.ips.totalFailedAttempts}</div>
            <div className="text-xs text-slate-500 mt-1">
              {statsQuery.data.ips.total} toplam kayıt
            </div>
          </Card>
        </div>
      )}

      {/* Tab'lar */}
      <div className="border-b border-slate-200">
        <div className="flex gap-4">
          <button
            onClick={() => {
              setActiveTab('accounts');
              setQText('');
              setAccountPage(1);
              setAccountStatusFilter('locked');
            }}
            className={`px-4 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'accounts'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Kilitli Hesaplar ({lockedAccountsCount})
          </button>
          <button
            onClick={() => {
              setActiveTab('ips');
              setQText('');
              setIpPage(1);
              setIpStatusFilter('locked');
            }}
            className={`px-4 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'ips'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Kilitli IP'ler ({lockedIpsCount})
          </button>
        </div>
      </div>

      {/* Arama ve Filtreler */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder={activeTab === 'accounts' ? 'Email veya isim ara...' : 'IP adresi ara...'}
              value={qText}
              onChange={(e) => {
                setQText(e.target.value);
                if (activeTab === 'accounts') {
                  setAccountPage(1);
                } else {
                  setIpPage(1);
                }
              }}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            {activeTab === 'accounts' ? (
              <>
                <Button
                  variant={accountStatusFilter === 'locked' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => {
                    setAccountStatusFilter('locked');
                    setAccountPage(1);
                  }}
                >
                  Kilitli
                </Button>
                <Button
                  variant={accountStatusFilter === 'unlocked' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => {
                    setAccountStatusFilter('unlocked');
                    setAccountPage(1);
                  }}
                >
                  Açık
                </Button>
                <Button
                  variant={accountStatusFilter === 'all' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => {
                    setAccountStatusFilter('all');
                    setAccountPage(1);
                  }}
                >
                  Tümü
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant={ipStatusFilter === 'locked' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => {
                    setIpStatusFilter('locked');
                    setIpPage(1);
                  }}
                >
                  Kilitli
                </Button>
                <Button
                  variant={ipStatusFilter === 'unlocked' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => {
                    setIpStatusFilter('unlocked');
                    setIpPage(1);
                  }}
                >
                  Açık
                </Button>
                <Button
                  variant={ipStatusFilter === 'all' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => {
                    setIpStatusFilter('all');
                    setIpPage(1);
                  }}
                >
                  Tümü
                </Button>
              </>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (activeTab === 'accounts') {
                  accountsQuery.refetch();
                } else {
                  ipsQuery.refetch();
                }
                statsQuery.refetch();
              }}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* İçerik */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-64" />
        </div>
      ) : activeTab === 'accounts' ? (
        <>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left p-3 text-sm font-semibold text-slate-700">Kullanıcı</th>
                    <th className="text-left p-3 text-sm font-semibold text-slate-700">Başarısız Deneme</th>
                    <th className="text-left p-3 text-sm font-semibold text-slate-700">Kilitlenme Süresi</th>
                    <th className="text-left p-3 text-sm font-semibold text-slate-700">Son Başarısız Deneme</th>
                    <th className="text-left p-3 text-sm font-semibold text-slate-700">IP Adresi</th>
                    <th className="text-left p-3 text-sm font-semibold text-slate-700">Durum</th>
                    {canManage && <th className="text-right p-3 text-sm font-semibold text-slate-700">İşlemler</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={canManage ? 7 : 6} className="p-8 text-center text-slate-500">
                        Kilit kaydı bulunamadı
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((lockout) => {
                      const isLocked = lockout.lockedUntil && new Date(lockout.lockedUntil) > new Date();
                      const minutesLeft = isLocked
                        ? Math.ceil((new Date(lockout.lockedUntil!).getTime() - Date.now()) / (1000 * 60))
                        : 0;

                      return (
                        <tr key={lockout.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-3">
                            <div>
                              <div className="font-medium text-slate-900">{lockout.user.email}</div>
                              {lockout.user.name && (
                                <div className="text-sm text-slate-500">{lockout.user.name}</div>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-slate-700">{lockout.failedAttempts}</td>
                          <td className="p-3 text-slate-700">
                            {isLocked ? (
                              <div>
                                <div className="text-sm font-medium text-red-600">{minutesLeft} dakika</div>
                                <div className="text-xs text-slate-500">
                                  {new Date(lockout.lockedUntil!).toLocaleString('tr-TR')}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-700">
                            {lockout.lastFailedAt ? (
                              <div className="text-sm">{new Date(lockout.lastFailedAt).toLocaleString('tr-TR')}</div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-700">
                            {lockout.lastFailedIp ? (
                              <span className="text-sm font-mono">{lockout.lastFailedIp}</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            {isLocked ? (
                              <Badge variant="danger">Kilitli</Badge>
                            ) : (
                              <Badge variant="success">Açık</Badge>
                            )}
                          </td>
                          {canManage && (
                            <td className="p-3 text-right">
                              {isLocked && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() =>
                                    setConfirmUnlockAccount({
                                      userId: lockout.userId,
                                      email: lockout.user.email
                                    })
                                  }
                                >
                                  <Unlock className="w-4 h-4 mr-1" />
                                  Kilidi Aç
                                </Button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Sayfalama */}
            {accountsQuery.data && accountsQuery.data.total > accountsQuery.data.pageSize && (
              <div className="p-4 border-t border-slate-200 flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  Toplam {accountsQuery.data.total} kayıt, sayfa {accountsQuery.data.page} /{' '}
                  {Math.ceil(accountsQuery.data.total / accountsQuery.data.pageSize)}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={accountPage === 1}
                    onClick={() => setAccountPage((p) => Math.max(1, p - 1))}
                  >
                    Önceki
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={accountPage >= Math.ceil(accountsQuery.data.total / accountsQuery.data.pageSize)}
                    onClick={() => setAccountPage((p) => p + 1)}
                  >
                    Sonraki
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      ) : (
        <>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left p-3 text-sm font-semibold text-slate-700">IP Adresi</th>
                    <th className="text-left p-3 text-sm font-semibold text-slate-700">Başarısız Deneme</th>
                    <th className="text-left p-3 text-sm font-semibold text-slate-700">Kilitlenme Süresi</th>
                    <th className="text-left p-3 text-sm font-semibold text-slate-700">Son Başarısız Deneme</th>
                    <th className="text-left p-3 text-sm font-semibold text-slate-700">Durum</th>
                    {canManage && <th className="text-right p-3 text-sm font-semibold text-slate-700">İşlemler</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredIps.length === 0 ? (
                    <tr>
                      <td colSpan={canManage ? 6 : 5} className="p-8 text-center text-slate-500">
                        IP kilit kaydı bulunamadı
                      </td>
                    </tr>
                  ) : (
                    filteredIps.map((lockout) => {
                      const isLocked = lockout.lockedUntil && new Date(lockout.lockedUntil) > new Date();
                      const minutesLeft = isLocked
                        ? Math.ceil((new Date(lockout.lockedUntil!).getTime() - Date.now()) / (1000 * 60))
                        : 0;

                      return (
                        <tr key={lockout.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-3">
                            <span className="font-mono text-slate-900">{lockout.ip}</span>
                          </td>
                          <td className="p-3 text-slate-700">{lockout.failedAttempts}</td>
                          <td className="p-3 text-slate-700">
                            {isLocked ? (
                              <div>
                                <div className="text-sm font-medium text-red-600">{minutesLeft} dakika</div>
                                <div className="text-xs text-slate-500">
                                  {new Date(lockout.lockedUntil!).toLocaleString('tr-TR')}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-700">
                            {lockout.lastFailedAt ? (
                              <div className="text-sm">{new Date(lockout.lastFailedAt).toLocaleString('tr-TR')}</div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            {isLocked ? (
                              <Badge variant="danger">Kilitli</Badge>
                            ) : (
                              <Badge variant="success">Açık</Badge>
                            )}
                          </td>
                          {canManage && (
                            <td className="p-3 text-right">
                              {isLocked && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setConfirmUnlockIp({ ip: lockout.ip })}
                                >
                                  <Unlock className="w-4 h-4 mr-1" />
                                  Kilidi Aç
                                </Button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Sayfalama */}
            {ipsQuery.data && ipsQuery.data.total > ipsQuery.data.pageSize && (
              <div className="p-4 border-t border-slate-200 flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  Toplam {ipsQuery.data.total} kayıt, sayfa {ipsQuery.data.page} /{' '}
                  {Math.ceil(ipsQuery.data.total / ipsQuery.data.pageSize)}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={ipPage === 1}
                    onClick={() => setIpPage((p) => Math.max(1, p - 1))}
                  >
                    Önceki
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={ipPage >= Math.ceil(ipsQuery.data.total / ipsQuery.data.pageSize)}
                    onClick={() => setIpPage((p) => p + 1)}
                  >
                    Sonraki
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Bilgi Modal */}
      <Modal open={showInfoModal} onClose={() => setShowInfoModal(false)} title="Hesap Kilitleme Bilgisi">
        <div className="space-y-4">
          <p className="text-slate-600">
            Bu sayfa, sistemdeki kilitli hesapları ve IP adreslerini görüntülemenize ve yönetmenize olanak tanır.
          </p>
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-900">Özellikler:</h3>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>Kilitli hesapları ve IP adreslerini listeleme</li>
              <li>Başarısız giriş denemesi sayısını görüntüleme</li>
              <li>Kilitlenme süresini görüntüleme</li>
              <li>Manuel olarak kilidi açma</li>
              <li>Tüm kilitleme kayıtlarını temizleme</li>
            </ul>
          </div>
        </div>
      </Modal>

      {/* Onay Dialog'ları */}
      <ConfirmDialog
        open={!!confirmUnlockAccount}
        onClose={() => setConfirmUnlockAccount(null)}
        onConfirm={() => {
          if (confirmUnlockAccount) {
            unlockAccountM.mutate(confirmUnlockAccount.userId);
          }
        }}
        title="Hesap Kilidini Aç"
        description={`${confirmUnlockAccount?.email} hesabının kilidini açmak istediğinize emin misiniz?`}
        confirmText="Kilidi Aç"
        variant="danger"
      />

      <ConfirmDialog
        open={!!confirmUnlockIp}
        onClose={() => setConfirmUnlockIp(null)}
        onConfirm={() => {
          if (confirmUnlockIp) {
            unlockIpM.mutate(confirmUnlockIp.ip);
          }
        }}
        title="IP Kilidini Aç"
        description={`${confirmUnlockIp?.ip} IP adresinin kilidini açmak istediğinize emin misiniz?`}
        confirmText="Kilidi Aç"
        variant="danger"
      />

      <ConfirmDialog
        open={!!confirmClearAll}
        onClose={() => setConfirmClearAll(null)}
        onConfirm={() => {
          if (confirmClearAll) {
            clearAllM.mutate(confirmClearAll);
          }
        }}
        title="Tüm Kayıtları Temizle"
        description={`Tüm ${confirmClearAll === 'accounts' ? 'hesap' : 'IP'} kilitleme kayıtlarını temizlemek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
        confirmText="Temizle"
        variant="danger"
      />
    </div>
  );
}

