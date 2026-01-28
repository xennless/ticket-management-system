import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef, memo, useMemo, useCallback } from 'react';
import { useAuth } from '../../lib/auth';
import { Button } from '../components/Button';
import { Menu, X, UserCircle, Bell, Smartphone, ChevronDown, ChevronRight, Link as LinkIcon, Lock } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import clsx from 'clsx';
import { RoleBadge } from '../components/RoleBadge';
import { Skeleton } from '../components/Skeleton';
import { TicketSearch } from '../components/TicketSearch';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { useKeyboardShortcuts, initDefaultShortcuts, setHelpModalState } from '../../lib/keyboard-shortcuts';
import { KeyboardShortcutsHelp } from '../components/KeyboardShortcutsHelp';

// Dynamic icon loader - cache for loaded icons
const iconCache = new Map<string, React.ComponentType<any>>();

// Function to dynamically load icon from Lucide React
const loadIcon = (iconName: string): React.ComponentType<any> | null => {
  // Check cache first
  if (iconCache.has(iconName)) {
    return iconCache.get(iconName)!;
  }

  // Try direct name first
  let IconComponent = (LucideIcons as any)[iconName];
  
  // If not found, try with Icon suffix
  if (!IconComponent || (typeof IconComponent !== 'function' && typeof IconComponent !== 'object')) {
    IconComponent = (LucideIcons as any)[`${iconName}Icon`];
  }
  
  // Check if it's a valid React component (function or object)
  if (!IconComponent || (typeof IconComponent !== 'function' && (typeof IconComponent !== 'object' || IconComponent === null))) {
    return null;
  }
  
  // Cache it
  iconCache.set(iconName, IconComponent);
  return IconComponent;
};

const getIcon = (iconName: string | null): React.ReactNode => {
  if (!iconName) return <LinkIcon className="w-4 h-4" />;
  
  const IconComponent = loadIcon(iconName);
  if (IconComponent) {
    return <IconComponent className="w-4 h-4" />;
  }
  
  // Fallback to Link icon if not found
  return <LinkIcon className="w-4 h-4" />;
};

type NavItemData = {
  id: string;
  code: string;
  name: string;
  path: string;
  icon: string | null;
  permission: string | null;
  order: number;
  isActive: boolean;
};

type NavSectionData = {
  id: string;
  code: string;
  name: string;
  icon: string | null;
  order: number;
  isActive: boolean;
  isCollapsible: boolean;
  defaultOpen: boolean;
  items: NavItemData[];
};

const NavItem = memo(function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition',
          isActive
            ? 'bg-slate-900 text-white shadow-sm'
            : 'text-slate-700 hover:bg-slate-100/70'
        )
      }
    >
      <span className="w-4 h-4">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
});

