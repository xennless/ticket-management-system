import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { Card } from '../../components/Card';
import { useAuth } from '../../../lib/auth';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useMemo, useState } from 'react';
import { Modal } from '../../components/Modal';
import { MultiSelect } from '../../components/MultiSelect';
import { RoleBadge } from '../../components/RoleBadge';
import { roleIcons, type RoleIconKey } from '../../icons';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { IconPicker } from '../../components/IconPicker';

// Role icon key'lerini Lucide icon isimlerine map et
const roleIconMap: Record<string, string> = {
  shield: 'Shield',
  headset: 'Headset',
  userCog: 'UserCog',
  wrench: 'Wrench',
  badgeCheck: 'BadgeCheck',
  building: 'Building2',
  users: 'Users',
  ticket: 'Ticket',
  key: 'KeyRound',
  crown: 'Crown',
  lifeBuoy: 'LifeBuoy',
  settings: 'Settings',
  fileText: 'FileText',
  briefcase: 'Briefcase'
};

// Lucide icon ismini role icon key'ine çevir
function lucideIconToRoleKey(lucideIconName: string | null | undefined): RoleIconKey {
  if (!lucideIconName) return 'shield';
  
  // Önce roleIconMap'in tersini kontrol et
  const reverseMap = Object.entries(roleIconMap).find(([_, value]) => value === lucideIconName);
  if (reverseMap) {
    return reverseMap[0] as RoleIconKey;
  }
  
  // Eğer bulunamazsa, küçük harfli key olarak dene
  const lowerKey = lucideIconName.toLowerCase() as RoleIconKey;
  if (lowerKey in roleIcons) {
    return lowerKey;
  }
  
  // Varsayılan olarak shield döndür
  return 'shield';
}
import { useToast } from '../../components/Toast';
import { PageHeader } from '../../components/PageHeader';
import { Info } from 'lucide-react';

type Permission = { id: string; code: string; name: string; description: string | null };
type Role = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  label: string | null;
  color: string | null;
  isSystem: boolean;
  userCount?: number;
  permissions: Permission[];
};
type PermissionTemplate = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  permissionIds: string[];
};

