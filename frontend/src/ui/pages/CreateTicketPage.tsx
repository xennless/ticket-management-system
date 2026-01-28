import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Textarea } from '../components/Textarea';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/PageHeader';
import { useQuery } from '@tanstack/react-query';
import { MultiSelect } from '../components/MultiSelect';
import { FileUploadModal } from '../components/FileUploadModal';
import { Modal } from '../components/Modal';
import { Paperclip, X, Info } from 'lucide-react';

type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export function CreateTicketPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [categoryId, setCategoryId] = useState<string>('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showFileModal, setShowFileModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Categories ve Tags query'leri
  const categoriesQ = useQuery({
    queryKey: ['ticketCategories'],
    queryFn: () => apiFetch<{ categories: Array<{ id: string; name: string; color: string | null }> }>('/api/ticket-categories')
  });

  const tagsQ = useQuery({
    queryKey: ['ticketTags'],
    queryFn: () => apiFetch<{ tags: Array<{ id: string; name: string; color: string | null }> }>('/api/ticket-tags')
  });

  const canSubmit = useMemo(() => title.trim().length >= 3, [title]);

  const createM = useMutation({
    mutationFn: () =>
      apiFetch<{ ticket: { id: string; key: number } }>('/api/tickets', {
        method: 'POST',
        json: {
          title: title.trim(),
          description: description.trim() ? description.trim() : undefined,
          priority,
          categoryId: categoryId || undefined,
          tagIds: tagIds.length > 0 ? tagIds : undefined
        }
      }),
    onSuccess: async (res) => {
      // Dosyaları yükle
      if (selectedFiles.length > 0) {
        const token = localStorage.getItem('ticket_token');
        const uploadPromises = selectedFiles.map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);
          
          const uploadRes = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/ticket-attachments/${res.ticket.id}/upload`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`
            },
            body: formData
          });

          if (!uploadRes.ok) {
            throw new Error(`${file.name} yüklenemedi`);
          }
        });

        try {
          await Promise.all(uploadPromises);
        } catch (error: unknown) {
          toast.push({ type: 'warning', title: 'Uyarı', description: getErrorMessage(error) || 'Bazı dosyalar yüklenemedi' });
        }
      }

      toast.push({ type: 'success', title: 'Ticket oluşturuldu' });
      await qc.invalidateQueries({ queryKey: ['tickets'] });
      nav(`/tickets/${res.ticket.id}`);
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message ?? 'Ticket oluşturulamadı' });
    }
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-3xl">
      <Card className="p-5">
        <PageHeader
          title="Yeni Ticket"
          description="Başlık ve açıklama girerek hızlıca ticket oluşturun."
          className="mb-4"
          actions={
            <Button variant="secondary" onClick={() => setShowInfoModal(true)}>
              <Info className="w-4 h-4 mr-2" />
              Bilgi
            </Button>
          }
        />

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Başlık</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="örn: VPN erişimi çalışmıyor" />
            <div className="text-xs text-slate-500 mt-1">En az 3 karakter.</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Öncelik</label>
              <Select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
                <option value="LOW">Düşük</option>
                <option value="MEDIUM">Orta</option>
                <option value="HIGH">Yüksek</option>
                <option value="URGENT">Acil</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kategori</label>
              <Select 
                value={categoryId} 
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Kategori seçin</option>
                {categoriesQ.data?.categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Sorunu/isteği detaylandırın (opsiyonel)"
              rows={4}
            />
          </div>

          {tagsQ.data && tagsQ.data.tags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Etiketler</label>
              <MultiSelect
                title="Etiketler"
                options={tagsQ.data.tags.map(tag => ({
                  id: tag.id,
                  label: tag.name,
                  right: tag.color ? (
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                  ) : undefined
                }))}
                value={tagIds}
                onChange={setTagIds}
                placeholder="Etiket ara..."
                emptyText="Etiket bulunamadı"
              />
            </div>
          )}

          {/* Dosya Ekleme */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Dosyalar (Opsiyonel)</label>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowFileModal(true)}
              disabled={createM.isPending}
            >
              <Paperclip className="w-4 h-4 mr-2" />
              Dosya Ekle
            </Button>
            {selectedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {file.type.startsWith('image/') ? (
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-10 h-10 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Paperclip className="w-5 h-5 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {file.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatFileSize(file.size)}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      disabled={createM.isPending}
                      className="p-1.5 rounded-lg hover:bg-red-100 text-red-600 transition-colors disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* File Upload Modal */}
          <FileUploadModal
            open={showFileModal}
            onClose={() => setShowFileModal(false)}
            onFilesSelected={handleFilesSelected}
            title="Dosya Ekle"
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => nav(-1)} disabled={createM.isPending}>
              Vazgeç
            </Button>
            <Button onClick={() => createM.mutate()} disabled={!canSubmit || createM.isPending}>
              {createM.isPending ? 'Oluşturuluyor...' : 'Ticket Oluştur'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Info Modal */}
      {showInfoModal && (
        <Modal title="Ticket Oluşturma Hakkında" open={showInfoModal} onClose={() => setShowInfoModal(false)}>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Info className="w-5 h-5" />
                Ticket Nedir?
              </h3>
              <p className="text-sm text-blue-800">
                Ticket sistemi, sorunlarınızı, isteklerinizi ve taleplerinizi takip etmenizi sağlar. Her ticket benzersiz bir numara ile oluşturulur ve sistem tarafından otomatik olarak yönetilir.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900 text-sm">Ticket Oluştururken:</h4>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">1</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Başlık</p>
                    <p className="text-sm text-slate-600">Sorununuzu veya isteğinizi kısa ve net bir şekilde özetleyin. En az 3 karakter olmalıdır.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">2</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Öncelik</p>
                    <p className="text-sm text-slate-600">Ticket'ın aciliyet seviyesini belirleyin. Düşük, Orta, Yüksek veya Acil seçeneklerinden birini seçebilirsiniz.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">3</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Kategori</p>
                    <p className="text-sm text-slate-600">Ticket'ınızı uygun bir kategoriye atayın. Bu, ticket'ın doğru ekibe yönlendirilmesini sağlar.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">4</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Açıklama</p>
                    <p className="text-sm text-slate-600">Sorununuzu veya isteğinizi detaylı bir şekilde açıklayın. Bu bilgi, ticket'ın daha hızlı çözülmesine yardımcı olur.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">5</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Etiketler ve Dosyalar</p>
                    <p className="text-sm text-slate-600">İsteğe bağlı olarak etiketler ekleyebilir ve ilgili dosyaları yükleyebilirsiniz. Bu, ticket'ın daha iyi organize edilmesini sağlar.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}