// Dropdown navigation section component
const NavSection = memo(function NavSection({ 
  section,
  has
}: { 
  section: NavSectionData;
  has: (perm: string) => boolean;
}) {
  const [isOpen, setIsOpen] = useState(section.defaultOpen);
  const location = useLocation();

  // Check if any child route is active
  const hasActiveChild = useMemo(() => {
    return section.items.some(item => location.pathname.startsWith(item.path));
  }, [location.pathname, section.items]);

  // Auto-expand if a child is active
  useEffect(() => {
    if (hasActiveChild) {
      setIsOpen(true);
    }
  }, [hasActiveChild]);

  // Filter items by permission
  const visibleItems = useMemo(() => {
    return section.items.filter(item => !item.permission || has(item.permission));
  }, [section.items, has]);

  // Don't render if no visible items
  if (visibleItems.length === 0) return null;

  if (!section.isCollapsible) {
    return (
      <div className="space-y-1">
        <div className="mt-4 mb-1 text-xs font-semibold uppercase text-slate-400 tracking-wider">
          {section.name}
        </div>
        {visibleItems.map((item) => (
          <NavItem key={item.id} to={item.path} icon={getIcon(item.icon)} label={item.name} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
          hasActiveChild
            ? 'bg-slate-100 text-slate-900'
            : 'text-slate-600 hover:bg-slate-100/70'
        )}
      >
        <span className="w-4 h-4">{getIcon(section.icon)}</span>
        <span className="flex-1 text-left">{section.name}</span>
        <ChevronRight className={clsx('w-4 h-4 transition-transform', isOpen && 'rotate-90')} />
      </button>
      {isOpen && (
        <div className="ml-4 pl-2 border-l border-slate-200 space-y-1">
          {visibleItems.map((item) => (
            <NavItem key={item.id} to={item.path} icon={getIcon(item.icon)} label={item.name} />
          ))}
        </div>
      )}
    </div>
  );
});

export function AppShell() {
  const { token, me, isLoading, logout, has } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpenState] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch navigation data
  const navQuery = useQuery<{ sections: NavSectionData[]; standaloneItems: NavItemData[] }>({
    queryKey: ['navigation'],
    enabled: !!token,
    queryFn: () => apiFetch('/api/navigation'),
    staleTime: 5 * 60 * 1000 // 5 dakika cache
  });

  const unreadNotifQ = useQuery({
    queryKey: ['notifications', { unreadOnly: true, page: 1, pageSize: 1 }],
    enabled: !!token && has('notification.read'),
    queryFn: () => apiFetch<{ total: number }>(`/api/notifications?unreadOnly=true&page=1&pageSize=1`),
    staleTime: 30_000,
    refetchInterval: 60_000
  });

  useEffect(() => {
    if (!isLoading && !token) nav('/login', { replace: true });
  }, [isLoading, token, nav]);

  useEffect(() => {
    initDefaultShortcuts();
    setHelpModalState(setHelpModalOpenState);
  }, []);

  useKeyboardShortcuts();

  useEffect(() => {
    setSidebarOpen(false);
    setProfileDropdownOpen(false);
  }, [location]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [profileDropdownOpen]);

  // Filter standalone items by permission
  const visibleStandaloneItems = useMemo(() => {
    if (!navQuery.data) return [];
    return navQuery.data.standaloneItems.filter(item => !item.permission || has(item.permission));
  }, [navQuery.data, has]);

  // Load dashboard icon for sidebar header
  const DashboardIcon = useMemo(() => {
    return loadIcon('LayoutDashboard') || LinkIcon;
  }, []);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Skeleton className="h-12 w-12 mx-auto rounded-full" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }
  if (!token) return null;

  const pathLabels: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/tickets': 'Destek Talepleri',
    '/profile': 'Profilim',
    '/notifications': 'Bildirimler',
    '/sessions': 'Sessionlar',
    '/settings': 'Ayarlar',
    '/2fa': '2FA',
    '/logs': 'Sistem Logları',
    '/groups': 'Gruplar',
    '/bulk': 'Toplu İşlemler',
    '/import-export': 'İçe/Dışa Aktar',
    '/reports': 'Raporlar',
    '/admin/permissions': 'Yetkiler',
    '/admin/permission-templates': 'Yetki Şablonları',
    '/admin/roles': 'Roller',
    '/admin/users': 'Kullanıcılar',
    '/admin/navigation': 'Navigasyon'
  };

  const currentPath = location.pathname.split('/').slice(0, 2).join('/') || '/tickets';
  const breadcrumb = pathLabels[location.pathname] || pathLabels[currentPath] || 'Ana Sayfa';

  return (
    <div className="h-full flex">
      <KeyboardShortcutsHelp open={helpModalOpen} onClose={() => setHelpModalOpenState(false)} />
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed lg:static inset-y-0 left-0 z-50 w-72 border-r border-slate-200/70 bg-white/95 backdrop-blur-md p-4 flex flex-col gap-6 transition-all',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <DashboardIcon className="w-5 h-5" />
            <span className="text-lg">Ticket System</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 overflow-y-auto scrollbar-hide">
          {navQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              {/* Standalone items (ana menü) */}
              {visibleStandaloneItems.map((item) => (
                <NavItem key={item.id} to={item.path} icon={getIcon(item.icon)} label={item.name} />
              ))}

              {/* Sections */}
              {navQuery.data?.sections.map((section) => (
                <NavSection key={section.id} section={section} has={has} />
              ))}
            </>
          )}
        </nav>

        <div className="mt-auto border-t border-slate-200/70 pt-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border-2 border-slate-300">
              {me?.user.avatarUrl ? (
                <img
                  src={me.user.avatarUrl}
                  alt={me.user.name || me.user.email}
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserCircle className="w-6 h-6 text-slate-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate">{me?.user.name ?? '—'}</div>
              <div className="text-xs text-slate-500 truncate">{me?.user.email}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {me?.roles?.map((r) => (
              <RoleBadge key={r.id} icon={r.label} color={r.color} text={r.name} />
            ))}
          </div>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              logout();
              nav('/login', { replace: true });
            }}
          >
            Çıkış
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-slate-50/50">
        <div className="max-w-7xl mx-auto p-4 lg:p-6">
          {/* Mobile Menu Button */}
          <div className="lg:hidden mb-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-slate-100 border border-slate-200"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* Top Bar */}
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <div className="text-sm text-slate-500">
                <NavLink to="/tickets" className="hover:text-slate-700">
                  Ana Sayfa
                </NavLink>
                {location.pathname !== '/tickets' && (
                  <>
                    <span className="mx-2">/</span>
                    <span className="text-slate-900">{breadcrumb}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Ticket Search */}
              <TicketSearch />

              {/* Notifications Button */}
              {has('notification.read') && (
                <button
                  onClick={() => nav('/notifications')}
                  className={clsx(
                    'relative p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-all',
                    (unreadNotifQ.data?.total ?? 0) > 0 && 'ring-2 ring-red-100'
                  )}
                  aria-label="Bildirimler"
                >
                  <Bell className={clsx(
                    'w-5 h-5 transition-all',
                    (unreadNotifQ.data?.total ?? 0) > 0 
                      ? 'text-red-500 animate-pulse' 
                      : 'text-slate-500'
                  )} />
                  {(unreadNotifQ.data?.total ?? 0) > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-medium leading-5 text-center shadow-sm">
                      {Math.min(99, unreadNotifQ.data!.total)}
                    </span>
                  )}
                </button>
              )}

              {/* Profile Dropdown */}
              <div className="relative" ref={profileDropdownRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-slate-300">
                    {me?.user.avatarUrl ? (
                      <img
                        src={me.user.avatarUrl}
                        alt={me.user.name || me.user.email}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <UserCircle className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <span className="hidden sm:inline font-medium text-slate-700">{me?.user.name || me?.user.email}</span>
                  <ChevronDown className={clsx('w-4 h-4 text-slate-400 transition-transform', profileDropdownOpen && 'rotate-180')} />
                </button>
                
                {profileDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-slate-200 bg-white shadow-lg z-50">
                    <div className="p-2">
                      <NavLink
                        to="/profile"
                        onClick={() => setProfileDropdownOpen(false)}
                        className={clsx(
                          'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                          location.pathname === '/profile'
                            ? 'bg-slate-100 text-slate-900'
                            : 'text-slate-700 hover:bg-slate-50'
                        )}
                      >
                        <UserCircle className="w-4 h-4" />
                        Profilim
                      </NavLink>
                      {has('session.read') && (
                        <NavLink
                          to="/sessions"
                          onClick={() => setProfileDropdownOpen(false)}
                          className={clsx(
                            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                            location.pathname === '/sessions'
                              ? 'bg-slate-100 text-slate-900'
                              : 'text-slate-700 hover:bg-slate-50'
                          )}
                        >
                          <Smartphone className="w-4 h-4" />
                          Sessionlar
                        </NavLink>
                      )}
                      {has('auth.2fa.manage') && (
                        <NavLink
                          to="/2fa"
                          onClick={() => setProfileDropdownOpen(false)}
                          className={clsx(
                            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                            location.pathname === '/2fa'
                              ? 'bg-slate-100 text-slate-900'
                              : 'text-slate-700 hover:bg-slate-50'
                          )}
                        >
                          <Lock className="w-4 h-4" />
                          2FA
                        </NavLink>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Outlet />
        </div>
      </main>
    </div>
  );
}