export function RolesPage() {
  const { has, me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const canManage = has('role.manage');
  
  // Kullanıcının system-developer rolüne sahip olup olmadığını kontrol et
  const hasSystemDeveloperRole = me?.roles?.some((r) => r.code === 'system-developer') ?? false;

  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [qText, setQText] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [openInfo, setOpenInfo] = useState(false);
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());

  // Not: backend'deki "label" alanını UI'da "icon" olarak kullanıyoruz.
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<RoleIconKey>('shield');
  const [color, setColor] = useState('#0f172a');
  const [description, setDescription] = useState('');
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);

  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState<RoleIconKey>('shield');
  const [editColor, setEditColor] = useState('#0f172a');
  const [editDescription, setEditDescription] = useState('');
  const [editPermissionIds, setEditPermissionIds] = useState<string[]>([]);

  const q = useQuery({
    queryKey: ['admin', 'roles'],
    enabled: has('role.read'),
    queryFn: () => apiFetch<{ roles: Role[] }>('/api/admin/roles')
  });

  const permsQ = useQuery({
    queryKey: ['admin', 'permissions'],
    enabled: has('permission.read') || canManage,
    queryFn: () => apiFetch<{ permissions: Permission[] }>('/api/admin/permissions')
  });

  const templatesQ = useQuery({
    queryKey: ['permission-templates'],
    enabled: has('permission.read') || canManage,
    queryFn: () => apiFetch<{ templates: PermissionTemplate[] }>('/api/admin/permission-templates')
  });

  const createM = useMutation({
    mutationFn: () =>
      apiFetch('/api/admin/roles', {
        method: 'POST',
        json: {
          code,
          name,
          description: description || undefined,
          label: icon,
          color: color || undefined,
          permissionIds: selectedPermissionIds
        }
      }),
    onSuccess: async () => {
      setCode('');
      setName('');
      setIcon('shield');
      setDescription('');
      setSelectedPermissionIds([]);
      setSelectedTemplate(null);
      setOpenCreate(false);
      toast.push({ type: 'success', title: 'Rol oluşturuldu', description: name });
      await qc.invalidateQueries({ queryKey: ['admin', 'roles'] });
    }
  });

  const updateM = useMutation({
    mutationFn: (p: { id: string; name: string; label: string; color: string; description: string }) =>
      apiFetch(`/api/admin/roles/${p.id}`, {
        method: 'PUT',
        json: {
          name: p.name,
          label: p.label || null,
          color: p.color || null,
          description: p.description || null
        }
      }),
    onSuccess: async () => {
      toast.push({ type: 'success', title: 'Rol güncellendi' });
      await qc.invalidateQueries({ queryKey: ['admin', 'roles'] });
    }
  });

  const updatePermsM = useMutation({
    mutationFn: (p: { id: string; permissionIds: string[] }) =>
      apiFetch(`/api/admin/roles/${p.id}/permissions`, { method: 'PUT', json: { permissionIds: p.permissionIds } }),
    onSuccess: async () => {
      toast.push({ type: 'success', title: 'Rol yetkileri güncellendi' });
      await qc.invalidateQueries({ queryKey: ['admin', 'roles'] });
    }
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/admin/roles/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.push({ type: 'success', title: 'Rol silindi' });
      await qc.invalidateQueries({ queryKey: ['admin', 'roles'] });
    }
  });

  const permissions = useMemo(
    () => (permsQ.data?.permissions ?? []).slice().sort((a, b) => a.code.localeCompare(b.code)),
    [permsQ.data]
  );

  const permissionOptions = useMemo(
    () =>
      permissions.map((p) => ({
        id: p.id,
        label: p.name, // UI'da kod yerine "Destek Oluşturma" gibi isimleri göstermek için
        subLabel: p.code
      })),
    [permissions]
  );

  const criticalCodes = ['permission.manage', 'role.manage', 'user.manage'];
  
  const templates = useMemo(() => templatesQ.data?.templates ?? [], [templatesQ.data]);

  function applyTemplate(templateId: string) {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      setSelectedPermissionIds(template.permissionIds);
    }
  }

  const roles = useMemo(() => (q.data?.roles ?? []).slice().sort((a, b) => a.code.localeCompare(b.code)), [q.data]);
  const filteredRoles = useMemo(() => {
    const needle = qText.trim().toLowerCase();
    if (!needle) return roles;
    return roles.filter((r) => `${r.code} ${r.name} ${r.description ?? ''}`.toLowerCase().includes(needle));
  }, [roles, qText]);

  if (!has('role.read')) return <div>Yetkin yok.</div>;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Roller"
        description="Rol listesi, icon/renk ve bağlı yetkiler"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setOpenInfo(true)} title="Rol Yönetimi Bilgisi">
              <Info className="w-4 h-4" />
            </Button>
            {canManage && <Button onClick={() => setOpenCreate(true)}>Yeni Rol</Button>}
          </div>
        }
      />

      <Card className="p-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Input value={qText} onChange={(e) => setQText(e.target.value)} placeholder="Ara (rol adı, kod, açıklama)" />
          <div className="text-sm text-slate-500 flex items-center md:justify-center">{filteredRoles.length} sonuç</div>
          <Button variant="secondary" onClick={() => q.refetch()}>
            Yenile
          </Button>
        </div>
      </Card>

      <Modal title="Yeni Rol Oluştur" open={openCreate} onClose={() => setOpenCreate(false)}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="text-sm font-semibold mb-3">Rol Bilgileri</div>
            <div className="grid grid-cols-1 gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Rol kodu (örn: support-agent)" />
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rol adı (örn: Destek Uzmanı)" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <IconPicker
                      value={icon}
                      onChange={(val) => setIcon(val as RoleIconKey)}
                      iconMap={roleIconMap}
                    />
                <div className="flex gap-2">
                  <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#0f172a" />
                  <input
                    className="h-10 w-14 rounded-md border border-slate-200 bg-white"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                  />
                </div>
              </div>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Açıklama (opsiyonel)" />
            </div>

            <div className="mt-4">
              <div className="text-xs text-slate-500 mb-2">Önizleme</div>
              <RoleBadge icon={icon} color={color} text={name || 'Rol'} />
            </div>

            <div className="mt-4">
              <div className="text-xs text-slate-500 mb-2">Yetki Şablonları</div>
              {templates.length === 0 ? (
                <div className="text-xs text-slate-400">Henüz şablon yok. Admin panelinden şablon ekleyebilirsiniz.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => applyTemplate(t.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                        selectedTemplate === t.id
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                      style={selectedTemplate === t.id ? {} : { borderLeftColor: t.color || '#64748b', borderLeftWidth: '3px' }}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
              {selectedTemplate && (
                <div className="text-xs text-slate-400 mt-2">
                  Seçili: {templates.find((t) => t.id === selectedTemplate)?.name} ({selectedPermissionIds.length} yetki)
                </div>
              )}
            </div>
          </Card>

          <MultiSelect
            title="Yetkiler (arama ile)"
            options={permissionOptions}
            value={selectedPermissionIds}
            onChange={setSelectedPermissionIds}
            placeholder="Yetki ara (örn: Destek, Ticket, Kullanıcı)..."
          />
        </div>

        {createM.error && <div className="text-sm text-red-600 mt-3">Hata: {(createM.error as any)?.message}</div>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpenCreate(false)}>
            İptal
          </Button>
          <Button onClick={() => createM.mutate()} disabled={!code.trim() || !name.trim() || createM.isPending}>
            Oluştur
          </Button>
        </div>
      </Modal>

      <div className="grid grid-cols-1 gap-3">
        {q.isLoading && <div>Yükleniyor…</div>}
        {q.error && <div className="text-sm text-red-600">Hata: {(q.error as any)?.message}</div>}
        {filteredRoles.map((r) => {
          const hasCritical = r.permissions.some((p) => criticalCodes.includes(p.code));
          return (
          <Card key={r.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-900">
                  {r.name} <span className="text-slate-400 text-sm">({r.code})</span>
                </div>
                <div className="mt-2">
                  <RoleBadge icon={r.label} color={r.color} text={r.name} />
                </div>
                {r.description && <div className="text-sm text-slate-600">{r.description}</div>}
                {r.isSystem && <div className="text-xs text-slate-500 mt-1">Sistem rolü</div>}
              </div>
              <div className="text-xs text-slate-400 text-right">
                <div>{r.permissions.length} yetki</div>
                {typeof r.userCount === 'number' && <div>{r.userCount} kullanıcı</div>}
                {hasCritical && (
                  <div className="mt-1 inline-flex items-center rounded-full border border-amber-200/70 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                    kritik
                  </div>
                )}
              </div>
            </div>

            {canManage && (
              <div className="mt-3 flex flex-wrap gap-2">
                {/* System Developer rolü: sadece system-developer rolüne sahip kullanıcılar düzenleyebilir, silinemez */}
                {r.code === 'system-developer' ? (
                  hasSystemDeveloperRole ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditingRole(r);
                        setEditName(r.name);
                        setEditIcon(lucideIconToRoleKey(r.label));
                        setEditColor(r.color ?? '#0f172a');
                        setEditDescription(r.description ?? '');
                        setEditPermissionIds(r.permissions.map((p) => p.id));
                        setOpenEdit(true);
                      }}
                    >
                      Düzenle
                    </Button>
                  ) : (
                    <div className="text-xs text-slate-500">Sadece system-developer rolüne sahip kullanıcılar düzenleyebilir</div>
                  )
                ) : !r.isSystem ? (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditingRole(r);
                        setEditName(r.name);
                        setEditIcon(lucideIconToRoleKey(r.label));
                        setEditColor(r.color ?? '#0f172a');
                        setEditDescription(r.description ?? '');
                        setEditPermissionIds(r.permissions.map((p) => p.id));
                        setOpenEdit(true);
                      }}
                    >
                      Düzenle
                    </Button>
                    <Button variant="danger" onClick={() => setConfirmDelete({ id: r.id, name: r.name })} disabled={deleteM.isPending}>
                      Sil
                    </Button>
                  </>
                ) : null}
              </div>
            )}

            <div className="mt-3">
              <div className="flex flex-wrap gap-2">
                {(expandedRoles.has(r.id) ? r.permissions : r.permissions.slice(0, 5)).map((p) => (
                  <span key={p.id} className="text-xs rounded-md border border-slate-200 bg-slate-50 text-slate-700 px-2 py-1" title={p.code}>
                    {p.name}
                  </span>
                ))}
                {r.permissions.length > 5 && !expandedRoles.has(r.id) && (
                  <button
                    type="button"
                    onClick={() => setExpandedRoles(prev => new Set(prev).add(r.id))}
                    className="text-xs rounded-md border border-slate-300 bg-white text-slate-700 px-2 py-1 hover:bg-slate-50 hover:border-slate-400 transition-colors"
                  >
                    +{r.permissions.length - 5} daha fazla
                  </button>
                )}
                {expandedRoles.has(r.id) && r.permissions.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setExpandedRoles(prev => {
                      const next = new Set(prev);
                      next.delete(r.id);
                      return next;
                    })}
                    className="text-xs rounded-md border border-slate-300 bg-white text-slate-700 px-2 py-1 hover:bg-slate-50 hover:border-slate-400 transition-colors"
                  >
                    Daha az göster
                  </button>
                )}
              </div>
            </div>
          </Card>
        )})}
      </div>

      <Modal
        title={editingRole ? `Rol Düzenle — ${editingRole.name}` : 'Rol Düzenle'}
        open={openEdit}
        onClose={() => setOpenEdit(false)}
      >
        {!editingRole ? (
          <div className="text-sm text-slate-500">Rol seçilmedi.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="text-sm font-semibold mb-3 text-slate-900">Rol Bilgileri</div>
                <div className="grid grid-cols-1 gap-2">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Rol adı" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <IconPicker
                      value={editIcon}
                      onChange={(val) => setEditIcon(val as RoleIconKey)}
                      iconMap={roleIconMap}
                    />
                    <div className="flex gap-2">
                      <Input value={editColor} onChange={(e) => setEditColor(e.target.value)} placeholder="#0f172a" />
                      <input
                        className="h-10 w-14 rounded-md border border-slate-200 bg-white"
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                      />
                    </div>
                  </div>
                  <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Açıklama (opsiyonel)" />
                </div>

                <div className="mt-4">
                  <div className="text-xs text-slate-500 mb-2">Önizleme</div>
                  <RoleBadge icon={editIcon} color={editColor} text={editName || editingRole.name} />
                </div>
              </Card>

              <MultiSelect
                title="Yetkiler (arama ile)"
                options={permissionOptions}
                value={editPermissionIds}
                onChange={setEditPermissionIds}
                placeholder="Yetki ara…"
              />
            </div>

            {(updateM.error || updatePermsM.error) && (
              <div className="text-sm text-red-600 mt-3">
                Hata: {((updateM.error || updatePermsM.error) as any)?.message ?? 'Bilinmeyen hata'}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpenEdit(false)}>
                Kapat
              </Button>
              <Button
                onClick={async () => {
                  // Diff özeti (toast)
                  const before = new Set(editingRole.permissions.map((p) => p.id));
                  const after = new Set(editPermissionIds);
                  const added = Array.from(after).filter((id) => !before.has(id));
                  const removed = Array.from(before).filter((id) => !after.has(id));
                  if (added.length || removed.length) {
                    toast.push({
                      type: 'info',
                      title: 'Yetki değişikliği özeti',
                      description: `Eklenecek: ${added.length} • Çıkarılacak: ${removed.length}`
                    });
                  }

                  await Promise.all([
                    updateM.mutateAsync({
                      id: editingRole.id,
                      name: editName,
                      label: editIcon,
                      color: editColor,
                      description: editDescription
                    }),
                    updatePermsM.mutateAsync({ id: editingRole.id, permissionIds: editPermissionIds })
                  ]);
                  setOpenEdit(false);
                }}
                disabled={!editName.trim() || updateM.isPending || updatePermsM.isPending}
              >
                Kaydet
              </Button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Rol silinsin mi?"
        description={confirmDelete ? `${confirmDelete.name} rolünü silmek üzeresin.` : undefined}
        danger
        confirmText="Sil"
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          await deleteM.mutateAsync(confirmDelete.id);
          setConfirmDelete(null);
        }}
      />

      {/* Bilgilendirme Modal */}
      <Modal title="Rol Yönetimi Bilgisi" open={openInfo} onClose={() => setOpenInfo(false)}>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              Rol Yönetimi Nasıl Çalışır?
            </h3>
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                Rol yönetimi sistemi, kullanıcılara yetki grupları atamanıza olanak sağlar. Her rol, bir dizi yetki (permission) içerir ve kullanıcılar bu rollere sahip olduklarında o yetkilere erişebilir.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Temel Özellikler:</h4>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li><strong>Rol Oluşturma:</strong> İkon, renk ve açıklama ile özelleştirilebilir roller oluşturabilirsiniz</li>
                  <li><strong>Yetki Atama:</strong> Rollere birden fazla yetki atayabilirsiniz</li>
                  <li><strong>Yetki Şablonları:</strong> Önceden tanımlanmış yetki şablonlarını kullanarak hızlıca rol oluşturabilirsiniz</li>
                  <li><strong>Çoklu Rol:</strong> Kullanıcılar birden fazla role sahip olabilir, yetkiler birleşir</li>
                  <li><strong>Sistem Rolleri:</strong> Sistem rolleri (system-developer) silinemez veya düzenlenemez</li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">Önemli Notlar:</h4>
                <ul className="list-disc list-inside space-y-1 text-amber-800">
                  <li>Rol kodları benzersiz olmalıdır ve değiştirilemez</li>
                  <li>Sistem rolleri korunur, düzenlenemez veya silinemez</li>
                  <li>Bir rol silindiğinde, tüm kullanıcılardan otomatik olarak kaldırılır</li>
                  <li>Yetki şablonları, benzer roller için hızlı oluşturma sağlar</li>
                  <li>System Developer rolü tüm yetkilere sahiptir ve her zaman aktif kalır</li>
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


