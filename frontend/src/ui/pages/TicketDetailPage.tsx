import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { apiFetch, getToken } from '../../lib/api';
import { config } from '../../config';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Textarea } from '../components/Textarea';
import { Badge } from '../components/Badge';
import { Skeleton } from '../components/Skeleton';
import { Modal } from '../components/Modal';
import { Select } from '../components/Select';
import { FileUploadModal } from '../components/FileUploadModal';
import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { useToast } from '../components/Toast';
import { ArrowLeft, Send, Clock, User, MessageSquare, Lock, AlertCircle, CheckCircle2, XCircle, UserPlus, Play, CheckCircle, Paperclip, Download, Trash2, Eye, ExternalLink, Target, Timer, AlertTriangle, ChevronDown, ChevronUp, History, ArrowRight, Tag, Edit, Star } from 'lucide-react';
import clsx from 'clsx';

type Ticket = {
  id: string;
  key: number;
  title: string;
  description: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  category?: { id: string; name: string; color: string | null } | null;
  tags?: Array<{ id: string; name: string; color: string | null }>;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; email: string; name: string | null; avatarUrl: string | null };
  assignedTo: { id: string; email: string; name: string | null; avatarUrl: string | null } | null;
  closedAt: string | null;
  closedBy: { id: string; email: string; name: string | null } | null;
  firstRespondedAt?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: { id: string; email: string; name: string | null } | null;
  resolutionNote?: string | null;
  slaStatus?: string | null;
  firstResponseSLA?: number | null;
  resolutionSLA?: number | null;
  firstResponseDeadline?: string | null;
  resolutionDeadline?: string | null;
  rating?: {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    ratedBy: { id: string; email: string; name: string | null; avatarUrl: string | null };
  } | null;
};

type Message = {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  author: { id: string; email: string; name: string | null };
};

const statusLabels: Record<string, string> = {
  OPEN: 'Açık',
  IN_PROGRESS: 'İşlemde',
  RESOLVED: 'Çözüldü',
  CLOSED: 'Kapalı'
};

const statusVariants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  OPEN: 'info',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'default'
};

const priorityLabels: Record<string, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  URGENT: 'Acil'
};

const priorityVariants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  LOW: 'default',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'danger'
};

