import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { getErrorMessage } from '../../../lib/errors';
import { Card } from '../../components/Card';
import { useAuth } from '../../../lib/auth';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useMemo, useState } from 'react';
import { Modal } from '../../components/Modal';
import { MultiSelect } from '../../components/MultiSelect';
import { RoleBadge } from '../../components/RoleBadge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { Switch } from '../../components/Switch';
import { FormField } from '../../components/FormField';
import { PasswordStrength } from '../../components/PasswordStrength';
import { Tooltip } from '../../components/Tooltip';
import { Info, Search, RefreshCw, UserPlus, Calendar, Clock, UserCheck, UserX, Eye } from 'lucide-react';
import { ViewUserProfileModal } from '../../components/ViewUserProfileModal';
import { PageHeader } from '../../components/PageHeader';

type Role = { id: string; code: string; name: string; label: string | null; color: string | null };
type User = {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  deletedAt: string | null;
  lastLoginAt?: string | null;
  lastLoginIp?: string | null;
  mustChangePassword?: boolean;
  deactivatedAt?: string | null;
  deactivatedBy?: { id: string; email: string; name: string | null } | null;
  activatedAt?: string | null;
  activatedBy?: { id: string; email: string; name: string | null } | null;
  createdAt: string;
  roles: Role[];
};

