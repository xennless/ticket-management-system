import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { Skeleton } from '../components/Skeleton';
import { Users, Shield, CheckSquare, Square, Trash2, UserCheck, UserX, Info } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';

type User = {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
};

type Role = {
  id: string;
  code: string;
  name: string;
};

export function BulkOperationsPage() {
  const { has } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const canUserBulk = has('user.bulk');
  const canRoleBulk = has('role.bulk');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'activate' | 'deactivate' | 'delete' | 'assignRole' | 'removeRole'>('activate');
  const [selectedRole, setSelectedRole] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'users' | 'roles'; action: string; count: number } | null>(null);
  const [openInfo, setOpenInfo] = useState(false);

  const { data: usersData, isLoading: usersLoading } = useQuery<{ users: User[] }>({
    queryKey: ['admin', 'users'],
    enabled: canUserBulk,
    queryFn: () => apiFetch('/api/admin/users')
  });

  const { data: rolesData, isLoading: rolesLoading } = useQuery<{ roles: Role[] }>({
    queryKey: ['admin', 'roles'],
    enabled: canRoleBulk,
    queryFn: () => apiFetch('/api/admin/roles')
  });

  const bulkUsersM = useMutation({
    mutationFn: (data: { userIds: string[]; action: string; roleId?: string }) =>
      apiFetch('/api/bulk/users', { method: 'POST', json: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.push({ type: 'success', title: 'Toplu işlem başarıyla tamamlandı' });
      setSelectedUsers(new Set());
      setConfirmOpen(false);
    }
  });

  const bulkRolesM = useMutation({
    mutationFn: (data: { roleIds: string[]; action: string }) =>
      apiFetch('/api/bulk/roles', { method: 'POST', json: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'roles'] });
      toast.push({ type: 'success', title: 'Toplu işlem başarıyla tamamlandı' });
      setSelectedRoles(new Set());
      setConfirmOpen(false);
    }
  });

  const toggleUser = (userId: string) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUsers(newSet);
  };

  const toggleRole = (roleId: string) => {
    const newSet = new Set(selectedRoles);
    if (newSet.has(roleId)) {
      newSet.delete(roleId);
    } else {
      newSet.add(roleId);
    }
    setSelectedRoles(newSet);
  };

  const selectAllUsers = () => {
    if (selectedUsers.size === usersData?.users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(usersData?.users.map((u) => u.id) || []));
    }
  };

  const selectAllRoles = () => {
    if (selectedRoles.size === rolesData?.roles.length) {
      setSelectedRoles(new Set());
    } else {
      setSelectedRoles(new Set(rolesData?.roles.map((r) => r.id) || []));
    }
  };

  const handleBulkUsers = () => {
    if (selectedUsers.size === 0) {
      toast.push({ type: 'error', title: 'Lütfen en az bir kullanıcı seçin' });
      return;
    }

    if ((bulkAction === 'assignRole' || bulkAction === 'removeRole') && !selectedRole) {
      toast.push({ type: 'error', title: 'Lütfen bir rol seçin' });
      return;
    }

    const actionLabels: Record<string, string> = {
      activate: 'Aktif Et',
      deactivate: 'Pasif Et',
      delete: 'Sil',
      assignRole: 'Rol Ata',
      removeRole: 'Rol Kaldır'
    };

    setConfirmAction({
      type: 'users',
      action: actionLabels[bulkAction] || bulkAction,
      count: selectedUsers.size
    });
    setConfirmOpen(true);
  };

  const handleBulkRoles = () => {
    if (selectedRoles.size === 0) {
      toast.push({ type: 'error', title: 'Lütfen en az bir rol seçin' });
      return;
    }

    setConfirmAction({
      type: 'roles',
      action: 'Sil',
      count: selectedRoles.size
    });
    setConfirmOpen(true);
  };

  const executeBulkUsers = () => {
    bulkUsersM.mutate({
      userIds: Array.from(selectedUsers),
      action: bulkAction,
      ...(bulkAction === 'assignRole' || bulkAction === 'removeRole' ? { roleId: selectedRole } : {})
    });
  };

  const executeBulkRoles = () => {
    bulkRolesM.mutate({
      roleIds: Array.from(selectedRoles),
      action: 'delete'
    });
  };

  if (!canUserBulk && !canRoleBulk) {
    return <div className="p-6 text-center text-slate-500">Toplu işlem yetkiniz yok.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Toplu İşlemler" description="Çoklu kullanıcı ve rol üzerinde toplu işlemler yapın" />

      {canUserBulk && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Kullanıcılar
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={selectAllUsers}>
                {selectedUsers.size === usersData?.users.length ? (
                  <>
                    <Square className="w-4 h-4 mr-2" />
                    Tümünü Kaldır
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Tümünü Seç
                  </>
                )}
              </Button>
              <span className="text-sm text-slate-500">{selectedUsers.size} seçili</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Select value={bulkAction} onChange={(e) => setBulkAction(e.target.value as any)}>
              <option value="activate">Aktif Et</option>
              <option value="deactivate">Pasif Et</option>
              <option value="delete">Sil</option>
              <option value="assignRole">Rol Ata</option>
              <option value="removeRole">Rol Kaldır</option>
            </Select>
            {(bulkAction === 'assignRole' || bulkAction === 'removeRole') && (
              <Select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                <option value="">Rol Seçin</option>
                {rolesData?.roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            )}
            <Button onClick={handleBulkUsers} disabled={selectedUsers.size === 0 || bulkUsersM.isPending}>
              İşlemi Uygula
            </Button>
          </div>

          {usersLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {usersData?.users.map((u) => (
                <div
                  key={u.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    selectedUsers.has(u.id)
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                  onClick={() => toggleUser(u.id)}
                >
                  {selectedUsers.has(u.id) ? (
                    <CheckSquare className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-400" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">{u.name || u.email}</div>
                    <div className="text-sm text-slate-500">{u.email}</div>
                  </div>
                  {u.isActive ? (
                    <UserCheck className="w-4 h-4 text-green-500" />
                  ) : (
                    <UserX className="w-4 h-4 text-red-500" />
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {canRoleBulk && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Roller
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={selectAllRoles}>
                {selectedRoles.size === rolesData?.roles.length ? (
                  <>
                    <Square className="w-4 h-4 mr-2" />
                    Tümünü Kaldır
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Tümünü Seç
                  </>
                )}
              </Button>
              <span className="text-sm text-slate-500">{selectedRoles.size} seçili</span>
            </div>
          </div>

          <div className="mb-4">
            <Button variant="danger" onClick={handleBulkRoles} disabled={selectedRoles.size === 0 || bulkRolesM.isPending}>
              <Trash2 className="w-4 h-4 mr-2" />
              Seçili Rolleri Sil
            </Button>
          </div>

          {rolesLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {rolesData?.roles
                .filter((r) => !r.code.includes('system-developer'))
                .map((r) => (
                  <div
                    key={r.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      selectedRoles.has(r.id)
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                    onClick={() => toggleRole(r.id)}
                  >
                    {selectedRoles.has(r.id) ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400" />
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">{r.name}</div>
                      <div className="text-sm text-slate-500">{r.code}</div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Card>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (confirmAction?.type === 'users') {
            executeBulkUsers();
          } else if (confirmAction?.type === 'roles') {
            executeBulkRoles();
          }
        }}
        title="Toplu İşlem Onayı"
        description={`${confirmAction?.count} ${confirmAction?.type === 'users' ? 'kullanıcı' : 'rol'} üzerinde "${confirmAction?.action}" işlemini uygulamak istediğinize emin misiniz?`}
      />

      {/* Bilgilendirme Modal */}
      <Modal title="Toplu İşlemler Bilgisi" open={openInfo} onClose={() => setOpenInfo(false)}>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              Toplu İşlemler Nasıl Çalışır?
            </h3>
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                Toplu işlemler sistemi, birden fazla kullanıcı veya rolü aynı anda yönetmenize olanak sağlar. Zamandan tasarruf edin.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Kullanıcı İşlemleri:</h4>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li><strong>Aktif Et:</strong> Seçili kullanıcıları aktif duruma getirir</li>
                  <li><strong>Pasif Et:</strong> Seçili kullanıcıları pasif duruma getirir</li>
                  <li><strong>Sil:</strong> Seçili kullanıcıları kalıcı olarak siler</li>
                  <li><strong>Rol Ata:</strong> Seçili kullanıcılara belirtilen rolü atar</li>
                  <li><strong>Rol Kaldır:</strong> Seçili kullanıcılardan belirtilen rolü kaldırır</li>
                </ul>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-semibold text-red-900 mb-2">Rol İşlemleri:</h4>
                <ul className="list-disc list-inside space-y-1 text-red-800">
                  <li><strong>Sil:</strong> Seçili rolleri kalıcı olarak siler</li>
                  <li>Silinen roller tüm kullanıcılardan otomatik kaldırılır</li>
                  <li>Silme işlemi geri alınamaz</li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">Önemli Notlar:</h4>
                <ul className="list-disc list-inside space-y-1 text-amber-800">
                  <li>Toplu işlemler geri alınamaz, dikkatli kullanın</li>
                  <li>Silme işlemleri kalıcıdır ve veri kaybına neden olur</li>
                  <li>Rol atama/kaldırma işlemleri anında uygulanır</li>
                  <li>Seçim yapmak için checkbox'ları kullanın</li>
                  <li>"Tümünü Seç" ile tüm öğeleri seçebilirsiniz</li>
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

