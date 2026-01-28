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
  ChevronRight,
  User,
  Mail,
  Calendar,
  Edit,
  LogOut,
  Shield,
  AlertTriangle,
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
  myRole?: string;
  joinedAt?: string;
};

type UserOption = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

export function MyGroupsPage() {
  const { has, me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const canCreate = has('group.create');
  const currentUserId = me?.user?.id;

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

  // Add members
  const [userSearch, setUserSearch] = useState('');
  const [newLeaderId, setNewLeaderId] = useState('');

  // Queries
  const myGroupsQuery = useQuery<{ groups: Group[] }>({
    queryKey: ['my-groups'],
    queryFn: () => apiFetch('/api/groups/my/list')
  });

  const canCreateQuery = useQuery<{ canCreate: boolean; existingGroup: { id: string; name: string } | null }>({
    queryKey: ['my-groups-can-create'],
    enabled: canCreate,
    queryFn: () => apiFetch('/api/groups/my/can-create')
  });

  const usersQuery = useQuery<{ users: UserOption[] }>({
    queryKey: ['users-for-group', userSearch],
    enabled: (openCreate || !!openAddMembers) && userSearch.length >= 2,
    queryFn: () => apiFetch(`/api/admin/users?q=${userSearch}&pageSize=10`)
  });

  // Mutations
  const createM = useMutation({
    mutationFn: () => apiFetch('/api/groups/my/create', {
      method: 'POST',
      json: { name, description, color, userIds: selectedUserIds }
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-groups'] });
      qc.invalidateQueries({ queryKey: ['my-groups-can-create'] });
      toast.push({ type: 'success', title: 'Grup oluşturuldu' });
      closeCreateModal();
    },
    onError: (err: any) => toast.push({ type: 'error', title: 'Hata', description: err?.message })
  });

  const updateM = useMutation({
    mutationFn: (data: { id: string }) => apiFetch(`/api/groups/${data.id}`, {
      method: 'PUT',
      json: { name: editName, description: editDescription, color: editColor }
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-groups'] });
      toast.push({ type: 'success', title: 'Grup güncellendi' });
      setOpenEdit(null);
    },
    onError: (err: any) => toast.push({ type: 'error', title: 'Hata', description: err?.message })
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/groups/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-groups'] });
      qc.invalidateQueries({ queryKey: ['my-groups-can-create'] });
      toast.push({ type: 'success', title: 'Grup silindi' });
      setConfirmDelete(null);
      setOpenDetail(null);
    },
    onError: (err: any) => toast.push({ type: 'error', title: 'Hata', description: err?.message })
  });

  const addMemberM = useMutation({
    mutationFn: (data: { groupId: string; userId: string }) => apiFetch(`/api/groups/${data.groupId}/members`, {
      method: 'POST',
      json: { userIds: [data.userId] }
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-groups'] });
      toast.push({ type: 'success', title: 'Üye eklendi' });
    },
    onError: (err: any) => toast.push({ type: 'error', title: 'Hata', description: err?.message })
  });

  const removeMemberM = useMutation({
    mutationFn: (data: { groupId: string; userId: string }) => apiFetch(`/api/groups/${data.groupId}/members/${data.userId}`, {
      method: 'DELETE'
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-groups'] });
      toast.push({ type: 'success', title: 'Üye çıkarıldı' });
      setConfirmRemoveMember(null);
    },
    onError: (err: any) => toast.push({ type: 'error', title: 'Hata', description: err?.message })
  });

  const changeLeaderM = useMutation({
    mutationFn: (data: { groupId: string; newLeaderId: string }) => apiFetch(`/api/groups/${data.groupId}/leader`, {
      method: 'PUT',
      json: { newLeaderId: data.newLeaderId }
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-groups'] });
      qc.invalidateQueries({ queryKey: ['my-groups-can-create'] });
      toast.push({ type: 'success', title: 'Lider değiştirildi' });
      setOpenChangeLeader(null);
    },
    onError: (err: any) => toast.push({ type: 'error', title: 'Hata', description: err?.message })
  });

  const leaveM = useMutation({
    mutationFn: (groupId: string) => apiFetch(`/api/groups/${groupId}/leave`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-groups'] });
      toast.push({ type: 'success', title: 'Gruptan ayrıldınız' });
      setConfirmLeave(null);
      setOpenDetail(null);
    },
    onError: (err: any) => toast.push({ type: 'error', title: 'Hata', description: err?.message })
  });

  // Helpers
  const closeCreateModal = () => {
    setOpenCreate(false);
    setName('');
    setDescription('');
    setColor('#3b82f6');
    setSelectedUserIds([]);
  };

  const openEditModal = (group: Group) => {
    setEditName(group.name);
    setEditDescription(group.description || '');
    setEditColor(group.color || '#3b82f6');
    setOpenEdit(group);
  };

  const groups = myGroupsQuery.data?.groups || [];
  const availableUsers = usersQuery.data?.users || [];
  const canCreateNew = canCreateQuery.data?.canCreate ?? false;
  const existingOwnGroup = canCreateQuery.data?.existingGroup;

  // Kullanıcının lider olduğu grup
  const myOwnGroup = useMemo(() => {
    return groups.find(g => g.leaderId === currentUserId && g.createdBy?.id === currentUserId);
  }, [groups, currentUserId]);

  // Üye olduğu diğer gruplar
  const otherGroups = useMemo(() => {
    return groups.filter(g => !(g.leaderId === currentUserId && g.createdBy?.id === currentUserId));
  }, [groups, currentUserId]);

  if (myGroupsQuery.isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Grubum"
        description="Kendi grubunuzu yönetin ve üyesi olduğunuz grupları görüntüleyin"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setOpenInfo(true)} title="Grubum Bilgisi">
              <Info className="w-4 h-4" />
            </Button>
            {canCreate && canCreateNew ? (
              <Button onClick={() => setOpenCreate(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Grup Oluştur
              </Button>
            ) : canCreate && existingOwnGroup ? (
              <div className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Zaten bir grubunuz var
              </div>
            ) : null}
          </div>
        }
      />

      {/* Kendi Grubum */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-500" />
          Lider Olduğum Grup
        </h2>

        {myOwnGroup ? (
          <Card className="p-5 border-l-4 border-l-amber-500">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: myOwnGroup.color || '#3b82f6' }}
                  >
                    {myOwnGroup.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{myOwnGroup.name}</h3>
                    <p className="text-sm text-slate-500">{myOwnGroup._count.members} üye</p>
                  </div>
                </div>
                {myOwnGroup.description && (
                  <p className="text-sm text-slate-600 mb-3">{myOwnGroup.description}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="warning">Lider</Badge>
                  {!myOwnGroup.isActive && <Badge variant="danger">Pasif</Badge>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setOpenDetail(myOwnGroup)}>
                  Detay
                </Button>
                <Button variant="secondary" size="sm" onClick={() => openEditModal(myOwnGroup)}>
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ) : canCreate ? (
          <Card className="p-8 text-center bg-slate-50 border-dashed">
            <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-600 mb-4">Henüz bir grubunuz yok.</p>
            {canCreateNew && (
              <Button onClick={() => setOpenCreate(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Grup Oluştur
              </Button>
            )}
          </Card>
        ) : (
          <Card className="p-6 text-center bg-slate-50">
            <Shield className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-slate-500 text-sm">Grup oluşturma yetkiniz yok.</p>
          </Card>
        )}
      </div>

      {/* Üyesi Olduğum Gruplar */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-500" />
          Üyesi Olduğum Gruplar
        </h2>

        {otherGroups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {otherGroups.map((group) => {
              const isLeader = group.leaderId === currentUserId;
              return (
                <Card key={group.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: group.color || '#3b82f6' }}
                      >
                        {group.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{group.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <span>{group._count.members} üye</span>
                          {group.leader && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Crown className="w-3 h-3 text-amber-500" />
                                {group.leader.name || group.leader.email}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={isLeader ? 'warning' : 'default'}>
                        {isLeader ? 'Lider' : 'Üye'}
                      </Badge>
                      <Button variant="secondary" size="sm" onClick={() => setOpenDetail(group)}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-8 text-center bg-slate-50">
            <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">Henüz başka bir gruba üye değilsiniz.</p>
          </Card>
        )}
      </div>

      {/* Create Modal */}
      <Modal title="Yeni Grup Oluştur" open={openCreate} onClose={closeCreateModal}>
        <div className="space-y-4">
          <FormField label="Grup Adı" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Grup adı" />
          </FormField>
          <FormField label="Açıklama">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Grup açıklaması" />
          </FormField>
          <FormField label="Renk">
            <div className="flex gap-2">
              <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#3b82f6" />
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-16 rounded cursor-pointer border border-slate-200"
              />
            </div>
          </FormField>
          <FormField label="Üyeler" hint="Sonra da ekleyebilirsiniz">
            <Input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Kullanıcı ara..."
            />
            {availableUsers.length > 0 && (
              <div className="mt-2 border rounded-lg divide-y max-h-40 overflow-y-auto">
                {availableUsers.filter(u => u.id !== currentUserId && !selectedUserIds.includes(u.id)).map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUserIds([...selectedUserIds, user.id])}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="text-sm">{user.name || user.email}</span>
                    <span className="text-xs text-slate-400 ml-auto">{user.email}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedUserIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedUserIds.map((uid) => {
                  const user = availableUsers.find(u => u.id === uid);
                  return (
                    <Badge key={uid} variant="info" className="gap-1">
                      {user?.name || user?.email || uid}
                      <button onClick={() => setSelectedUserIds(selectedUserIds.filter(i => i !== uid))}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </FormField>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={closeCreateModal}>İptal</Button>
            <Button onClick={() => createM.mutate()} disabled={!name.trim() || createM.isPending}>
              Oluştur
            </Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      {openDetail && (
        <Modal title={openDetail.name} open={!!openDetail} onClose={() => setOpenDetail(null)}>
          <div className="space-y-4">
            {openDetail.description && (
              <p className="text-slate-600">{openDetail.description}</p>
            )}
            
            {/* Lider */}
            {openDetail.leader && (
              <div className="flex items-center gap-2 text-sm">
                <Crown className="w-4 h-4 text-amber-500" />
                <span className="font-medium">Lider:</span>
                <span>{openDetail.leader.name || openDetail.leader.email}</span>
              </div>
            )}

            {/* Üyeler */}
            <div>
              <h4 className="font-medium text-slate-900 mb-2">Üyeler ({openDetail.members.length})</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {openDetail.members.map((member) => {
                  const isLeader = member.userId === openDetail.leaderId;
                  const isMe = member.userId === currentUserId;
                  const amILeader = openDetail.leaderId === currentUserId;
                  return (
                    <div key={member.id} className={clsx(
                      'flex items-center justify-between p-2 rounded-lg',
                      isMe ? 'bg-blue-50' : 'bg-slate-50'
                    )}>
                      <div className="flex items-center gap-2">
                        {member.user.avatarUrl ? (
                          <img src={member.user.avatarUrl} className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                            <User className="w-4 h-4 text-slate-500" />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium">
                            {member.user.name || member.user.email}
                            {isMe && <span className="text-blue-600 ml-1">(Ben)</span>}
                          </div>
                          <div className="text-xs text-slate-500">{member.user.email}</div>
                        </div>
                        {isLeader && (
                          <Badge variant="warning" className="ml-2">Lider</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {has('profile.read') && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setViewingProfileUserId(member.userId)}
                            title="Profil Görüntüle"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                        {amILeader && !isMe && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setConfirmRemoveMember({ group: openDetail, member })}
                            title="Üyeyi Çıkar"
                          >
                            <UserMinus className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-4 border-t">
              {openDetail.leaderId === currentUserId && (
                <>
                  <Button variant="secondary" onClick={() => {
                    setOpenAddMembers(openDetail);
                    setOpenDetail(null);
                  }}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Üye Ekle
                  </Button>
                  <Button variant="secondary" onClick={() => {
                    setNewLeaderId('');
                    setOpenChangeLeader(openDetail);
                    setOpenDetail(null);
                  }}>
                    <Crown className="w-4 h-4 mr-2" />
                    Lider Değiştir
                  </Button>
                  {openDetail.createdBy?.id === currentUserId && (
                    <Button variant="danger" onClick={() => setConfirmDelete(openDetail)}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Grubu Sil
                    </Button>
                  )}
                </>
              )}
              {openDetail.leaderId !== currentUserId && (
                <Button variant="danger" onClick={() => setConfirmLeave(openDetail)}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Gruptan Ayrıl
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {openEdit && (
        <Modal title="Grubu Düzenle" open={!!openEdit} onClose={() => setOpenEdit(null)}>
          <div className="space-y-4">
            <FormField label="Grup Adı" required>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </FormField>
            <FormField label="Açıklama">
              <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </FormField>
            <FormField label="Renk">
              <div className="flex gap-2">
                <Input value={editColor} onChange={(e) => setEditColor(e.target.value)} />
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="h-10 w-16 rounded cursor-pointer border border-slate-200"
                />
              </div>
            </FormField>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="secondary" onClick={() => setOpenEdit(null)}>İptal</Button>
              <Button 
                onClick={() => updateM.mutate({ id: openEdit.id })} 
                disabled={!editName.trim() || updateM.isPending}
              >
                Kaydet
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Members Modal */}
      {openAddMembers && (
        <Modal title="Üye Ekle" open={!!openAddMembers} onClose={() => setOpenAddMembers(null)}>
          <div className="space-y-4">
            <Input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Kullanıcı ara..."
            />
            {availableUsers.length > 0 && (
              <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                {availableUsers
                  .filter(u => !openAddMembers.members.some(m => m.userId === u.id))
                  .map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        addMemberM.mutate({ groupId: openAddMembers.id, userId: user.id });
                      }}
                      disabled={addMemberM.isPending}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="text-sm">{user.name || user.email}</span>
                      <span className="text-xs text-slate-400 ml-auto">{user.email}</span>
                      <Plus className="w-4 h-4 text-green-600" />
                    </button>
                  ))}
              </div>
            )}
            {userSearch.length < 2 && (
              <p className="text-sm text-slate-500 text-center">En az 2 karakter yazın</p>
            )}
          </div>
        </Modal>
      )}

      {/* Change Leader Modal */}
      {openChangeLeader && (
        <Modal title="Lider Değiştir" open={!!openChangeLeader} onClose={() => setOpenChangeLeader(null)}>
          <div className="space-y-4">
            <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              Liderliği devrettiğinizde, yeni grup oluşturabilirsiniz.
            </p>
            <FormField label="Yeni Lider">
              <div className="space-y-2">
                {openChangeLeader.members
                  .filter(m => m.userId !== currentUserId)
                  .map((member) => (
                    <label
                      key={member.id}
                      className={clsx(
                        'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                        newLeaderId === member.userId ? 'border-blue-500 bg-blue-50' : 'hover:bg-slate-50'
                      )}
                    >
                      <input
                        type="radio"
                        name="newLeader"
                        value={member.userId}
                        checked={newLeaderId === member.userId}
                        onChange={(e) => setNewLeaderId(e.target.value)}
                        className="sr-only"
                      />
                      {member.user.avatarUrl ? (
                        <img src={member.user.avatarUrl} className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                          <User className="w-4 h-4 text-slate-500" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{member.user.name || member.user.email}</div>
                        <div className="text-xs text-slate-500">{member.user.email}</div>
                      </div>
                      {newLeaderId === member.userId && (
                        <Crown className="w-5 h-5 text-amber-500 ml-auto" />
                      )}
                    </label>
                  ))}
              </div>
            </FormField>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="secondary" onClick={() => setOpenChangeLeader(null)}>İptal</Button>
              <Button
                onClick={() => changeLeaderM.mutate({ groupId: openChangeLeader.id, newLeaderId })}
                disabled={!newLeaderId || changeLeaderM.isPending}
              >
                Liderliği Devret
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Grubu Sil"
        description={`"${confirmDelete?.name}" grubunu silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
        danger
        confirmText="Sil"
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && deleteM.mutate(confirmDelete.id)}
      />

      <ConfirmDialog
        open={!!confirmRemoveMember}
        title="Üyeyi Çıkar"
        description={`"${confirmRemoveMember?.member.user.name || confirmRemoveMember?.member.user.email}" kullanıcısını gruptan çıkarmak istediğinize emin misiniz?`}
        danger
        confirmText="Çıkar"
        onClose={() => setConfirmRemoveMember(null)}
        onConfirm={() => confirmRemoveMember && removeMemberM.mutate({
          groupId: confirmRemoveMember.group.id,
          userId: confirmRemoveMember.member.userId
        })}
      />

      <ConfirmDialog
        open={!!confirmLeave}
        title="Gruptan Ayrıl"
        description={`"${confirmLeave?.name}" grubundan ayrılmak istediğinize emin misiniz?`}
        danger
        confirmText="Ayrıl"
        onClose={() => setConfirmLeave(null)}
        onConfirm={() => confirmLeave && leaveM.mutate(confirmLeave.id)}
      />

      <ViewUserProfileModal
        userId={viewingProfileUserId}
        open={!!viewingProfileUserId}
        onClose={() => setViewingProfileUserId(null)}
      />

      {/* Bilgilendirme Modal */}
      <Modal title="Grubum Bilgisi" open={openInfo} onClose={() => setOpenInfo(false)}>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              Grubum Nasıl Çalışır?
            </h3>
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                Grubum sayfası, kendi grubunuzu yönetmenize ve üyesi olduğunuz grupları görüntülemenize olanak sağlar.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Özellikler:</h4>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li><strong>Kendi Grubum:</strong> Lider olduğunuz grubu buradan yönetebilirsiniz</li>
                  <li><strong>Üye Olduğum Gruplar:</strong> Üyesi olduğunuz diğer grupları görüntüleyebilirsiniz</li>
                  <li><strong>Grup Oluşturma:</strong> Grup oluşturma yetkisi olan kullanıcılar sadece 1 grup oluşturabilir</li>
                  <li><strong>Üye Yönetimi:</strong> Liderler grup üyelerini ekleyebilir, çıkarabilir ve liderliği devredebilir</li>
                  <li><strong>Gruptan Ayrılma:</strong> Üye olduğunuz gruplardan ayrılabilirsiniz (lider hariç)</li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">Önemli Notlar:</h4>
                <ul className="list-disc list-inside space-y-1 text-amber-800">
                  <li>Grup oluşturma yetkisi olan kullanıcılar sadece 1 grup oluşturabilir</li>
                  <li>Mevcut grubunuz silinene veya gruptan ayrılana kadar yeni grup oluşturamazsınız</li>
                  <li>Lider, liderliği başka bir üyeye devredebilir</li>
                  <li>Lider, gruptan ayrılmadan önce liderliği devretmelidir</li>
                  <li>Üyeler gruptan ayrılabilir, ancak lider ayrılamaz</li>
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

