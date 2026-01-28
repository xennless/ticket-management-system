import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { MultiSelect } from '../../components/MultiSelect';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { PageHeader } from '../../components/PageHeader';
import { Skeleton } from '../../components/Skeleton';
import { Plus, Pencil, Trash2, Copy, Layers, Info } from 'lucide-react';
import { useMemo, useState } from 'react';
import clsx from 'clsx';

type Permission = { id: string; code: string; name: string };
type PermissionTemplate = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  isSystem: boolean;
  permissionIds: string[];
  permissions: Permission[];
};

const TEMPLATE_COLORS = [
  { value: '#3b82f6', label: 'Mavi' },
  { value: '#10b981', label: 'Yeşil' },
  { value: '#f59e0b', label: 'Turuncu' },
  { value: '#ef4444', label: 'Kırmızı' },
  { value: '#8b5cf6', label: 'Mor' },
  { value: '#ec4899', label: 'Pembe' },
  { value: '#6366f1', label: 'İndigo' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#64748b', label: 'Gri' }
];

const TEMPLATE_ICONS = [
  { value: 'support', label: 'Destek' },
  { value: 'readonly', label: 'Okuma' },
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'Kullanıcı' },
  { value: 'manager', label: 'Yönetici' },
  { value: 'agent', label: 'Temsilci' },
  { value: 'viewer', label: 'Görüntüleyici' },
  { value: 'editor', label: 'Editör' }
];

