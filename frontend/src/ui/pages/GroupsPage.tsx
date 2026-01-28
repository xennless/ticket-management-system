import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { FormField } from '../components/FormField';
import { Modal } from '../components/Modal';
import { Skeleton } from '../components/Skeleton';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/Badge';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { 
  Users, 
  Plus, 
  Trash2, 
  Crown, 
  UserPlus, 
  UserMinus, 
  Settings, 
  ChevronRight,
  User,
  Mail,
  Calendar,
  Edit,
  LogOut,
  Shield,
  Eye,
  Info
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useToast } from '../components/Toast';
import { ViewUserProfileModal } from '../components/ViewUserProfileModal';
import clsx from 'clsx';

type GroupMember = {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    isActive?: boolean;
  };
};

type Group = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  isActive: boolean;
  leaderId: string | null;
  leader: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  } | null;
  createdBy: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  createdAt: string;
  members: GroupMember[];
  _count: { members: number };
};

type UserOption = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

export function GroupsPage() {
  const { has, me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const canRead = has('group.read');
  const canManage = has('group.manage');

  // Modals
  const [openCreate, setOpenCreate] = useState(false);
  const [openDetail, setOpenDetail] = useState<Group | null>(null);
  const [openEdit, setOpenEdit] = useState<Group | null>(null);
  const [openAddMembers, setOpenAddMembers] = useState<Group | null>(null);
  const [openChangeLeader, setOpenChangeLeader] = useState<Group | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Group | null>(null);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<{ group: Group; member: GroupMember } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState<Group | null>(null);
  const [viewingProfileUserId, setViewingProfileUserId] = useState<string | null>(null);
  const [openInfo, setOpenInfo] = useState(false);

  // Form states - Create
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Form states - Edit
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState('');

  // Search
  const [userSearch, setUserSearch] = useState('');
  const [newLeaderId, setNewLeaderId] = useState('');

  // Queries
  const { data, isLoading } = useQuery<{ groups: Group[] }>({
    queryKey: ['groups'],
    enabled: canRead,
    queryFn: () => apiFetch('/api/groups')
  });

  const usersQuery = useQuery<{ users: UserOption[] }>({
    queryKey: ['admin', 'users'],
    enabled: canRead,
    queryFn: () => apiFetch('/api/admin/users')
  });

  // Mutations
  const createM = useMutation({
    mutationFn: () =>
      apiFetch('/api/groups', {
        method: 'POST',
        json: { 
          name, 
          description: description || undefined, 
          color: color || undefined,
          userIds: selectedUserIds.length > 0 ? selectedUserIds : undefined
        }
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      toast.push({ type: 'success', title: 'Grup oluşturuldu' });
      setOpenCreate(false);
      resetCreateForm();
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message });
    }
  });

  const updateM = useMutation({
    mutationFn: (data: { id: string; name: string; description: string; color: string }) =>
      apiFetch(`/api/groups/${data.id}`, {
        method: 'PUT',
        json: { name: data.name, description: data.description || null, color: data.color || null }
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      toast.push({ type: 'success', title: 'Grup güncellendi' });
      setOpenEdit(null);
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message });
    }
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/groups/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      toast.push({ type: 'success', title: 'Grup silindi' });
      setConfirmDelete(null);
      setOpenDetail(null);
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message });
    }
  });

  const addMembersM = useMutation({
    mutationFn: (data: { groupId: string; userIds: string[] }) =>
      apiFetch<{ group: Group }>(`/api/groups/${data.groupId}/members`, {
        method: 'POST',
        json: { userIds: data.userIds }
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      toast.push({ type: 'success', title: 'Üyeler eklendi' });
      setOpenAddMembers(null);
      setOpenDetail(res.group);
      setSelectedUserIds([]);
      setUserSearch('');
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message });
    }
  });

  const removeMemberM = useMutation({
    mutationFn: (data: { groupId: string; userId: string }) =>
      apiFetch<{ group: Group }>(`/api/groups/${data.groupId}/members/${data.userId}`, { method: 'DELETE' }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      toast.push({ type: 'success', title: 'Üye çıkarıldı' });
      setConfirmRemoveMember(null);
      setOpenDetail(res.group);
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message });
    }
  });

  const changeLeaderM = useMutation({
    mutationFn: (data: { groupId: string; leaderId: string }) =>
      apiFetch<{ group: Group }>(`/api/groups/${data.groupId}/leader`, {
        method: 'PUT',
        json: { leaderId: data.leaderId }
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      toast.push({ type: 'success', title: 'Lider değiştirildi' });
      setOpenChangeLeader(null);
      setOpenDetail(res.group);
      setNewLeaderId('');
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message });
    }
  });

  const leaveGroupM = useMutation({
    mutationFn: (groupId: string) =>
      apiFetch(`/api/groups/${groupId}/leave`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      toast.push({ type: 'success', title: 'Gruptan ayrıldınız' });
      setConfirmLeave(null);
      setOpenDetail(null);
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: 'Hata', description: err?.message });
    }
  });

  // Helpers
  const resetCreateForm = () => {
    setName('');
    setDescription('');
    setColor('#3b82f6');
    setSelectedUserIds([]);
  };

  const isLeader = (group: Group) => group.leaderId === me?.user.id;
  const isMember = (group: Group) => group.members.some(m => m.userId === me?.user.id);
  const canEditGroup = (group: Group) => canManage || isLeader(group);

  // Filter users not in group for add members
  const availableUsers = useMemo(() => {
    if (!openAddMembers || !usersQuery.data) return [];
    const memberIds = new Set(openAddMembers.members.map(m => m.userId));
    return usersQuery.data.users.filter(u => !memberIds.has(u.id));
  }, [openAddMembers, usersQuery.data]);

  const filteredAvailableUsers = useMemo(() => {
    if (!userSearch.trim()) return availableUsers;
    const search = userSearch.toLowerCase();
    return availableUsers.filter(u => 
      u.name?.toLowerCase().includes(search) || 
      u.email.toLowerCase().includes(search)
    );
  }, [availableUsers, userSearch]);

  // For create modal
  const allUsers = usersQuery.data?.users || [];
  const filteredAllUsers = useMemo(() => {
    if (!userSearch.trim()) return allUsers;
    const search = userSearch.toLowerCase();
    return allUsers.filter(u => 
      u.name?.toLowerCase().includes(search) || 
      u.email.toLowerCase().includes(search)
    );
  }, [allUsers, userSearch]);

  if (!canRead) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title="Tüm Gruplar (Admin)" description="Yetkiniz yok" />
        <Card className="p-8 text-center text-slate-500">
          <Shield className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <div>Tüm grupları görüntüleme yetkiniz yok.</div>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  const groups = data?.groups || [];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Tüm Gruplar (Admin)"
        description={`Sistemdeki tüm gruplar (${groups.length} grup)`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setOpenInfo(true)} title="Grup Yönetimi Bilgisi">
              <Info className="w-4 h-4" />
            </Button>
            {canManage && (
              <Button onClick={() => setOpenCreate(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Yeni Grup
              </Button>
            )}
          </div>
        }
      />

      {groups.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <div className="text-slate-500">Henüz grup yok.</div>
          {canManage && (
            <Button className="mt-4" onClick={() => setOpenCreate(true)}>
              <Plus className="w-4 h-4 mr-2" />
              İlk Grubu Oluştur
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => (
            <Card 
              key={g.id} 
              className="p-5 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setOpenDetail(g)}
            >
              <div className="flex items-start gap-4">
                {/* Color indicator */}
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: g.color || '#3b82f6' }}
                >
                  {g.name.charAt(0).toUpperCase()}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-900 truncate">{g.name}</h3>
                    {isLeader(g) && (
                      <Badge variant="warning" className="text-[10px]">
                        <Crown className="w-3 h-3 mr-1" /> Lider
                      </Badge>
                    )}
                    {isMember(g) && !isLeader(g) && (
                      <Badge variant="info" className="text-[10px]">Üye</Badge>
                    )}
                  </div>
                  
                  {g.description && (
                    <p className="text-sm text-slate-500 line-clamp-2 mb-2">{g.description}</p>
                  )}
                  
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {g._count.members} üye
                    </span>
                    {g.leader && (
                      <span className="flex items-center gap-1">
                        <Crown className="w-3 h-3" />
                        {g.leader.name || g.leader.email}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-slate-300" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      <Modal title="Yeni Grup Oluştur" open={openCreate} onClose={() => { setOpenCreate(false); resetCreateForm(); }}>
        <div className="space-y-4">
          <FormField label="Grup Adı" hint="Zorunlu alan">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn: Yazılım Ekibi" />
          </FormField>
          
          <FormField label="Açıklama">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Grup hakkında kısa bir açıklama"
            />
          </FormField>
          
          <FormField label="Renk">
            <div className="flex gap-2">
              <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#3b82f6" className="flex-1" />
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-16 rounded-md border border-slate-200 cursor-pointer"
              />
            </div>
          </FormField>

          <FormField label="Başlangıç Üyeleri" hint="Opsiyonel - Kendiniz otomatik eklenir">
            <Input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Kullanıcı ara..."
              className="mb-2"
            />
            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg">
              {filteredAllUsers.slice(0, 20).map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedUserIds.includes(u.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUserIds([...selectedUserIds, u.id]);
                      } else {
                        setSelectedUserIds(selectedUserIds.filter(id => id !== u.id));
                      }
                    }}
                    className="rounded border-slate-300"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{u.name || u.email}</div>
                    {u.name && <div className="text-xs text-slate-500 truncate">{u.email}</div>}
                  </div>
                </label>
              ))}
              {filteredAllUsers.length === 0 && (
                <div className="p-3 text-sm text-slate-500 text-center">Kullanıcı bulunamadı</div>
              )}
            </div>
            {selectedUserIds.length > 0 && (
              <div className="mt-2 text-xs text-slate-500">{selectedUserIds.length} kullanıcı seçildi</div>
            )}
          </FormField>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => { setOpenCreate(false); resetCreateForm(); }}>
              İptal
            </Button>
            <Button onClick={() => createM.mutate()} disabled={!name.trim() || createM.isPending}>
              Oluştur
            </Button>
          </div>
        </div>
      </Modal>

      {/* Group Detail Modal */}
      <Modal 
        title={openDetail?.name || 'Grup Detayı'} 
        open={!!openDetail} 
        onClose={() => setOpenDetail(null)}
      >
        {openDetail && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div 
                className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-2xl"
                style={{ backgroundColor: openDetail.color || '#3b82f6' }}
              >
                {openDetail.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-slate-900">{openDetail.name}</h2>
                {openDetail.description && (
                  <p className="text-slate-600 mt-1">{openDetail.description}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(openDetail.createdAt).toLocaleDateString('tr-TR')}
                  </span>
                  {openDetail.createdBy && (
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {openDetail.createdBy.name || openDetail.createdBy.email}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Leader */}
            {openDetail.leader && (
              <Card className="p-4 bg-amber-50 border-amber-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <Crown className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-amber-900">Grup Lideri</div>
                      <div className="text-sm text-amber-700">
                        {openDetail.leader.name || openDetail.leader.email}
                      </div>
                    </div>
                  </div>
                  {canEditGroup(openDetail) && (
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => setOpenChangeLeader(openDetail)}
                    >
                      Değiştir
                    </Button>
                  )}
                </div>
              </Card>
            )}

            {/* Members */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-slate-900">
                  Üyeler ({openDetail.members.length})
                </h3>
                {canEditGroup(openDetail) && (
                  <Button 
                    size="sm"
                    onClick={() => {
                      setOpenAddMembers(openDetail);
                      setUserSearch('');
                      setSelectedUserIds([]);
                    }}
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    Üye Ekle
                  </Button>
                )}
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {openDetail.members.map((m) => (
                  <div 
                    key={m.id} 
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                        {m.user.avatarUrl ? (
                          <img src={m.user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">
                            {m.user.name || m.user.email}
                          </span>
                          {m.role === 'leader' && (
                            <Crown className="w-3 h-3 text-amber-500" />
                          )}
                        </div>
                        <div className="text-xs text-slate-500">{m.user.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {has('profile.read') && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingProfileUserId(m.userId);
                          }}
                          title="Profil Görüntüle"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      {canEditGroup(openDetail) && m.userId !== openDetail.leaderId && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmRemoveMember({ group: openDetail, member: m });
                          }}
                          title="Üyeyi Çıkar"
                        >
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-4 border-t">
              {canEditGroup(openDetail) && (
                <>
                  <Button 
                    variant="secondary"
                    onClick={() => {
                      setEditName(openDetail.name);
                      setEditDescription(openDetail.description || '');
                      setEditColor(openDetail.color || '#3b82f6');
                      setOpenEdit(openDetail);
                    }}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Düzenle
                  </Button>
                  {canManage && (
                    <Button 
                      variant="danger"
                      onClick={() => setConfirmDelete(openDetail)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Sil
                    </Button>
                  )}
                </>
              )}
              {isMember(openDetail) && !isLeader(openDetail) && (
                <Button 
                  variant="secondary"
                  onClick={() => setConfirmLeave(openDetail)}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Ayrıl
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Group Modal */}
      <Modal title="Grubu Düzenle" open={!!openEdit} onClose={() => setOpenEdit(null)}>
        <div className="space-y-4">
          <FormField label="Grup Adı" hint="Zorunlu alan">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </FormField>
          <FormField label="Açıklama">
            <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
          </FormField>
          <FormField label="Renk">
            <div className="flex gap-2">
              <Input value={editColor} onChange={(e) => setEditColor(e.target.value)} className="flex-1" />
              <input
                type="color"
                value={editColor}
                onChange={(e) => setEditColor(e.target.value)}
                className="h-10 w-16 rounded-md border border-slate-200"
              />
            </div>
          </FormField>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setOpenEdit(null)}>İptal</Button>
            <Button 
              onClick={() => openEdit && updateM.mutate({
                id: openEdit.id,
                name: editName,
                description: editDescription,
                color: editColor
              })}
              disabled={!editName.trim() || updateM.isPending}
            >
              Kaydet
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Members Modal */}
      <Modal title="Üye Ekle" open={!!openAddMembers} onClose={() => { setOpenAddMembers(null); setSelectedUserIds([]); setUserSearch(''); }}>
        <div className="space-y-4">
          <Input
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Kullanıcı ara..."
          />
          <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
            {filteredAvailableUsers.length === 0 ? (
              <div className="p-4 text-sm text-slate-500 text-center">
                {availableUsers.length === 0 ? 'Eklenebilecek kullanıcı yok' : 'Kullanıcı bulunamadı'}
              </div>
            ) : (
              filteredAvailableUsers.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedUserIds.includes(u.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUserIds([...selectedUserIds, u.id]);
                      } else {
                        setSelectedUserIds(selectedUserIds.filter(id => id !== u.id));
                      }
                    }}
                    className="rounded border-slate-300"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{u.name || u.email}</div>
                    {u.name && <div className="text-xs text-slate-500 truncate">{u.email}</div>}
                  </div>
                </label>
              ))
            )}
          </div>
          {selectedUserIds.length > 0 && (
            <div className="text-sm text-slate-500">{selectedUserIds.length} kullanıcı seçildi</div>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => { setOpenAddMembers(null); setSelectedUserIds([]); }}>
              İptal
            </Button>
            <Button 
              onClick={() => openAddMembers && addMembersM.mutate({
                groupId: openAddMembers.id,
                userIds: selectedUserIds
              })}
              disabled={selectedUserIds.length === 0 || addMembersM.isPending}
            >
              Ekle ({selectedUserIds.length})
            </Button>
          </div>
        </div>
      </Modal>

      {/* Change Leader Modal */}
      <Modal title="Lider Değiştir" open={!!openChangeLeader} onClose={() => { setOpenChangeLeader(null); setNewLeaderId(''); }}>
        {openChangeLeader && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Yeni grup liderini seçin. Mevcut lider normal üye olacaktır.
            </p>
            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
              {openChangeLeader.members
                .filter(m => m.userId !== openChangeLeader.leaderId)
                .map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="newLeader"
                      checked={newLeaderId === m.userId}
                      onChange={() => setNewLeaderId(m.userId)}
                      className="border-slate-300"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {m.user.name || m.user.email}
                      </div>
                      {m.user.name && <div className="text-xs text-slate-500 truncate">{m.user.email}</div>}
                    </div>
                  </label>
                ))}
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="secondary" onClick={() => { setOpenChangeLeader(null); setNewLeaderId(''); }}>
                İptal
              </Button>
              <Button 
                onClick={() => openChangeLeader && changeLeaderM.mutate({
                  groupId: openChangeLeader.id,
                  leaderId: newLeaderId
                })}
                disabled={!newLeaderId || changeLeaderM.isPending}
              >
                Lider Yap
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Grubu Sil"
        description={`"${confirmDelete?.name}" grubunu silmek istediğinize emin misiniz? Tüm üyelikler de silinecektir.`}
        danger
        confirmText="Sil"
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => { if (confirmDelete) deleteM.mutate(confirmDelete.id); }}
      />

      <ConfirmDialog
        open={!!confirmRemoveMember}
        title="Üyeyi Çıkar"
        description={`"${confirmRemoveMember?.member.user.name || confirmRemoveMember?.member.user.email}" kullanıcısını gruptan çıkarmak istediğinize emin misiniz?`}
        danger
        confirmText="Çıkar"
        onClose={() => setConfirmRemoveMember(null)}
        onConfirm={() => { if (confirmRemoveMember) removeMemberM.mutate({
          groupId: confirmRemoveMember.group.id,
          userId: confirmRemoveMember.member.userId
        }); }}
      />

      <ConfirmDialog
        open={!!confirmLeave}
        title="Gruptan Ayrıl"
        description={`"${confirmLeave?.name}" grubundan ayrılmak istediğinize emin misiniz?`}
        confirmText="Ayrıl"
        onClose={() => setConfirmLeave(null)}
        onConfirm={() => { if (confirmLeave) leaveGroupM.mutate(confirmLeave.id); }}
      />

      <ViewUserProfileModal
        userId={viewingProfileUserId}
        open={!!viewingProfileUserId}
        onClose={() => setViewingProfileUserId(null)}
      />

      {/* Bilgilendirme Modal */}
      <Modal title="Grup Yönetimi Bilgisi" open={openInfo} onClose={() => setOpenInfo(false)}>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              Grup Yönetimi Nasıl Çalışır?
            </h3>
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                Grup yönetimi sistemi, kullanıcıların bir araya gelerek çalışma grupları oluşturmasına olanak sağlar. Her grubun bir lideri ve üyeleri bulunur.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Grup Özellikleri:</h4>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li><strong>Grup Lideri:</strong> Her grubun bir lideri vardır ve lider grup ayarlarını yönetebilir</li>
                  <li><strong>Üye Yönetimi:</strong> Lider üyeleri ekleyebilir, çıkarabilir veya liderliği devredebilir</li>
                  <li><strong>Renk ve İkon:</strong> Gruplar renk ve ikon ile özelleştirilebilir</li>
                  <li><strong>Admin Görünümü:</strong> Adminler tüm grupları görüntüleyebilir ve yönetebilir</li>
                  <li><strong>Grubum Sayfası:</strong> Kullanıcılar kendi gruplarını "Grubum" sayfasında görüntüleyebilir</li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">Önemli Notlar:</h4>
                <ul className="list-disc list-inside space-y-1 text-amber-800">
                  <li>Grup oluşturma yetkisi olan kullanıcılar sadece 1 grup oluşturabilir</li>
                  <li>Lider, liderliği başka bir üyeye devredebilir</li>
                  <li>Üyeler gruptan ayrılabilir (lider hariç)</li>
                  <li>Lider ayrılmak isterse önce liderliği devretmesi gerekir</li>
                  <li>Adminler tüm grupları görüntüleyebilir ve yönetebilir</li>
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
