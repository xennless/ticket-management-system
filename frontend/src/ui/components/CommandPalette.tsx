import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { LayoutDashboard, Ticket, Users, Shield, KeyRound, Bell, Settings, FileText, Activity, BarChart3 } from 'lucide-react';
import { useState, useEffect } from 'react';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const { has } = useAuth();

  useEffect(() => {
    const openHandler = () => setOpen(true);
    window.addEventListener('open-command-palette', openHandler as any);
    return () => window.removeEventListener('open-command-palette', openHandler as any);
  }, []);

  const pages = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', permission: 'dashboard.read' },
    { id: 'tickets', label: 'Tickets', icon: Ticket, path: '/tickets' },
    { id: 'create-ticket', label: 'Yeni Ticket Oluştur', icon: Ticket, path: '/tickets/new', permission: 'ticket.create' },
    { id: 'users', label: 'Kullanıcılar', icon: Users, path: '/admin/users', permission: 'user.read' },
    { id: 'roles', label: 'Roller', icon: Shield, path: '/admin/roles', permission: 'role.read' },
    { id: 'permissions', label: 'Yetkiler', icon: KeyRound, path: '/admin/permissions', permission: 'permission.read' },
    { id: 'notifications', label: 'Bildirimler', icon: Bell, path: '/notifications', permission: 'notification.read' },
    { id: 'settings', label: 'Ayarlar', icon: Settings, path: '/settings', permission: 'settings.read' },
    { id: 'audit', label: 'Audit Log', icon: FileText, path: '/audit', permission: 'audit.read' },
    { id: 'activity', label: 'Aktivite', icon: Activity, path: '/activity', permission: 'activity.read' },
    { id: 'reports', label: 'Raporlar', icon: BarChart3, path: '/reports', permission: 'report.read' }
  ].filter((p) => !p.permission || has(p.permission));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" role="dialog" aria-modal="true" aria-label="Komut Paleti">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <Command className="relative w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-2xl">
        <Command.Input
          placeholder="Komut ara veya sayfaya git... (Ctrl+K)"
          className="w-full border-0 border-b border-slate-200 px-4 py-3 text-base outline-none focus:ring-0"
          autoFocus
        />
        <Command.List className="max-h-96 overflow-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-slate-500">Sonuç bulunamadı.</Command.Empty>
          <Command.Group heading="Sayfalar">
            {pages.map((page) => {
              const Icon = page.icon;
              return (
                <Command.Item
                  key={page.id}
                  onSelect={() => {
                    nav(page.path);
                    setOpen(false);
                  }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer aria-selected:bg-slate-100"
                >
                  <Icon className="w-4 h-4 text-slate-500" />
                  <span>{page.label}</span>
                </Command.Item>
              );
            })}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}

