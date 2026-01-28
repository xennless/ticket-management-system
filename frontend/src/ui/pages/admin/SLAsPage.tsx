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
import { Plus, Edit, Trash2, Clock, AlertCircle, CheckCircle, XCircle, Search, Info } from 'lucide-react';
import clsx from 'clsx';

type TicketCategory = {
  id: string;
  name: string;
  color: string | null;
};

type SLA = {
  id: string;
  name: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | null;
  categoryId: string | null;
  category: TicketCategory | null;
  firstResponseTime: number | null; // dakika
  resolutionTime: number | null; // saat
  isActive: boolean;
  _count: { tickets: number };
  createdAt: string;
  updatedAt: string;
};

const priorityLabels: Record<string, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  URGENT: 'Acil'
};

const priorityColors: Record<string, string> = {
  LOW: 'default',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'danger'
};

function formatTime(minutes: number | null): string {
  if (!minutes) return '-';
  if (minutes < 60) return `${minutes} dk`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins > 0 ? `${hours} sa ${mins} dk` : `${hours} sa`;
  const days = Math.floor(hours / 24);
  const hrs = hours % 24;
  return hrs > 0 ? `${days} gün ${hrs} sa` : `${days} gün`;
}

function formatResolutionTime(hours: number | null): string {
  if (!hours) return '-';
  if (hours < 24) return `${hours} sa`;
  const days = Math.floor(hours / 24);
  const hrs = hours % 24;
  return hrs > 0 ? `${days} gün ${hrs} sa` : `${days} gün`;
}

