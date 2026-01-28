import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { Card } from '../../components/Card';
import { useAuth } from '../../../lib/auth';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Textarea } from '../../components/Textarea';
import { HtmlEditor } from '../../components/HtmlEditor';
import { useMemo, useState, useEffect } from 'react';
import { Modal } from '../../components/Modal';
import { Badge } from '../../components/Badge';
import { useToast } from '../../components/Toast';
import { PageHeader } from '../../components/PageHeader';
import { Skeleton } from '../../components/Skeleton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Mail, Send, Settings, FileText, BarChart3, CheckCircle, XCircle, AlertCircle, Eye, FileCode, Info, Edit, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';

type EmailSettings = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  configured: boolean;
};

type EmailLog = {
  id: string;
  to: string;
  subject: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
  metadata?: { type?: string; [key: string]: any } | null;
  user?: { id: string; email: string; name: string | null } | null;
};

type EmailStats = {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  successRate: string;
};

type EmailTemplate = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  subject: string;
  html: string;
  text: string | null;
  variables: Record<string, string> | null;
  isActive: boolean;
  isSystem: boolean;
  updatedAt: string;
  createdAt: string;
  updatedBy?: { id: string; email: string; name: string | null } | null;
};

export function EmailPage() {
  const { has } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const canReadSettings = has('email.settings.read');
  const canManageSettings = has('email.settings.manage');
  const canSendTest = has('email.send');
  const canReadLogs = has('email.logs.read');

  const [showTestModal, setShowTestModal] = useState(false);
  const [showLogDetail, setShowLogDetail] = useState<EmailLog | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'logs' | 'stats' | 'templates'>('settings');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING' | 'SENT' | 'FAILED'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'ticket' | 'password-reset' | 'password-changed' | 'account-lockout' | 'test' | 'other'>('all');
  const [page, setPage] = useState(1);

  // Template edit state
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    code: '',
    name: '',
    description: '',
    subject: '',
    html: '',
    text: '',
    variables: {} as Record<string, string>
  });
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [confirmDeleteTemplate, setConfirmDeleteTemplate] = useState<EmailTemplate | null>(null);
  const [showVariablesModal, setShowVariablesModal] = useState(false);
  const [variablesForm, setVariablesForm] = useState<Record<string, string>>({});

  // Test email form
  const [testEmail, setTestEmail] = useState('');
  const [testSubject, setTestSubject] = useState('Test Email');
  const [testBody, setTestBody] = useState('<p>Bu bir test emailidir.</p>');

  // Settings form
  const [enabled, setEnabled] = useState(false);
  const [host, setHost] = useState('');
  const [port, setPort] = useState(587);
  const [secure, setSecure] = useState(false);
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [from, setFrom] = useState('');
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ['email', 'settings'],
    enabled: canReadSettings,
    queryFn: () => apiFetch<EmailSettings>('/api/email/settings')
  });

  // Settings yüklendiğinde form'u doldur
  useEffect(() => {
    if (settingsQuery.data && !settingsLoaded) {
      if (settingsQuery.data.configured) {
        setEnabled(settingsQuery.data.enabled);
        setHost(settingsQuery.data.host);
        setPort(settingsQuery.data.port);
        setSecure(settingsQuery.data.secure);
        setUser(settingsQuery.data.user);
        setFrom(settingsQuery.data.from);
        setSettingsLoaded(true);
      } else {
        // Ayarlar yoksa default değerleri kullan
        setEnabled(false);
        setHost('');
        setPort(587);
        setSecure(false);
        setUser('');
        setFrom('');
        setSettingsLoaded(true);
      }
    }
  }, [settingsQuery.data]);

  const logsQuery = useQuery({
    queryKey: ['email', 'logs', page, statusFilter, typeFilter, search],
    enabled: canReadLogs && activeTab === 'logs',
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('pageSize', '20');
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (typeFilter !== 'all') {
        params.set('type', typeFilter);
      }
      if (search && search.trim()) {
        params.set('to', search.trim());
      }
      return apiFetch<{ page: number; pageSize: number; total: number; logs: EmailLog[] }>(
        `/api/email/logs?${params.toString()}`
      );
    }
  });

  const statsQuery = useQuery({
    queryKey: ['email', 'stats'],
    enabled: canReadLogs && activeTab === 'stats',
    queryFn: () => apiFetch<EmailStats>('/api/email/stats')
  });

  // Email değişkenleri query
  const variablesQuery = useQuery<{ variables: Record<string, string>; globalVariables: Record<string, string> }>({
    queryKey: ['email', 'variables'],
    enabled: canReadSettings && activeTab === 'templates',
    queryFn: () => apiFetch('/api/email/variables')
  });

  const templatesQuery = useQuery({
    queryKey: ['email', 'templates'],
    enabled: canReadSettings, // Her zaman yükle, aktif tab kontrolünü kaldırdık
    queryFn: () => apiFetch<{ templates: EmailTemplate[] }>('/api/email/templates')
  });

  const testConnectionM = useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean; message?: string }>('/api/email/settings/test', {
        method: 'POST',
        json: { host, port, secure, user, password, from }
      }),
    onSuccess: (data) => {
      if (data.success) {
        toast.push({ type: 'success', title: 'Başarılı', description: data.message || 'SMTP bağlantısı başarılı' });
      } else {
        toast.push({ type: 'error', title: 'Hata', description: data.message || 'SMTP bağlantısı başarısız' });
      }
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message || 'Bağlantı test edilemedi' });
    }
  });

  const saveSettingsM = useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean }>('/api/email/settings', {
        method: 'PUT',
        json: { enabled, host, port, secure, user, password, from }
      }),
    onSuccess: async () => {
      toast.push({ type: 'success', title: 'Ayarlar kaydedildi' });
      await qc.invalidateQueries({ queryKey: ['email', 'settings'] });
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message });
    }
  });

  const sendTestEmailM = useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean; message?: string; messageId?: string }>('/api/email/test', {
        method: 'POST',
        json: { to: testEmail, subject: testSubject, body: testBody }
      }),
    onSuccess: (data) => {
      if (data.success) {
        toast.push({ type: 'success', title: 'Test emaili gönderildi', description: data.messageId });
        setShowTestModal(false);
        setTestEmail('');
        setTestSubject('Test Email');
        setTestBody('<p>Bu bir test emailidir.</p>');
        qc.invalidateQueries({ queryKey: ['email', 'logs'] });
      } else {
        toast.push({ type: 'error', title: 'Hata', description: data.message || 'Email gönderilemedi' });
      }
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message });
    }
  });

  const filteredLogs = useMemo(() => {
    let logs = logsQuery.data?.logs || [];
    
    // Type filter
    if (typeFilter !== 'all') {
      logs = logs.filter((log) => {
        const logType = log.metadata?.type;
        if (typeFilter === 'other') {
          return !logType || !['ticket', 'password-reset', 'password-changed', 'account-lockout', 'test'].includes(logType);
        }
        return logType === typeFilter;
      });
    }
    
    // Search filter
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      logs = logs.filter((log) => 
        log.to.toLowerCase().includes(needle) ||
        log.subject.toLowerCase().includes(needle) ||
        (log.metadata?.type && log.metadata.type.toLowerCase().includes(needle))
      );
    }
    
    return logs;
  }, [logsQuery.data, typeFilter, search]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SENT':
        return <Badge variant="success">Gönderildi</Badge>;
      case 'FAILED':
        return <Badge variant="danger">Başarısız</Badge>;
      case 'PENDING':
        return <Badge variant="warning">Bekliyor</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getEmailTypeBadge = (log: EmailLog) => {
    const type = log.metadata?.type;
    if (!type) {
      return <Badge variant="default">Diğer</Badge>;
    }
    switch (type) {
      case 'ticket':
        return <Badge variant="default" className="bg-blue-100 text-blue-700 border-blue-200">Ticket</Badge>;
      case 'password-reset':
        return <Badge variant="default" className="bg-orange-100 text-orange-700 border-orange-200">Şifre Sıfırlama</Badge>;
      case 'password-changed':
        return <Badge variant="default" className="bg-green-100 text-green-700 border-green-200">Şifre Güncellenme</Badge>;
      case 'account-lockout':
        return <Badge variant="default" className="bg-red-100 text-red-700 border-red-200">Hesap Kilitleme</Badge>;
      case 'test':
        return <Badge variant="default" className="bg-purple-100 text-purple-700 border-purple-200">Test</Badge>;
      default:
        return <Badge variant="default">Diğer</Badge>;
    }
  };

  // Template mutations
  const createTemplateM = useMutation({
    mutationFn: () =>
      apiFetch<{ template: EmailTemplate }>('/api/email/templates', {
        method: 'POST',
        json: templateForm
      }),
    onSuccess: async () => {
      toast.push({ type: 'success', title: 'Şablon oluşturuldu' });
      setShowCreateTemplate(false);
      setTemplateForm({ code: '', name: '', description: '', subject: '', html: '', text: '', variables: {} });
      await qc.invalidateQueries({ queryKey: ['email', 'templates'] });
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message });
    }
  });

  const updateTemplateM = useMutation({
    mutationFn: (code: string) =>
      apiFetch<{ template: EmailTemplate }>(`/api/email/templates/${code}`, {
        method: 'PUT',
        json: {
          name: templateForm.name,
          description: templateForm.description || null,
          subject: templateForm.subject,
          html: templateForm.html,
          text: templateForm.text || null,
          variables: Object.keys(templateForm.variables).length > 0 ? templateForm.variables : null
        }
      }),
    onSuccess: async () => {
      toast.push({ type: 'success', title: 'Şablon güncellendi' });
      setEditingTemplate(null);
      setTemplateForm({ code: '', name: '', description: '', subject: '', html: '', text: '', variables: {} });
      await qc.invalidateQueries({ queryKey: ['email', 'templates'] });
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message });
    }
  });

  const deleteTemplateM = useMutation({
    mutationFn: (code: string) => apiFetch(`/api/email/templates/${code}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.push({ type: 'success', title: 'Şablon silindi' });
      setConfirmDeleteTemplate(null);
      await qc.invalidateQueries({ queryKey: ['email', 'templates'] });
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message });
    }
  });

  // Variables mutation
  const updateVariablesM = useMutation({
    mutationFn: (variables: Record<string, string>) =>
      apiFetch('/api/email/variables', {
        method: 'PUT',
        json: { variables }
      }),
    onSuccess: async () => {
      toast.push({ type: 'success', title: 'Değişkenler güncellendi' });
      setShowVariablesModal(false);
      await qc.invalidateQueries({ queryKey: ['email', 'variables'] });
      await qc.invalidateQueries({ queryKey: ['email', 'templates'] });
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message });
    }
  });

  const handleEditTemplate = (template: EmailTemplate) => {
    setTemplateForm({
      code: template.code,
      name: template.name,
      description: template.description || '',
      subject: template.subject,
      html: template.html,
      text: template.text || '',
      variables: template.variables || {}
    });
    setEditingTemplate(template);
  };

  const handleCreateTemplate = () => {
    setTemplateForm({ code: '', name: '', description: '', subject: '', html: '', text: '', variables: {} });
    setShowCreateTemplate(true);
  };

  if (!canReadSettings && !canReadLogs) {
    return (
      <div className="p-6">
        <Card className="p-6 text-center">
          <p className="text-slate-600">Email yönetimine erişim yetkiniz bulunmamaktadır.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Email Yönetimi"
        description="Email SMTP ayarları, test gönderme ve log yönetimi"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowInfoModal(true)}>
              <Info className="w-4 h-4 mr-2" />
              Bilgi
            </Button>
            {canSendTest && (
              <Button variant="secondary" onClick={() => setShowTestModal(true)}>
                <Send className="w-4 h-4 mr-2" />
                Test Email Gönder
              </Button>
            )}
          </>
        }
      />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {canReadSettings && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={clsx(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'settings'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              Ayarlar
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('templates')}
              className={clsx(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'templates'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              <FileCode className="w-4 h-4 inline mr-2" />
              Şablonlar
            </button>
          </>
        )}
        {canReadLogs && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={clsx(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'logs'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Loglar
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stats')}
              className={clsx(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'stats'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              İstatistikler
            </button>
          </>
        )}
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && canReadSettings && (
        <Card className="p-6">
          {settingsQuery.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">SMTP Ayarları</h3>
                {settingsQuery.data?.configured && (
                  <Badge variant={settingsQuery.data.enabled ? 'success' : 'default'}>
                    {settingsQuery.data.enabled ? 'Aktif' : 'Pasif'}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Aktif
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                      disabled={!canManageSettings}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-600">Email servisini aktif et</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    SMTP Host
                  </label>
                  <Input
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                    disabled={!canManageSettings}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Port
                  </label>
                  <Input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(parseInt(e.target.value) || 587)}
                    placeholder="587"
                    disabled={!canManageSettings}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Güvenli Bağlantı (TLS/SSL)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={secure}
                      onChange={(e) => setSecure(e.target.checked)}
                      disabled={!canManageSettings}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-600">SSL/TLS kullan</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Kullanıcı Adı
                  </label>
                  <Input
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="user@example.com"
                    disabled={!canManageSettings}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Şifre
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={!canManageSettings}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Gönderen Email
                  </label>
                  <Input
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    placeholder="Name <email@example.com> veya email@example.com"
                    disabled={!canManageSettings}
                  />
                </div>
              </div>

              {canManageSettings && (
                <div className="flex gap-2 pt-4 border-t border-slate-200">
                  <Button
                    variant="secondary"
                    onClick={() => testConnectionM.mutate()}
                    disabled={testConnectionM.isPending}
                  >
                    {testConnectionM.isPending ? 'Test ediliyor...' : 'Bağlantıyı Test Et'}
                  </Button>
                  <Button onClick={() => saveSettingsM.mutate()} disabled={saveSettingsM.isPending}>
                    {saveSettingsM.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && canReadLogs && (
        <div className="space-y-4">
          {/* Filters */}
          <Card className="p-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-2">Ara (Email)</label>
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Email adresi..."
                />
              </div>
              <div className="w-48">
                <label className="block text-sm font-medium text-slate-700 mb-2">Durum</label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as any);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
                >
                  <option value="all">Tümü</option>
                  <option value="PENDING">Bekliyor</option>
                  <option value="SENT">Gönderildi</option>
                  <option value="FAILED">Başarısız</option>
                </select>
              </div>
              <div className="w-48">
                <label className="block text-sm font-medium text-slate-700 mb-2">Email Tipi</label>
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value as any);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
                >
                  <option value="all">Tümü</option>
                  <option value="ticket">Ticket</option>
                  <option value="password-reset">Şifre Sıfırlama</option>
                  <option value="password-changed">Şifre Güncellenme</option>
                  <option value="account-lockout">Hesap Kilitleme</option>
                  <option value="test">Test</option>
                  <option value="other">Diğer</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Logs List */}
          {logsQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : logsQuery.error ? (
            <Card className="p-6 text-center text-red-600">Loglar yüklenirken bir hata oluştu.</Card>
          ) : filteredLogs.length === 0 ? (
            <Card className="p-12 text-center">
              <Mail className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Log bulunamadı</h3>
              <p className="text-sm text-slate-500">Henüz email gönderilmemiş veya filtre kriterlerinize uygun log yok.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <Card key={log.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-slate-900">{log.to}</span>
                        {getStatusBadge(log.status)}
                        {getEmailTypeBadge(log)}
                      </div>
                      <p className="text-sm text-slate-700 mb-1">{log.subject}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Oluşturulma: {new Date(log.createdAt).toLocaleString('tr-TR')}</span>
                        {log.sentAt && <span>Gönderilme: {new Date(log.sentAt).toLocaleString('tr-TR')}</span>}
                        {log.user && <span>Gönderen: {log.user.name || log.user.email}</span>}
                      </div>
                      {log.errorMessage && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                          <AlertCircle className="w-3 h-3 inline mr-1" />
                          {log.errorMessage}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowLogDetail(log)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}

              {/* Pagination */}
              {logsQuery.data && logsQuery.data.total > 20 && (
                <div className="flex items-center justify-between pt-4">
                  <div className="text-sm text-slate-600">
                    Toplam {logsQuery.data.total} log, sayfa {page} / {Math.ceil(logsQuery.data.total / 20)}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Önceki
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= Math.ceil(logsQuery.data.total / 20)}
                    >
                      Sonraki
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && canReadLogs && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {statsQuery.isLoading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </>
          ) : statsQuery.error ? (
            <Card className="p-6 text-center text-red-600 md:col-span-4">İstatistikler yüklenirken bir hata oluştu.</Card>
          ) : statsQuery.data ? (
            <>
              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">Toplam</span>
                  <Mail className="w-5 h-5 text-slate-400" />
                </div>
                <div className="text-3xl font-bold text-slate-900">{statsQuery.data.total}</div>
              </Card>
              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">Gönderildi</span>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-3xl font-bold text-green-600">{statsQuery.data.sent}</div>
              </Card>
              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">Başarısız</span>
                  <XCircle className="w-5 h-5 text-red-500" />
                </div>
                <div className="text-3xl font-bold text-red-600">{statsQuery.data.failed}</div>
              </Card>
              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">Başarı Oranı</span>
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-3xl font-bold text-blue-600">%{statsQuery.data.successRate}</div>
              </Card>
            </>
          ) : null}
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && canReadSettings && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-slate-900">
              Email Şablonları
              {templatesQuery.data?.templates && (
                <span className="text-sm font-normal text-slate-500 ml-2">
                  ({templatesQuery.data.templates.length} şablon)
                </span>
              )}
            </h3>
            {canManageSettings && (
              <div className="flex items-center gap-2">
                <Button 
                  variant="secondary" 
                  onClick={() => {
                    if (variablesQuery.data) {
                      setVariablesForm(variablesQuery.data.globalVariables || {});
                      setShowVariablesModal(true);
                    }
                  }}
                  disabled={!variablesQuery.data}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Değişkenleri Ayarla
                </Button>
                <Button onClick={handleCreateTemplate}>
                  <Plus className="w-4 h-4 mr-2" />
                  Yeni Şablon
                </Button>
              </div>
            )}
          </div>

          {templatesQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : templatesQuery.error ? (
            <Card className="p-6 text-center text-red-600">Şablonlar yüklenirken bir hata oluştu.</Card>
          ) : templatesQuery.data?.templates.length === 0 ? (
            <Card className="p-12 text-center">
              <FileCode className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Şablon bulunamadı</h3>
              <p className="text-sm text-slate-500 mb-4">Henüz email şablonu oluşturulmamış.</p>
              {canManageSettings && (
                <Button onClick={handleCreateTemplate}>
                  <Plus className="w-4 h-4 mr-2" />
                  İlk Şablonu Oluştur
                </Button>
              )}
            </Card>
          ) : (
            <div className="space-y-3">
              {templatesQuery.data?.templates.map((template) => (
                <Card key={template.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <FileCode className="w-4 h-4 text-slate-400" />
                        <h3 className="font-semibold text-slate-900">{template.name}</h3>
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">{template.code}</code>
                        {template.isSystem && <Badge variant="default">Sistem</Badge>}
                        {template.isActive ? (
                          <Badge variant="success">Aktif</Badge>
                        ) : (
                          <Badge variant="default">Pasif</Badge>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-sm text-slate-600 mb-2">{template.description}</p>
                      )}
                      <p className="text-xs text-slate-500 mb-2">
                        <strong>Konu:</strong> {template.subject}
                      </p>
                      {template.variables && Object.keys(template.variables).length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-slate-700 mb-1">Kullanılabilir Değişkenler:</p>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(template.variables).map(([key, desc]) => (
                              <span key={key} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                {`{{${key}}}`} - {desc}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span>Güncelleme: {new Date(template.updatedAt).toLocaleDateString('tr-TR')}</span>
                        {template.updatedBy && (
                          <span>Güncelleyen: {template.updatedBy.name || template.updatedBy.email}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {canManageSettings ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleEditTemplate(template)}
                            title="Şablonu düzenle"
                          >
                            <Edit className="w-4 h-4 mr-1.5" />
                            <span className="text-xs">Düzenle</span>
                          </Button>
                          {!template.isSystem && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => setConfirmDeleteTemplate(template)}
                              title="Şablonu sil"
                            >
                              <Trash2 className="w-4 h-4 mr-1.5" />
                              <span className="text-xs">Sil</span>
                            </Button>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 py-2">Sadece görüntüleme</span>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Test Email Modal */}
      {showTestModal && (
        <Modal title="Test Email Gönder" open={showTestModal} onClose={() => setShowTestModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Alıcı Email</label>
              <Input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Konu</label>
              <Input value={testSubject} onChange={(e) => setTestSubject(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">İçerik (HTML)</label>
              <Textarea
                value={testBody}
                onChange={(e) => setTestBody(e.target.value)}
                rows={6}
                placeholder="<p>Email içeriği...</p>"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="secondary" onClick={() => setShowTestModal(false)}>
                İptal
              </Button>
              <Button onClick={() => sendTestEmailM.mutate()} disabled={sendTestEmailM.isPending || !testEmail}>
                {sendTestEmailM.isPending ? 'Gönderiliyor...' : 'Gönder'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Log Detail Modal */}
      {showLogDetail && (
        <Modal title="Email Log Detayı" open={!!showLogDetail} onClose={() => setShowLogDetail(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Alıcı</label>
              <p className="text-sm text-slate-900">{showLogDetail.to}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Konu</label>
              <p className="text-sm text-slate-900">{showLogDetail.subject}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Durum</label>
              <div>{getStatusBadge(showLogDetail.status)}</div>
            </div>
            {showLogDetail.errorMessage && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hata Mesajı</label>
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  {showLogDetail.errorMessage}
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Zamanlar</label>
              <div className="space-y-1 text-sm text-slate-600">
                <p>Oluşturulma: {new Date(showLogDetail.createdAt).toLocaleString('tr-TR')}</p>
                {showLogDetail.sentAt && <p>Gönderilme: {new Date(showLogDetail.sentAt).toLocaleString('tr-TR')}</p>}
              </div>
            </div>
            {showLogDetail.user && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Gönderen</label>
                <p className="text-sm text-slate-900">{showLogDetail.user.name || showLogDetail.user.email}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Variables Modal */}
      {showVariablesModal && variablesQuery.data && (
        <Modal 
          title="Email Değişkenlerini Ayarla" 
          open={showVariablesModal} 
          onClose={() => setShowVariablesModal(false)}
          className="max-w-4xl"
        >
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">Değişken Kullanımı:</p>
                  <p>Email şablonlarında değişkenleri <code className="bg-blue-100 px-1.5 py-0.5 rounded">{'{{variableName}}'}</code> formatında kullanabilirsiniz.</p>
                  <p className="mt-2">Sistem değişkenleri (year, companyName) düzenlenemez ancak kullanılabilir.</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {/* Sistem değişkenleri (sadece görüntüleme) */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Sistem Değişkenleri (Düzenlenemez)</h3>
                <div className="space-y-2">
                  {Object.entries(variablesQuery.data.variables)
                    .filter(([key]) => ['year', 'currentYear', 'companyName', 'company'].includes(key))
                    .map(([key, desc]) => (
                      <div key={key} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <code className="font-mono text-sm bg-white px-2 py-1 rounded border border-slate-300 flex-shrink-0">
                          {`{{${key}}}`}
                        </code>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-slate-900">{key}</div>
                          <div className="text-xs text-slate-600">{desc}</div>
                        </div>
                        <Badge variant="default" className="text-xs">Sistem</Badge>
                      </div>
                    ))}
                </div>
              </div>

              {/* Global değişkenler (düzenlenebilir) */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Global Değişkenler</h3>
                <div className="space-y-2">
                  {Object.entries(variablesForm).map(([key, desc], index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                      <code className="font-mono text-sm bg-slate-100 px-2 py-1 rounded border border-slate-300 flex-shrink-0">
                        {`{{${key}}}`}
                      </code>
                      <Input
                        value={key}
                        onChange={(e) => {
                          const newKey = e.target.value;
                          const newForm = { ...variablesForm };
                          delete newForm[key];
                          newForm[newKey] = desc;
                          setVariablesForm(newForm);
                        }}
                        placeholder="Değişken adı"
                        className="flex-shrink-0 w-40"
                      />
                      <Input
                        value={desc}
                        onChange={(e) => {
                          setVariablesForm({ ...variablesForm, [key]: e.target.value });
                        }}
                        placeholder="Açıklama"
                        className="flex-1"
                      />
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          const newForm = { ...variablesForm };
                          delete newForm[key];
                          setVariablesForm(newForm);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setVariablesForm({ ...variablesForm, '': '' });
                  }}
                  className="mt-2"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Yeni Değişken Ekle
                </Button>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button variant="secondary" onClick={() => setShowVariablesModal(false)}>
                İptal
              </Button>
              <Button 
                onClick={() => {
                  // Boş key'leri temizle
                  const cleaned = Object.fromEntries(
                    Object.entries(variablesForm).filter(([key, desc]) => key.trim() && desc.trim())
                  );
                  updateVariablesM.mutate(cleaned);
                }}
                disabled={updateVariablesM.isPending}
              >
                {updateVariablesM.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Template Create/Edit Modal */}
      {(showCreateTemplate || editingTemplate) && (
        <Modal 
          title={editingTemplate ? 'Şablonu Düzenle' : 'Yeni Şablon Oluştur'} 
          open={showCreateTemplate || !!editingTemplate}
          className="max-w-5xl"
          onClose={() => {
            setShowCreateTemplate(false);
            setEditingTemplate(null);
            setTemplateForm({ code: '', name: '', description: '', subject: '', html: '', text: '', variables: {} });
          }}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Kod</label>
              <Input
                value={templateForm.code}
                onChange={(e) => setTemplateForm({ ...templateForm, code: e.target.value })}
                placeholder="twoFactorCode"
                disabled={!!editingTemplate}
              />
              <p className="text-xs text-slate-500 mt-1">Benzersiz tanımlayıcı (değiştirilemez)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">İsim</label>
              <Input
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                placeholder="2FA Doğrulama Kodu"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Açıklama</label>
              <Textarea
                value={templateForm.description}
                onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                placeholder="İki faktörlü doğrulama kodu gönderimi için şablon"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Konu</label>
              <Input
                value={templateForm.subject}
                onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                placeholder="Doğrulama Kodunuz: {{code}}"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">HTML İçerik</label>
              <HtmlEditor
                value={templateForm.html}
                onChange={(html) => setTemplateForm({ ...templateForm, html })}
                placeholder="Email içeriğinizi buraya yazın..."
                variables={{
                  ...(variablesQuery.data?.variables || {}),
                  ...(templateForm.variables || {})
                }}
              />
              <p className="text-xs text-slate-500 mt-1">
                Değişkenler için <code className="bg-slate-100 px-1 rounded">{'{{variableName}}'}</code> formatını kullanın
              </p>
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button 
                variant="secondary" 
                onClick={() => {
                  setShowCreateTemplate(false);
                  setEditingTemplate(null);
                  setTemplateForm({ code: '', name: '', description: '', subject: '', html: '', text: '', variables: {} });
                }}
              >
                İptal
              </Button>
              <Button 
                onClick={() => editingTemplate ? updateTemplateM.mutate(editingTemplate.code) : createTemplateM.mutate()} 
                disabled={!templateForm.code || !templateForm.name || !templateForm.subject || !templateForm.html}
              >
                {editingTemplate ? 'Güncelle' : 'Oluştur'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <Modal title="Email Yönetimi Hakkında" open={showInfoModal} onClose={() => setShowInfoModal(false)}>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Info className="w-5 h-5" />
                Email Yönetimi Nedir?
              </h3>
              <p className="text-sm text-blue-800">
                Email yönetimi sayfası, sistemin email gönderme ayarlarını yapılandırmanıza, test email göndermenize, email loglarını görüntülemenize ve email şablonlarını yönetmenize olanak sağlar.
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
                    <p className="text-sm font-medium text-slate-900">SMTP Ayarları</p>
                    <p className="text-sm text-slate-600">Email göndermek için SMTP sunucu ayarlarını yapılandırabilirsiniz. Host, port, kullanıcı adı ve şifre bilgilerini buradan ayarlayabilirsiniz.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">2</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Test Email</p>
                    <p className="text-sm text-slate-600">SMTP ayarlarınızı test etmek için test email gönderebilirsiniz. Bu sayede email gönderiminin düzgün çalışıp çalışmadığını kontrol edebilirsiniz.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">3</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Email Logları</p>
                    <p className="text-sm text-slate-600">Gönderilen tüm emaillerin loglarını görüntüleyebilir, durumlarını kontrol edebilir ve hata mesajlarını inceleyebilirsiniz. Email tipine göre filtreleme yapabilirsiniz.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">4</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Email Şablonları</p>
                    <p className="text-sm text-slate-600">Sistem tarafından gönderilen emailler için HTML şablonları oluşturabilir ve düzenleyebilirsiniz. Değişkenler kullanarak dinamik içerik oluşturabilirsiniz.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">5</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Değişkenler</p>
                    <p className="text-sm text-slate-600">Email şablonlarında kullanabileceğiniz global değişkenleri yönetebilirsiniz. Sistem değişkenleri (yıl, şirket adı) otomatik olarak mevcuttur.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <Modal title="Email Yönetimi Hakkında" open={showInfoModal} onClose={() => setShowInfoModal(false)}>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Info className="w-5 h-5" />
                Email Yönetimi Nedir?
              </h3>
              <p className="text-sm text-blue-800">
                Email yönetimi sayfası, sistemin email gönderme ayarlarını yapılandırmanıza, test email göndermenize, email loglarını görüntülemenize ve email şablonlarını yönetmenize olanak sağlar.
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
                    <p className="text-sm font-medium text-slate-900">SMTP Ayarları</p>
                    <p className="text-sm text-slate-600">Email göndermek için SMTP sunucu ayarlarını yapılandırabilirsiniz. Host, port, kullanıcı adı ve şifre bilgilerini buradan ayarlayabilirsiniz.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">2</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Test Email</p>
                    <p className="text-sm text-slate-600">SMTP ayarlarınızı test etmek için test email gönderebilirsiniz. Bu sayede email gönderiminin düzgün çalışıp çalışmadığını kontrol edebilirsiniz.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">3</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Email Logları</p>
                    <p className="text-sm text-slate-600">Gönderilen tüm emaillerin loglarını görüntüleyebilir, durumlarını kontrol edebilir ve hata mesajlarını inceleyebilirsiniz. Email tipine göre filtreleme yapabilirsiniz.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">4</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Email Şablonları</p>
                    <p className="text-sm text-slate-600">Sistem tarafından gönderilen emailler için HTML şablonları oluşturabilir ve düzenleyebilirsiniz. Değişkenler kullanarak dinamik içerik oluşturabilirsiniz.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">5</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Değişkenler</p>
                    <p className="text-sm text-slate-600">Email şablonlarında kullanabileceğiniz global değişkenleri yönetebilirsiniz. Sistem değişkenleri (yıl, şirket adı) otomatik olarak mevcuttur.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Template Confirm Dialog */}
      {confirmDeleteTemplate && (
        <ConfirmDialog
          open={!!confirmDeleteTemplate}
          title="Şablonu Sil"
          description={`"${confirmDeleteTemplate.name}" şablonunu silmek istediğinize emin misiniz?`}
          danger
          confirmText="Sil"
          onConfirm={() => {
            if (confirmDeleteTemplate) {
              deleteTemplateM.mutate(confirmDeleteTemplate.code);
            }
          }}
          onClose={() => setConfirmDeleteTemplate(null)}
        />
      )}
    </div>
  );
}

