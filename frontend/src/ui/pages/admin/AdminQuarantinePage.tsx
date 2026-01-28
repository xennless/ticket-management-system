import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { getErrorMessage } from '../../../lib/errors';
import { useAuth } from '../../../lib/auth';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Skeleton } from '../../components/Skeleton';
import { ShieldAlert, Search, Info, RefreshCw, Unlock, Trash2, Download, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Badge } from '../../components/Badge';

type QuarantineFile = {
  id: string;
  fileName: string;
  sanitizedFileName: string;
  fileSize: number;
  mimeType: string;
  detectedMimeType: string | null;
  scanResult: string | null;
  reason: 'VIRUS' | 'MIME_TYPE_MISMATCH' | 'SUSPICIOUS' | 'SCAN_FAILED' | 'MANUAL';
  ticketId: string | null;
  uploadedBy: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  releasedBy: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  releasedAt: string | null;
  createdAt: string;
  attachment: {
    id: string;
    ticket: {
      id: string;
      key: number;
      title: string;
    } | null;
  } | null;
};

type QuarantineStats = {
  total: number;
  released: number;
  active: number;
  byReason: Record<string, number>;
  byStatus: Record<string, number>;
};

export function AdminQuarantinePage() {
  const { has } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const canRead = has('quarantine.read');
  const canManage = has('quarantine.manage');

  const [qText, setQText] = useState('');
  const [page, setPage] = useState(1);
  const [reasonFilter, setReasonFilter] = useState<'VIRUS' | 'MIME_TYPE_MISMATCH' | 'SUSPICIOUS' | 'SCAN_FAILED' | 'MANUAL' | 'all'>('all');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [confirmRelease, setConfirmRelease] = useState<{ id: string; fileName: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; fileName: string } | null>(null);
  const [viewingFile, setViewingFile] = useState<QuarantineFile | null>(null);

  const filesQuery = useQuery<{ files: QuarantineFile[]; total: number; page: number; pageSize: number; totalPages: number }>({
    queryKey: ['quarantine', 'files', { page, search: qText, reason: reasonFilter }],
    enabled: canRead,
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      if (reasonFilter !== 'all') params.set('reason', reasonFilter);
      if (qText) params.set('search', qText);
      return apiFetch(`/api/quarantine?${params}`);
    }
  });

  const statsQuery = useQuery<QuarantineStats>({
    queryKey: ['quarantine', 'stats'],
    enabled: canRead,
    queryFn: () => apiFetch('/api/quarantine/stats'),
    refetchInterval: 30000 // 30 saniyede bir yenile
  });

  const releaseM = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/quarantine/${id}/release`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quarantine'] });
      toast.push({ type: 'success', title: 'Dosya serbest bırakıldı', description: 'Dosya normal klasöre taşındı' });
      setConfirmRelease(null);
    },
    onError: (err) => {
      toast.push({ type: 'error', title: 'Hata', description: getErrorMessage(err) });
    }
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/quarantine/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quarantine'] });
      toast.push({ type: 'success', title: 'Dosya silindi', description: 'Dosya kalıcı olarak silindi' });
      setConfirmDelete(null);
    },
    onError: (err) => {
      toast.push({ type: 'error', title: 'Hata', description: getErrorMessage(err) });
    }
  });

  const filteredFiles = useMemo(() => {
    if (!filesQuery.data?.files) return [];
    return filesQuery.data.files;
  }, [filesQuery.data]);

  const getReasonBadge = (reason: string) => {
    const colors: Record<string, 'danger' | 'warning' | 'info'> = {
      VIRUS: 'danger',
      MIME_TYPE_MISMATCH: 'warning',
      SUSPICIOUS: 'warning',
      SCAN_FAILED: 'info',
      MANUAL: 'info'
    };
    const labels: Record<string, string> = {
      VIRUS: 'Virus',
      MIME_TYPE_MISMATCH: 'MIME Uyuşmazlığı',
      SUSPICIOUS: 'Şüpheli',
      SCAN_FAILED: 'Tarama Hatası',
      MANUAL: 'Manuel'
    };
    return <Badge variant={colors[reason] || 'info'}>{labels[reason] || reason}</Badge>;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (!canRead) {
    return (
      <Card className="p-4 border-red-200 bg-red-50">
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="w-4 h-4" />
          <div>Quarantine görüntüleme yetkiniz yok.</div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dosya Karantinası"
        description="Karantinaya alınmış dosyaları görüntüleme ve yönetme"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setShowInfoModal(true)} title="Quarantine Bilgisi">
              <Info className="w-4 h-4" />
            </Button>
            <Button variant="secondary" onClick={() => { filesQuery.refetch(); statsQuery.refetch(); }}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Yenile
            </Button>
          </div>
        }
      />

      {/* İstatistikler */}
      {statsQuery.data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-500 mb-1">Toplam Dosya</div>
                <div className="text-2xl font-bold text-slate-900">{statsQuery.data.total}</div>
              </div>
              <ShieldAlert className="w-8 h-8 text-slate-400" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-500 mb-1">Aktif</div>
                <div className="text-2xl font-bold text-amber-600">{statsQuery.data.active}</div>
              </div>
              <AlertTriangle className="w-8 h-8 text-amber-400" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-500 mb-1">Serbest Bırakılan</div>
                <div className="text-2xl font-bold text-emerald-600">{statsQuery.data.released}</div>
              </div>
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-500 mb-1">Virus Tespit Edilen</div>
                <div className="text-2xl font-bold text-red-600">{statsQuery.data.byReason.VIRUS || 0}</div>
              </div>
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          </Card>
        </div>
      )}

      {/* Filtreler */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="Dosya adı, kullanıcı ara..."
            className="w-full"
          />
          <div className="flex gap-2">
            <Button
              variant={reasonFilter === 'all' ? 'primary' : 'secondary'}
              onClick={() => setReasonFilter('all')}
              className="text-xs"
            >
              Tümü
            </Button>
            <Button
              variant={reasonFilter === 'VIRUS' ? 'primary' : 'secondary'}
              onClick={() => setReasonFilter('VIRUS')}
              className="text-xs"
            >
              Virus
            </Button>
            <Button
              variant={reasonFilter === 'MIME_TYPE_MISMATCH' ? 'primary' : 'secondary'}
              onClick={() => setReasonFilter('MIME_TYPE_MISMATCH')}
              className="text-xs"
            >
              MIME
            </Button>
            <Button
              variant={reasonFilter === 'SUSPICIOUS' ? 'primary' : 'secondary'}
              onClick={() => setReasonFilter('SUSPICIOUS')}
              className="text-xs"
            >
              Şüpheli
            </Button>
          </div>
          <div className="text-sm text-slate-500 flex items-center justify-end">
            {filesQuery.data?.total || 0} sonuç
          </div>
        </div>
      </Card>

      {/* Dosya Listesi */}
      {filesQuery.isLoading ? (
        <Card className="p-6">
          <Skeleton className="h-32" />
        </Card>
      ) : filteredFiles.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">
          <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-slate-400" />
          <div>Karantinaya alınmış dosya bulunamadı</div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Dosya</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Boyut</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Neden</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Yükleyen</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Tarih</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Durum</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-600 uppercase">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredFiles.map((file) => (
                  <tr key={file.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">{file.fileName}</div>
                      {file.detectedMimeType && file.detectedMimeType !== file.mimeType && (
                        <div className="text-xs text-slate-500 mt-1">
                          Tespit: {file.detectedMimeType}
                        </div>
                      )}
                      {file.attachment?.ticket && (
                        <div className="text-xs text-slate-500 mt-1">
                          Ticket: #{file.attachment.ticket.key} - {file.attachment.ticket.title}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{formatFileSize(file.fileSize)}</td>
                    <td className="px-5 py-4">{getReasonBadge(file.reason)}</td>
                    <td className="px-5 py-4">
                      <div className="text-sm text-slate-600">
                        {file.uploadedBy?.name || file.uploadedBy?.email || '—'}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {new Date(file.createdAt).toLocaleString('tr-TR')}
                    </td>
                    <td className="px-5 py-4">
                      {file.releasedAt ? (
                        <Badge variant="success">Serbest Bırakıldı</Badge>
                      ) : (
                        <Badge variant="warning">Karantinada</Badge>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setViewingFile(file)}
                          title="Detaylar"
                        >
                          <Info className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => window.open(`/api/quarantine/${file.id}/download`, '_blank')}
                          title="İndir"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        {canManage && !file.releasedAt && (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => setConfirmRelease({ id: file.id, fileName: file.fileName })}
                              title="Serbest Bırak"
                            >
                              <Unlock className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => setConfirmDelete({ id: file.id, fileName: file.fileName })}
                              title="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
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

          {/* Sayfalama */}
          {filesQuery.data && filesQuery.data.totalPages > 1 && (
            <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Sayfa {filesQuery.data.page} / {filesQuery.data.totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Önceki
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(p => Math.min(filesQuery.data!.totalPages, p + 1))}
                  disabled={page >= filesQuery.data.totalPages}
                >
                  Sonraki
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Detay Modal */}
      <Modal title="Dosya Detayları" open={!!viewingFile} onClose={() => setViewingFile(null)}>
        {viewingFile && (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1">Dosya Adı</div>
              <div className="text-sm text-slate-900">{viewingFile.fileName}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1">Sanitize Edilmiş Ad</div>
              <div className="text-sm text-slate-900">{viewingFile.sanitizedFileName}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1">Boyut</div>
              <div className="text-sm text-slate-900">{formatFileSize(viewingFile.fileSize)}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1">MIME Type</div>
              <div className="text-sm text-slate-900">{viewingFile.mimeType}</div>
            </div>
            {viewingFile.detectedMimeType && (
              <div>
                <div className="text-xs font-medium text-slate-500 mb-1">Tespit Edilen MIME Type</div>
                <div className="text-sm text-slate-900">{viewingFile.detectedMimeType}</div>
              </div>
            )}
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1">Neden</div>
              <div className="mt-1">{getReasonBadge(viewingFile.reason)}</div>
            </div>
            {viewingFile.scanResult && (
              <div>
                <div className="text-xs font-medium text-slate-500 mb-1">Tarama Sonucu</div>
                <div className="text-sm text-slate-900 bg-red-50 border border-red-200 rounded p-2">
                  {viewingFile.scanResult}
                </div>
              </div>
            )}
            {viewingFile.uploadedBy && (
              <div>
                <div className="text-xs font-medium text-slate-500 mb-1">Yükleyen</div>
                <div className="text-sm text-slate-900">
                  {viewingFile.uploadedBy.name || viewingFile.uploadedBy.email}
                </div>
              </div>
            )}
            {viewingFile.releasedAt && viewingFile.releasedBy && (
              <div>
                <div className="text-xs font-medium text-slate-500 mb-1">Serbest Bırakan</div>
                <div className="text-sm text-slate-900">
                  {viewingFile.releasedBy.name || viewingFile.releasedBy.email} - {new Date(viewingFile.releasedAt).toLocaleString('tr-TR')}
                </div>
              </div>
            )}
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1">Oluşturulma Tarihi</div>
              <div className="text-sm text-slate-900">{new Date(viewingFile.createdAt).toLocaleString('tr-TR')}</div>
            </div>
          </div>
        )}
      </Modal>

      {/* Onay Dialogları */}
      <ConfirmDialog
        open={!!confirmRelease}
        title="Dosyayı Serbest Bırak"
        message={`"${confirmRelease?.fileName}" dosyasını serbest bırakmak istediğinize emin misiniz? Dosya normal klasöre taşınacak.`}
        confirmText="Serbest Bırak"
        cancelText="İptal"
        onConfirm={() => confirmRelease && releaseM.mutate(confirmRelease.id)}
        onCancel={() => setConfirmRelease(null)}
        variant="primary"
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Dosyayı Kalıcı Olarak Sil"
        message={`"${confirmDelete?.fileName}" dosyasını kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
        confirmText="Sil"
        cancelText="İptal"
        onConfirm={() => confirmDelete && deleteM.mutate(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
        variant="danger"
      />

      {/* Bilgi Modal */}
      <Modal title="Quarantine Bilgisi" open={showInfoModal} onClose={() => setShowInfoModal(false)}>
        <div className="space-y-4 text-sm text-slate-700">
          <p>
            Dosya karantinası, güvenlik kontrollerinden geçemeyen dosyaların izole edildiği bir mekanizmadır.
          </p>
          <div>
            <h4 className="font-semibold text-slate-900 mb-2">Karantina Nedenleri:</h4>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Virus:</strong> ClamAV tarafından virus tespit edildi</li>
              <li><strong>MIME Uyuşmazlığı:</strong> Dosya içeriği bildirilen MIME type ile uyuşmuyor</li>
              <li><strong>Şüpheli:</strong> Dosya şüpheli içerik içeriyor</li>
              <li><strong>Tarama Hatası:</strong> Dosya taraması başarısız oldu</li>
              <li><strong>Manuel:</strong> Admin tarafından manuel olarak karantinaya alındı</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 mb-2">İşlemler:</h4>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Serbest Bırak:</strong> Dosyayı normal klasöre taşır ve kullanıma açar</li>
              <li><strong>Sil:</strong> Dosyayı kalıcı olarak siler</li>
              <li><strong>İndir:</strong> Dosyayı inceleme için indirir (güvenli ortamda açın)</li>
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  );
}

