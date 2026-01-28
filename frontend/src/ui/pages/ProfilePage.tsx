import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { getErrorMessage } from '../../lib/errors';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { FormField } from '../components/FormField';
import { PasswordStrength } from '../components/PasswordStrength';
import { Badge } from '../components/Badge';
import { Skeleton } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { useState, useRef, useEffect } from 'react';
import {
  User,
  Mail,
  Camera,
  Save,
  Clock,
  Shield,
  UserCheck,
  UserX,
  Calendar,
  AlertCircle,
  Edit2,
  X,
  Bell,
  Info
} from 'lucide-react';
import { RoleBadge } from '../components/RoleBadge';
import { Switch } from '../components/Switch';
import { Modal } from '../components/Modal';

type ProfileData = {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    isActive: boolean;
    lastLoginAt: string | null;
    lastLoginIp: string | null;
    activatedAt: string | null;
    activatedBy: { id: string; email: string; name: string | null } | null;
    deactivatedAt: string | null;
    deactivatedBy: { id: string; email: string; name: string | null } | null;
    createdAt: string;
    updatedAt: string;
  };
  roles: Array<{ id: string; code: string; name: string; label: string | null; color: string | null }>;
  permissions: Array<{ code: string; name: string }>;
};

type NotificationPreferences = {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  onAssigned: boolean;
  onStatusChange: boolean;
  onMention: boolean;
};

