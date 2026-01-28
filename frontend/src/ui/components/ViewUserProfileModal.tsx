import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { Modal } from './Modal';
import { Badge } from './Badge';
import { Skeleton } from './Skeleton';
import { RoleBadge } from './RoleBadge';
import {
  User,
  Mail,
  Clock,
  Shield,
  UserCheck,
  UserX,
  Calendar,
  AlertCircle,
  XCircle
} from 'lucide-react';

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

export function ViewUserProfileModal({
  userId,
  open,
  onClose
}: {
  userId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const profileQ = useQuery({
    queryKey: ['userProfile', userId],
    queryFn: () => apiFetch<ProfileData>(`/api/admin/users/${userId}/profile`),
    enabled: !!userId && open
  });

  if (!userId) return null;

  const profile = profileQ.data;

  return (
    <Modal
      title={profile ? `${profile.user.name || profile.user.email} - Profil` : 'Kullanıcı Profili'}
      open={open}
      onClose={onClose}
      className="max-w-4xl"
    >
      {profileQ.isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {profileQ.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-4 h-4" />
            <div>Hata: {(profileQ.error as any)?.message}</div>
          </div>
        </div>
      )}

      {profile && (
        <div className="space-y-6">
          {/* Profil Header */}
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
              {profile.user.avatarUrl ? (
                <img
                  src={profile.user.avatarUrl}
                  alt={profile.user.name || profile.user.email}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-10 h-10 text-slate-400" />
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="text-xl font-bold text-slate-900">
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
              <div className="flex items-center gap-2 text-slate-600 mb-3">
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

          {/* Audit Bilgileri */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-200/70">
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
                      <XCircle className="w-4 h-4 text-red-500" />
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

          {/* Yetkiler */}
          <div className="pt-6 border-t border-slate-200/70">
            <div className="flex items-center gap-2 mb-4">
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
          </div>
        </div>
      )}
    </Modal>
  );
}

