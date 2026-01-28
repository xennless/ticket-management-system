import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Badge } from '../components/Badge';
import { Skeleton } from '../components/Skeleton';
import { useMemo, useState, useCallback } from 'react';
import { Search, Plus, RefreshCw, Filter, Ticket as TicketIcon, X, AlertCircle, Info, CheckCircle, AlertTriangle, Zap, Target, TrendingUp, Timer, UserPlus } from 'lucide-react';
import { AdvancedFilters } from '../components/AdvancedFilters';
import clsx from 'clsx';
import { parseTicketQuery } from '../../lib/ticketQuery';
import { PageHeader } from '../components/PageHeader';
import { ErrorBanner } from '../components/ErrorBanner';
import { Pagination } from '../components/Pagination';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';

type Ticket = {
  id: string;
  key: number;
  title: string;
  description?: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueAt?: string | null;
  category?: { id: string; name: string; color: string | null } | null;
  tags?: Array<{ id: string; name: string; color: string | null }>;
  createdAt: string;
  updatedAt: string;
  slaStatus?: 'on_time' | 'at_risk' | 'breached' | null;
  firstRespondedAt?: string | null;
  resolvedAt?: string | null;
  createdBy: { id: string; email: string; name: string | null };
  assignedTo: { id: string; email: string; name: string | null } | null;
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


export function TicketsPage() {
  const { has, me } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('');
  const [priority, setPriority] = useState<string>('');
  const [scope, setScope] = useState<'all' | 'mine' | 'unassigned' | 'closed'>('all');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20); // Sayfa boyutu sabit, gelecekte değiştirilebilir
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [openInfo, setOpenInfo] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<{
    status: string[];
    priority: string[];
    createdById: string[];
    assignedToId: string[];
    dateFrom: Date | null;
    dateTo: Date | null;
    q: string;
  }>({
    status: [],
    priority: [],
    createdById: [],
    assignedToId: [],
    dateFrom: null,
    dateTo: null,
    q: ''
  });

  // Kullanıcıları çek (filtreleme için)
  const { data: usersData } = useQuery({
    queryKey: ['admin', 'users'],
    enabled: has('user.read'),
    queryFn: () => apiFetch<{ users: Array<{ id: string; email: string; name: string | null }> }>('/api/admin/users')
  });

  const queryKey = useMemo(
    () => [
      'tickets',
      {
        q: advancedFilters.q || q,
        status: advancedFilters.status.length > 0 ? advancedFilters.status.join(',') : status,
        priority: advancedFilters.priority.length > 0 ? advancedFilters.priority.join(',') : priority,
        createdById: advancedFilters.createdById.join(','),
        assignedToId: advancedFilters.assignedToId.join(','),
        dateFrom: advancedFilters.dateFrom?.toISOString(),
        dateTo: advancedFilters.dateTo?.toISOString(),
        scope,
        page,
        pageSize
      }
    ],
    [q, status, priority, advancedFilters, scope, page, pageSize]
  );

  const queryFn = useCallback(async () => {
    const params = new URLSearchParams();
    const searchQ = advancedFilters.q || q;
    if (searchQ) params.set('q', searchQ);
    
    // Status filtreleme: scope'a göre
    if (scope === 'closed') {
      // Kapanmış ticket'lar için sadece CLOSED
      params.set('status', 'CLOSED');
    } else {
      // Diğer scope'lar için kapalı ticket'ları hariç tut
      if (advancedFilters.status.length > 0) {
        // Advanced filters'dan status varsa, CLOSED'ı çıkar
        const filteredStatus = advancedFilters.status.filter(s => s !== 'CLOSED');
        if (filteredStatus.length > 0) {
          params.set('status', filteredStatus.join(','));
        } else {
          // Eğer sadece CLOSED varsa, default status kullan
          params.set('status', 'OPEN,IN_PROGRESS,RESOLVED');
        }
      } else if (status && status !== 'CLOSED') {
        params.set('status', status);
      } else {
        // Varsayılan: Kapalı olmayan ticket'lar
        params.set('status', 'OPEN,IN_PROGRESS,RESOLVED');
      }
    }
    
    if (advancedFilters.priority.length > 0) {
      params.set('priority', advancedFilters.priority.join(','));
    } else if (priority) {
      params.set('priority', priority);
    }
    if (advancedFilters.createdById.length > 0) {
      params.set('createdById', advancedFilters.createdById.join(','));
    }
    if (advancedFilters.assignedToId.length > 0) {
      params.set('assignedToId', advancedFilters.assignedToId.join(','));
    }
    if (advancedFilters.dateFrom) {
      params.set('dateFrom', advancedFilters.dateFrom.toISOString());
    }
    if (advancedFilters.dateTo) {
      params.set('dateTo', advancedFilters.dateTo.toISOString());
    }
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    return apiFetch<{ tickets: Ticket[]; total: number; page: number; pageSize: number }>(`/api/tickets?${params}`);
  }, [q, status, priority, advancedFilters, scope, page, pageSize]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn,
    staleTime: 30_000 // 30s cache
  });

  const hasFilters = q || status || priority || advancedFilters.status.length > 0 || advancedFilters.priority.length > 0 || advancedFilters.createdById.length > 0 || advancedFilters.assignedToId.length > 0 || advancedFilters.dateFrom || advancedFilters.dateTo;

  const clearAllFilters = useCallback(() => {
    setQ('');
    setStatus('');
    setPriority('');
    setScope('all');
    setPage(1);
    setAdvancedFilters({
      status: [],
      priority: [],
      createdById: [],
      assignedToId: [],
      dateFrom: null,
      dateTo: null,
      q: ''
    });
  }, []);

  const chips = useMemo(() => {
    const out: Array<{ id: string; label: string; onRemove: () => void }> = [];

    if (scope === 'mine') out.push({ id: 'scope:mine', label: 'Bana Atanmışlar', onRemove: () => setScope('all') });
    if (scope === 'unassigned')
      out.push({ id: 'scope:unassigned', label: 'Atanmamış', onRemove: () => setScope('all') });
    if (scope === 'closed') out.push({ id: 'scope:closed', label: 'Kapanmış', onRemove: () => setScope('all') });

    const qVal = advancedFilters.q || q;
    if (qVal) out.push({ id: 'q', label: `Arama: ${qVal}`, onRemove: () => { setQ(''); setAdvancedFilters((s) => ({ ...s, q: '' })); } });

    const statusVal = advancedFilters.status.length > 0 ? advancedFilters.status.join(',') : status;
    if (statusVal) out.push({ id: 'status', label: `Durum: ${statusVal}`, onRemove: () => { setStatus(''); setAdvancedFilters((s) => ({ ...s, status: [] })); } });

    const priorityVal = advancedFilters.priority.length > 0 ? advancedFilters.priority.join(',') : priority;
    if (priorityVal) out.push({ id: 'priority', label: `Öncelik: ${priorityVal}`, onRemove: () => { setPriority(''); setAdvancedFilters((s) => ({ ...s, priority: [] })); } });

    if (advancedFilters.createdById.length > 0) {
      out.push({ id: 'createdBy', label: `Oluşturan: ${advancedFilters.createdById.length} kişi`, onRemove: () => setAdvancedFilters((s) => ({ ...s, createdById: [] })) });
    }
    if (advancedFilters.assignedToId.length > 0) {
      out.push({ id: 'assignedTo', label: `Atanan: ${advancedFilters.assignedToId.length} kişi`, onRemove: () => setAdvancedFilters((s) => ({ ...s, assignedToId: [] })) });
    }
    if (advancedFilters.dateFrom || advancedFilters.dateTo) {
      const from = advancedFilters.dateFrom ? advancedFilters.dateFrom.toLocaleDateString('tr-TR') : '—';
      const to = advancedFilters.dateTo ? advancedFilters.dateTo.toLocaleDateString('tr-TR') : '—';
      out.push({ id: 'date', label: `Tarih: ${from} → ${to}`, onRemove: () => setAdvancedFilters((s) => ({ ...s, dateFrom: null, dateTo: null })) });
    }

    return out;
  }, [advancedFilters, q, status, priority, scope]);

  const applySmartQuery = (raw: string) => {
    const parsed = parseTicketQuery(raw);

    // freeText -> q
    setQ(parsed.freeText);
    setAdvancedFilters((s) => ({ ...s, q: parsed.freeText }));

    // status/priority
    if (parsed.status) setAdvancedFilters((s) => ({ ...s, status: parsed.status ?? s.status }));
    if (parsed.priority) setAdvancedFilters((s) => ({ ...s, priority: parsed.priority ?? s.priority }));

    // createdBy
    if (parsed.createdBy) {
      if (parsed.createdBy === 'me' && me?.user?.id) {
        setAdvancedFilters((s) => ({ ...s, createdById: [me.user.id] }));
      } else if (Array.isArray(parsed.createdBy)) {
        setAdvancedFilters((s) => ({ ...s, createdById: parsed.createdBy as string[] }));
      }
    }

    // assignee/scope
    if (parsed.assignedTo) {
      if (parsed.assignedTo === 'me' && me?.user?.id) {
        setScope('mine');
        setAdvancedFilters((s) => ({ ...s, assignedToId: [me.user.id] }));
      } else if (parsed.assignedTo === 'unassigned') {
        setScope('unassigned');
        setAdvancedFilters((s) => ({ ...s, assignedToId: ['null'] }));
      } else if (Array.isArray(parsed.assignedTo)) {
        setScope('all');
        setAdvancedFilters((s) => ({ ...s, assignedToId: parsed.assignedTo as string[] }));
      }
    }

    // dates
    if (parsed.dateFrom || parsed.dateTo) {
      setAdvancedFilters((s) => ({
        ...s,
        dateFrom: parsed.dateFrom ?? s.dateFrom,
        dateTo: parsed.dateTo ?? s.dateTo
      }));
    }
  };




  return (
    <div className="space-y-6">
      <PageHeader
        title="Destek Talepleri"
        description="Tüm destek taleplerini görüntüleyin ve yönetin"
        actions={
          <>
            <Button variant="secondary" onClick={() => setOpenInfo(true)} title="Ticket Sistemi Bilgisi">
              <Info className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 overflow-auto">
            <button
              onClick={() => {
                setScope('all');
                setAdvancedFilters((s) => ({ ...s, assignedToId: [] }));
                  setPage(1);
              }}
              className={clsx(
                'px-3 py-1.5 rounded text-sm font-medium',
                scope === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              Tümü
            </button>
            <button
              onClick={() => {
                if (!me?.user?.id) return;
                setScope('mine');
                setAdvancedFilters((s) => ({ ...s, assignedToId: [me.user.id] }));
                  setPage(1);
              }}
              className={clsx(
                'px-3 py-1.5 rounded text-sm font-medium',
                scope === 'mine' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              )}
              disabled={!me?.user?.id}
            >
              Bana Atanmışlar
            </button>
            <button
              onClick={() => {
                setScope('unassigned');
                setAdvancedFilters((s) => ({ ...s, assignedToId: ['null'] }));
                  setPage(1);
              }}
              className={clsx(
                'px-3 py-1.5 rounded text-sm font-medium',
                scope === 'unassigned' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              Atanmamış
            </button>
            <button
              onClick={() => {
                setScope('closed');
                setAdvancedFilters((s) => ({ ...s, assignedToId: s.assignedToId }));
                setPage(1);
              }}
              className={clsx(
                'px-3 py-1.5 rounded text-sm font-medium',
                scope === 'closed' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              Kapanmış
            </button>
            </div>
            {has('ticket.create') && (
              <Link to="/tickets/new">
                <Button className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Yeni Talep
                </Button>
              </Link>
            )}
          </>
        }
      />

      <Card className="p-4">
        {/* Arama ve Aksiyonlar */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={advancedFilters.q || q}
              onChange={(e) => {
                setAdvancedFilters({ ...advancedFilters, q: e.target.value });
                setQ(e.target.value);
                setPage(1);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applySmartQuery((e.target as HTMLInputElement).value);
              }}
              placeholder="Ara (başlık, açıklama, ticket numarası)"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <Button
                variant="secondary"
                onClick={clearAllFilters}
                className="flex items-center gap-1 text-xs"
              >
                <X className="w-3 h-3" />
                Temizle
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              {showAdvancedFilters ? 'Filtreleri Gizle' : 'Daha Fazla'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => refetch()}
              className="flex items-center gap-2"
              aria-label="Yenile"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Sonuç Sayısı */}
        {data && (
          <div className="mb-4 text-sm text-slate-600 font-medium">
            {data.total} talep bulundu
          </div>
        )}
        {chips.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={c.onRemove}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                aria-label={`${c.label} filtresini kaldır`}
              >
                <span className="truncate max-w-[240px]">{c.label}</span>
                <X className="w-3 h-3 text-slate-400" />
              </button>
            ))}
          </div>
        )}
        {showAdvancedFilters && (
          <AdvancedFilters
            filters={advancedFilters}
            onChange={setAdvancedFilters}
            users={usersData?.users || []}
          />
        )}
      </Card>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </Card>
          ))}
        </div>
      )}

      {error && (
        <ErrorBanner message={(error as any)?.message ?? 'Bilinmeyen hata'} />
      )}

      {!isLoading && !error && data && data.tickets.length === 0 && (
        <EmptyState
          icon={TicketIcon}
          title={hasFilters ? 'Talep bulunamadı' : 'Henüz destek talebi yok'}
          description={
            hasFilters
              ? 'Arama kriterlerinize uygun talep bulunamadı. Filtreleri temizleyip tekrar deneyin.'
              : 'Sistemde henüz destek talebi oluşturulmamış. İlk talebi oluşturarak başlayabilirsiniz.'
          }
          actions={
            hasFilters
              ? [
                  {
                    label: 'Filtreleri Temizle',
                    onClick: clearAllFilters,
                    variant: 'secondary' as const
                  }
                ]
              : has('ticket.create')
                ? [
                    {
                      label: 'Yeni Talep Oluştur',
                      href: '/tickets/new'
                    }
                  ]
                : []
          }
          helpLinks={
            hasFilters
              ? []
              : [
                  {
                    label: 'Ticket oluşturma hakkında bilgi',
                    href: '/help/tickets',
                    external: false
                  }
                ]
          }
        />
      )}

      {!isLoading && !error && data && data.tickets.length > 0 && (
        <div className="space-y-3">
          {data.tickets.map((t) => {
            const getUserDisplayName = (name: string | null, email: string) => {
              return name || email.split('@')[0];
            };

            const formatDate = (dateString: string) => {
              const date = new Date(dateString);
              const now = new Date();
              const diffMs = now.getTime() - date.getTime();
              const diffMins = Math.floor(diffMs / 60000);
              const diffHours = Math.floor(diffMs / 3600000);
              const diffDays = Math.floor(diffMs / 86400000);

              if (diffMins < 1) return 'Az önce';
              if (diffMins < 60) return `${diffMins} dk önce`;
              if (diffHours < 24) return `${diffHours} saat önce`;
              if (diffDays < 7) return `${diffDays} gün önce`;
              return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
            };

            const getPriorityColor = (priority: string) => {
              switch (priority) {
                case 'URGENT': return 'bg-red-100 text-red-700 border-red-300';
                case 'HIGH': return 'bg-orange-100 text-orange-700 border-orange-300';
                case 'MEDIUM': return 'bg-blue-100 text-blue-700 border-blue-300';
                case 'LOW': return 'bg-slate-100 text-slate-700 border-slate-300';
                default: return 'bg-slate-100 text-slate-700 border-slate-300';
              }
            };

            return (
              <Card
                key={t.id}
                className="p-5 cursor-pointer transition-all hover:border-slate-400 hover:shadow-lg hover:-translate-y-0.5 group"
                onClick={() => navigate(`/tickets/${t.id}`)}
              >
                <div className="flex items-start gap-4">
                  {/* Ana içerik */}
                  <div className="flex-1 min-w-0">
                    {/* Üst satır - Ticket numarası ve badge'ler */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-400">#{t.key}</span>
                        <Badge variant={statusVariants[t.status]} className="text-xs px-2 py-0.5">
                          {statusLabels[t.status]}
                        </Badge>
                        <Badge 
                          variant="default"
                          className={clsx("text-xs px-2 py-0.5 border font-medium", getPriorityColor(t.priority))}
                        >
                          {priorityLabels[t.priority]}
                        </Badge>
                        {t.category && (
                          <Badge 
                            variant="default"
                            className="text-xs px-2 py-0.5 border"
                            style={t.category.color ? { 
                              backgroundColor: t.category.color + '15', 
                              color: t.category.color, 
                              borderColor: t.category.color + '40' 
                            } : undefined}
                          >
                            {t.category.name}
                          </Badge>
                        )}
                        {t.tags && t.tags.length > 0 && t.tags.slice(0, 2).map(tag => (
                          <Badge 
                            key={tag.id}
                            variant="default"
                            className="text-xs px-2 py-0.5 border bg-slate-50 text-slate-600 border-slate-200"
                          >
                            {tag.name}
                          </Badge>
                        ))}
                        {t.tags && t.tags.length > 2 && (
                          <Badge variant="default" className="text-xs px-2 py-0.5 border bg-slate-50 text-slate-600 border-slate-200">
                            +{t.tags.length - 2}
                          </Badge>
                        )}
                        {t.slaStatus === 'breached' && (
                          <Badge variant="danger" className="text-xs px-2 py-0.5 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            SLA İhlali
                          </Badge>
                        )}
                        {t.slaStatus === 'at_risk' && (
                          <Badge variant="warning" className="text-xs px-2 py-0.5 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            SLA Risk
                          </Badge>
                        )}
                        {t.slaStatus === 'on_time' && t.firstRespondedAt && (
                          <Badge variant="success" className="text-xs px-2 py-0.5 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            SLA Zamanında
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 group-hover:text-slate-600 transition-colors">
                        {formatDate(t.updatedAt)}
                      </div>
                    </div>

                    {/* Başlık */}
                    <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-slate-700 transition-colors">
                      {t.title}
                    </h3>

                    {/* Açıklama */}
                    {t.description && (
                      <p className="text-sm text-slate-600 line-clamp-2 mb-3">
                        {t.description}
                      </p>
                    )}

                    {/* Alt satır - Kullanıcı bilgileri ve ek bilgiler */}
                    <div className="flex items-center gap-4 pt-3 border-t border-slate-100 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-slate-700">
                            {getUserDisplayName(t.createdBy.name, t.createdBy.email)}
                          </span>
                          <span className="text-[10px] text-slate-500">Oluşturan</span>
                        </div>
                      </div>

                      {t.assignedTo && (
                        <>
                          <div className="w-px h-6 bg-slate-200" />
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-slate-700">
                                {getUserDisplayName(t.assignedTo.name, t.assignedTo.email)}
                              </span>
                              <span className="text-[10px] text-slate-500">Atanan</span>
                            </div>
                          </div>
                        </>
                      )}

                      {!t.assignedTo && (
                        <>
                          <div className="w-px h-6 bg-slate-200" />
                          <div className="flex items-center gap-1.5 text-xs text-amber-600">
                            <UserPlus className="w-3.5 h-3.5" />
                            <span className="font-medium">Atanmamış</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Sağ tarafta önemli bilgiler */}
                  <div className="flex flex-col items-end gap-2 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-xs text-slate-500">Oluşturulma</div>
                      <div className="text-xs font-medium text-slate-700">
                        {new Date(t.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                    {t.dueAt && (
                      <div className="flex flex-col items-end gap-1">
                        <div className="text-xs text-slate-500">Bitiş Tarihi</div>
                        <div className={clsx(
                          "text-xs font-medium",
                          new Date(t.dueAt) < new Date() ? "text-red-600" : "text-slate-700"
                        )}>
                          {new Date(t.dueAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}

          <Pagination
            page={page}
            pageSize={pageSize}
            total={data.total}
            onPageChange={(p) => setPage(p)}
            className="pt-2"
          />
        </div>
      )}

      {/* Bilgilendirme Modal */}
      <Modal title="Ticket Sistemi Bilgisi" open={openInfo} onClose={() => setOpenInfo(false)}>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              Ticket Sistemi Nasıl Çalışır?
            </h3>
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                Ticket sistemi, destek taleplerini yönetmenize olanak sağlar. Ticket'lar durum, öncelik, kategori ve etiketlerle organize edilir.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Ticket Durumları:</h4>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li><strong>Açık (OPEN):</strong> Yeni oluşturulmuş, henüz işleme alınmamış ticket</li>
                  <li><strong>İşlemde (IN_PROGRESS):</strong> Aktif olarak üzerinde çalışılan ticket</li>
                  <li><strong>Çözüldü (RESOLVED):</strong> Çözümü tamamlanmış, onay bekleyen ticket</li>
                  <li><strong>Kapalı (CLOSED):</strong> Tamamen kapatılmış, arşivlenmiş ticket</li>
                </ul>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">Öncelik Seviyeleri:</h4>
                <ul className="list-disc list-inside space-y-1 text-green-800">
                  <li><strong>Düşük (LOW):</strong> Rutin işlemler, normal hızda çözülebilir</li>
                  <li><strong>Orta (MEDIUM):</strong> Standart öncelik, normal sürede çözülür</li>
                  <li><strong>Yüksek (HIGH):</strong> Acil durumlar, öncelikli çözüm gerektirir</li>
                  <li><strong>Acil (URGENT):</strong> Kritik durumlar, derhal müdahale gerektirir</li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-start gap-3 mb-4">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Target className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-purple-900 mb-1 text-base">Service Level Agreement (SLA) Sistemi</h4>
                    <p className="text-sm text-purple-700">
                      SLA, her ticket için belirlenen yanıt ve çözüm sürelerini takip eder ve müşteri memnuniyetini ölçer.
                    </p>
                  </div>
                </div>

                {/* SLA Durumları */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="font-semibold text-green-900 text-sm">Zamanında (On Time)</span>
                    </div>
                    <p className="text-xs text-green-700">
                      Ticket, belirlenen süre içinde yanıtlandı veya çözüldü. SLA karşılanıyor.
                    </p>
                    <div className="mt-2 flex items-center gap-1">
                      <div className="h-1.5 flex-1 bg-green-200 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: '100%' }}></div>
                      </div>
                      <span className="text-xs font-medium text-green-700">100%</span>
                    </div>
                  </div>

                  <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="font-semibold text-amber-900 text-sm">Risk Altında (At Risk)</span>
                    </div>
                    <p className="text-xs text-amber-700">
                      SLA süresinin %80'inden fazlası kullanıldı. Dikkat gerektirir.
                    </p>
                    <div className="mt-2 flex items-center gap-1">
                      <div className="h-1.5 flex-1 bg-amber-200 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: '85%' }}></div>
                      </div>
                      <span className="text-xs font-medium text-amber-700">85%</span>
                    </div>
                  </div>

                  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <span className="font-semibold text-red-900 text-sm">İhlal Edildi (Breached)</span>
                    </div>
                    <p className="text-xs text-red-700">
                      SLA süresi aşıldı. Acil müdahale ve müşteri iletişimi gerekir.
                    </p>
                    <div className="mt-2 flex items-center gap-1">
                      <div className="h-1.5 flex-1 bg-red-200 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: '100%' }}></div>
                      </div>
                      <span className="text-xs font-medium text-red-700">100%+</span>
                    </div>
                  </div>
                </div>

                {/* SLA Metrikleri */}
                <div className="bg-white rounded-lg p-4 border border-purple-100 mb-4">
                  <h5 className="font-semibold text-slate-900 mb-3 text-sm flex items-center gap-2">
                    <Timer className="w-4 h-4 text-purple-600" />
                    SLA Metrikleri
                  </h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">İlk Yanıt Süresi</div>
                      <div className="text-sm font-semibold text-slate-900">Otomatik Hesaplanır</div>
                      <div className="text-xs text-slate-600 mt-1">
                        Ticket oluşturulduktan ilk yanıta kadar geçen süre (dakika)
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Çözüm Süresi</div>
                      <div className="text-sm font-semibold text-slate-900">Otomatik Hesaplanır</div>
                      <div className="text-xs text-slate-600 mt-1">
                        İlk yanıttan (veya oluşturulmadan) çözüme kadar geçen süre (saat)
                      </div>
                    </div>
                  </div>
                </div>

                {/* SLA Hesaplama Kriterleri */}
                <div className="bg-white rounded-lg p-4 border border-purple-100">
                  <h5 className="font-semibold text-slate-900 mb-3 text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-purple-600" />
                    SLA Hesaplama Önceliği
                  </h5>
                  <div className="space-y-2 text-xs text-slate-700">
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold">1</span>
                      <span><strong>Öncelik + Kategori:</strong> En spesifik SLA kuralı (örn: Acil + Teknik Destek)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold">2</span>
                      <span><strong>Sadece Kategori:</strong> Kategoriye özel genel SLA (örn: Teknik Destek)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold">3</span>
                      <span><strong>Sadece Öncelik:</strong> Önceliğe özel genel SLA (örn: Acil ticket'lar)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold">4</span>
                      <span><strong>Varsayılan:</strong> Hiçbir kural eşleşmezse varsayılan SLA değerleri kullanılır</span>
                    </div>
                  </div>
                </div>

                {/* Örnekler */}
                <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                  <h5 className="font-semibold text-blue-900 mb-2 text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-600" />
                    Örnek Senaryolar
                  </h5>
                  <div className="space-y-2 text-xs text-blue-800">
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      <span><strong>Acil + Teknik Destek:</strong> 60 dk ilk yanıt, 8 saat çözüm</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      <span><strong>Yüksek Öncelik:</strong> 4 saat ilk yanıt, 24 saat çözüm</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      <span><strong>Orta Öncelik:</strong> 12 saat ilk yanıt, 48 saat çözüm</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      <span><strong>Düşük Öncelik:</strong> 24 saat ilk yanıt, 72 saat çözüm</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <TicketIcon className="w-4 h-4 text-slate-600" />
                  Diğer Özellikler
                </h4>
                <ul className="list-disc list-inside space-y-1 text-slate-700 text-sm">
                  <li><strong>Gelişmiş Filtreleme:</strong> Durum, öncelik, kategori, tarih ve atama filtreleri</li>
                  <li><strong>Akıllı Arama:</strong> Başlık, açıklama ve ticket numarası ile arama</li>
                  <li><strong>Atama:</strong> Ticket'ları kullanıcılara atayabilirsiniz</li>
                  <li><strong>Kategori ve Etiketler:</strong> Ticket'ları organize etmek için kullanılır</li>
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