export function ProfilePage() {
  const { refreshMe, has } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const profileQ = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiFetch<ProfileData>('/api/auth/me'),
    enabled: has('profile.read')
  });

  // Update form when data loads
  useEffect(() => {
    if (profileQ.data) {
      setName(profileQ.data.user.name ?? '');
      setAvatarPreview(profileQ.data.user.avatarUrl);
    }
  }, [profileQ.data]);

  const updateM = useMutation({
    mutationFn: (data: { name?: string | null; password?: string; avatarUrl?: string | null }) =>
      apiFetch<{ user: ProfileData['user'] }>('/api/auth/profile', {
        method: 'PUT',
        json: data
      }),
    onSuccess: async () => {
      toast.push({ type: 'success', title: 'Profil güncellendi' });
      setIsEditing(false);
      setPassword('');
      await Promise.all([
        profileQ.refetch(),
        refreshMe(),
        qc.invalidateQueries({ queryKey: ['profile'] })
      ]);
    },
    onError: (err: any) => {
      // Backend'den gelen şifre politikası hatalarını göster
      if (err?.issues && Array.isArray(err.issues)) {
        const policyErrors = err.issues
          .filter((issue: any) => issue.path?.[0] === 'password')
          .map((issue: any) => issue.message);
        if (policyErrors.length > 0) {
          toast.push({ 
            type: 'error', 
            title: 'Şifre Politikası Hatası', 
            description: policyErrors.join(', ') 
          });
        } else {
          toast.push({ type: 'error', title: 'Hata', description: getErrorMessage(err) });
        }
      } else {
        toast.push({ type: 'error', title: 'Hata', description: getErrorMessage(err) });
      }
    }
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.push({ type: 'error', title: 'Dosya çok büyük', description: 'Maksimum 5MB' });
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.push({ type: 'error', title: 'Geçersiz dosya', description: 'Sadece resim dosyaları yüklenebilir' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setAvatarPreview(base64);
      updateM.mutate({ avatarUrl: base64 });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const updateData: { name?: string | null; password?: string } = {};
    if (name !== profileQ.data?.user.name) {
      updateData.name = name || null;
    }
    if (password.trim()) {
      if (password.length < 8) {
        toast.push({ type: 'error', title: 'Şifre en az 8 karakter olmalı' });
        return;
      }
      updateData.password = password;
    }

    if (Object.keys(updateData).length === 0) {
      setIsEditing(false);
      return;
    }

    updateM.mutate(updateData);
  };

  const handleCancel = () => {
    setName(profileQ.data?.user.name ?? '');
    setPassword('');
    setIsEditing(false);
  };

  if (!has('profile.read')) {
    return (
      <Card className="p-4 border-red-200 bg-red-50">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-4 h-4" />
          <div>Profil görüntüleme yetkiniz yok.</div>
        </div>
      </Card>
    );
  }

  if (profileQ.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (profileQ.error) {
    return (
      <Card className="p-4 border-red-200 bg-red-50">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-4 h-4" />
          <div>Hata: {getErrorMessage(profileQ.error)}</div>
        </div>
      </Card>
    );
  }

  const profile = profileQ.data!;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Profil</h1>
          <p className="text-sm text-slate-600 mt-1">Kişisel bilgilerinizi ve ayarlarınızı yönetin</p>
        </div>
        <Button variant="secondary" onClick={() => setShowInfoModal(true)}>
          <Info className="w-4 h-4 mr-2" />
          Bilgi
        </Button>
      </div>
      {/* Profil Header */}
      <Card className="p-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="relative group">
            <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
              {avatarPreview || profile.user.avatarUrl ? (
                <img
                  src={avatarPreview || profile.user.avatarUrl || ''}
                  alt={profile.user.name || profile.user.email}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-12 h-12 text-slate-400" />
              )}
            </div>
            {has('profile.update') && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 bg-slate-900 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera className="w-4 h-4" />
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          {/* Kullanıcı Bilgileri */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="text-2xl font-bold text-slate-900">
                {profile.user.name || 'İsimsiz Kullanıcı'}
              </div>
              {profile.user.isActive ? (
                <Badge variant="success" className="flex items-center gap-1">
                  <UserCheck className="w-3 h-3" />
                  Aktif
                </Badge>
              ) : (
                <Badge variant="danger" className="flex items-center gap-1">
                  <UserX className="w-3 h-3" />
                  Pasif
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-slate-600 mb-4">
              <Mail className="w-4 h-4" />
              <span>{profile.user.email}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.roles.map((r) => (
                <RoleBadge key={r.id} icon={r.label} color={r.color} text={r.name} />
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Profil Düzenleme */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="text-lg font-semibold text-slate-900">Profil Bilgileri</div>
          {has('profile.update') && (
            !isEditing ? (
              <Button variant="secondary" onClick={() => setIsEditing(true)} className="flex items-center gap-2">
                <Edit2 className="w-4 h-4" />
                Düzenle
              </Button>
            ) : (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleCancel} disabled={updateM.isPending}>
                <X className="w-4 h-4 mr-2" />
                İptal
              </Button>
              <Button onClick={handleSave} disabled={updateM.isPending} className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                {updateM.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <FormField label="Email" hint="Email değiştirilemez">
            <Input value={profile.user.email} disabled className="bg-slate-50" />
          </FormField>

          <FormField label="Ad Soyad">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isEditing}
              placeholder="Ad Soyad"
            />
          </FormField>

          {isEditing && (
            <FormField
              label="Yeni Şifre"
              hint="Değiştirmek istemiyorsanız boş bırakın"
              error={password.length > 0 && password.length < 8 ? 'Şifre en az 8 karakter olmalı' : null}
            >
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Yeni şifre (opsiyonel)"
              />
              {password && <PasswordStrength password={password} showErrors={true} />}
            </FormField>
          )}
        </div>
      </Card>

      {/* Audit Bilgileri */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="w-5 h-5 text-slate-600" />
          <div className="text-lg font-semibold text-slate-900">Audit Bilgileri</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Hesap Bilgileri</div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Oluşturulma:</span>
                  <span className="text-slate-900">
                    {new Date(profile.user.createdAt).toLocaleString('tr-TR')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Son Güncelleme:</span>
                  <span className="text-slate-900">
                    {new Date(profile.user.updatedAt).toLocaleString('tr-TR')}
                  </span>
                </div>
              </div>
            </div>

            {profile.user.lastLoginAt && (
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Son Giriş</div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">Tarih:</span>
                    <span className="text-slate-900">
                      {new Date(profile.user.lastLoginAt).toLocaleString('tr-TR')}
                    </span>
                  </div>
                  {profile.user.lastLoginIp && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600">IP:</span>
                      <span className="text-slate-900 font-mono text-xs">{profile.user.lastLoginIp}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {profile.user.activatedAt && profile.user.activatedBy && (
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Aktifleştirme</div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-500" />
                    <span className="text-slate-600">Tarih:</span>
                    <span className="text-slate-900">
                      {new Date(profile.user.activatedAt).toLocaleString('tr-TR')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600">Kullanıcı:</span>
                    <span className="text-slate-900">
                      {profile.user.activatedBy.name || profile.user.activatedBy.email}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {profile.user.deactivatedAt && profile.user.deactivatedBy && (
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pasifleştirme</div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <UserX className="w-4 h-4 text-red-500" />
                    <span className="text-slate-600">Tarih:</span>
                    <span className="text-slate-900">
                      {new Date(profile.user.deactivatedAt).toLocaleString('tr-TR')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600">Kullanıcı:</span>
                    <span className="text-slate-900">
                      {profile.user.deactivatedBy.name || profile.user.deactivatedBy.email}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Bildirim Tercihleri */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6" id="notifications">
          <Bell className="w-5 h-5 text-slate-500" />
          <div className="text-lg font-semibold text-slate-900">Bildirim Tercihleri</div>
        </div>

        <NotificationPreferencesSection />
      </Card>

      {/* Yetkiler */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="w-5 h-5 text-slate-600" />
          <div className="text-lg font-semibold text-slate-900">Yetkiler</div>
          <Badge variant="default">{profile.permissions.length} yetki</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile.permissions.map((p) => (
            <Badge key={p.code} variant="info">
              {p.name}
            </Badge>
          ))}
        </div>
      </Card>

      {/* Info Modal */}
      {showInfoModal && (
        <Modal title="Profil Yönetimi Hakkında" open={showInfoModal} onClose={() => setShowInfoModal(false)}>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Info className="w-5 h-5" />
                Profil Yönetimi
              </h3>
              <p className="text-sm text-blue-800">
                Bu sayfada kişisel bilgilerinizi görüntüleyebilir ve güncelleyebilirsiniz. Avatar, ad soyad ve şifre
                değişikliklerini buradan yapabilirsiniz.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Özellikler:</h4>
                <ul className="space-y-1 text-sm text-slate-600">
                  <li>• Profil fotoğrafı yükleme ve güncelleme</li>
                  <li>• Ad soyad bilgilerini düzenleme</li>
                  <li>• Şifre değiştirme (güvenlik için)</li>
                  <li>• Bildirim tercihlerini yönetme</li>
                  <li>• Yetkilerinizi görüntüleme</li>
                  <li>• Audit bilgilerini görüntüleme (son giriş, aktivasyon vb.)</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Güvenlik:</h4>
                <p className="text-sm text-slate-600">
                  Şifre değiştirirken güçlü bir şifre seçmeye özen gösterin. Şifre güçlülük göstergesi size yardımcı
                  olacaktır.
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function NotificationPreferencesSection() {
  const qc = useQueryClient();
  const toast = useToast();

  const notifQ = useQuery<{ preferences: NotificationPreferences }>({
    queryKey: ['notificationPreferences'],
    queryFn: () => apiFetch('/api/notifications/settings')
  });

  const updateNotifM = useMutation({
    mutationFn: (data: Partial<NotificationPreferences>) =>
      apiFetch('/api/notifications/settings', { method: 'PUT', json: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notificationPreferences'] });
      toast.push({ type: 'success', title: 'Bildirim tercihleri güncellendi' });
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message ?? 'Bildirim tercihleri güncellenemedi' });
    }
  });

  if (!notifQ.data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-slate-900">Uygulama içi bildirimler</div>
          <div className="text-xs text-slate-500">Sistem içindeki bildirimleri göster</div>
        </div>
        <Switch
          checked={notifQ.data.preferences.inAppEnabled}
          onChange={(v: boolean) => updateNotifM.mutate({ inAppEnabled: v })}
          disabled={updateNotifM.isPending}
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-slate-900">E-posta bildirimleri</div>
          <div className="text-xs text-slate-500">E-posta ile bildirim gönder</div>
        </div>
        <Switch
          checked={notifQ.data.preferences.emailEnabled}
          onChange={(v: boolean) => updateNotifM.mutate({ emailEnabled: v })}
          disabled={updateNotifM.isPending}
        />
      </div>
      <div className="pt-2 border-t border-slate-200">
        <div className="text-sm font-semibold text-slate-700 mb-3">Olay Bazlı Bildirimler</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
            <div className="text-sm text-slate-700">Atanınca</div>
            <Switch
              checked={notifQ.data.preferences.onAssigned}
              onChange={(v: boolean) => updateNotifM.mutate({ onAssigned: v })}
              disabled={updateNotifM.isPending}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
            <div className="text-sm text-slate-700">Durum değişince</div>
            <Switch
              checked={notifQ.data.preferences.onStatusChange}
              onChange={(v: boolean) => updateNotifM.mutate({ onStatusChange: v })}
              disabled={updateNotifM.isPending}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
            <div className="text-sm text-slate-700">@Mention</div>
            <Switch
              checked={notifQ.data.preferences.onMention}
              onChange={(v: boolean) => updateNotifM.mutate({ onMention: v })}
              disabled={updateNotifM.isPending}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

