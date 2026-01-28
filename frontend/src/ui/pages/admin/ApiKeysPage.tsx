import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { getErrorMessage } from '../../../lib/errors';
import { useAuth } from '../../../lib/auth';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Skeleton } from '../../components/Skeleton';
import { Key, Search, Plus, Trash2, Edit, Eye, EyeOff, Copy, CheckCircle, XCircle, Calendar, Globe } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Badge } from '../../components/Badge';
import { FormField } from '../../components/FormField';
import { Switch } from '../../components/Switch';

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  key?: string; // Sadece oluşturma anında gösterilir
  userId: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  createdBy: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  isExpired: boolean;
};

export function ApiKeysPage() {
  const { has, user: currentUser } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const canRead = has('apikey.read');
  const canManage = has('apikey.manage');

  const [qText, setQText] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [viewingKey, setViewingKey] = useState<ApiKey | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isActive, setIsActive] = useState(true);

  const apiKeysQuery = useQuery<{ apiKeys: ApiKey[] }>({
    queryKey: ['api-keys', { showInactive }],
    enabled: canRead,
    queryFn: () => {
      const params = new URLSearchParams();
      if (!showInactive) params.set('isActive', 'true');
      return apiFetch(`/api/api-keys?${params}`);
    }
  });

  const myApiKeysQuery = useQuery<{ apiKeys: ApiKey[] }>({
    queryKey: ['api-keys', 'my'],
    enabled: true, // Herkes kendi key'lerini görebilir
    queryFn: () => apiFetch('/api/api-keys/my')
  });

  const createM = useMutation({
    mutationFn: () =>
      apiFetch<{ apiKey: ApiKey; message: string }>('/api/api-keys', {
        method: 'POST',
        json: {
          name,
          ...(userId && { userId }),
          ...(expiresAt && { expiresAt: new Date(expiresAt).toISOString() })
        }
      }),
    onSuccess: (data) => {
      setName('');
      setUserId('');
      setExpiresAt('');
      setIsActive(true);
      setOpenCreate(false);
      qc.invalidateQueries({ queryKey: ['api-keys'] });
      toast.push({ 
        type: 'success', 
        title: 'API key oluşturuldu', 
        description: data.message 
      });
      // Yeni oluşturulan key'i göster
      if (data.apiKey.key) {
        setViewingKey({ ...data.apiKey, key: data.apiKey.key });
      }
    },
    onError: (err) => {
      toast.push({ type: 'error', title: 'Hata', description: getErrorMessage(err) });
    }
  });

  const updateM = useMutation({
    mutationFn: (data: { name?: string; isActive?: boolean; expiresAt?: string | null }) =>
      apiFetch<{ apiKey: ApiKey }>(`/api/api-keys/${editingKey?.id}`, {
        method: 'PUT',
        json: data
      }),
    onSuccess: () => {
      setOpenEdit(false);
      setEditingKey(null);
      qc.invalidateQueries({ queryKey: ['api-keys'] });
      toast.push({ type: 'success', title: 'API key güncellendi' });
    },
    onError: (err) => {
      toast.push({ type: 'error', title: 'Hata', description: getErrorMessage(err) });
    }
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/api-keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['api-keys'] });
      toast.push({ type: 'success', title: 'API key silindi' });
      setConfirmDelete(null);
    },
    onError: (err) => {
      toast.push({ type: 'error', title: 'Hata', description: getErrorMessage(err) });
    }
  });

  const filteredKeys = useMemo(() => {
    if (!apiKeysQuery.data?.apiKeys) return [];
    let keys = apiKeysQuery.data.apiKeys;
    if (qText) {
      keys = keys.filter(
        (k) =>
          k.name.toLowerCase().includes(qText.toLowerCase()) ||
          k.user.email.toLowerCase().includes(qText.toLowerCase()) ||
          k.keyPrefix.toLowerCase().includes(qText.toLowerCase())
      );
    }
    return keys;
  }, [apiKeysQuery.data, qText]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    toast.push({ type: 'success', title: 'Kopyalandı' });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleEdit = (key: ApiKey) => {
    setEditingKey(key);
    setName(key.name);
    setIsActive(key.isActive);
    setExpiresAt(key.expiresAt ? new Date(key.expiresAt).toISOString().slice(0, 16) : '');
    setOpenEdit(true);
  };

  const handleSaveEdit = () => {
    if (!editingKey) return;
    updateM.mutate({
      name,
      isActive,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
    });
  };

  if (!canRead) {
    return (
      <div className="p-6">
        <Card>
          <div className="text-center py-12">
            <p className="text-slate-600">Bu sayfayı görüntüleme yetkiniz yok.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="API Key Yönetimi"
        description="API key'leri oluşturun, yönetin ve izleyin"
        icon={Key}
      />

      {/* İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-slate-600 mb-1">Toplam Key</div>
          <div className="text-2xl font-semibold text-slate-900">
            {apiKeysQuery.data?.apiKeys.length || 0}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-slate-600 mb-1">Aktif Key</div>
          <div className="text-2xl font-semibold text-green-600">
            {apiKeysQuery.data?.apiKeys.filter((k) => k.isActive && !k.isExpired).length || 0}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-slate-600 mb-1">Süresi Dolmuş</div>
          <div className="text-2xl font-semibold text-red-600">
            {apiKeysQuery.data?.apiKeys.filter((k) => k.isExpired).length || 0}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-slate-600 mb-1">Benim Key'lerim</div>
          <div className="text-2xl font-semibold text-slate-900">
            {myApiKeysQuery.data?.apiKeys.length || 0}
          </div>
        </Card>
      </div>

      {/* Filtreler ve Arama */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Key adı, kullanıcı email veya prefix ile ara..."
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              className="pl-10"
            />
          </div>
          <Switch
            checked={showInactive}
            onChange={setShowInactive}
            label="Pasif key'leri göster"
          />
          {canManage && (
            <Button onClick={() => setOpenCreate(true)} icon={Plus}>
              Yeni Key
            </Button>
          )}
        </div>
      </Card>

      {/* API Key Listesi */}
      <Card>
        {apiKeysQuery.isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : filteredKeys.length === 0 ? (
          <div className="text-center py-12">
            <Key className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">API key bulunamadı</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Key Adı</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Prefix</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Kullanıcı</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Durum</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Son Kullanım</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Bitiş Tarihi</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-600">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredKeys.map((key) => (
                  <tr key={key.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{key.name}</div>
                      {key.createdBy && (
                        <div className="text-xs text-slate-500">
                          Oluşturan: {key.createdBy.name || key.createdBy.email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-700">
                        {key.keyPrefix}...
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-900">{key.user.name || key.user.email}</div>
                      <div className="text-xs text-slate-500">{key.user.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {key.isActive && !key.isExpired ? (
                          <Badge variant="success" icon={CheckCircle}>Aktif</Badge>
                        ) : key.isExpired ? (
                          <Badge variant="danger" icon={XCircle}>Süresi Dolmuş</Badge>
                        ) : (
                          <Badge variant="secondary" icon={XCircle}>Pasif</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {key.lastUsedAt ? (
                        <div className="text-sm text-slate-900">
                          {new Date(key.lastUsedAt).toLocaleDateString('tr-TR')}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">Hiç kullanılmadı</span>
                      )}
                      {key.lastUsedIp && (
                        <div className="text-xs text-slate-500">{key.lastUsedIp}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {key.expiresAt ? (
                        <div className="text-sm text-slate-900">
                          {new Date(key.expiresAt).toLocaleDateString('tr-TR')}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">Süresiz</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Eye}
                          onClick={() => setViewingKey(key)}
                        >
                          Detay
                        </Button>
                        {canManage && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Edit}
                              onClick={() => handleEdit(key)}
                            >
                              Düzenle
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Trash2}
                              onClick={() => setConfirmDelete({ id: key.id, name: key.name })}
                            >
                              Sil
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Oluşturma Modal */}
      <Modal
        open={openCreate}
        onClose={() => {
          setOpenCreate(false);
          setName('');
          setUserId('');
          setExpiresAt('');
        }}
        title="Yeni API Key Oluştur"
      >
        <div className="space-y-4">
          <FormField label="Key Adı" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Production API Key"
            />
          </FormField>
          {canManage && (
            <FormField label="Kullanıcı ID (Opsiyonel)">
              <Input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Boş bırakılırsa kendi key'iniz oluşturulur"
              />
            </FormField>
          )}
          <FormField label="Bitiş Tarihi (Opsiyonel)">
            <Input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setOpenCreate(false)}>
              İptal
            </Button>
            <Button
              onClick={() => createM.mutate()}
              disabled={!name || createM.isPending}
            >
              Oluştur
            </Button>
          </div>
        </div>
      </Modal>

      {/* Düzenleme Modal */}
      <Modal
        open={openEdit}
        onClose={() => {
          setOpenEdit(false);
          setEditingKey(null);
        }}
        title="API Key Düzenle"
      >
        <div className="space-y-4">
          <FormField label="Key Adı" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
          <FormField label="Aktif">
            <Switch checked={isActive} onChange={setIsActive} />
          </FormField>
          <FormField label="Bitiş Tarihi">
            <Input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setOpenEdit(false)}>
              İptal
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!name || updateM.isPending}
            >
              Kaydet
            </Button>
          </div>
        </div>
      </Modal>

      {/* Detay Modal */}
      <Modal
        open={!!viewingKey}
        onClose={() => setViewingKey(null)}
        title="API Key Detayları"
      >
        {viewingKey && (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-slate-700 mb-1">Key Adı</div>
              <div className="text-slate-900">{viewingKey.name}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-700 mb-1">Key</div>
              {viewingKey.key ? (
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-slate-100 px-3 py-2 rounded text-sm font-mono">
                    {viewingKey.key}
                  </code>
                  <Button
                    size="sm"
                    icon={copiedKey === viewingKey.key ? CheckCircle : Copy}
                    onClick={() => handleCopy(viewingKey.key!)}
                  >
                    {copiedKey === viewingKey.key ? 'Kopyalandı' : 'Kopyala'}
                  </Button>
                </div>
              ) : (
                <code className="block bg-slate-100 px-3 py-2 rounded text-sm font-mono">
                  {viewingKey.keyPrefix}...
                </code>
              )}
              {viewingKey.key && (
                <p className="text-xs text-red-600 mt-2">
                  ⚠️ Bu key sadece bir kez gösterilir. Lütfen güvenli bir yere kaydedin.
                </p>
              )}
            </div>
            <div>
              <div className="text-sm font-medium text-slate-700 mb-1">Kullanıcı</div>
              <div className="text-slate-900">{viewingKey.user.name || viewingKey.user.email}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-700 mb-1">Durum</div>
              <div>
                {viewingKey.isActive && !viewingKey.isExpired ? (
                  <Badge variant="success">Aktif</Badge>
                ) : viewingKey.isExpired ? (
                  <Badge variant="danger">Süresi Dolmuş</Badge>
                ) : (
                  <Badge variant="secondary">Pasif</Badge>
                )}
              </div>
            </div>
            {viewingKey.lastUsedAt && (
              <div>
                <div className="text-sm font-medium text-slate-700 mb-1">Son Kullanım</div>
                <div className="text-slate-900">
                  {new Date(viewingKey.lastUsedAt).toLocaleString('tr-TR')}
                </div>
                {viewingKey.lastUsedIp && (
                  <div className="text-xs text-slate-500">IP: {viewingKey.lastUsedIp}</div>
                )}
              </div>
            )}
            {viewingKey.expiresAt && (
              <div>
                <div className="text-sm font-medium text-slate-700 mb-1">Bitiş Tarihi</div>
                <div className="text-slate-900">
                  {new Date(viewingKey.expiresAt).toLocaleString('tr-TR')}
                </div>
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-slate-700 mb-1">Oluşturulma</div>
              <div className="text-slate-900">
                {new Date(viewingKey.createdAt).toLocaleString('tr-TR')}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Silme Onayı */}
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) deleteM.mutate(confirmDelete.id);
        }}
        title="API Key'i Sil"
        message={`"${confirmDelete?.name}" adlı API key'i silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
        confirmText="Sil"
        variant="danger"
      />
    </div>
  );
}