export function PermissionTemplatesPage() {
  const { has } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const canManage = has('permissionTemplate.manage');
  const canRead = has('permissionTemplate.read');

  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PermissionTemplate | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [searchText, setSearchText] = useState('');
  const [openInfo, setOpenInfo] = useState(false);

  // Create form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [icon, setIcon] = useState('support');
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState('#3b82f6');
  const [editIcon, setEditIcon] = useState('support');
  const [editPermissionIds, setEditPermissionIds] = useState<string[]>([]);

  // Templates query
  const templatesQ = useQuery({
    queryKey: ['permission-templates'],
    enabled: canRead,
    queryFn: () => apiFetch<{ templates: PermissionTemplate[] }>('/api/admin/permission-templates')
  });

  // Permissions query
  const permsQ = useQuery({
    queryKey: ['admin', 'permissions'],
    enabled: canRead,
    queryFn: () => apiFetch<{ permissions: Permission[] }>('/api/admin/permissions')
  });

  // Mutations
  const createM = useMutation({
    mutationFn: () =>
      apiFetch('/api/admin/permission-templates', {
        method: 'POST',
        json: {
          code,
          name,
          description: description || undefined,
          color,
          icon,
          permissionIds: selectedPermissionIds
        }
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permission-templates'] });
      toast.push({ type: 'success', title: 'Şablon oluşturuldu' });
      resetCreateForm();
      setOpenCreate(false);
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err.message });
    }
  });

  const updateM = useMutation({
    mutationFn: (data: { id: string; name: string; description: string; color: string; icon: string; permissionIds: string[] }) =>
      apiFetch(`/api/admin/permission-templates/${data.id}`, {
        method: 'PUT',
        json: {
          name: data.name,
          description: data.description || null,
          color: data.color,
          icon: data.icon,
          permissionIds: data.permissionIds
        }
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permission-templates'] });
      toast.push({ type: 'success', title: 'Şablon güncellendi' });
      setOpenEdit(false);
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err.message });
    }
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/permission-templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permission-templates'] });
      toast.push({ type: 'success', title: 'Şablon silindi' });
    }
  });

  const resetCreateForm = () => {
    setCode('');
    setName('');
    setDescription('');
    setColor('#3b82f6');
    setIcon('support');
    setSelectedPermissionIds([]);
  };

  const handleEdit = (template: PermissionTemplate) => {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditDescription(template.description || '');
    setEditColor(template.color || '#3b82f6');
    setEditIcon(template.icon || 'support');
    setEditPermissionIds(template.permissionIds);
    setOpenEdit(true);
  };

  const handleDuplicate = (template: PermissionTemplate) => {
    setCode(`${template.code}-copy`);
    setName(`${template.name} (Kopya)`);
    setDescription(template.description || '');
    setColor(template.color || '#3b82f6');
    setIcon(template.icon || 'support');
    setSelectedPermissionIds(template.permissionIds);
    setOpenCreate(true);
  };

  // Permission options for MultiSelect
  const permissionOptions = useMemo(
    () =>
      (permsQ.data?.permissions ?? [])
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((p) => ({
          id: p.id,
          label: p.name,
          subLabel: p.code
        })),
    [permsQ.data]
  );

  // Filtered templates
  const templates = useMemo(() => {
    const all = templatesQ.data?.templates ?? [];
    if (!searchText.trim()) return all;
    const needle = searchText.toLowerCase();
    return all.filter(
      (t) =>
        t.name.toLowerCase().includes(needle) ||
        t.code.toLowerCase().includes(needle) ||
        (t.description?.toLowerCase().includes(needle) ?? false)
    );
  }, [templatesQ.data, searchText]);

  if (!canRead) {
    return <div className="p-6 text-center text-slate-500">Yetki şablonlarını görüntüleme yetkiniz yok.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Yetki Şablonları"
        description="Rol oluştururken kullanılacak yetki şablonlarını yönetin"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setOpenInfo(true)} title="Yetki Şablonları Bilgisi">
              <Info className="w-4 h-4" />
            </Button>
            {canManage && (
              <Button onClick={() => setOpenCreate(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Yeni Şablon
              </Button>
            )}
          </div>
        }
      />

      {/* Search */}
      <Card className="p-4">
        <Input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Şablon ara (ad, kod, açıklama)..."
        />
      </Card>

      {/* Loading */}
      {templatesQ.isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!templatesQ.isLoading && templates.length === 0 && (
        <Card className="p-8 text-center">
          <Layers className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <div className="text-slate-500 mb-4">Henüz yetki şablonu yok.</div>
          {canManage && (
            <Button onClick={() => setOpenCreate(true)}>
              <Plus className="w-4 h-4 mr-2" />
              İlk Şablonu Oluştur
            </Button>
          )}
        </Card>
      )}

      {/* Templates Grid */}
      {!templatesQ.isLoading && templates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: template.color || '#64748b' }}
                >
                  {template.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate">{template.name}</h3>
                  <p className="text-xs text-slate-500">{template.code}</p>
                </div>
                {template.isSystem && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600">
                    Sistem
                  </span>
                )}
              </div>

              {template.description && (
                <p className="text-sm text-slate-600 mb-3 line-clamp-2">{template.description}</p>
              )}

              <div className="text-xs text-slate-500 mb-3">
                {template.permissions.length} yetki
              </div>

              {/* Permission badges */}
              <div className="flex flex-wrap gap-1 mb-4 max-h-20 overflow-hidden">
                {template.permissions.slice(0, 8).map((p) => (
                  <span
                    key={p.id}
                    className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 truncate max-w-[120px]"
                    title={p.code}
                  >
                    {p.name}
                  </span>
                ))}
                {template.permissions.length > 8 && (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-slate-200 text-slate-700">
                    +{template.permissions.length - 8} daha
                  </span>
                )}
              </div>

              {/* Actions */}
              {canManage && (
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDuplicate(template)}
                    className="flex-1"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Kopyala
                  </Button>
                  {!template.isSystem && (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => handleEdit(template)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setConfirmDelete({ id: template.id, name: template.name })}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal title="Yeni Yetki Şablonu" open={openCreate} onClose={() => setOpenCreate(false)}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Şablon Kodu</label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="örn: support-agent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Şablon Adı</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="örn: Destek Uzmanı"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Şablon açıklaması (opsiyonel)"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Renk</label>
                <div className="flex gap-2">
                  <select
                    className="flex-1 rounded-lg border border-slate-200 bg-white text-slate-900 px-3 py-2 text-sm"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                  >
                    {TEMPLATE_COLORS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-10 w-12 rounded border border-slate-200"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tip</label>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white text-slate-900 px-3 py-2 text-sm"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                >
                  {TEMPLATE_ICONS.map((i) => (
                    <option key={i.value} value={i.value}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preview */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500 mb-2">Önizleme</div>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: color }}
                >
                  {(name || 'Ş').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-slate-900">{name || 'Şablon Adı'}</div>
                  <div className="text-xs text-slate-500">{selectedPermissionIds.length} yetki seçili</div>
                </div>
              </div>
            </div>
          </div>

          <MultiSelect
            title="Yetkiler"
            options={permissionOptions}
            value={selectedPermissionIds}
            onChange={setSelectedPermissionIds}
            placeholder="Yetki ara..."
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpenCreate(false)}>
            İptal
          </Button>
          <Button
            onClick={() => createM.mutate()}
            disabled={!code.trim() || !name.trim() || createM.isPending}
          >
            Oluştur
          </Button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title={editingTemplate ? `Şablon Düzenle — ${editingTemplate.name}` : 'Şablon Düzenle'}
        open={openEdit}
        onClose={() => setOpenEdit(false)}
      >
        {editingTemplate && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Şablon Kodu</label>
                  <Input value={editingTemplate.code} disabled className="bg-slate-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Şablon Adı</label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Şablon adı"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label>
                  <Input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Açıklama (opsiyonel)"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Renk</label>
                    <div className="flex gap-2">
                      <select
                        className="flex-1 rounded-lg border border-slate-200 bg-white text-slate-900 px-3 py-2 text-sm"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                      >
                        {TEMPLATE_COLORS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="h-10 w-12 rounded border border-slate-200"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tip</label>
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-white text-slate-900 px-3 py-2 text-sm"
                      value={editIcon}
                      onChange={(e) => setEditIcon(e.target.value)}
                    >
                      {TEMPLATE_ICONS.map((i) => (
                        <option key={i.value} value={i.value}>
                          {i.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <MultiSelect
                title="Yetkiler"
                options={permissionOptions}
                value={editPermissionIds}
                onChange={setEditPermissionIds}
                placeholder="Yetki ara..."
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpenEdit(false)}>
                İptal
              </Button>
              <Button
                onClick={() =>
                  updateM.mutate({
                    id: editingTemplate.id,
                    name: editName,
                    description: editDescription,
                    color: editColor,
                    icon: editIcon,
                    permissionIds: editPermissionIds
                  })
                }
                disabled={!editName.trim() || updateM.isPending}
              >
                Kaydet
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Şablon silinsin mi?"
        description={confirmDelete ? `"${confirmDelete.name}" şablonunu silmek üzeresin.` : undefined}
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
      <Modal title="Yetki Şablonları Bilgisi" open={openInfo} onClose={() => setOpenInfo(false)}>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              Yetki Şablonları Nasıl Çalışır?
            </h3>
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                Yetki şablonları, rol oluştururken hızlıca yetki grupları atamanızı sağlar. Benzer yetkilere sahip roller için şablonlar kullanarak zamandan tasarruf edebilirsiniz.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Şablon Özellikleri:</h4>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li><strong>Renk ve İkon:</strong> Şablonları görsel olarak ayırt edebilmeniz için renk ve ikon atayabilirsiniz</li>
                  <li><strong>Yetki Grubu:</strong> Şablonlar birden fazla yetki içerebilir</li>
                  <li><strong>Kopyalama:</strong> Mevcut şablonları kopyalayarak yeni şablonlar oluşturabilirsiniz</li>
                  <li><strong>Rol Oluşturma:</strong> Rol oluştururken şablonu seçerek yetkileri otomatik olarak ekleyebilirsiniz</li>
                  <li><strong>Sistem Şablonları:</strong> Sistem şablonları korunur, silinemez</li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">Önemli Notlar:</h4>
                <ul className="list-disc list-inside space-y-1 text-amber-800">
                  <li>Şablonlar yalnızca rol oluştururken yardımcıdır, yetkileri doğrudan kontrol etmez</li>
                  <li>Şablon kullanıldıktan sonra rolün yetkileri şablondan bağımsız olarak değiştirilebilir</li>
                  <li>Sistem şablonları varsayılan roller için hazırlanmıştır</li>
                  <li>Şablonlar kopyalanabilir, düzenlenebilir ve silinebilir (sistem şablonları hariç)</li>
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