export function SLAsPage() {
  const { has } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const canRead = has('sla.read');
  const canManage = has('sla.manage');

  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState<SLA | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SLA | null>(null);
  const [search, setSearch] = useState('');
  const [openInfo, setOpenInfo] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | ''>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [firstResponseTime, setFirstResponseTime] = useState<number | ''>('');
  const [resolutionTime, setResolutionTime] = useState<number | ''>('');
  const [isActive, setIsActive] = useState(true);

  const slasQuery = useQuery({
    queryKey: ['slas'],
    enabled: canRead,
    queryFn: () => apiFetch<{ slas: SLA[] }>('/api/slas')
  });

  const categoriesQuery = useQuery({
    queryKey: ['ticket-categories'],
    enabled: canManage && (openCreate || !!openEdit),
    queryFn: () => apiFetch<{ categories: TicketCategory[] }>('/api/ticket-categories/all')
  });

  const createM = useMutation({
    mutationFn: () =>
      apiFetch<{ sla: SLA }>('/api/slas', {
        method: 'POST',
        json: {
          name,
          priority: priority || null,
          categoryId: categoryId || null,
          firstResponseTime: firstResponseTime ? Number(firstResponseTime) : null,
          resolutionTime: resolutionTime ? Number(resolutionTime) : null,
          isActive
        }
      }),
    onSuccess: async () => {
      resetForm();
      setOpenCreate(false);
      toast.push({ type: 'success', title: 'SLA oluşturuldu' });
      await qc.invalidateQueries({ queryKey: ['slas'] });
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message });
    }
  });

  const updateM = useMutation({
    mutationFn: (sla: SLA) =>
      apiFetch<{ sla: SLA }>(`/api/slas/${sla.id}`, {
        method: 'PUT',
        json: {
          name,
          priority: priority || null,
          categoryId: categoryId || null,
          firstResponseTime: firstResponseTime ? Number(firstResponseTime) : null,
          resolutionTime: resolutionTime ? Number(resolutionTime) : null,
          isActive
        }
      }),
    onSuccess: async () => {
      resetForm();
      setOpenEdit(null);
      toast.push({ type: 'success', title: 'SLA güncellendi' });
      await qc.invalidateQueries({ queryKey: ['slas'] });
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message });
    }
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/slas/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setConfirmDelete(null);
      toast.push({ type: 'success', title: 'SLA silindi' });
      await qc.invalidateQueries({ queryKey: ['slas'] });
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message });
    }
  });

  function resetForm() {
    setName('');
    setPriority('');
    setCategoryId('');
    setFirstResponseTime('');
    setResolutionTime('');
    setIsActive(true);
  }

  function openCreateModal() {
    resetForm();
    setOpenCreate(true);
  }

  function openEditModal(sla: SLA) {
    setName(sla.name);
    setPriority(sla.priority || '');
    setCategoryId(sla.categoryId || '');
    setFirstResponseTime(sla.firstResponseTime || '');
    setResolutionTime(sla.resolutionTime || '');
    setIsActive(sla.isActive);
    setOpenEdit(sla);
  }

  const slas = useMemo(() => slasQuery.data?.slas ?? [], [slasQuery.data]);
  const categories = useMemo(() => categoriesQuery.data?.categories ?? [], [categoriesQuery.data]);

  const filteredSLAs = useMemo(() => {
    if (!search.trim()) return slas;
    const needle = search.toLowerCase();
    return slas.filter(
      (sla) =>
        sla.name.toLowerCase().includes(needle) ||
        (sla.priority && priorityLabels[sla.priority].toLowerCase().includes(needle)) ||
        (sla.category?.name.toLowerCase().includes(needle))
    );
  }, [slas, search]);

  if (!canRead) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title="SLA Yönetimi" description="Yetkiniz yok" />
        <Card className="p-8 text-center text-slate-500">
          <AlertCircle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <div>SLA yönetimi için yetkiniz yok.</div>
        </Card>
      </div>
    );
  }

  if (slasQuery.isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="SLA Yönetimi"
        description={`Service Level Agreement (SLA) tanımları (${slas.length} SLA)`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setOpenInfo(true)} title="SLA Bilgisi">
              <Info className="w-4 h-4" />
            </Button>
            {canManage && (
              <Button onClick={openCreateModal}>
                <Plus className="w-4 h-4 mr-2" />
                Yeni SLA
              </Button>
            )}
          </div>
        }
      />

      {/* Arama */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SLA ara (isim, öncelik, kategori)..."
              className="pl-9"
            />
          </div>
        </div>
      </Card>

      {/* SLA Listesi */}
      {filteredSLAs.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">
          {search ? 'Arama sonucu bulunamadı' : 'Henüz SLA tanımı yok'}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredSLAs.map((sla) => (
            <Card key={sla.id} className={clsx('p-5', !sla.isActive && 'opacity-60')}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-semibold text-slate-900">{sla.name}</h3>
                    {!sla.isActive && (
                      <Badge variant="default" className="text-xs">
                        Pasif
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {/* Öncelik */}
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Öncelik</div>
                      {sla.priority ? (
                        <Badge variant={priorityColors[sla.priority] as any}>
                          {priorityLabels[sla.priority]}
                        </Badge>
                      ) : (
                        <span className="text-sm text-slate-600">Tüm öncelikler</span>
                      )}
                    </div>

                    {/* Kategori */}
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Kategori</div>
                      {sla.category ? (
                        <Badge variant="info" style={{ backgroundColor: sla.category.color || undefined }}>
                          {sla.category.name}
                        </Badge>
                      ) : (
                        <span className="text-sm text-slate-600">Tüm kategoriler</span>
                      )}
                    </div>

                    {/* Ticket Sayısı */}
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Ticket Sayısı</div>
                      <span className="text-sm font-medium text-slate-900">{sla._count.tickets}</span>
                    </div>
                  </div>

                  {/* SLA Süreleri */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div>
                        <div className="text-xs text-slate-500">İlk Yanıt Süresi</div>
                        <div className="text-sm font-medium text-slate-900">
                          {formatTime(sla.firstResponseTime)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div>
                        <div className="text-xs text-slate-500">Çözüm Süresi</div>
                        <div className="text-sm font-medium text-slate-900">
                          {formatResolutionTime(sla.resolutionTime)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEditModal(sla)}
                      title="Düzenle"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setConfirmDelete(sla)}
                      disabled={sla._count.tickets > 0}
                      title={sla._count.tickets > 0 ? 'Bu SLA\'ya bağlı ticket\'lar var' : 'Sil'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Oluştur Modal */}
      <Modal title="Yeni SLA Oluştur" open={openCreate} onClose={() => setOpenCreate(false)}>
        <div className="grid grid-cols-1 gap-4">
          <FormField label="SLA Adı" hint="Zorunlu alan">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn: Acil Destek SLA" />
          </FormField>

          <FormField label="Öncelik" hint="Boş bırakılırsa tüm öncelikler için geçerli olur">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tüm öncelikler</option>
              <option value="LOW">Düşük</option>
              <option value="MEDIUM">Orta</option>
              <option value="HIGH">Yüksek</option>
              <option value="URGENT">Acil</option>
            </select>
          </FormField>

          <FormField label="Kategori" hint="Boş bırakılırsa tüm kategoriler için geçerli olur">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tüm kategoriler</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="İlk Yanıt Süresi (dakika)" hint="Boş bırakılabilir">
            <Input
              type="number"
              value={firstResponseTime}
              onChange={(e) => setFirstResponseTime(e.target.value ? Number(e.target.value) : '')}
              placeholder="Örn: 60 (1 saat)"
              min="1"
            />
          </FormField>

          <FormField label="Çözüm Süresi (saat)" hint="Boş bırakılabilir">
            <Input
              type="number"
              value={resolutionTime}
              onChange={(e) => setResolutionTime(e.target.value ? Number(e.target.value) : '')}
              placeholder="Örn: 24 (1 gün)"
              min="1"
            />
          </FormField>

          <FormField label="Aktif">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">Bu SLA aktif olsun</span>
            </label>
          </FormField>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setOpenCreate(false)}>
              İptal
            </Button>
            <Button
              onClick={() => createM.mutate()}
              disabled={!name.trim() || createM.isPending || (!priority && !categoryId)}
            >
              {createM.isPending ? 'Oluşturuluyor...' : 'Oluştur'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Düzenle Modal */}
      {openEdit && (
        <Modal title="SLA Düzenle" open={!!openEdit} onClose={() => setOpenEdit(null)}>
          <div className="grid grid-cols-1 gap-4">
            <FormField label="SLA Adı" hint="Zorunlu alan">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn: Acil Destek SLA" />
            </FormField>

            <FormField label="Öncelik" hint="Boş bırakılırsa tüm öncelikler için geçerli olur">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tüm öncelikler</option>
                <option value="LOW">Düşük</option>
                <option value="MEDIUM">Orta</option>
                <option value="HIGH">Yüksek</option>
                <option value="URGENT">Acil</option>
              </select>
            </FormField>

            <FormField label="Kategori" hint="Boş bırakılırsa tüm kategoriler için geçerli olur">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tüm kategoriler</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="İlk Yanıt Süresi (dakika)" hint="Boş bırakılabilir">
              <Input
                type="number"
                value={firstResponseTime}
                onChange={(e) => setFirstResponseTime(e.target.value ? Number(e.target.value) : '')}
                placeholder="Örn: 60 (1 saat)"
                min="1"
              />
            </FormField>

            <FormField label="Çözüm Süresi (saat)" hint="Boş bırakılabilir">
              <Input
                type="number"
                value={resolutionTime}
                onChange={(e) => setResolutionTime(e.target.value ? Number(e.target.value) : '')}
                placeholder="Örn: 24 (1 gün)"
                min="1"
              />
            </FormField>

            <FormField label="Aktif">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Bu SLA aktif olsun</span>
              </label>
            </FormField>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="secondary" onClick={() => setOpenEdit(null)}>
                İptal
              </Button>
              <Button
                onClick={() => updateM.mutate(openEdit)}
                disabled={!name.trim() || updateM.isPending || (!priority && !categoryId)}
              >
                {updateM.isPending ? 'Güncelleniyor...' : 'Güncelle'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Silme Onay */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="SLA Sil"
        description={
          confirmDelete
            ? `"${confirmDelete.name}" SLA'sını silmek istediğinize emin misiniz? Bu SLA'ya bağlı ${confirmDelete._count.tickets} ticket bulunmaktadır.`
            : ''
        }
        danger
        confirmText="Sil"
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => { if (confirmDelete) deleteM.mutate(confirmDelete.id); }}
      />

      {/* Bilgilendirme Modal */}
      <Modal title="SLA Özelleştirme Bilgisi" open={openInfo} onClose={() => setOpenInfo(false)}>
        <div className="space-y-6">
          {/* SLA Nasıl Çalışır */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              SLA Özelleştirme Nasıl Çalışır?
            </h3>
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                SLA (Service Level Agreement) sistemi, ticket'lar için özel yanıt ve çözüm süreleri tanımlamanıza olanak sağlar.
                Sistem, ticket'ların öncelik ve kategorilerine göre en uygun SLA'yı otomatik olarak seçer.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">SLA Seçim Önceliği:</h4>
                <ol className="list-decimal list-inside space-y-1 text-blue-800">
                  <li><strong>Kategori + Öncelik:</strong> Hem kategori hem de öncelik eşleşen SLA</li>
                  <li><strong>Sadece Kategori:</strong> Kategori eşleşen ama öncelik belirtilmemiş SLA</li>
                  <li><strong>Sadece Öncelik:</strong> Öncelik eşleşen ama kategori belirtilmemiş SLA</li>
                  <li><strong>Varsayılan:</strong> Hiçbir SLA bulunamazsa sistem varsayılan değerleri kullanır</li>
                </ol>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">Önemli Notlar:</h4>
                <ul className="list-disc list-inside space-y-1 text-amber-800">
                  <li>Bir ticket için yalnızca <strong>tek bir SLA</strong> uygulanır</li>
                  <li>En spesifik eşleşen SLA önceliklidir (kategori + öncelik &gt; sadece kategori &gt; sadece öncelik)</li>
                  <li>Aynı spesifiklikte birden fazla SLA varsa, en son oluşturulan kullanılır</li>
                  <li>Pasif SLA'lar eşleştirmede kullanılmaz</li>
                  <li>Boş bırakılan alanlar (öncelik/kategori) "tümü" anlamına gelir</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Varsayılan SLA Ayarları */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-600" />
              Varsayılan SLA Ayarları
            </h3>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="text-sm text-slate-600 mb-4">
                Eğer bir ticket için özel bir SLA tanımlanmamışsa, sistem aşağıdaki varsayılan değerleri kullanır:
              </p>
              
              <div className="space-y-3">
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="danger" className="font-semibold">ACİL (URGENT)</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">İlk Yanıt:</span>
                      <span className="font-medium text-slate-900 ml-2">1 saat (60 dakika)</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Çözüm:</span>
                      <span className="font-medium text-slate-900 ml-2">8 saat</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="warning" className="font-semibold">YÜKSEK (HIGH)</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">İlk Yanıt:</span>
                      <span className="font-medium text-slate-900 ml-2">4 saat (240 dakika)</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Çözüm:</span>
                      <span className="font-medium text-slate-900 ml-2">24 saat (1 gün)</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="info" className="font-semibold">ORTA (MEDIUM)</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">İlk Yanıt:</span>
                      <span className="font-medium text-slate-900 ml-2">12 saat (720 dakika)</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Çözüm:</span>
                      <span className="font-medium text-slate-900 ml-2">48 saat (2 gün)</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="default" className="font-semibold">DÜŞÜK (LOW)</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">İlk Yanıt:</span>
                      <span className="font-medium text-slate-900 ml-2">24 saat (1440 dakika)</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Çözüm:</span>
                      <span className="font-medium text-slate-900 ml-2">72 saat (3 gün)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SLA Durumları */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              SLA Durumları
            </h3>
            <div className="space-y-2 text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <Badge variant="success" className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Zamanında (on_time)
                </Badge>
                <span className="text-slate-600">SLA süresinin %80'inden azı kullanıldı</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="warning" className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Riskte (at_risk)
                </Badge>
                <span className="text-slate-600">SLA süresinin %80-100'ü arası kullanıldı</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="danger" className="flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  İhlal (breached)
                </Badge>
                <span className="text-slate-600">SLA süresi aşıldı (%100'den fazla)</span>
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