export function TicketDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { has, me } = useAuth();
  const toast = useToast();
  const [msg, setMsg] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [viewingImage, setViewingImage] = useState<{ url: string; fileName: string; attachmentId?: string } | null>(null);
  const [imageBlobUrls, setImageBlobUrls] = useState<Map<string, string>>(new Map());
  const [showFileModal, setShowFileModal] = useState(false);
  const [slaExpanded, setSlaExpanded] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState<string>('');
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Kullanıcı listesi (atama için)
  const usersQ = useQuery({
    queryKey: ['admin', 'users'],
    enabled: has('user.read') && showAssignModal,
    queryFn: () => apiFetch<{ users: Array<{ id: string; email: string; name: string | null }> }>('/api/admin/users')
  });

  const ticketQ = useQuery({
    queryKey: ['ticket', id],
    enabled: !!id,
    queryFn: () => apiFetch<{ ticket: Ticket }>(`/api/tickets/${id}`)
  });

  const messagesQ = useQuery({
    queryKey: ['ticketMessages', id],
    enabled: !!id,
    queryFn: () => apiFetch<{ messages: Message[] }>(`/api/tickets/${id}/messages`)
  });

  // Aktivite geçmişi
  const activitiesQ = useQuery({
    queryKey: ['ticketActivities', id],
    enabled: !!id && showActivityModal,
    queryFn: () => apiFetch<{ activities: Array<{
      type: string;
      timestamp: string;
      user?: { id: string; name: string | null; email: string; avatarUrl?: string | null };
      data?: any;
    }> }>(`/api/tickets/${id}/activities`)
  });

  // Kullanıcıları çek (aktivite detayları için)
  const usersForActivitiesQ = useQuery({
    queryKey: ['admin', 'users'],
    enabled: has('user.read') && showActivityModal && activitiesQ.data !== undefined,
    queryFn: () => apiFetch<{ users: Array<{ id: string; email: string; name: string | null; avatarUrl: string | null }> }>('/api/admin/users')
  });

  const closeM = useMutation({
    mutationFn: () => apiFetch<{ ticket: Ticket }>(`/api/tickets/${id}/close`, { method: 'PUT' }),
    onSuccess: async () => {
      toast.push({ type: 'success', title: 'Talep kapatıldı' });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['ticket', id] }), 
        qc.invalidateQueries({ queryKey: ['tickets'] }),
        qc.invalidateQueries({ queryKey: ['ticketActivities', id] })
      ]);
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message });
    }
  });

  const reopenM = useMutation({
    mutationFn: () => apiFetch<{ ticket: Ticket }>(`/api/tickets/${id}/reopen`, { method: 'PUT' }),
    onSuccess: async () => {
      toast.push({ type: 'success', title: 'Talep yeniden açıldı' });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['ticket', id] }), 
        qc.invalidateQueries({ queryKey: ['tickets'] }),
        qc.invalidateQueries({ queryKey: ['ticketActivities', id] })
      ]);
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message });
    }
  });

  const assignM = useMutation({
    mutationFn: (assignedToId: string | null) => 
      apiFetch<{ ticket: Ticket }>(`/api/tickets/${id}/assign`, { 
        method: 'PUT', 
        json: { assignedToId } 
      }),
    onSuccess: async () => {
      toast.push({ type: 'success', title: 'Atama güncellendi' });
      setShowAssignModal(false);
      setSelectedUserId('');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['ticket', id] }), 
        qc.invalidateQueries({ queryKey: ['tickets'] }),
        qc.invalidateQueries({ queryKey: ['ticketActivities', id] })
      ]);
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message });
    }
  });

  const statusChangeM = useMutation({
    mutationFn: ({ status, resolutionNote }: { status: Ticket['status']; resolutionNote?: string | null }) => 
      apiFetch<{ ticket: Ticket }>(`/api/tickets/${id}`, { 
        method: 'PUT', 
        json: { status, resolutionNote } 
      }),
    onSuccess: async () => {
      toast.push({ type: 'success', title: 'Durum güncellendi' });
      setShowResolveModal(false);
      setResolutionNote('');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['ticket', id] }), 
        qc.invalidateQueries({ queryKey: ['tickets'] }),
        qc.invalidateQueries({ queryKey: ['ticketActivities', id] })
      ]);
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message || 'Durum güncellenemedi' });
    }
  });

  const closeAfterResolveM = useMutation({
    mutationFn: () => apiFetch<{ ticket: Ticket }>(`/api/tickets/${id}/close`, { method: 'PUT' }),
    onSuccess: async () => {
      toast.push({ type: 'success', title: 'Ticket çözüldü ve kapatıldı' });
      setShowResolveModal(false);
      setResolutionNote('');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['ticket', id] }), 
        qc.invalidateQueries({ queryKey: ['tickets'] }),
        qc.invalidateQueries({ queryKey: ['ticketActivities', id] })
      ]);
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message || 'Ticket kapatılamadı' });
    }
  });

  const sendMsgM = useMutation({
    mutationFn: () =>
      apiFetch<{ message: Message }>(`/api/tickets/${id}/messages`, { method: 'POST', json: { body: msg, isInternal } }),
    onSuccess: async () => {
      setMsg('');
      setIsInternal(false);
      toast.push({ type: 'success', title: 'Mesaj gönderildi' });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['ticketMessages', id] }),
        qc.invalidateQueries({ queryKey: ['ticket', id] }),
        qc.invalidateQueries({ queryKey: ['ticketActivities', id] })
      ]);
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Mesaj gönderilemedi', description: err?.message });
    }
  });



  // Attachments
  const attachmentsQ = useQuery({
    queryKey: ['ticketAttachments', id],
    enabled: !!id,
    queryFn: () => apiFetch<{ attachments: Array<{ id: string; fileName: string; fileSize: number; mimeType: string; createdAt: string; uploadedBy: { id: string; email: string; name: string | null } }> }>(`/api/ticket-attachments/${id}`)
  });

  // Resim blob URL'lerini oluştur ve temizle
  useEffect(() => {
    return () => {
      imageBlobUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageBlobUrls]);

  // Resim için blob URL oluştur
  const getImageBlobUrl = async (attachmentId: string): Promise<string> => {
    // Cache'den kontrol et
    if (imageBlobUrls.has(attachmentId)) {
      return imageBlobUrls.get(attachmentId)!;
    }

    // Fetch ile authenticated request yap
    const token = getToken();
    const response = await fetch(`${config.apiBaseUrl}/api/ticket-attachments/${id}/download/${attachmentId}?inline=true`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Resim yüklenemedi');
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    // Cache'e ekle
    setImageBlobUrls((prev) => {
      const next = new Map(prev);
      next.set(attachmentId, blobUrl);
      return next;
    });

    return blobUrl;
  };


  const uploadFileM = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const token = localStorage.getItem('ticket_token');
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/ticket-attachments/${id}/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Dosya yüklenemedi' }));
        throw new Error(error.message || 'Dosya yüklenemedi');
      }

      return res.json();
    },
    onSuccess: async () => {
      toast.push({ type: 'success', title: 'Dosya yüklendi' });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['ticketAttachments', id] }),
        qc.invalidateQueries({ queryKey: ['ticketActivities', id] })
      ]);
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message || 'Dosya yüklenemedi' });
    }
  });

  const submitRatingM = useMutation({
    mutationFn: () =>
      apiFetch<{ rating: Ticket['rating'] }>(`/api/tickets/${id}/rating`, { 
        method: 'POST', 
        json: { rating, comment: ratingComment || undefined } 
      }),
    onSuccess: async () => {
      setShowRatingModal(false);
      setRating(5);
      setRatingComment('');
      toast.push({ type: 'success', title: 'Değerlendirme gönderildi' });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['ticket', id] }),
        qc.invalidateQueries({ queryKey: ['ticketActivities', id] })
      ]);
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Değerlendirme gönderilemedi', description: err?.message });
    }
  });

  const updateRatingM = useMutation({
    mutationFn: () =>
      apiFetch<{ rating: Ticket['rating'] }>(`/api/tickets/${id}/rating`, { 
        method: 'PUT', 
        json: { rating, comment: ratingComment || undefined } 
      }),
    onSuccess: async () => {
      setShowRatingModal(false);
      toast.push({ type: 'success', title: 'Değerlendirme güncellendi' });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['ticket', id] }),
        qc.invalidateQueries({ queryKey: ['ticketActivities', id] })
      ]);
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Değerlendirme güncellenemedi', description: err?.message });
    }
  });

  const deleteFileM = useMutation({
    mutationFn: (attachmentId: string) => apiFetch(`/api/ticket-attachments/${id}/${attachmentId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.push({ type: 'success', title: 'Dosya silindi' });
      await qc.invalidateQueries({ queryKey: ['ticketAttachments', id] });
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message || 'Dosya silinemedi' });
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
    files.forEach(file => {
      uploadFileM.mutate(file);
    });
  };

  if (ticketQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (ticketQ.error) {
    return (
      <Card className="p-4 border-red-200 bg-red-50">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-4 h-4" />
          <div>Hata: {(ticketQ.error as any)?.message}</div>
        </div>
      </Card>
    );
  }

  const ticket = ticketQ.data!.ticket;
  const isClosed = ticket.status === 'CLOSED';
  
  // SLA hesaplamaları
  const formatSLATime = (minutes: number | null | undefined) => {
    if (!minutes) return 'Belirtilmemiş';
    if (minutes < 60) return `${minutes} dakika`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} saat`;
    return `${hours} saat ${mins} dakika`;
  };

  const formatResolutionTime = (hours: number | null | undefined) => {
    if (!hours) return 'Belirtilmemiş';
    if (hours < 24) return `${hours} saat`;
    const days = Math.floor(hours / 24);
    const hrs = hours % 24;
    if (hrs === 0) return `${days} gün`;
    return `${days} gün ${hrs} saat`;
  };

  // İlk yanıt deadline hesaplama
  const firstResponseDeadline = ticket.firstResponseSLA && ticket.createdAt
    ? new Date(new Date(ticket.createdAt).getTime() + ticket.firstResponseSLA * 60 * 1000)
    : null;

  // Çözüm deadline hesaplama (ilk yanıt varsa ondan, yoksa oluşturulma tarihinden)
  const resolutionStart = ticket.firstRespondedAt ? new Date(ticket.firstRespondedAt) : new Date(ticket.createdAt);
  const resolutionDeadline = ticket.resolutionSLA
    ? new Date(resolutionStart.getTime() + ticket.resolutionSLA * 60 * 60 * 1000)
    : null;

  // Kalan süre hesaplama
  const getRemainingTime = (deadline: Date | null) => {
    if (!deadline) return null;
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    if (diff < 0) return { exceeded: true, value: Math.abs(diff) };
    return { exceeded: false, value: diff };
  };

  const firstResponseRemaining = firstResponseDeadline ? getRemainingTime(firstResponseDeadline) : null;
  const resolutionRemaining = resolutionDeadline ? getRemainingTime(resolutionDeadline) : null;

  const formatRemainingTime = (ms: number) => {
    const minutes = Math.floor(ms / (60 * 1000));
    if (minutes < 60) return `${minutes} dakika`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) {
      if (mins === 0) return `${hours} saat`;
      return `${hours} saat ${mins} dakika`;
    }
    const days = Math.floor(hours / 24);
    const hrs = hours % 24;
    if (hrs === 0) return `${days} gün`;
    return `${days} gün ${hrs} saat`;
  };

  // İlk yanıt ilerleme yüzdesi
  const getFirstResponseProgress = () => {
    if (!ticket.firstResponseSLA || !firstResponseDeadline) return null;
    const now = new Date();
    const total = ticket.firstResponseSLA * 60 * 1000;
    const elapsed = now.getTime() - new Date(ticket.createdAt).getTime();
    if (ticket.firstRespondedAt) {
      const responseTime = new Date(ticket.firstRespondedAt).getTime() - new Date(ticket.createdAt).getTime();
      return Math.min(100, Math.round((responseTime / total) * 100));
    }
    return Math.min(100, Math.round((elapsed / total) * 100));
  };

  // Çözüm ilerleme yüzdesi
  const getResolutionProgress = () => {
    if (!ticket.resolutionSLA || !resolutionDeadline) return null;
    const now = new Date();
    const total = ticket.resolutionSLA * 60 * 60 * 1000;
    const elapsed = now.getTime() - resolutionStart.getTime();
    if (ticket.resolvedAt) {
      const resolveTime = new Date(ticket.resolvedAt).getTime() - resolutionStart.getTime();
      return Math.min(100, Math.round((resolveTime / total) * 100));
    }
    return Math.min(100, Math.round((elapsed / total) * 100));
  };

  const firstResponseProgress = getFirstResponseProgress();
  const resolutionProgress = getResolutionProgress();

  const getUserInitials = (name: string | null, email: string) => {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name[0].toUpperCase();
    }
    return email[0].toUpperCase();
  };

  const getUserDisplayName = (name: string | null, email: string) => {
    return name || email.split('@')[0];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link to="/tickets">
          <Button variant="secondary" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Geri
          </Button>
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          {has('ticket.activity.read') && (
            <Button 
              variant="secondary" 
              onClick={() => setShowActivityModal(true)}
              className="flex items-center gap-2"
            >
              <History className="w-4 h-4" />
              Aktivite Geçmişi
            </Button>
          )}
            {!isClosed && (
              <>
                {has('ticket.assign') && (
                  <>
                    {me?.user.id && ticket.assignedTo?.id !== me.user.id && (
                      <Button 
                        variant="secondary" 
                        onClick={() => assignM.mutate(me.user.id)} 
                        disabled={assignM.isPending}
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Bana Ata
                      </Button>
                    )}
                    <Button 
                      variant="secondary" 
                      onClick={() => setShowAssignModal(true)} 
                      disabled={assignM.isPending}
                    >
                      <User className="w-4 h-4 mr-2" />
                      Birini Ata
                    </Button>
                  </>
                )}
                {has('ticket.update') && ticket.status === 'OPEN' && (
                  <Button 
                    variant="secondary" 
                    onClick={() => statusChangeM.mutate({ status: 'IN_PROGRESS', resolutionNote: null })} 
                    disabled={statusChangeM.isPending}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    İşleme Al
                  </Button>
                )}
                {has('ticket.update') && ticket.status === 'IN_PROGRESS' && (
                  <Button 
                    variant="secondary" 
                    onClick={() => {
                      setResolutionNote('');
                      setShowResolveModal(true);
                    }} 
                    disabled={statusChangeM.isPending}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Çöz
                  </Button>
                )}
                {has('ticket.update') && ticket.status === 'RESOLVED' && has('ticket.close') && (
                  <Button variant="danger" onClick={() => closeM.mutate()} disabled={closeM.isPending}>
                    <XCircle className="w-4 h-4 mr-2" />
                    Kapat
                  </Button>
                )}
              </>
            )}
            {has('ticket.reopen') && isClosed && (
              <Button variant="secondary" onClick={() => reopenM.mutate()} disabled={reopenM.isPending}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Yeniden Aç
              </Button>
            )}
        </div>
      </div>

      {/* Ana Bilgi Kartı */}
      <Card className="p-6">
        {/* Başlık ve Badge'ler */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="text-2xl font-extrabold text-slate-400">#{ticket.key}</span>
              <h1 className="text-2xl font-bold text-slate-900 flex-1 min-w-0">
                {ticket.title}
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <Badge variant={statusVariants[ticket.status]} className="text-sm px-3 py-1">
                {statusLabels[ticket.status]}
              </Badge>
              <Badge variant={priorityVariants[ticket.priority]} className="text-sm px-3 py-1 font-medium">
                {priorityLabels[ticket.priority]}
              </Badge>
              {ticket.category && (
                <Badge 
                  variant="default"
                  className="text-sm px-3 py-1"
                  style={ticket.category.color ? { 
                    backgroundColor: ticket.category.color, 
                    color: '#fff',
                    borderColor: ticket.category.color
                  } : undefined}
                >
                  {ticket.category.name}
                </Badge>
              )}
              {ticket.tags && ticket.tags.length > 0 && ticket.tags.map(tag => (
                <Badge 
                  key={tag.id}
                  variant="default"
                  className="text-sm px-3 py-1 border bg-slate-50"
                  style={tag.color ? { 
                    backgroundColor: tag.color + '20', 
                    color: tag.color, 
                    borderColor: tag.color 
                  } : undefined}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>

            {/* Bilgi Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200">
              <div className="flex items-center gap-3">
                {ticket.createdBy.avatarUrl ? (
                  <img 
                    src={ticket.createdBy.avatarUrl} 
                    alt={getUserDisplayName(ticket.createdBy.name, ticket.createdBy.email)}
                    className="w-10 h-10 rounded-full object-cover shadow-sm border-2 border-slate-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-sm font-bold text-slate-700 shadow-sm">
                    {getUserInitials(ticket.createdBy.name, ticket.createdBy.email)}
                  </div>
                )}
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">Oluşturan</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {getUserDisplayName(ticket.createdBy.name, ticket.createdBy.email)}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {new Date(ticket.createdAt).toLocaleString('tr-TR', { 
                      day: 'numeric', 
                      month: 'short', 
                      year: 'numeric',
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              </div>

              {ticket.assignedTo ? (
                <div className="flex items-center gap-3">
                  {ticket.assignedTo.avatarUrl ? (
                    <img 
                      src={ticket.assignedTo.avatarUrl} 
                      alt={getUserDisplayName(ticket.assignedTo.name, ticket.assignedTo.email)}
                      className="w-10 h-10 rounded-full object-cover shadow-sm border-2 border-blue-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-200 to-blue-300 flex items-center justify-center text-sm font-bold text-blue-700 shadow-sm">
                      {getUserInitials(ticket.assignedTo.name, ticket.assignedTo.email)}
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-slate-500 mb-0.5">Atanan</div>
                    <div className="text-sm font-semibold text-slate-900">
                      {getUserDisplayName(ticket.assignedTo.name, ticket.assignedTo.email)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-200 to-amber-300 flex items-center justify-center text-sm font-bold text-amber-700 shadow-sm">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-0.5">Atanan</div>
                    <div className="text-sm font-semibold text-amber-700">
                      Atanmamış
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Açıklama */}
        {ticket.description && (
          <div className="mt-6 p-5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200/50">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              <div className="text-base font-semibold text-slate-900">Açıklama</div>
            </div>
            <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{ticket.description}</div>
          </div>
        )}

        {ticket.resolutionNote && (
          <div className="mt-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200/70">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <div className="text-sm font-medium text-emerald-800">Çözüm / Yapılan İşlem</div>
            </div>
            <div className="text-sm text-emerald-900 whitespace-pre-wrap mb-2">{ticket.resolutionNote}</div>
            {ticket.resolvedBy && ticket.resolvedAt && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-emerald-700">
                <span>Çözen: {ticket.resolvedBy.name ?? ticket.resolvedBy.email}</span>
                <span>Çözüldü: {new Date(ticket.resolvedAt).toLocaleString('tr-TR')}</span>
              </div>
            )}
          </div>
        )}

        {/* Değerlendirme Bölümü */}
        {(ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') && (
          <div className="mt-4 p-4 rounded-lg border border-slate-200 bg-gradient-to-br from-amber-50 to-yellow-50">
            {ticket.rating ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-5 h-5 text-amber-600 fill-amber-600" />
                  <div className="text-sm font-semibold text-slate-900">Değerlendirme</div>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className={`w-5 h-5 ${i <= ticket.rating!.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-slate-700">{ticket.rating.rating}/5</span>
                </div>
                {ticket.rating.comment && (
                  <div className="text-sm text-slate-700 whitespace-pre-wrap mb-2 p-3 rounded-md bg-white/70 border border-slate-200/50">
                    {ticket.rating.comment}
                  </div>
                )}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {ticket.rating.ratedBy.avatarUrl ? (
                      <img 
                        src={ticket.rating.ratedBy.avatarUrl} 
                        alt={getUserDisplayName(ticket.rating.ratedBy.name, ticket.rating.ratedBy.email)}
                        className="w-5 h-5 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-xs font-bold text-slate-700">
                        {getUserInitials(ticket.rating.ratedBy.name, ticket.rating.ratedBy.email)}
                      </div>
                    )}
                    <span>{getUserDisplayName(ticket.rating.ratedBy.name, ticket.rating.ratedBy.email)}</span>
                    <span>•</span>
                    <span>{new Date(ticket.rating.createdAt).toLocaleDateString('tr-TR')}</span>
                  </div>
                  {has('ticket.rating.update') && ticket.rating.ratedBy.id === me?.user?.id && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setRating(ticket.rating!.rating);
                        setRatingComment(ticket.rating!.comment || '');
                        setShowRatingModal(true);
                      }}
                    >
                      Düzenle
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-5 h-5 text-amber-600" />
                  <div className="text-sm font-semibold text-slate-900">Değerlendirme</div>
                </div>
                <div className="text-sm text-slate-600 mb-3">
                  Bu ticket için henüz değerlendirme yapılmamış.
                </div>
                {has('ticket.rating.create') && (ticket.createdBy.id === me?.user?.id || ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setRating(5);
                      setRatingComment('');
                      setShowRatingModal(true);
                    }}
                  >
                    <Star className="w-4 h-4 mr-1.5" />
                    Değerlendirme Yap
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Dosyalar */}
        <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200/70">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-slate-600" />
              <div className="text-sm font-medium text-slate-700">Eklenen Dosyalar</div>
              {attachmentsQ.data && attachmentsQ.data.attachments.length > 0 && (
                <Badge variant="default" className="text-xs">
                  {attachmentsQ.data.attachments.length}
                </Badge>
              )}
            </div>
            {has('ticket.update') && !isClosed && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowFileModal(true)}
                disabled={uploadFileM.isPending}
              >
                <Paperclip className="w-3 h-3 mr-1" />
                {uploadFileM.isPending ? 'Yükleniyor...' : 'Dosya Ekle'}
              </Button>
            )}
          </div>

          {attachmentsQ.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : attachmentsQ.data && attachmentsQ.data.attachments.length > 0 ? (
            <div className="space-y-2">
              {attachmentsQ.data.attachments.map((attachment) => {
                const isImage = attachment.mimeType.startsWith('image/');
                
                return (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Paperclip className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {attachment.fileName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatFileSize(attachment.fileSize)} • {new Date(attachment.createdAt).toLocaleString('tr-TR')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isImage ? (
                        <button
                          onClick={async () => {
                            try {
                              const blobUrl = await getImageBlobUrl(attachment.id);
                              setViewingImage({ url: blobUrl, fileName: attachment.fileName, attachmentId: attachment.id });
                            } catch (err) {
                              toast.push({ type: 'error', title: 'Hata', description: 'Resim yüklenemedi' });
                            }
                          }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Görüntüle"
                        >
                          <Eye className="w-4 h-4 text-slate-600" />
                        </button>
                      ) : null}
                      <a
                        href={`${config.apiBaseUrl}/api/ticket-attachments/${id}/download/${attachment.id}?inline=false`}
                        download={attachment.fileName}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                        title="İndir"
                      >
                        <Download className="w-4 h-4 text-slate-600" />
                      </a>
                      {has('ticket.update') && !isClosed && (
                        <button
                          onClick={() => {
                            if (confirm('Bu dosyayı silmek istediğinizden emin misiniz?')) {
                              deleteFileM.mutate(attachment.id);
                            }
                          }}
                          disabled={deleteFileM.isPending}
                          className="p-1.5 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-slate-500 text-center py-4">
              Henüz dosya eklenmemiş
            </div>
          )}
        </div>

        {/* SLA Bilgileri - Modern ve Detaylı */}
        <div className="mt-6 rounded-xl bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 border-2 border-purple-200/70 shadow-sm overflow-hidden">
          {/* SLA Durum Badge - Her zaman görünür */}
          {ticket.slaStatus && (
            <div className={clsx(
              "p-4 border-b-2",
              ticket.slaStatus === 'breached' && "bg-red-50 border-red-300",
              ticket.slaStatus === 'at_risk' && "bg-amber-50 border-amber-300",
              ticket.slaStatus === 'on_time' && "bg-green-50 border-green-300"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {ticket.slaStatus === 'breached' && (
                    <>
                      <AlertCircle className="w-6 h-6 text-red-600" />
                      <div>
                        <div className="font-bold text-red-900 text-base">SLA İhlali</div>
                        <div className="text-xs text-red-700 mt-0.5">SLA süresi aşıldı, acil müdahale gerekli</div>
                      </div>
                    </>
                  )}
                  {ticket.slaStatus === 'at_risk' && (
                    <>
                      <AlertTriangle className="w-6 h-6 text-amber-600" />
                      <div>
                        <div className="font-bold text-amber-900 text-base">SLA Risk Altında</div>
                        <div className="text-xs text-amber-700 mt-0.5">SLA süresinin %80'inden fazlası kullanıldı</div>
                      </div>
                    </>
                  )}
                  {ticket.slaStatus === 'on_time' && (
                    <>
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      <div>
                        <div className="font-bold text-green-900 text-base">SLA Zamanında</div>
                        <div className="text-xs text-green-700 mt-0.5">Ticket belirlenen süreler içinde</div>
                      </div>
                    </>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSlaExpanded(!slaExpanded)}
                  className="flex items-center gap-2"
                >
                  {slaExpanded ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Daha Az
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Daha Fazla
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Detaylı Bilgiler - Açılır/Kapanır */}
          {slaExpanded && (
            <div className="p-6">
              {/* İlk Yanıt ve Çözüm Kartları */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* İlk Yanıt SLA */}
            <div className="bg-white rounded-lg p-5 border-2 border-purple-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Timer className="w-5 h-5 text-purple-600" />
                <h4 className="font-bold text-slate-900">İlk Yanıt Süresi</h4>
              </div>
              
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Hedef Süre</div>
                  <div className="text-xl font-bold text-slate-900">
                    {formatSLATime(ticket.firstResponseSLA || undefined)}
                  </div>
                </div>

                {firstResponseDeadline && (
                  <div className="text-xs text-slate-600">
                    <div className="font-medium mb-1">Hedef Tarih:</div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {firstResponseDeadline.toLocaleString('tr-TR', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric',
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                )}

                {ticket.firstRespondedAt ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="font-semibold text-green-900 text-sm">Yanıtlandı</span>
                    </div>
                    <div className="text-xs text-green-700">
                      {new Date(ticket.firstRespondedAt).toLocaleString('tr-TR')}
                    </div>
                    {firstResponseRemaining && !firstResponseRemaining.exceeded && (
                      <div className="text-xs text-green-600 mt-1">
                        ✅ Hedef süre içinde yanıtlandı
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span className="font-semibold text-amber-900 text-sm">Bekliyor</span>
                    </div>
                    {firstResponseRemaining && (
                      <div className={clsx(
                        "text-xs font-medium mt-1",
                        firstResponseRemaining.exceeded ? "text-red-700" : "text-amber-700"
                      )}>
                        {firstResponseRemaining.exceeded ? (
                          <>⚠️ {formatRemainingTime(firstResponseRemaining.value)} önce aşıldı</>
                        ) : (
                          <>⏱️ {formatRemainingTime(firstResponseRemaining.value)} kaldı</>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {firstResponseProgress !== null && (
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                      <span>İlerleme</span>
                      <span className="font-medium">{firstResponseProgress}%</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          "h-full rounded-full transition-all",
                          firstResponseProgress >= 100 ? "bg-red-500" :
                          firstResponseProgress >= 80 ? "bg-amber-500" :
                          ticket.firstRespondedAt ? "bg-green-500" : "bg-purple-500"
                        )}
                        style={{ width: `${Math.min(100, firstResponseProgress)}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Çözüm SLA */}
            <div className="bg-white rounded-lg p-5 border-2 border-indigo-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-indigo-600" />
                <h4 className="font-bold text-slate-900">Çözüm Süresi</h4>
              </div>
              
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Hedef Süre</div>
                  <div className="text-xl font-bold text-slate-900">
                    {formatResolutionTime(ticket.resolutionSLA || undefined)}
                  </div>
                </div>

                {resolutionDeadline && (
                  <div className="text-xs text-slate-600">
                    <div className="font-medium mb-1">Hedef Tarih:</div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {resolutionDeadline.toLocaleString('tr-TR', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric',
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                )}

                {ticket.resolvedAt ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="font-semibold text-green-900 text-sm">Çözüldü</span>
                    </div>
                    <div className="text-xs text-green-700">
                      {new Date(ticket.resolvedAt).toLocaleString('tr-TR')}
                    </div>
                    {resolutionRemaining && !resolutionRemaining.exceeded && (
                      <div className="text-xs text-green-600 mt-1">
                        ✅ Hedef süre içinde çözüldü
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span className="font-semibold text-amber-900 text-sm">Devam Ediyor</span>
                    </div>
                    {ticket.firstRespondedAt && (
                      <div className="text-xs text-amber-600 mt-1">
                        İlk yanıttan sonra hesaplanıyor
                      </div>
                    )}
                    {resolutionRemaining && (
                      <div className={clsx(
                        "text-xs font-medium mt-1",
                        resolutionRemaining.exceeded ? "text-red-700" : "text-amber-700"
                      )}>
                        {resolutionRemaining.exceeded ? (
                          <>⚠️ {formatRemainingTime(resolutionRemaining.value)} önce aşıldı</>
                        ) : (
                          <>⏱️ {formatRemainingTime(resolutionRemaining.value)} kaldı</>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {resolutionProgress !== null && (
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                      <span>İlerleme</span>
                      <span className="font-medium">{resolutionProgress}%</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          "h-full rounded-full transition-all",
                          resolutionProgress >= 100 ? "bg-red-500" :
                          resolutionProgress >= 80 ? "bg-amber-500" :
                          ticket.resolvedAt ? "bg-green-500" : "bg-indigo-500"
                        )}
                        style={{ width: `${Math.min(100, resolutionProgress)}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

              {/* Öncelik ve Kategori Bilgisi */}
              <div className="mt-4 pt-4 border-t border-purple-200">
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Öncelik:</span>
                    <Badge variant={priorityVariants[ticket.priority]} className="text-xs">
                      {priorityLabels[ticket.priority]}
                    </Badge>
                  </div>
                  {ticket.category && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Kategori:</span>
                      <Badge variant="default" className="text-xs">
                        {ticket.category.name}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-slate-600" />
          <div className="text-lg font-semibold text-slate-900">Mesajlar</div>
          {messagesQ.data && (
            <Badge variant="default">
              {messagesQ.data.messages.length}
            </Badge>
          )}
        </div>

        {messagesQ.isLoading && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}

        {messagesQ.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            Hata: {(messagesQ.error as any)?.message}
          </div>
        )}

        <div className="space-y-3">
          {messagesQ.data?.messages?.map((m) => {
            const isAuthor = m.author.id === me?.user.id;
            return (
              <div
                key={m.id}
                className={clsx(
                  'rounded-lg border p-4',
                  isAuthor ? 'bg-slate-50 border-slate-200/70' : 'bg-white border-slate-200/70',
                  m.isInternal && 'border-yellow-200 bg-yellow-50/50'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-slate-900">
                      {m.author.name ?? m.author.email}
                    </div>
                    {m.isInternal && (
                      <Badge variant="warning" className="flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        İç Not
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(m.createdAt).toLocaleString('tr-TR')}
                  </div>
                </div>
                <div className="text-sm text-slate-700 whitespace-pre-wrap">{m.body}</div>
              </div>
            );
          })}
          {messagesQ.data && messagesQ.data.messages.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <div>Henüz mesaj yok</div>
            </div>
          )}
        </div>

        {has('ticket.message.create') && !isClosed && (
          <div className="mt-6 space-y-3 pt-6 border-t border-slate-200/70">
            <div className="flex items-center gap-2">
              <Textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="Mesajınızı yazın..."
                rows={4}
                className="flex-1"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  İç not (sadece ekip görebilir)
                </span>
              </label>
              <Button
                onClick={() => sendMsgM.mutate()}
                disabled={!msg.trim() || sendMsgM.isPending}
                className="flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {sendMsgM.isPending ? 'Gönderiliyor...' : 'Gönder'}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Resim Görüntüleme Modal */}
      {viewingImage && (
        <Modal
          open={true}
          onClose={() => setViewingImage(null)}
          title={viewingImage.fileName}
          className="max-w-5xl"
        >
          <div className="flex flex-col items-center gap-4">
            <div 
              className="relative w-full bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center"
              style={{ height: '70vh' }}
            >
              <img
                src={viewingImage.url}
                alt={viewingImage.fileName}
                className="max-w-full max-h-full object-contain rounded-lg"
                draggable={false}
              />
            </div>
            <div className="flex gap-2 w-full justify-end items-center">
              <Button
                variant="secondary"
                onClick={() => {
                  if (viewingImage.attachmentId) {
                    const token = getToken();
                    const url = `${config.apiBaseUrl}/api/ticket-attachments/${id}/download/${viewingImage.attachmentId}?inline=true&token=${encodeURIComponent(token || '')}`;
                    window.open(url, '_blank');
                  }
                }}
                className="mr-auto"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Yeni Sekmede Aç
              </Button>
              <Button variant="secondary" onClick={() => setViewingImage(null)}>
                Kapat
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Çözüm Modal */}
      {showResolveModal && (
        <Modal
          open={showResolveModal}
          onClose={() => {
            setShowResolveModal(false);
            setResolutionNote('');
          }}
          title="Çözüm / Yapılan İşlem"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Çözüm / Yapılan İşlem
              </label>
              <Textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                rows={6}
                placeholder="Çözümü veya yapılan işlemi açıklayın..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="secondary" 
                onClick={() => {
                  setShowResolveModal(false);
                  setResolutionNote('');
                }}
                disabled={statusChangeM.isPending || closeAfterResolveM.isPending}
              >
                İptal
              </Button>
              {has('ticket.close') && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await statusChangeM.mutateAsync({ status: 'RESOLVED', resolutionNote: resolutionNote.trim() || null });
                    await closeAfterResolveM.mutateAsync();
                  }}
                  disabled={statusChangeM.isPending || closeAfterResolveM.isPending}
                >
                  {statusChangeM.isPending || closeAfterResolveM.isPending ? 'İşleniyor...' : 'Çöz ve Kapat'}
                </Button>
              )}
              <Button
                onClick={() => statusChangeM.mutate({ status: 'RESOLVED', resolutionNote: resolutionNote.trim() || null })}
                disabled={statusChangeM.isPending || closeAfterResolveM.isPending}
              >
                {statusChangeM.isPending ? 'Kaydediliyor...' : 'Çöz'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Atama Modal */}
      {showAssignModal && (
        <Modal
          open={showAssignModal}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedUserId('');
          }}
          title="Kullanıcı Ata"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Kullanıcı Seç</label>
              <Select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                <option value="">Atanmamış (Kaldır)</option>
                {usersQ.data?.users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name ?? u.email}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedUserId('');
                }}
              >
                İptal
              </Button>
              <Button
                onClick={() => assignM.mutate(selectedUserId || null)}
                disabled={assignM.isPending}
              >
                {assignM.isPending ? 'Atanıyor...' : 'Ata'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* File Upload Modal */}
      <FileUploadModal
        open={showFileModal}
        onClose={() => setShowFileModal(false)}
        onFilesSelected={handleFilesSelected}
        title="Dosya Ekle"
      />

      {/* Aktivite Geçmişi Modal */}
      {has('ticket.activity.read') && (
        <Modal 
          title={`Ticket #${ticket.key} - Aktivite Geçmişi`}
          open={showActivityModal} 
          onClose={() => setShowActivityModal(false)}
          className="max-w-4xl"
        >
          <div className="space-y-4 max-h-[calc(100vh-12rem)] overflow-y-auto pr-2">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-200">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <History className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Aktivite Geçmişi</h2>
                <p className="text-xs text-slate-500 mt-0.5">Ticket #{ticket.key}</p>
              </div>
            </div>
            
            {activitiesQ.isLoading ? (
              <div className="text-center py-8">
                <div className="text-sm text-slate-500">Yükleniyor...</div>
              </div>
            ) : activitiesQ.error ? (
              <div className="text-center py-8">
                <div className="text-sm text-red-600">Aktivite geçmişi yüklenemedi</div>
              </div>
            ) : activitiesQ.data && activitiesQ.data.activities.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-sm text-slate-500">Henüz aktivite kaydı yok</div>
              </div>
            ) : (
              <div className="relative pl-2">
                {/* Timeline çizgisi */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 via-purple-200 to-pink-200" />
                
                <div className="space-y-5">
                  {activitiesQ.data?.activities.map((activity, index) => {
                    const getUserInitials = (name: string | null, email: string) => {
                      if (name) {
                        const parts = name.trim().split(' ');
                        if (parts.length >= 2) {
                          return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                        }
                        return name[0].toUpperCase();
                      }
                      return email[0].toUpperCase();
                    };

                    const getUserDisplayName = (name: string | null, email: string) => {
                      return name || email.split('@')[0];
                    };

                    const formatDateTime = (dateString: string) => {
                      const date = new Date(dateString);
                      return date.toLocaleString('tr-TR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                    };

                    const statusLabelsAct: Record<string, string> = {
                      OPEN: 'Açık',
                      IN_PROGRESS: 'İşlemde',
                      RESOLVED: 'Çözüldü',
                      CLOSED: 'Kapalı'
                    };

                    const priorityLabelsAct: Record<string, string> = {
                      LOW: 'Düşük',
                      MEDIUM: 'Orta',
                      HIGH: 'Yüksek',
                      URGENT: 'Acil'
                    };

                    const getUserById = (userId: string | null | undefined) => {
                      if (!userId || !usersForActivitiesQ.data) return null;
                      return usersForActivitiesQ.data.users.find(u => u.id === userId);
                    };

                    const getActivityIcon = () => {
                      switch (activity.type) {
                        case 'ticket_created':
                          return <CheckCircle className="w-5 h-5 text-blue-600" />;
                        case 'ticket_assigned':
                          return <UserPlus className="w-5 h-5 text-cyan-600" />;
                        case 'status_changed':
                          return <Play className="w-5 h-5 text-orange-600" />;
                        case 'priority_changed':
                          return <AlertTriangle className="w-5 h-5 text-rose-600" />;
                        case 'category_changed':
                          return <Tag className="w-5 h-5 text-violet-600" />;
                        case 'title_changed':
                          return <Edit className="w-5 h-5 text-sky-600" />;
                        case 'first_response':
                          return <Clock className="w-5 h-5 text-green-600" />;
                        case 'public_message':
                          return <MessageSquare className="w-5 h-5 text-purple-600" />;
                        case 'internal_message':
                          return <Lock className="w-5 h-5 text-amber-600" />;
                        case 'file_uploaded':
                          return <Paperclip className="w-5 h-5 text-indigo-600" />;
                        case 'ticket_resolved':
                          return <Target className="w-5 h-5 text-emerald-600" />;
                        case 'ticket_closed':
                          return <XCircle className="w-5 h-5 text-slate-600" />;
                        default:
                          return <CheckCircle className="w-5 h-5 text-slate-400" />;
                      }
                    };

                    const getActivityTitle = () => {
                      switch (activity.type) {
                        case 'ticket_created':
                          return 'Ticket Oluşturuldu';
                        case 'ticket_assigned':
                          return 'Ticket Atandı';
                        case 'status_changed':
                          return 'Durum Değiştirildi';
                        case 'priority_changed':
                          return 'Öncelik Değiştirildi';
                        case 'category_changed':
                          return 'Kategori Değiştirildi';
                        case 'title_changed':
                          return 'Başlık Değiştirildi';
                        case 'first_response':
                          return 'İlk Yanıt Verildi';
                        case 'public_message':
                          return 'Mesaj Eklendi';
                        case 'internal_message':
                          return 'İç Mesaj Eklendi';
                        case 'file_uploaded':
                          return 'Dosya Eklendi';
                        case 'ticket_resolved':
                          return 'Ticket Çözüldü';
                        case 'ticket_closed':
                          return 'Ticket Kapatıldı';
                        case 'ticket_rated':
                          return 'Değerlendirme Yapıldı';
                        case 'ticket_rating_updated':
                          return 'Değerlendirme Güncellendi';
                        default:
                          return 'Aktivite';
                      }
                    };

                    const getActivityColor = () => {
                      switch (activity.type) {
                        case 'ticket_created':
                          return 'bg-blue-100 border-blue-300';
                        case 'ticket_assigned':
                          return 'bg-cyan-100 border-cyan-300';
                        case 'status_changed':
                          return 'bg-orange-100 border-orange-300';
                        case 'priority_changed':
                          return 'bg-rose-100 border-rose-300';
                        case 'category_changed':
                          return 'bg-violet-100 border-violet-300';
                        case 'title_changed':
                          return 'bg-sky-100 border-sky-300';
                        case 'first_response':
                          return 'bg-green-100 border-green-300';
                        case 'public_message':
                          return 'bg-purple-100 border-purple-300';
                        case 'internal_message':
                          return 'bg-amber-100 border-amber-300';
                        case 'file_uploaded':
                          return 'bg-indigo-100 border-indigo-300';
                        case 'ticket_resolved':
                          return 'bg-emerald-100 border-emerald-300';
                        case 'ticket_closed':
                          return 'bg-slate-100 border-slate-300';
                        case 'ticket_rated':
                        case 'ticket_rating_updated':
                          return 'bg-amber-100 border-amber-300';
                        default:
                          return 'bg-slate-100 border-slate-300';
                      }
                    };

                    return (
                      <div key={index} className="relative flex gap-4">
                        {/* Timeline noktası */}
                        <div className={clsx(
                          "relative z-10 flex-shrink-0 w-12 h-12 rounded-full border-3 shadow-md flex items-center justify-center backdrop-blur-sm",
                          getActivityColor()
                        )}>
                          {getActivityIcon()}
                        </div>

                        {/* İçerik */}
                        <div className="flex-1 min-w-0 pb-5">
                          <div className={clsx(
                            "rounded-xl border-2 p-4 shadow-sm transition-all hover:shadow-md",
                            getActivityColor()
                          )}>
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2.5">
                                <h4 className="font-bold text-base text-slate-900">
                                  {getActivityTitle()}
                                </h4>
                              </div>
                              <div className="text-xs font-medium text-slate-500 bg-white/60 px-2 py-1 rounded-md">
                                {formatDateTime(activity.timestamp)}
                              </div>
                            </div>

                            {activity.user && (
                              <div className="flex items-center gap-2 mb-2">
                                {activity.user.avatarUrl ? (
                                  <img
                                    src={activity.user.avatarUrl}
                                    alt={getUserDisplayName(activity.user.name, activity.user.email)}
                                    className="w-7 h-7 rounded-full border-2 border-white shadow-sm object-cover"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-xs font-semibold text-white shadow-sm">
                                    {getUserInitials(activity.user.name, activity.user.email)}
                                  </div>
                                )}
                                <span className="text-sm font-medium text-slate-800">
                                  {getUserDisplayName(activity.user.name, activity.user.email)}
                                </span>
                              </div>
                            )}

                            {activity.data && (
                              <div className="mt-2 space-y-1">
                                {activity.type === 'public_message' || activity.type === 'internal_message' ? (
                                  <div className="text-sm text-slate-700 bg-white/70 rounded-lg p-3 border border-slate-200/50 shadow-sm leading-relaxed">
                                    {activity.data.body}
                                  </div>
                                ) : activity.type === 'file_uploaded' ? (
                                  <div className="flex items-center gap-2.5 text-sm text-slate-700 bg-white/60 rounded-lg p-2.5 border border-slate-200/50">
                                    <Paperclip className="w-4 h-4 text-indigo-600" />
                                    <span className="font-semibold">{activity.data.fileName}</span>
                                    <span className="text-xs text-slate-500 ml-auto">
                                      ({Math.round((activity.data.fileSize || 0) / 1024)} KB)
                                    </span>
                                  </div>
                                ) : activity.type === 'ticket_assigned' ? (
                                  <div className="text-sm text-slate-700">
                                    {activity.data.fromUserId ? (
                                      <div className="flex items-center gap-2 bg-white/60 rounded-lg p-2.5 border border-slate-200/50">
                                        <span className="text-slate-600 text-xs font-medium">Kimi:</span>
                                        {(() => {
                                          const fromUser = getUserById(activity.data.fromUserId);
                                          return fromUser ? (
                                            <span className="font-semibold px-2 py-1 bg-cyan-50 text-cyan-700 rounded-md text-xs">{getUserDisplayName(fromUser.name, fromUser.email)}</span>
                                          ) : (
                                            <span className="text-slate-400 text-xs">Bilinmeyen</span>
                                          );
                                        })()}
                                        <ArrowRight className="w-4 h-4 text-slate-400 mx-1" />
                                        {activity.data.toUserId ? (() => {
                                          const toUser = getUserById(activity.data.toUserId);
                                          return toUser ? (
                                            <span className="font-semibold px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs">{getUserDisplayName(toUser.name, toUser.email)}</span>
                                          ) : (
                                            <span className="text-slate-400 text-xs">Atanmamış</span>
                                          );
                                        })() : (
                                          <span className="text-slate-400 text-xs">Atanmamış</span>
                                        )}
                                      </div>
                                    ) : activity.data.toUserId ? (() => {
                                      const toUser = getUserById(activity.data.toUserId);
                                      return toUser ? (
                                        <div className="bg-white/60 rounded-lg p-2.5 border border-slate-200/50">
                                          <span className="text-slate-600 text-xs font-medium mr-2">Kime:</span>
                                          <span className="font-semibold px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs">{getUserDisplayName(toUser.name, toUser.email)}</span>
                                        </div>
                                      ) : null;
                                    })() : (
                                      <span className="text-slate-500 text-sm bg-white/60 rounded-lg px-3 py-2 inline-block border border-slate-200/50">Atama kaldırıldı</span>
                                    )}
                                  </div>
                                ) : activity.type === 'status_changed' ? (
                                  <div className="flex items-center gap-2.5 bg-white/60 rounded-lg p-2.5 border border-slate-200/50">
                                    <Badge variant={activity.data.from === 'OPEN' ? 'info' : activity.data.from === 'IN_PROGRESS' ? 'warning' : activity.data.from === 'RESOLVED' ? 'success' : 'default'} className="text-xs font-semibold">
                                      {activity.data.from ? statusLabelsAct[activity.data.from] : '—'}
                                    </Badge>
                                    <ArrowRight className="w-4 h-4 text-slate-400" />
                                    <Badge variant={activity.data.to === 'OPEN' ? 'info' : activity.data.to === 'IN_PROGRESS' ? 'warning' : activity.data.to === 'RESOLVED' ? 'success' : 'default'} className="text-xs font-semibold">
                                      {statusLabelsAct[activity.data.to]}
                                    </Badge>
                                  </div>
                                ) : activity.type === 'priority_changed' ? (
                                  <div className="flex items-center gap-2.5 bg-white/60 rounded-lg p-2.5 border border-slate-200/50">
                                    <Badge variant={activity.data.from === 'LOW' ? 'default' : activity.data.from === 'MEDIUM' ? 'info' : activity.data.from === 'HIGH' ? 'warning' : 'danger'} className="text-xs font-semibold">
                                      {activity.data.from ? priorityLabelsAct[activity.data.from] : '—'}
                                    </Badge>
                                    <ArrowRight className="w-4 h-4 text-slate-400" />
                                    <Badge variant={activity.data.to === 'LOW' ? 'default' : activity.data.to === 'MEDIUM' ? 'info' : activity.data.to === 'HIGH' ? 'warning' : 'danger'} className="text-xs font-semibold">
                                      {priorityLabelsAct[activity.data.to]}
                                    </Badge>
                                  </div>
                                ) : activity.type === 'category_changed' ? (
                                  <div className="flex items-center gap-2.5 bg-white/60 rounded-lg p-2.5 border border-slate-200/50">
                                    <span className="text-slate-600 text-xs font-medium">
                                      {activity.data.fromCategoryId ? 'Önceki kategori' : 'Kategori yok'}
                                    </span>
                                    <ArrowRight className="w-4 h-4 text-slate-400" />
                                    <span className="font-semibold text-slate-800 px-2 py-1 bg-violet-50 text-violet-700 rounded-md text-xs">
                                      {activity.data.toCategoryId ? 'Yeni kategori' : 'Kategori yok'}
                                    </span>
                                  </div>
                                ) : activity.type === 'title_changed' ? (
                                  <div className="bg-white/60 rounded-lg p-3 border border-slate-200/50 space-y-2">
                                    <div className="text-xs text-slate-500 line-through">{activity.data.from}</div>
                                    <div className="font-semibold text-slate-800">{activity.data.to}</div>
                                  </div>
                                ) : activity.type === 'ticket_reopened' ? (
                                  <div className="text-sm text-slate-600 bg-white/60 rounded-lg p-2.5 border border-slate-200/50">
                                    Ticket yeniden açıldı
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Değerlendirme Modal */}
      {showRatingModal && (
        <Modal
          title={ticket.rating ? 'Değerlendirmeyi Güncelle' : 'Ticket Değerlendirmesi'}
          open={showRatingModal}
          onClose={() => setShowRatingModal(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Puan (1-5 arası)
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setRating(i)}
                    className={clsx(
                      'flex-1 p-4 rounded-lg border-2 transition-all hover:scale-105',
                      rating >= i
                        ? 'border-amber-400 bg-amber-50 text-amber-700'
                        : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
                    )}
                  >
                    <Star
                      className={clsx(
                        'w-6 h-6 mx-auto',
                        rating >= i ? 'fill-amber-500 text-amber-500' : 'text-slate-300'
                      )}
                    />
                    <div className="mt-1 text-xs font-medium">{i}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Yorum (Opsiyonel)
              </label>
              <Textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Değerlendirme yorumunuzu buraya yazabilirsiniz..."
                rows={4}
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="secondary" onClick={() => setShowRatingModal(false)}>
                İptal
              </Button>
              <Button
                onClick={() => {
                  if (ticket.rating) {
                    updateRatingM.mutate();
                  } else {
                    submitRatingM.mutate();
                  }
                }}
                disabled={submitRatingM.isPending || updateRatingM.isPending}
              >
                {submitRatingM.isPending || updateRatingM.isPending ? 'Gönderiliyor...' : ticket.rating ? 'Güncelle' : 'Gönder'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <Modal title="Ticket Detayı Hakkında" open={showInfoModal} onClose={() => setShowInfoModal(false)}>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Info className="w-5 h-5" />
                Ticket Detayı Nedir?
              </h3>
              <p className="text-sm text-blue-800">
                Ticket detay sayfası, bir ticket'ın tüm bilgilerini görüntülemenize, mesaj göndermenize, durumunu güncellemenize ve ticket ile ilgili tüm aktiviteleri takip etmenize olanak sağlar.
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
                    <p className="text-sm font-medium text-slate-900">Ticket Bilgileri</p>
                    <p className="text-sm text-slate-600">Ticket'ın durumu, önceliği, kategorisi, atanan kişi ve SLA bilgilerini görüntüleyebilirsiniz.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">2</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Mesajlaşma</p>
                    <p className="text-sm text-slate-600">Ticket ile ilgili mesajlar gönderebilir ve alabilirsiniz. İç mesajlar sadece destek ekibi tarafından görülebilir.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">3</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Dosya Yönetimi</p>
                    <p className="text-sm text-slate-600">Ticket'a dosya ekleyebilir, görüntüleyebilir ve silebilirsiniz. Ekran görüntüleri ve log dosyaları ekleyebilirsiniz.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">4</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Aktivite Geçmişi</p>
                    <p className="text-sm text-slate-600">Ticket'ın tüm aktivitelerini, durum değişikliklerini ve güncellemelerini görüntüleyebilirsiniz.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">5</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">SLA Takibi</p>
                    <p className="text-sm text-slate-600">İlk yanıt ve çözüm sürelerini takip edebilir, SLA durumunu görüntüleyebilirsiniz.</p>
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


