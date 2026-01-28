import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Card } from '../components/Card';
import { Skeleton } from '../components/Skeleton';
import { Users, Shield, KeyRound, UserCheck, Clock, Info } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';

type DashboardData = {
  stats: {
    totalUsers: number;
    activeUsers: number;
    totalRoles: number;
    totalPermissions: number;
  };
  recentUsers: Array<{ id: string; email: string; name: string | null; createdAt: string }>;
  recentLogins: Array<{ id: string; email: string; name: string | null; lastLoginAt: string }>;
};

export function DashboardPage() {
  const { has } = useAuth();
  const canRead = has('dashboard.read');
  const [openInfo, setOpenInfo] = useState(false);

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    enabled: canRead,
    queryFn: () => apiFetch<DashboardData>('/api/dashboard')
  });

  if (!canRead) {
    return <div className="p-6 text-center text-slate-500">Dashboard görüntüleme yetkiniz yok.</div>;
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-red-600">Hata: {(error as any)?.message}</div>;
  }

  const { stats, recentUsers, recentLogins } = data!;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Dashboard" 
        description="Sistem özeti ve istatistikler"
        actions={
          <Button variant="secondary" onClick={() => setOpenInfo(true)} title="Dashboard Bilgisi">
            <Info className="w-4 h-4" />
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Toplam Kullanıcı</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{stats.totalUsers}</div>
            </div>
            <Users className="w-8 h-8 text-slate-400" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Aktif Kullanıcı</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{stats.activeUsers}</div>
            </div>
            <UserCheck className="w-8 h-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Toplam Rol</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{stats.totalRoles}</div>
            </div>
            <Shield className="w-8 h-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Toplam Yetki</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{stats.totalPermissions}</div>
            </div>
            <KeyRound className="w-8 h-8 text-purple-500" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-slate-500" />
            <h2 className="font-semibold text-slate-900">Son Eklenen Kullanıcılar</h2>
          </div>
          {recentUsers.length > 0 ? (
            <div className="space-y-2">
              {recentUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium text-slate-900">{u.name || u.email}</div>
                    <div className="text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500">Henüz kullanıcı yok.</div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-slate-500" />
            <h2 className="font-semibold text-slate-900">Son Girişler</h2>
          </div>
          {recentLogins.length > 0 ? (
            <div className="space-y-2">
              {recentLogins.map((u) => (
                <div key={u.id} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium text-slate-900">{u.name || u.email}</div>
                    <div className="text-slate-500">
                      {new Date(u.lastLoginAt).toLocaleDateString()} {new Date(u.lastLoginAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500">Henüz giriş yapılmamış.</div>
          )}
        </Card>
      </div>

      {/* Bilgilendirme Modal */}
      <Modal title="Dashboard Bilgisi" open={openInfo} onClose={() => setOpenInfo(false)}>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              Dashboard Nasıl Çalışır?
            </h3>
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                Dashboard, sisteminizin genel durumunu ve istatistiklerini görüntülemenize olanak sağlar. Önemli metrikler ve son aktiviteler burada özetlenir.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">İstatistikler:</h4>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li><strong>Toplam Kullanıcı:</strong> Sistemdeki tüm kayıtlı kullanıcı sayısı</li>
                  <li><strong>Aktif Kullanıcı:</strong> Aktif durumda olan kullanıcı sayısı</li>
                  <li><strong>Toplam Rol:</strong> Tanımlanmış rol sayısı</li>
                  <li><strong>Toplam Yetki:</strong> Sistemdeki toplam yetki sayısı</li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">Özellikler:</h4>
                <ul className="list-disc list-inside space-y-1 text-amber-800">
                  <li>Son Eklenen Kullanıcılar: En son oluşturulan kullanıcıları gösterir</li>
                  <li>Son Girişler: Son giriş yapan kullanıcıları ve tarihlerini gösterir</li>
                  <li>Gerçek Zamanlı: Veriler gerçek zamanlı olarak güncellenir</li>
                  <li>Yetki Kontrolü: Dashboard görüntüleme yetkisi gerektirir</li>
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

