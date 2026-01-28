import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { Card } from '../../components/Card';
import { useAuth } from '../../../lib/auth';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { FormField } from '../../components/FormField';
import { useMemo, useState } from 'react';
import { Modal } from '../../components/Modal';
import { Badge } from '../../components/Badge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { PageHeader } from '../../components/PageHeader';
import { Skeleton } from '../../components/Skeleton';
import { Plus, Edit, Trash2, Search, Tag, CheckCircle, XCircle, Info } from 'lucide-react';
import clsx from 'clsx';

type TicketCategory = {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export function TicketCategoriesPage() {
  const { has } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const canRead = has('ticket.category.read');
  const canManage = has('ticket.category.manage');

  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState<TicketCategory | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TicketCategory | null>(null);
  const [search, setSearch] = useState('');
  const [openInfo, setOpenInfo] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  const categoriesQuery = useQuery({
    queryKey: ['ticket-categories', 'all'],
    enabled: canRead,
    queryFn: () => apiFetch<{ categories: TicketCategory[] }>('/api/ticket-categories/all')
  });

  const resetForm = () => {
    setName('');
    setColor('#3b82f6');
    setDescription('');
    setIsActive(true);
  };

  const createM = useMutation({
    mutationFn: () =>
      apiFetch<{ category: TicketCategory }>('/api/ticket-categories', {
        method: 'POST',
        json: {
          name,
          color: color || undefined,
          description: description || undefined
        }
      }),
    onSuccess: async () => {
      resetForm();
      setOpenCreate(false);
      toast.push({ type: 'success', title: 'Kategori oluşturuldu' });
      await qc.invalidateQueries({ queryKey: ['ticket-categories'] });
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message });
    }
  });

  const updateM = useMutation({
    mutationFn: (category: TicketCategory) =>
      apiFetch<{ category: TicketCategory }>(`/api/ticket-categories/${category.id}`, {
        method: 'PUT',
        json: {
          name,
          color: color || undefined,
          description: description || undefined,
          isActive
        }
      }),
    onSuccess: async () => {
      resetForm();
      setOpenEdit(null);
      toast.push({ type: 'success', title: 'Kategori güncellendi' });
      await qc.invalidateQueries({ queryKey: ['ticket-categories'] });
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message });
    }
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => apiFetch<{ success: boolean; message?: string }>(`/api/ticket-categories/${id}`, { method: 'DELETE' }),
    onSuccess: async (data) => {
      toast.push({ 
        type: 'success', 
        title: data.message || 'Kategori silindi',
        description: data.message || undefined
      });
      setConfirmDelete(null);
      await qc.invalidateQueries({ queryKey: ['ticket-categories'] });
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message });
    }
  });

  const filtered = useMemo(() => {
    const categories = categoriesQuery.data?.categories ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) return categories;
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        (c.description?.toLowerCase().includes(needle) ?? false)
    );
  }, [categoriesQuery.data, search]);

  const handleEdit = (category: TicketCategory) => {
    setName(category.name);
    setColor(category.color || '#3b82f6');
    setDescription(category.description || '');
    setIsActive(category.isActive);
    setOpenEdit(category);
  };

  const handleCreate = () => {
    resetForm();
    setOpenCreate(true);
  };

  if (!canRead) {
    return (
      <div className="p-6">
        <Card className="p-6 text-center">
          <p className="text-slate-600">Kategorileri görüntülemek için yetkiniz bulunmamaktadır.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Ticket Kategorileri"
        description="Ticket kategorilerini yönetin. Kategoriler ticket'ları organize etmek için kullanılır."
        actions={
          canManage ? (
            <>
              <Button variant="secondary" onClick={() => setOpenInfo(true)}>
                <Info className="w-4 h-4 mr-2" />
                Bilgi
              </Button>
              <Button variant="primary" onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Yeni Kategori
              </Button>
            </>
          ) : undefined
        }
      />

      {/* Info Modal */}
      {openInfo && (
        <Modal title="Kategori Yönetimi Hakkında" open={openInfo} onClose={() => setOpenInfo(false)}>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Info className="w-5 h-5" />
                Kategoriler Nedir?
              </h3>
              <p className="text-sm text-blue-800">
                Kategoriler, ticket'ları organize etmek ve gruplandırmak için kullanılır. Her ticket bir kategoriye ait olabilir ve bu sayede ticket'ları daha kolay yönetebilirsiniz.
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
                    <p className="text-sm font-medium text-slate-900">Renk ve Açıklama</p>
                    <p className="text-sm text-slate-600">Her kategori için özel bir renk ve açıklama belirleyebilirsiniz. Renkler kategoriyi görsel olarak ayırt etmenize yardımcı olur.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">2</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Aktif/Pasif Durumu</p>
                    <p className="text-sm text-slate-600">Kullanılan kategoriler pasif yapılabilir ama silinemez. Pasif kategoriler yeni ticket oluştururken görünmez, ancak mevcut ticket'larda kullanılmaya devam eder.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">3</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Kategori Organizasyonu</p>
                    <p className="text-sm text-slate-600">Kategoriler sayesinde ticket'larınızı konularına göre gruplandırabilir ve daha kolay takip edebilirsiniz.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
              <p className="text-xs text-amber-800">
                <strong>💡 İpucu:</strong> Kategorilerinizi mantıklı isimler ve açıklayıcı renkler ile oluşturun. Bu, ticket yönetimini çok daha kolay hale getirir.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Kategori ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      {/* Categories List */}
      {categoriesQuery.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : categoriesQuery.error ? (
        <Card className="p-6 text-center text-red-600">
          Kategoriler yüklenirken bir hata oluştu.
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Tag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Kategori bulunamadı</h3>
          <p className="text-sm text-slate-500 mb-4">
            {search ? 'Arama kriterlerinize uygun kategori bulunamadı.' : 'Henüz kategori oluşturulmamış.'}
          </p>
          {canManage && !search && (
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              İlk Kategoriyi Oluştur
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((category) => (
            <Card key={category.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className="w-4 h-4 rounded mt-1 flex-shrink-0"
                    style={{ backgroundColor: category.color || '#3b82f6' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900">{category.name}</h3>
                      {category.isActive ? (
                        <Badge variant="success">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Aktif
                        </Badge>
                      ) : (
                        <Badge variant="default">
                          <XCircle className="w-3 h-3 mr-1" />
                          Pasif
                        </Badge>
                      )}
                    </div>
                    {category.description && (
                      <p className="text-sm text-slate-600 mt-1">{category.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span>Oluşturulma: {new Date(category.createdAt).toLocaleDateString('tr-TR')}</span>
                      <span>Güncelleme: {new Date(category.updatedAt).toLocaleDateString('tr-TR')}</span>
                    </div>
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Edit}
                      onClick={() => handleEdit(category)}
                    >
                      Düzenle
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      onClick={() => setConfirmDelete(category)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Sil
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {openCreate && (
        <Modal
          title="Yeni Kategori Oluştur"
          open={openCreate}
          onClose={() => {
            setOpenCreate(false);
            resetForm();
          }}
        >
          <div className="space-y-4">
            <FormField label="Kategori Adı" required>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: Teknik Destek"
                autoFocus
              />
            </FormField>

            <FormField label="Renk" hint="Kategoriyi temsil eden renk">
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#3b82f6"
                  className="flex-1 max-w-[140px]"
                  maxLength={7}
                />
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-14 rounded-md border border-slate-200 bg-white cursor-pointer flex-shrink-0"
                />
              </div>
            </FormField>

            <FormField label="Açıklama">
              <Input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Kategori hakkında kısa açıklama (isteğe bağlı)"
              />
            </FormField>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="ghost"
                onClick={() => {
                  setOpenCreate(false);
                  resetForm();
                }}
              >
                İptal
              </Button>
              <Button
                variant="primary"
                onClick={() => createM.mutate()}
                disabled={!name.trim() || createM.isPending}
              >
                {createM.isPending ? 'Oluşturuluyor...' : 'Oluştur'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {openEdit && (
        <Modal
          title="Kategori Düzenle"
          open={!!openEdit}
          onClose={() => {
            setOpenEdit(null);
            resetForm();
          }}
        >
          <div className="space-y-4">
            <FormField label="Kategori Adı" required>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: Teknik Destek"
                autoFocus
              />
            </FormField>

            <FormField label="Renk" hint="Kategoriyi temsil eden renk">
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#3b82f6"
                  className="flex-1 max-w-[140px]"
                  maxLength={7}
                />
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-14 rounded-md border border-slate-200 bg-white cursor-pointer flex-shrink-0"
                />
              </div>
            </FormField>

            <FormField label="Açıklama">
              <Input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Kategori hakkında kısa açıklama (isteğe bağlı)"
              />
            </FormField>

            <FormField label="Durum">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">Aktif</span>
              </label>
              <p className="text-xs text-slate-500 mt-1">
                Pasif kategoriler yeni ticket'larda görünmez
              </p>
            </FormField>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="ghost"
                onClick={() => {
                  setOpenEdit(null);
                  resetForm();
                }}
              >
                İptal
              </Button>
              <Button
                variant="primary"
                onClick={() => updateM.mutate(openEdit)}
                disabled={!name.trim() || updateM.isPending}
              >
                {updateM.isPending ? 'Güncelleniyor...' : 'Güncelle'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <ConfirmDialog
          open={!!confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => {
            if (confirmDelete) {
              deleteM.mutate(confirmDelete.id);
            }
          }}
          title="Kategoriyi Sil"
          description={`"${confirmDelete.name}" kategorisini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`}
          confirmText="Sil"
          confirmVariant="danger"
          isLoading={deleteM.isPending}
        />
      )}
    </div>
  );
}