export function UsersPage() {
  const { has } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const canManage = has('user.manage');
  const canViewProfile = has('profile.read');

  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; email: string } | null>(null);
  const [confirmHardDelete, setConfirmHardDelete] = useState<{ id: string; email: string } | null>(null);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [roleIds, setRoleIds] = useState<string[]>([]);

  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editMustChangePassword, setEditMustChangePassword] = useState(false);
  const [editRoleIds, setEditRoleIds] = useState<string[]>([]);

  const [qText, setQText] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [openSoftInfo, setOpenSoftInfo] = useState(false);
  const [filterRole, setFilterRole] = useState<string | null>(null);
  const [viewingProfileUserId, setViewingProfileUserId] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [openInfo, setOpenInfo] = useState(false);

  const q = useQuery({
    queryKey: ['admin', 'users'],
    enabled: has('user.read'),
    queryFn: () => apiFetch<{ users: User[] }>('/api/admin/users')
  });

  const rolesQ = useQuery({
    queryKey: ['admin', 'roles'],
    enabled: has('role.read') || canManage,
    queryFn: () => apiFetch<{ roles: Role[] }>('/api/admin/roles')
  });

  const createM = useMutation({
    mutationFn: () =>
      apiFetch<{ user: User }>('/api/admin/users', {
        method: 'POST',
        json: {
          email,
          name: name || undefined,
          password,
          mustChangePassword,
          // Not: roleIds bir dizi. Sadece mevcut rol listesinde olanları gönderelim.
          roleIds: roleIds.filter((id) => roles.some((r) => r.id === id))
        }
      }),
    onSuccess: async () => {
      setEmail('');
      setName('');
      setPassword('');
      setMustChangePassword(false);
      setRoleIds([]);
      setOpenCreate(false);
      toast.push({ type: 'success', title: 'Kullanıcı oluşturuldu', description: email });
      await qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: async (err: any) => {
      // Backend missingRoleIds döndürürse kullanıcıyı yönlendir
      if (err?.missingRoleIds?.length) {
        toast.push({
          type: 'error',
          title: 'Seçtiğin bazı roller artık yok',
          description: 'Rol listesi yenilendi. Lütfen tekrar seçim yap.'
        });
        await rolesQ.refetch();
        setRoleIds((prev) => prev.filter((id) => roles.some((r) => r.id === id)));
      }
    }
  });

  const updateM = useMutation({
    mutationFn: (p: { id: string; name: string; password?: string; roleIds: string[] }) =>
      apiFetch<{ user: User }>(`/api/admin/users/${p.id}`, {
        method: 'PUT',
        json: {
          name: p.name || null,
          password: p.password || undefined,
          mustChangePassword: p.mustChangePassword,
          roleIds: p.roleIds
        }
      }),
    onSuccess: async () => {
      toast.push({ type: 'success', title: 'Kullanıcı güncellendi' });
      setEditPassword('');
      setEditMustChangePassword(false);
      await qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    }
  });

  const softDeleteM = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.push({ type: 'success', title: 'Kullanıcı silindi (soft-delete)' });
      await qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    }
  });

  const restoreM = useMutation({
    mutationFn: (id: string) => apiFetch<{ user: User }>(`/api/admin/users/${id}/restore`, { method: 'PUT' }),
    onSuccess: async () => {
      toast.push({ type: 'success', title: 'Kullanıcı restore edildi' });
      await qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    }
  });

  const roles = useMemo(
    () => (rolesQ.data?.roles ?? []).slice().sort((a, b) => a.code.localeCompare(b.code)),
    [rolesQ.data]
  );

  const roleOptions = useMemo(
    () =>
      roles.map((r) => ({
        id: r.id,
        label: r.name,
        subLabel: r.code,
        right: <RoleBadge icon={r.label} color={r.color} text={r.name} />
      })),
    [roles]
  );

  const users = useMemo(() => q.data?.users ?? [], [q.data]);
  const filteredUsers = useMemo(() => {
    const needle = qText.trim().toLowerCase();
    return users
      .filter((u) => (showInactive ? true : u.isActive))
      .filter((u) => {
        if (!needle) return true;
        return `${u.email} ${u.name ?? ''}`.toLowerCase().includes(needle);
      })
      .filter((u) => {
        if (!filterRole) return true;
        return u.roles.some((r) => r.id === filterRole);
      });
  }, [users, qText, showInactive, filterRole]);

  const validateEmail = (email: string): string | null => {
    if (!email.trim()) return 'Email gereklidir';
    const emailRegex = /^[^\s@]+@[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Geçersiz email formatı';
    return null;
  };

  if (!has('user.read')) return <div>Yetkin yok.</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kullanıcılar"
        description="Sistemdeki kullanıcıları görüntüleyin ve yönetin"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setOpenInfo(true)} title="Kullanıcı Yönetimi Bilgisi">
              <Info className="w-4 h-4" />
            </Button>
            {canManage && (
              <Button onClick={() => setOpenCreate(true)} className="flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Yeni Kullanıcı
              </Button>
            )}
          </div>
        }
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              placeholder="Ara (email, ad soyad)"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={showInactive} onChange={setShowInactive} label="Pasifleri göster" />
            <Tooltip content="Pasif kullanıcılar giriş yapamaz ancak sistemde kalır ve aktifleştirilebilir.">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/70 bg-white text-slate-600 hover:bg-slate-50/70 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                onClick={() => setOpenSoftInfo(true)}
              >
                <Info className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
          <select
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none text-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
            value={filterRole ?? ''}
            onChange={(e) => setFilterRole(e.target.value || null)}
          >
            <option value="">Tüm Roller</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-slate-600 font-medium">{filteredUsers.length} kullanıcı</div>
            <Button variant="secondary" onClick={() => q.refetch()} className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Yenile
            </Button>
          </div>
        </div>
      </Card>

      {q.isLoading && (
        <Card className="p-8">
          <div className="text-center text-slate-500">Yükleniyor…</div>
        </Card>
      )}

      {q.error && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="text-sm text-red-600">Hata: {(q.error as any)?.message}</div>
        </Card>
      )}

      {!q.isLoading && !q.error && filteredUsers.length === 0 && (
        <Card className="p-12">
          <div className="text-center space-y-2">
            <div className="text-slate-400 text-lg">Kullanıcı bulunamadı</div>
            <div className="text-sm text-slate-500">
              {qText || filterRole || showInactive
                ? 'Filtreleri değiştirerek tekrar deneyin'
                : 'Henüz kullanıcı eklenmemiş'}
            </div>
          </div>
        </Card>
      )}

      {!q.isLoading && !q.error && filteredUsers.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-50/80 backdrop-blur-sm z-10">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-200/70">
                  <th className="px-5 py-4">Kullanıcı</th>
                  <th className="px-5 py-4">Durum</th>
                  <th className="px-5 py-4">Roller</th>
                  <th className="px-5 py-4">Son Giriş</th>
                  <th className="px-5 py-4">Oluşturma</th>
                  {(canManage || canViewProfile) && <th className="px-5 py-4 text-right">İşlemler</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/70 bg-white">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">{u.name ?? '—'}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{u.email}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-2">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200/70 w-fit">
                            <UserCheck className="w-3 h-3" />
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 border border-red-200/70 w-fit">
                            <UserX className="w-3 h-3" />
                            Pasif
                          </span>
                        )}
                        {!u.isActive && u.deactivatedAt && (
                          <Tooltip
                            content={
                              <div className="space-y-1">
                                <div>Pasif Edilme: {new Date(u.deactivatedAt).toLocaleString()}</div>
                                {u.deactivatedBy && (
                                  <div>Pasif Eden: {u.deactivatedBy.name ?? u.deactivatedBy.email}</div>
                                )}
                              </div>
                            }
                          >
                            <div className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(u.deactivatedAt).toLocaleDateString()}
                            </div>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {u.roles.map((r) => (
                          <RoleBadge key={r.id} icon={r.label} color={r.color} text={r.name} />
                        ))}
                        {u.roles.length === 0 && <span className="text-xs text-slate-400">Rol yok</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {u.lastLoginAt ? (
                        <Tooltip
                          content={
                            <div className="space-y-1">
                              <div>Son Giriş: {new Date(u.lastLoginAt).toLocaleString()}</div>
                              {u.lastLoginIp && <div>IP: {u.lastLoginIp}</div>}
                            </div>
                          }
                        >
                          <div className="text-xs text-slate-600 flex items-center gap-1.5">
                            <Calendar className="w-3 h-3" />
                            {new Date(u.lastLoginAt).toLocaleDateString()}
                          </div>
                        </Tooltip>
                      ) : (
                        <span className="text-xs text-slate-400">Hiç giriş yapmamış</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-xs text-slate-600 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(u.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    {(canManage || canViewProfile) && (
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {canViewProfile && (
                            <Button
                              variant="secondary"
                              onClick={() => setViewingProfileUserId(u.id)}
                              className="flex items-center gap-2"
                            >
                              <Eye className="w-4 h-4" />
                              Profil
                            </Button>
                          )}
                          {canManage && (
                            <>
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setEditingUser(u);
                                  setEditName(u.name ?? '');
                                  setEditPassword('');
                                  setEditMustChangePassword(u.mustChangePassword ?? false);
                                  setEditRoleIds(u.roles.map((r) => r.id));
                                  setOpenEdit(true);
                                }}
                              >
                                Düzenle
                              </Button>
                          {u.isActive ? (
                            <Button
                              variant="danger"
                              onClick={() => setConfirmDelete({ id: u.id, email: u.email })}
                              disabled={softDeleteM.isPending}
                            >
                              Pasif Et
                            </Button>
                          ) : (
                            <>
                              <Button variant="secondary" onClick={() => restoreM.mutate(u.id)} disabled={restoreM.isPending}>
                                Aktif Et
                              </Button>
                              <Button variant="danger" onClick={() => setConfirmHardDelete({ id: u.id, email: u.email })}>
                                Kalıcı Sil
                              </Button>
                            </>
                          )}
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal title="Yeni Kullanıcı Oluştur" open={openCreate} onClose={() => setOpenCreate(false)}>
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <FormField
                label="Email"
                hint="Kullanıcının giriş yapacağı email adresi"
                error={emailError}
              >
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError(validateEmail(e.target.value));
                  }}
                  placeholder="ornek@local.com"
                  onBlur={() => setEmailError(validateEmail(email))}
                />
              </FormField>

              <FormField label="Ad Soyad" hint="Opsiyonel">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ad Soyad"
                />
              </FormField>

              <FormField
                label="Şifre"
                hint="Şifre politikası gereksinimlerini karşılamalıdır"
                error={password.length > 0 && password.length < 8 ? 'Şifre en az 8 karakter olmalı' : null}
              >
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Şifre"
                />
                {password && <PasswordStrength password={password} showErrors={true} />}
              </FormField>

              <FormField 
                label="Girişte Şifre Değiştirsin" 
                hint="Kullanıcı ilk giriş yaptığında şifresini değiştirmesi zorunlu olacak"
              >
                <Switch
                  checked={mustChangePassword}
                  onChange={setMustChangePassword}
                  label={mustChangePassword ? 'Aktif (Zorunlu)' : 'Pasif'}
                />
              </FormField>
            </div>

            <div>
              <MultiSelect
                title="Roller"
                options={roleOptions}
                value={roleIds}
                onChange={setRoleIds}
                placeholder="Rol ara…"
                emptyText="Rol bulunamadı"
              />
            </div>
          </div>

          {createM.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              <div className="font-medium mb-1">Hata:</div>
              {(() => {
                const err = createM.error as any;
                if (err?.issues && Array.isArray(err.issues)) {
                  const policyErrors = err.issues
                    .filter((issue: any) => issue.path?.[0] === 'password')
                    .map((issue: any) => issue.message);
                  if (policyErrors.length > 0) {
                    return (
                      <ul className="list-disc list-inside space-y-1">
                        {policyErrors.map((msg: string, i: number) => (
                          <li key={i}>{msg}</li>
                        ))}
                      </ul>
                    );
                  }
                }
                return <div>{getErrorMessage(err)}</div>;
              })()}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200/70">
            <Button variant="secondary" onClick={() => setOpenCreate(false)}>
              İptal
            </Button>
            <Button
              onClick={() => {
                const err = validateEmail(email);
                if (err) {
                  setEmailError(err);
                  return;
                }
                if (password.length < 8) return;
                createM.mutate();
              }}
              disabled={!email.trim() || password.length < 8 || createM.isPending || !!emailError}
            >
              {createM.isPending ? 'Oluşturuluyor...' : 'Oluştur'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        title={editingUser ? `Kullanıcı Düzenle — ${editingUser.email}` : 'Kullanıcı Düzenle'}
        open={openEdit}
        onClose={() => {
          setOpenEdit(false);
          setEditingUser(null);
          setEditPassword('');
          setEditMustChangePassword(false);
        }}
      >
        {!editingUser ? (
          <div className="text-sm text-slate-500">Kullanıcı seçilmedi.</div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 p-3 rounded-lg border border-slate-200/70 bg-slate-50/50">
                  <div className="text-xs font-medium text-slate-600">Durum</div>
                  {editingUser.isActive ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200/70">
                      <UserCheck className="w-3 h-3" />
                      Aktif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 border border-red-200/70">
                      <UserX className="w-3 h-3" />
                      Pasif
                    </span>
                  )}
                </div>

                <FormField label="Email" hint="Email değiştirilemez">
                  <Input value={editingUser.email} disabled className="bg-slate-50" />
                </FormField>

                <FormField label="Ad Soyad">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Ad Soyad"
                  />
                </FormField>

                <FormField
                  label="Yeni Şifre"
                  hint="Değiştirmek istemiyorsanız boş bırakın"
                  error={editPassword.length > 0 && editPassword.length < 8 ? 'Şifre en az 8 karakter olmalı' : null}
                >
                  <Input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Yeni şifre (opsiyonel)"
                  />
                  {editPassword && <PasswordStrength password={editPassword} showErrors={true} />}
                </FormField>

                <FormField 
                  label="Girişte Şifre Değiştirsin" 
                  hint={editPassword ? "Şifre değiştirildiğinde, kullanıcı giriş yaptığında şifresini tekrar değiştirmesi zorunlu olacak" : "Kullanıcı giriş yaptığında şifresini değiştirmesi zorunlu olacak (sadece şifre değiştirildiğinde uygulanır)"}
                >
                  <Switch
                    checked={editMustChangePassword}
                    onChange={setEditMustChangePassword}
                    label={editMustChangePassword ? 'Aktif (Zorunlu)' : 'Pasif'}
                  />
                </FormField>
              </div>

              <div>
                <MultiSelect
                  title="Roller"
                  options={roleOptions}
                  value={editRoleIds}
                  onChange={setEditRoleIds}
                  placeholder="Rol ara…"
                  emptyText="Rol bulunamadı"
                />
              </div>
            </div>

            {(() => {
              const before = new Set(editingUser.roles.map((r) => r.id));
              const after = new Set(editRoleIds);
              const added = roles.filter((r) => after.has(r.id) && !before.has(r.id));
              const removed = roles.filter((r) => before.has(r.id) && !after.has(r.id));

              if (added.length === 0 && removed.length === 0) return null;

              return (
                <div className="rounded-lg border border-slate-200/70 bg-slate-50/50 p-4 space-y-2">
                  <div className="text-xs font-semibold text-slate-700">Rol Değişiklikleri:</div>
                  {added.length > 0 && (
                    <div className="text-xs text-slate-600">
                      <span className="font-medium text-emerald-600">Eklenecek:</span>{' '}
                      {added.map((r) => r.name).join(', ')}
                    </div>
                  )}
                  {removed.length > 0 && (
                    <div className="text-xs text-slate-600">
                      <span className="font-medium text-red-600">Kaldırılacak:</span>{' '}
                      {removed.map((r) => r.name).join(', ')}
                    </div>
                  )}
                </div>
              );
            })()}

            {updateM.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                <div className="font-medium mb-1">Hata:</div>
                {(() => {
                  const err = updateM.error as any;
                  if (err?.issues && Array.isArray(err.issues)) {
                    const policyErrors = err.issues
                      .filter((issue: any) => issue.path?.[0] === 'password')
                      .map((issue: any) => issue.message);
                    if (policyErrors.length > 0) {
                      return (
                        <ul className="list-disc list-inside space-y-1">
                          {policyErrors.map((msg: string, i: number) => (
                            <li key={i}>{msg}</li>
                          ))}
                        </ul>
                      );
                    }
                  }
                  return <div>{getErrorMessage(err)}</div>;
                })()}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200/70">
              <Button variant="secondary" onClick={() => setOpenEdit(false)}>
                İptal
              </Button>
              <Button
                onClick={async () => {
                  if (editPassword && editPassword.length < 8) return;
                  await updateM.mutateAsync({
                    id: editingUser.id,
                    name: editName,
                    password: editPassword || undefined,
                    mustChangePassword: editMustChangePassword,
                    roleIds: editRoleIds
                  });
                  setOpenEdit(false);
                  setEditingUser(null);
                  setEditPassword('');
                  setEditMustChangePassword(false);
                }}
                disabled={updateM.isPending || (editPassword.length > 0 && editPassword.length < 8)}
              >
                {updateM.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Kullanıcı pasif edilsin mi?"
        description={
          confirmDelete
            ? [
                `${confirmDelete.email} kullanıcısı pasif edilecek.`,
                '',
                'Ne olur?',
                '- Kullanıcı giriş yapamaz',
                '- İstersen daha sonra “Aktif Et” ile geri alabilirsin'
              ].join('\n')
            : undefined
        }
        danger
        confirmText="Sil (Pasif)"
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          await softDeleteM.mutateAsync(confirmDelete.id);
          setConfirmDelete(null);
        }}
      />

      <ConfirmDialog
        open={!!confirmHardDelete}
        title="Kullanıcı kalıcı silinsin mi?"
        description={
          confirmHardDelete
            ? [
                `${confirmHardDelete.email} kullanıcısı kalıcı olarak silinecek.`,
                '',
                'Bu işlem geri alınamaz.',
                'Not: Kullanıcı ticket/mesaj gibi kayıtlarla ilişkiliyse sistem silmeye izin vermeyebilir.'
              ].join('\n')
            : undefined
        }
        danger
        confirmText="Kalıcı Sil"
        onClose={() => setConfirmHardDelete(null)}
        onConfirm={async () => {
          if (!confirmHardDelete) return;
          try {
            await apiFetch<void>(`/api/admin/users/${confirmHardDelete.id}/hard`, { method: 'DELETE' });
            toast.push({ type: 'success', title: 'Kullanıcı kalıcı silindi' });
            await qc.invalidateQueries({ queryKey: ['admin', 'users'] });
          } catch (e: unknown) {
            toast.push({ type: 'error', title: 'Kalıcı silinemedi', description: getErrorMessage(e) || 'Hata' });
          } finally {
            setConfirmHardDelete(null);
          }
        }}
      />

      <Modal title="Pasif Etme Nedir?" open={openSoftInfo} onClose={() => setOpenSoftInfo(false)}>
        <div className="text-sm text-slate-700 space-y-3">
          <div>
            <span className="font-semibold">Pasif etme</span> kullanıcıyı silmek yerine hesabı kapatır. Kullanıcı giriş yapamaz ama kayıtlar korunur.
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-4">
            <div className="font-semibold text-sm">Sonuçları</div>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 space-y-1">
              <li>Kullanıcı giriş yapamaz.</li>
              <li>Gerekirse “Aktif Et” ile geri alabilirsin.</li>
              <li>Kayıtlar korunur (audit/iz takibi).</li>
            </ul>
          </div>
          <div className="text-sm text-slate-600">
            “Pasifleri göster” anahtarı sadece listede görünürlüğü değiştirir; herhangi bir veri değiştirmez.
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setOpenSoftInfo(false)}>
              Kapat
            </Button>
          </div>
        </div>
      </Modal>

      <ViewUserProfileModal
        userId={viewingProfileUserId}
        open={!!viewingProfileUserId}
        onClose={() => setViewingProfileUserId(null)}
      />

      {/* Bilgilendirme Modal */}
      <Modal title="Kullanıcı Yönetimi Bilgisi" open={openInfo} onClose={() => setOpenInfo(false)}>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              Kullanıcı Yönetimi Nasıl Çalışır?
            </h3>
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                Kullanıcı yönetimi sistemi, sistemdeki tüm kullanıcıları görüntüleme, oluşturma, düzenleme ve silme işlemlerini yönetmenize olanak sağlar.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Temel Özellikler:</h4>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li><strong>Kullanıcı Oluşturma:</strong> Yeni kullanıcılar oluşturabilir, e-posta, isim ve şifre atayabilirsiniz</li>
                  <li><strong>Rol Atama:</strong> Kullanıcılara birden fazla rol atayabilirsiniz (çoklu rol desteği)</li>
                  <li><strong>Pasif Etme:</strong> Kullanıcıları pasif hale getirebilirsiniz (soft-delete - veriler silinmez)</li>
                  <li><strong>Kalıcı Silme:</strong> Kullanıcıları tamamen silebilirsiniz (hard-delete - geri alınamaz)</li>
                  <li><strong>Profil Görüntüleme:</strong> Kullanıcı detaylarını ve aktivite geçmişini görüntüleyebilirsiniz</li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">Önemli Notlar:</h4>
                <ul className="list-disc list-inside space-y-1 text-amber-800">
                  <li>Pasif edilen kullanıcılar sistemde giriş yapamaz ancak verileri korunur</li>
                  <li>Kalıcı silme işlemi geri alınamaz - dikkatli kullanın</li>
                  <li>Kullanıcılar birden fazla role sahip olabilir, yetkiler birleşir</li>
                  <li>E-posta adresi benzersiz olmalıdır</li>
                  <li>Şifre minimum güvenlik gereksinimlerini karşılamalıdır</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-green-600" />
              Kullanıcı Durumları
            </h3>
            <div className="space-y-2 text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <span className="font-medium text-green-700">Aktif</span>
                <span className="text-slate-600">Kullanıcı sisteme giriş yapabilir ve tüm yetkilerini kullanabilir</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-amber-700">Pasif</span>
                <span className="text-slate-600">Kullanıcı sisteme giriş yapamaz ancak verileri korunur</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-red-700">Silinmiş</span>
                <span className="text-slate-600">Kullanıcı kalıcı olarak silinmiş, veriler geri alınamaz</span>
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


