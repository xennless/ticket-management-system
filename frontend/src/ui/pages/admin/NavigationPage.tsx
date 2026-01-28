import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { FormField } from '../../components/FormField';
import { Modal } from '../../components/Modal';
import { Select } from '../../components/Select';
import { Skeleton } from '../../components/Skeleton';
import { PageHeader } from '../../components/PageHeader';
import { Badge } from '../../components/Badge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { IconPicker } from '../../components/IconPicker';
import { 
  Menu, 
  Plus, 
  Trash2, 
  Edit, 
  FolderOpen, 
  Link, 
  GripVertical,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Shield,
  ArrowUp,
  ArrowDown,
  Info
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useToast } from '../../components/Toast';
import clsx from 'clsx';

type NavSection = {
  id: string;
  code: string;
  name: string;
  icon: string | null;
  order: number;
  isActive: boolean;
  isCollapsible: boolean;
  defaultOpen: boolean;
  items: NavItem[];
  _count?: { items: number };
};

type NavItem = {
  id: string;
  code: string;
  name: string;
  path: string;
  icon: string | null;
  permission: string | null;
  order: number;
  isActive: boolean;
  sectionId: string | null;
  section?: { id: string; name: string } | null;
};

export function NavigationPage() {
  const { has } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const canManage = has('navigation.manage');
  const canRead = has('navigation.read');

  // Modals
  const [openSectionModal, setOpenSectionModal] = useState(false);
  const [openItemModal, setOpenItemModal] = useState(false);
  const [editingSection, setEditingSection] = useState<NavSection | null>(null);
  const [editingItem, setEditingItem] = useState<NavItem | null>(null);
  const [confirmDeleteSection, setConfirmDeleteSection] = useState<NavSection | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<NavItem | null>(null);
  const [openInfo, setOpenInfo] = useState(false);

  // Section form
  const [sectionCode, setSectionCode] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [sectionIcon, setSectionIcon] = useState('FolderCog');
  const [sectionCollapsible, setSectionCollapsible] = useState(true);
  const [sectionDefaultOpen, setSectionDefaultOpen] = useState(false);

  // Item form
  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemPath, setItemPath] = useState('');
  const [itemIcon, setItemIcon] = useState('Link');
  const [itemPermission, setItemPermission] = useState('');
  const [itemSectionId, setItemSectionId] = useState<string | null>(null);

  // Queries
  const sectionsQuery = useQuery<{ sections: NavSection[] }>({
    queryKey: ['nav-sections'],
    enabled: canRead || canManage,
    queryFn: () => apiFetch('/api/navigation/admin/sections')
  });

  const itemsQuery = useQuery<{ items: NavItem[] }>({
    queryKey: ['nav-items'],
    enabled: canRead || canManage,
    queryFn: () => apiFetch('/api/navigation/admin/items')
  });

  const permissionsQuery = useQuery<{ permissions: { id: string; code: string; name: string }[] }>({
    queryKey: ['admin', 'permissions'],
    enabled: canRead || canManage,
    queryFn: () => apiFetch('/api/admin/permissions')
  });

  const routesQuery = useQuery<{ routes: { path: string; name: string; description: string; suggestedPermission?: string }[] }>({
    queryKey: ['system-routes'],
    enabled: canRead || canManage,
    queryFn: () => apiFetch('/api/navigation/routes')
  });

  const systemRoutes = routesQuery.data?.routes || [];

  // Path'ten yetki kodu tahmin etme fonksiyonu - backend'den gelen suggestedPermission'ı kullan
  const getPermissionForPath = (path: string): string | null => {
    const route = systemRoutes.find(r => r.path === path);
    return route?.suggestedPermission || null;
  };

  // Mutations
  const createSectionM = useMutation({
    mutationFn: () => apiFetch('/api/navigation/admin/sections', {
      method: 'POST',
      json: {
        code: sectionCode,
        name: sectionName,
        icon: sectionIcon,
        isCollapsible: sectionCollapsible,
        defaultOpen: sectionDefaultOpen
      }
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nav-sections'] });
      qc.invalidateQueries({ queryKey: ['navigation'] });
      toast.push({ type: 'success', title: 'Bölüm oluşturuldu' });
      closeSectionModal();
    },
    onError: (err: any) => toast.push({ type: 'error', title: 'Hata', description: err?.message })
  });

  const updateSectionM = useMutation({
    mutationFn: (data: { id: string }) => apiFetch(`/api/navigation/admin/sections/${data.id}`, {
      method: 'PUT',
      json: {
        name: sectionName,
        icon: sectionIcon,
        isCollapsible: sectionCollapsible,
        defaultOpen: sectionDefaultOpen
      }
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nav-sections'] });
      qc.invalidateQueries({ queryKey: ['navigation'] });
      toast.push({ type: 'success', title: 'Bölüm güncellendi' });
      closeSectionModal();
    },
    onError: (err: any) => toast.push({ type: 'error', title: 'Hata', description: err?.message })
  });

  const deleteSectionM = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/navigation/admin/sections/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nav-sections'] });
      qc.invalidateQueries({ queryKey: ['nav-items'] });
      qc.invalidateQueries({ queryKey: ['navigation'] });
      toast.push({ type: 'success', title: 'Bölüm silindi' });
      setConfirmDeleteSection(null);
    },
    onError: (err: any) => toast.push({ type: 'error', title: 'Hata', description: err?.message })
  });

  const createItemM = useMutation({
    mutationFn: () => apiFetch('/api/navigation/admin/items', {
      method: 'POST',
      json: {
        code: itemCode,
        name: itemName,
        path: itemPath,
        icon: itemIcon,
        permission: itemPermission || null,
        sectionId: itemSectionId
      }
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nav-items'] });
      qc.invalidateQueries({ queryKey: ['nav-sections'] });
      qc.invalidateQueries({ queryKey: ['navigation'] });
      toast.push({ type: 'success', title: 'Öğe oluşturuldu' });
      closeItemModal();
    },
    onError: (err: any) => toast.push({ type: 'error', title: 'Hata', description: err?.message })
  });

  const updateItemM = useMutation({
    mutationFn: (data: { id: string }) => apiFetch(`/api/navigation/admin/items/${data.id}`, {
      method: 'PUT',
      json: {
        name: itemName,
        path: itemPath,
        icon: itemIcon,
        permission: itemPermission || null,
        sectionId: itemSectionId
      }
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nav-items'] });
      qc.invalidateQueries({ queryKey: ['nav-sections'] });
      qc.invalidateQueries({ queryKey: ['navigation'] });
      toast.push({ type: 'success', title: 'Öğe güncellendi' });
      closeItemModal();
    },
    onError: (err: any) => toast.push({ type: 'error', title: 'Hata', description: err?.message })
  });

  const deleteItemM = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/navigation/admin/items/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nav-items'] });
      qc.invalidateQueries({ queryKey: ['nav-sections'] });
      qc.invalidateQueries({ queryKey: ['navigation'] });
      toast.push({ type: 'success', title: 'Öğe silindi' });
      setConfirmDeleteItem(null);
    },
    onError: (err: any) => toast.push({ type: 'error', title: 'Hata', description: err?.message })
  });

  const toggleActiveM = useMutation({
    mutationFn: (data: { type: 'section' | 'item'; id: string; isActive: boolean }) => {
      const url = data.type === 'section' 
        ? `/api/navigation/admin/sections/${data.id}`
        : `/api/navigation/admin/items/${data.id}`;
      return apiFetch(url, { method: 'PUT', json: { isActive: data.isActive } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nav-sections'] });
      qc.invalidateQueries({ queryKey: ['nav-items'] });
      qc.invalidateQueries({ queryKey: ['navigation'] });
    }
  });

  // Sıralama değiştirme
  const reorderM = useMutation({
    mutationFn: (data: { type: 'section' | 'item'; id: string; order: number }) => {
      const url = data.type === 'section' 
        ? `/api/navigation/admin/sections/${data.id}`
        : `/api/navigation/admin/items/${data.id}`;
      return apiFetch(url, { method: 'PUT', json: { order: data.order } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nav-sections'] });
      qc.invalidateQueries({ queryKey: ['nav-items'] });
      qc.invalidateQueries({ queryKey: ['navigation'] });
    }
  });

  // Yukarı/Aşağı taşıma fonksiyonları
  const moveSection = (section: NavSection, direction: 'up' | 'down') => {
    const sorted = [...sections].sort((a, b) => a.order - b.order);
    const currentIndex = sorted.findIndex(s => s.id === section.id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    
    const targetSection = sorted[targetIndex];
    
    // Swap orders
    reorderM.mutate({ type: 'section', id: section.id, order: targetSection.order });
    reorderM.mutate({ type: 'section', id: targetSection.id, order: section.order });
  };

  const moveItem = (item: NavItem, direction: 'up' | 'down', itemsList: NavItem[]) => {
    const sorted = [...itemsList].sort((a, b) => a.order - b.order);
    const currentIndex = sorted.findIndex(i => i.id === item.id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    
    const targetItem = sorted[targetIndex];
    
    // Swap orders
    reorderM.mutate({ type: 'item', id: item.id, order: targetItem.order });
    reorderM.mutate({ type: 'item', id: targetItem.id, order: item.order });
  };

  // Helpers
  const closeSectionModal = () => {
    setOpenSectionModal(false);
    setEditingSection(null);
    setSectionCode('');
    setSectionName('');
    setSectionIcon('FolderCog');
    setSectionCollapsible(true);
    setSectionDefaultOpen(false);
  };

  const closeItemModal = () => {
    setOpenItemModal(false);
    setEditingItem(null);
    setItemCode('');
    setItemName('');
    setItemPath('');
    setItemIcon('Link');
    setItemPermission('');
    setItemSectionId(null);
  };

  const openEditSection = (section: NavSection) => {
    setEditingSection(section);
    setSectionCode(section.code);
    setSectionName(section.name);
    setSectionIcon(section.icon || 'FolderCog');
    setSectionCollapsible(section.isCollapsible);
    setSectionDefaultOpen(section.defaultOpen);
    setOpenSectionModal(true);
  };

  const openEditItem = (item: NavItem) => {
    setEditingItem(item);
    setItemCode(item.code);
    setItemName(item.name);
    setItemPath(item.path);
    setItemIcon(item.icon || 'Link');
    setItemPermission(item.permission || '');
    setItemSectionId(item.sectionId);
    setOpenItemModal(true);
  };

  // Standalone items (no section)
  const standaloneItems = useMemo(() => 
    (itemsQuery.data?.items || []).filter(i => !i.sectionId).sort((a, b) => a.order - b.order),
    [itemsQuery.data]
  );

  const sections = sectionsQuery.data?.sections || [];
  const permissions = permissionsQuery.data?.permissions || [];

  if (!canRead && !canManage) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title="Navigasyon Yönetimi" description="Yetkiniz yok" />
        <Card className="p-8 text-center text-slate-500">
          <Shield className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <div>Navigasyon görüntüleme yetkiniz yok.</div>
        </Card>
      </div>
    );
  }

  if (sectionsQuery.isLoading || itemsQuery.isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Navigasyon Yönetimi"
        description="Sidebar menü yapısını düzenleyin"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setOpenInfo(true)} title="Navigasyon Bilgisi">
              <Info className="w-4 h-4" />
            </Button>
            <Button variant="secondary" onClick={() => setOpenSectionModal(true)}>
              <FolderOpen className="w-4 h-4 mr-2" />
              Yeni Bölüm
            </Button>
            <Button onClick={() => setOpenItemModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Yeni Öğe
            </Button>
          </div>
        }
      />

      {/* Bilgi */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Menu className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <div className="font-medium text-blue-900">Navigasyon Yapısı</div>
            <div className="text-sm text-blue-700 mt-1">
              Bölümler (sections) açılır kapanır menü gruplarıdır. Öğeler (items) ise menü linkleridir.
              Bir öğe bir bölüme bağlı olabilir veya ana menüde bağımsız görünebilir.
            </div>
          </div>
        </div>
      </Card>

      {/* Ana Menü Öğeleri */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Ana Menü</h2>
        <div className="space-y-2">
          {standaloneItems.map((item, index) => (
            <Card key={item.id} className={clsx('p-4', !item.isActive && 'opacity-50')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Sıralama Butonları */}
                  {canManage && (
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveItem(item, 'up', standaloneItems)}
                        disabled={index === 0 || reorderM.isPending}
                        className={clsx(
                          'p-0.5 rounded hover:bg-slate-200 transition-colors',
                          index === 0 && 'opacity-30 cursor-not-allowed'
                        )}
                        title="Yukarı Taşı"
                      >
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                      </button>
                      <button
                        onClick={() => moveItem(item, 'down', standaloneItems)}
                        disabled={index === standaloneItems.length - 1 || reorderM.isPending}
                        className={clsx(
                          'p-0.5 rounded hover:bg-slate-200 transition-colors',
                          index === standaloneItems.length - 1 && 'opacity-30 cursor-not-allowed'
                        )}
                        title="Aşağı Taşı"
                      >
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      </button>
                    </div>
                  )}
                  <span className="text-xs text-slate-400 w-6 text-center">{item.order}</span>
                  <Link className="w-4 h-4 text-slate-400" />
                  <div>
                    <div className="font-medium text-slate-900">{item.name}</div>
                    <div className="text-xs text-slate-500">{item.path}</div>
                  </div>
                  {item.permission && (
                    <Badge variant="info" className="text-[10px]">{item.permission}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canManage && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => toggleActiveM.mutate({ type: 'item', id: item.id, isActive: !item.isActive })}
                      >
                        {item.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => openEditItem(item)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setConfirmDeleteItem(item)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
          {standaloneItems.length === 0 && (
            <Card className="p-4 text-center text-slate-500 text-sm">
              Ana menüde bağımsız öğe yok
            </Card>
          )}
        </div>
      </div>

      {/* Bölümler */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Bölümler</h2>
        <div className="space-y-4">
          {sections.sort((a, b) => a.order - b.order).map((section, sectionIndex) => (
            <Card key={section.id} className={clsx('p-4', !section.isActive && 'opacity-50')}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {/* Bölüm Sıralama Butonları */}
                  {canManage && (
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveSection(section, 'up')}
                        disabled={sectionIndex === 0 || reorderM.isPending}
                        className={clsx(
                          'p-0.5 rounded hover:bg-slate-200 transition-colors',
                          sectionIndex === 0 && 'opacity-30 cursor-not-allowed'
                        )}
                        title="Yukarı Taşı"
                      >
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                      </button>
                      <button
                        onClick={() => moveSection(section, 'down')}
                        disabled={sectionIndex === sections.length - 1 || reorderM.isPending}
                        className={clsx(
                          'p-0.5 rounded hover:bg-slate-200 transition-colors',
                          sectionIndex === sections.length - 1 && 'opacity-30 cursor-not-allowed'
                        )}
                        title="Aşağı Taşı"
                      >
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      </button>
                    </div>
                  )}
                  <span className="text-xs text-slate-400 w-6 text-center">{section.order}</span>
                  <FolderOpen className="w-5 h-5 text-slate-500" />
                  <div>
                    <div className="font-semibold text-slate-900">{section.name}</div>
                    <div className="text-xs text-slate-500">
                      {section.items.length} öğe • {section.isCollapsible ? 'Açılır/Kapanır' : 'Sabit'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canManage && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => toggleActiveM.mutate({ type: 'section', id: section.id, isActive: !section.isActive })}
                      >
                        {section.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => openEditSection(section)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setConfirmDeleteSection(section)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              
              {/* Section Items */}
              <div className="ml-8 space-y-2">
                {section.items.sort((a, b) => a.order - b.order).map((item, itemIndex) => {
                  const sortedItems = section.items.sort((a, b) => a.order - b.order);
                  return (
                  <div 
                    key={item.id} 
                    className={clsx(
                      'flex items-center justify-between p-2 rounded-lg bg-slate-50',
                      !item.isActive && 'opacity-50'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {/* Öğe Sıralama Butonları */}
                      {canManage && (
                        <div className="flex gap-0.5">
                          <button
                            onClick={() => moveItem(item, 'up', sortedItems)}
                            disabled={itemIndex === 0 || reorderM.isPending}
                            className={clsx(
                              'p-0.5 rounded hover:bg-slate-200 transition-colors',
                              itemIndex === 0 && 'opacity-30 cursor-not-allowed'
                            )}
                            title="Yukarı Taşı"
                          >
                            <ArrowUp className="w-3 h-3 text-slate-500" />
                          </button>
                          <button
                            onClick={() => moveItem(item, 'down', sortedItems)}
                            disabled={itemIndex === sortedItems.length - 1 || reorderM.isPending}
                            className={clsx(
                              'p-0.5 rounded hover:bg-slate-200 transition-colors',
                              itemIndex === sortedItems.length - 1 && 'opacity-30 cursor-not-allowed'
                            )}
                            title="Aşağı Taşı"
                          >
                            <ArrowDown className="w-3 h-3 text-slate-500" />
                          </button>
                        </div>
                      )}
                      <span className="text-[10px] text-slate-400 w-4 text-center">{item.order}</span>
                      <span className="text-sm text-slate-700">{item.name}</span>
                      <span className="text-xs text-slate-400">{item.path}</span>
                      {item.permission && (
                        <Badge variant="default" className="text-[10px]">{item.permission}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {canManage && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => toggleActiveM.mutate({ type: 'item', id: item.id, isActive: !item.isActive })}
                          >
                            {item.isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => openEditItem(item)}>
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => setConfirmDeleteItem(item)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  );
                })}
                {section.items.length === 0 && (
                  <div className="text-xs text-slate-400 p-2">Bu bölümde öğe yok</div>
                )}
              </div>
            </Card>
          ))}
          {sections.length === 0 && (
            <Card className="p-8 text-center text-slate-500">
              <FolderOpen className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <div>Henüz bölüm oluşturulmamış</div>
            </Card>
          )}
        </div>
      </div>

      {/* Section Modal */}
      <Modal 
        title={editingSection ? 'Bölümü Düzenle' : 'Yeni Bölüm'} 
        open={openSectionModal} 
        onClose={closeSectionModal}
      >
        <div className="space-y-4">
          {!editingSection && (
            <FormField label="Kod" hint="Benzersiz tanımlayıcı (örn: admin)">
              <Input 
                value={sectionCode} 
                onChange={(e) => setSectionCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} 
                placeholder="admin"
              />
            </FormField>
          )}
          <FormField label="Ad">
            <Input value={sectionName} onChange={(e) => setSectionName(e.target.value)} placeholder="Yönetim" />
          </FormField>
          <FormField label="İkon">
            <IconPicker
              value={sectionIcon}
              onChange={setSectionIcon}
            />
          </FormField>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={sectionCollapsible}
                onChange={(e) => setSectionCollapsible(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm">Açılır/Kapanır</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={sectionDefaultOpen}
                onChange={(e) => setSectionDefaultOpen(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm">Varsayılan Açık</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={closeSectionModal}>İptal</Button>
            <Button 
              onClick={() => editingSection 
                ? updateSectionM.mutate({ id: editingSection.id }) 
                : createSectionM.mutate()
              }
              disabled={!sectionName.trim() || (!editingSection && !sectionCode.trim())}
            >
              {editingSection ? 'Kaydet' : 'Oluştur'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Item Modal */}
      <Modal 
        title={editingItem ? 'Öğeyi Düzenle' : 'Yeni Öğe'} 
        open={openItemModal} 
        onClose={closeItemModal}
      >
        <div className="space-y-4">
          {!editingItem && (
            <FormField label="Kod" hint="Benzersiz tanımlayıcı (örn: dashboard)">
              <Input 
                value={itemCode} 
                onChange={(e) => setItemCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} 
                placeholder="dashboard"
              />
            </FormField>
          )}
          <FormField label="Sayfa (Path)" hint="Menü öğesinin yönlendireceği sayfa - Sistem route'larından seçin">
            <Select 
              value={itemPath} 
              onChange={(e) => {
                const selectedPath = e.target.value;
                const route = systemRoutes.find(r => r.path === selectedPath);
                setItemPath(selectedPath);
                
                // Otomatik olarak adı da doldur (eğer boşsa veya düzenleme modundaysa)
                if (route) {
                  if (!itemName || !editingItem) {
                    setItemName(route.name);
                  }
                  
                  // Otomatik olarak yetkiyi de öner (eğer boşsa veya düzenleme modundaysa)
                  const suggestedPermission = getPermissionForPath(selectedPath);
                  if (suggestedPermission && (!itemPermission || !editingItem)) {
                    setItemPermission(suggestedPermission);
                  }
                }
              }}
            >
              <option value="">Sayfa seçin...</option>
              {systemRoutes.map((route) => (
                <option key={route.path} value={route.path}>
                  {route.name} - {route.path}
                </option>
              ))}
            </Select>
            {itemPath && !systemRoutes.find(r => r.path === itemPath) && (
              <div className="text-xs text-slate-500 mt-1">
                Not: Bu path sistem route'larında yok. Manuel path girebilirsiniz.
              </div>
            )}
          </FormField>
          <FormField label="Görünen Ad" hint="Menüde gösterilecek isim">
            <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Dashboard" />
          </FormField>
          <FormField label="İkon">
            <IconPicker
              value={itemIcon}
              onChange={setItemIcon}
            />
          </FormField>
          <FormField label="Gerekli Yetki" hint="Boş bırakılırsa herkes görebilir - Sistem yetkilerinden seçin">
            <Select value={itemPermission} onChange={(e) => setItemPermission(e.target.value)}>
              <option value="">Yetki gerektirmez</option>
              {permissions
                .slice()
                .sort((a, b) => a.code.localeCompare(b.code))
                .map((p) => (
                  <option key={p.id} value={p.code}>
                    {p.name} ({p.code})
                  </option>
                ))}
            </Select>
            {itemPath && getPermissionForPath(itemPath) && (
              <div className="text-xs text-slate-500 mt-1">
                Önerilen yetki: <span className="font-medium">{getPermissionForPath(itemPath)}</span>
              </div>
            )}
          </FormField>
          <FormField label="Bölüm" hint="Hangi bölümün altında görünsün">
            <Select value={itemSectionId || ''} onChange={(e) => setItemSectionId(e.target.value || null)}>
              <option value="">Ana Menü (bağımsız)</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </FormField>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={closeItemModal}>İptal</Button>
            <Button 
              onClick={() => editingItem 
                ? updateItemM.mutate({ id: editingItem.id }) 
                : createItemM.mutate()
              }
              disabled={!itemName.trim() || !itemPath.trim() || (!editingItem && !itemCode.trim())}
            >
              {editingItem ? 'Kaydet' : 'Oluştur'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={!!confirmDeleteSection}
        title="Bölümü Sil"
        description={`"${confirmDeleteSection?.name}" bölümünü silmek istediğinize emin misiniz? İçindeki öğeler ana menüye taşınacaktır.`}
        danger
        confirmText="Sil"
        onClose={() => setConfirmDeleteSection(null)}
        onConfirm={() => { if (confirmDeleteSection) deleteSectionM.mutate(confirmDeleteSection.id); }}
      />

      <ConfirmDialog
        open={!!confirmDeleteItem}
        title="Öğeyi Sil"
        description={`"${confirmDeleteItem?.name}" öğesini silmek istediğinize emin misiniz?`}
        danger
        confirmText="Sil"
        onClose={() => setConfirmDeleteItem(null)}
        onConfirm={() => { if (confirmDeleteItem) deleteItemM.mutate(confirmDeleteItem.id); }}
      />

      {/* Bilgilendirme Modal */}
      <Modal title="Navigasyon Yönetimi Bilgisi" open={openInfo} onClose={() => setOpenInfo(false)}>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              Navigasyon Nasıl Çalışır?
            </h3>
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                Navigasyon yönetimi, sidebar menü yapısını dinamik olarak düzenlemenize olanak sağlar. Menü öğeleri ve bölümler oluşturarak kullanıcıların erişebileceği sayfaları kontrol edebilirsiniz.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Menü Yapısı:</h4>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li><strong>Bölümler (Sections):</strong> Açılır/kapanır menü grupları oluşturabilirsiniz</li>
                  <li><strong>Öğeler (Items):</strong> Tekil menü linklerini yönetebilirsiniz</li>
                  <li><strong>Sıralama:</strong> Menü öğelerini yukarı/aşağı taşıyarak sıralayabilirsiniz</li>
                  <li><strong>Yetki Kontrolü:</strong> Her öğe için gerekli yetkiyi belirleyebilirsiniz</li>
                  <li><strong>İkon Seçimi:</strong> Her öğe için görsel ikon seçebilirsiniz</li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">Önemli Notlar:</h4>
                <ul className="list-disc list-inside space-y-1 text-amber-800">
                  <li>Bölümler açılır/kapanır yapılandırılabilir veya sabit olabilir</li>
                  <li>Öğeler bölümler altında veya ana menüde bağımsız olarak görünebilir</li>
                  <li>Path seçimi sistem route'larından otomatik yapılır</li>
                  <li>Yetki belirtilmemiş öğeler tüm kullanıcılara görünür</li>
                  <li>Pasif öğeler menüde görünmez ancak doğrudan URL ile erişilebilir</li>
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

