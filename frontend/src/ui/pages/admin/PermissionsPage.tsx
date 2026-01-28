import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { Card } from '../../components/Card';
import { useAuth } from '../../../lib/auth';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useMemo, useState } from 'react';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FormField } from '../../components/FormField';
import { useToast } from '../../components/Toast';
import { Lock, Search, Shield, AlertTriangle, Info } from 'lucide-react';
import { Badge } from '../../components/Badge';
import { Skeleton } from '../../components/Skeleton';
import { PageHeader } from '../../components/PageHeader';

type Permission = { id: string; code: string; name: string; description: string | null };

export function PermissionsPage() {
  const { has } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const canManage = has('permission.manage');

  const [qText, setQText] = useState('');

  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; code: string } | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const [editing, setEditing] = useState<Permission | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [openInfo, setOpenInfo] = useState(false);

  const q = useQuery({
    queryKey: ['admin', 'permissions'],
    enabled: has('permission.read'),
    queryFn: () => apiFetch<{ permissions: Permission[] }>('/api/admin/permissions')
  });

  const createM = useMutation({
    mutationFn: () =>
      apiFetch<{ permission: Permission }>('/api/admin/permissions', {
        method: 'POST',
        json: { code, name, description: description || undefined }
      }),
    onSuccess: async () => {
      setCode('');
      setName('');
      setDescription('');
      setOpenCreate(false);
      toast.push({ type: 'success', title: 'Yetki oluşturuldu', description: code });
      await qc.invalidateQueries({ queryKey: ['admin', 'permissions'] });
    }
  });

  const updateM = useMutation({
    mutationFn: (p: { id: string; code: string; name: string; description: string }) =>
      apiFetch<{ permission: Permission }>(`/api/admin/permissions/${p.id}`, {
        method: 'PUT',
        json: { code: p.code, name: p.name, description: p.description || null }
      }),
    onSuccess: async () => {
      setOpenEdit(false);
      toast.push({ type: 'success', title: 'Yetki güncellendi' });
      await qc.invalidateQueries({ queryKey: ['admin', 'permissions'] });
    }
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/admin/permissions/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.push({ type: 'success', title: 'Yetki silindi' });
      await qc.invalidateQueries({ queryKey: ['admin', 'permissions'] });
    }
  });

  const sorted = useMemo(() => (q.data?.permissions ?? []).slice().sort((a, b) => a.code.localeCompare(b.code)), [q.data]);
  const filtered = useMemo(() => {
    const needle = qText.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter((p) => `${p.code} ${p.name} ${p.description ?? ''}`.toLowerCase().includes(needle));
  }, [sorted, qText]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Permission[]>();
    for (const p of filtered) {
      const prefix = p.code.includes('.') ? p.code.split('.')[0] : 'other';
      const arr = groups.get(prefix) ?? [];
      arr.push(p);
      groups.set(prefix, arr);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  if (!has('permission.read')) return <div>Yetkin yok.</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yetkiler"
        description="Sistemde tanımlı yetki listesi ve yönetimi"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setOpenInfo(true)} title="Yetki Yönetimi Bilgisi">
              <Info className="w-4 h-4" />
            </Button>
            {canManage && (
              <Button onClick={() => setOpenCreate(true)} className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Yeni Yetki
              </Button>
            )}
          </div>
        }
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              placeholder="Ara (code, ad, açıklama)"
              className="pl-9"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-slate-600 font-medium">{filtered.length} yetki</div>
            <Button variant="secondary" onClick={() => q.refetch()}>
              Yenile
            </Button>
          </div>
        </div>
      </Card>

      {q.isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </Card>
          ))}
        </div>
      )}

      {q.error && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-4 h-4" />
            <div className="text-sm">Hata: {(q.error as any)?.message}</div>
          </div>
        </Card>
      )}

      {!q.isLoading && !q.error && grouped.length === 0 && (
        <Card className="p-12">
          <div className="text-center space-y-2">
            <Lock className="w-12 h-12 mx-auto text-slate-300" />
            <div className="text-slate-400 text-lg">Yetki bulunamadı</div>
            <div className="text-sm text-slate-500">
              {qText ? 'Arama kriterlerinizi değiştirerek tekrar deneyin' : 'Henüz yetki tanımlanmamış'}
            </div>
          </div>
        </Card>
      )}

      {!q.isLoading && !q.error && grouped.length > 0 && (
        <div className="space-y-4">
          {grouped.map(([prefix, items]) => (
            <Card key={prefix} className="p-0 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-200/70">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-slate-500" />
                  <div className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                    {prefix} ({items.length})
                  </div>
                </div>
              </div>
              <div className="divide-y divide-slate-100/70">
                {items.map((p: any) => (
                  <div key={p.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-sm font-semibold text-slate-900">{p.name}</div>
                          {p.isSystem && (
                            <Badge variant="warning" className="flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              Sistem
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-mono mb-1">{p.code}</div>
                        {p.description && (
                          <div className="text-xs text-slate-600 mt-1">{p.description}</div>
                        )}
                      </div>
                      {canManage && (
                        <div className="flex gap-2 shrink-0">
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setEditing(p);
                              setEditCode(p.code);
                              setEditName(p.name);
                              setEditDescription(p.description ?? '');
                              setOpenEdit(true);
                            }}
                            disabled={p.isSystem && p.code !== editCode}
                          >
                            Düzenle
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => setConfirmDelete({ id: p.id, code: p.code })}
                            disabled={!!p.isSystem}
                            title={p.isSystem ? 'Sistem yetkisi silinemez' : undefined}
                          >
                            Sil
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal title="Yeni Yetki Oluştur" open={openCreate} onClose={() => setOpenCreate(false)}>
        <div className="grid grid-cols-1 gap-3">
          <FormField label="Kod" hint="örn: ticket.create (boşluk yok)">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ticket.create" />
          </FormField>
          <FormField label="Görünen Ad" hint="UI'da gösterilecek isim">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Destek Oluşturma" />
          </FormField>
          <FormField label="Açıklama" hint="opsiyonel">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Bu yetkiye sahip kullanıcı destek açabilir." />
          </FormField>
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

      <Modal title={editing ? `Yetki Düzenle — ${editing.code}` : 'Yetki Düzenle'} open={openEdit} onClose={() => setOpenEdit(false)}>
        <div className="grid grid-cols-1 gap-3">
          <FormField label="Kod">
            <Input value={editCode} onChange={(e) => setEditCode(e.target.value)} disabled={(editing as any)?.isSystem} />
          </FormField>
          <FormField label="Görünen Ad">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </FormField>
          <FormField label="Açıklama">
            <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
          </FormField>
        </div>
        {updateM.error && <div className="text-sm text-red-600 mt-3">Hata: {(updateM.error as any)?.message}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpenEdit(false)}>
            Kapat
          </Button>
          <Button
            onClick={() => editing && updateM.mutate({ id: editing.id, code: editCode, name: editName, description: editDescription })}
            disabled={!editCode.trim() || !editName.trim() || updateM.isPending}
          >
            Kaydet
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Yetki silinsin mi?"
        description={confirmDelete ? `${confirmDelete.code} yetkisini silmek üzeresin.` : undefined}
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
      <Modal title="Yetki Yönetimi Bilgisi" open={openInfo} onClose={() => setOpenInfo(false)}>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              Yetki Yönetimi Nasıl Çalışır?
            </h3>
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                Yetki sistemi, kullanıcıların sistemde hangi işlemleri yapabileceğini belirleyen izinlerdir. Her yetki benzersiz bir koda sahiptir ve rollere atanarak kullanıcılara verilir.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Yetki Yapısı:</h4>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li><strong>Yetki Kodu:</strong> Benzersiz tanımlayıcı (örn: ticket.read, user.manage)</li>
                  <li><strong>Yetki Adı:</strong> Kullanıcı dostu görünen isim</li>
                  <li><strong>Açıklama:</strong> Yetkinin ne işe yaradığını açıklayan metin</li>
                  <li><strong>Sistem Yetkileri:</strong> Kod tarafından otomatik oluşturulan, korumalı yetkiler</li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">Önemli Notlar:</h4>
                <ul className="list-disc list-inside space-y-1 text-amber-800">
                  <li>Sistem yetkilerinin kodu değiştirilemez</li>
                  <li>Yetki kodları benzersiz olmalıdır (nokta ile ayrılmış format: modül.aksiyon)</li>
                  <li>Yeni yetkiler kod güncellemelerinde otomatik olarak eklenir</li>
                  <li>Silinen yetkiler, tüm rollerden otomatik olarak kaldırılır</li>
                  <li>Yetkiler mantıksal olarak gruplandırılır (ticket.*, user.*, vb.)</li>
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


