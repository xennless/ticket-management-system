import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './ui/shell/AppShell';
import { LoginPage } from './ui/pages/LoginPage';
import { ForgotPasswordPage } from './ui/pages/ForgotPasswordPage';
import { ResetPasswordPage } from './ui/pages/ResetPasswordPage';
import { Skeleton } from './ui/components/Skeleton';
import { RequireTwoFactor } from './ui/components/RequireTwoFactor';

// Lazy loading for better performance
const TicketsPage = lazy(() => import('./ui/pages/TicketsPage').then(m => ({ default: m.TicketsPage })));
const TicketDetailPage = lazy(() => import('./ui/pages/TicketDetailPage').then(m => ({ default: m.TicketDetailPage })));
const CreateTicketPage = lazy(() => import('./ui/pages/CreateTicketPage').then(m => ({ default: m.CreateTicketPage })));
const ProfilePage = lazy(() => import('./ui/pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const DashboardPage = lazy(() => import('./ui/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const NotificationsPage = lazy(() => import('./ui/pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const SessionsPage = lazy(() => import('./ui/pages/SessionsPage').then(m => ({ default: m.SessionsPage })));
const SettingsPage = lazy(() => import('./ui/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const Auth2FAPage = lazy(() => import('./ui/pages/Auth2FAPage').then(m => ({ default: m.Auth2FAPage })));
const LogsPage = lazy(() => import('./ui/pages/LogsPage').then(m => ({ default: m.LogsPage })));
const GroupsPage = lazy(() => import('./ui/pages/GroupsPage').then(m => ({ default: m.GroupsPage })));
const MyGroupsPage = lazy(() => import('./ui/pages/MyGroupsPage').then(m => ({ default: m.MyGroupsPage })));
const BulkOperationsPage = lazy(() => import('./ui/pages/BulkOperationsPage').then(m => ({ default: m.BulkOperationsPage })));
const ImportExportPage = lazy(() => import('./ui/pages/ImportExportPage').then(m => ({ default: m.ImportExportPage })));
const ReportsPage = lazy(() => import('./ui/pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const PermissionsPage = lazy(() => import('./ui/pages/admin/PermissionsPage').then(m => ({ default: m.PermissionsPage })));
const PermissionTemplatesPage = lazy(() => import('./ui/pages/admin/PermissionTemplatesPage').then(m => ({ default: m.PermissionTemplatesPage })));
const RolesPage = lazy(() => import('./ui/pages/admin/RolesPage').then(m => ({ default: m.RolesPage })));
const UsersPage = lazy(() => import('./ui/pages/admin/UsersPage').then(m => ({ default: m.UsersPage })));
const NavigationPage = lazy(() => import('./ui/pages/admin/NavigationPage').then(m => ({ default: m.NavigationPage })));
const SLAsPage = lazy(() => import('./ui/pages/admin/SLAsPage').then(m => ({ default: m.SLAsPage })));
const TicketCategoriesPage = lazy(() => import('./ui/pages/admin/TicketCategoriesPage').then(m => ({ default: m.TicketCategoriesPage })));
const EmailPage = lazy(() => import('./ui/pages/admin/EmailPage').then(m => ({ default: m.EmailPage })));
const Admin2FAPage = lazy(() => import('./ui/pages/admin/Admin2FAPage').then(m => ({ default: m.Admin2FAPage })));
const AdminLockoutPage = lazy(() => import('./ui/pages/admin/AdminLockoutPage').then(m => ({ default: m.AdminLockoutPage })));
const AdminQuarantinePage = lazy(() => import('./ui/pages/admin/AdminQuarantinePage').then(m => ({ default: m.AdminQuarantinePage })));
const ApiKeysPage = lazy(() => import('./ui/pages/admin/ApiKeysPage').then(m => ({ default: m.ApiKeysPage })));
const ValidationPage = lazy(() => import('./ui/pages/admin/ValidationPage').then(m => ({ default: m.ValidationPage })));
const CompliancePage = lazy(() => import('./ui/pages/admin/CompliancePage').then(m => ({ default: m.CompliancePage })));

const LoadingFallback = () => (
  <div className="p-6 space-y-4">
    <Skeleton className="h-8 w-64" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-32 w-full" />
  </div>
);

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Suspense fallback={<LoadingFallback />}><DashboardPage /></Suspense> },
      { path: 'tickets', element: <Suspense fallback={<LoadingFallback />}><TicketsPage /></Suspense> },
      { path: 'tickets/new', element: <Suspense fallback={<LoadingFallback />}><CreateTicketPage /></Suspense> },
      { path: 'tickets/:id', element: <Suspense fallback={<LoadingFallback />}><TicketDetailPage /></Suspense> },
      { path: 'profile', element: <Suspense fallback={<LoadingFallback />}><ProfilePage /></Suspense> },
      { path: 'notifications', element: <Suspense fallback={<LoadingFallback />}><NotificationsPage /></Suspense> },
      { path: 'sessions', element: <Suspense fallback={<LoadingFallback />}><SessionsPage /></Suspense> },
      { path: 'settings', element: <Suspense fallback={<LoadingFallback />}><RequireTwoFactor><SettingsPage /></RequireTwoFactor></Suspense> },
      { path: 'auth/2fa', element: <Suspense fallback={<LoadingFallback />}><Auth2FAPage /></Suspense> },
      { path: '2fa', element: <Navigate to="/auth/2fa" replace /> },
      { path: 'logs', element: <Suspense fallback={<LoadingFallback />}><RequireTwoFactor><LogsPage /></RequireTwoFactor></Suspense> },
      { path: 'audit', element: <Navigate to="/logs?tab=audit" replace /> },
      { path: 'activity', element: <Navigate to="/logs?tab=activity" replace /> },
      { path: 'monitoring', element: <Navigate to="/logs?tab=monitoring" replace /> },
      { path: 'groups', element: <Suspense fallback={<LoadingFallback />}><GroupsPage /></Suspense> },
      { path: 'my-groups', element: <Suspense fallback={<LoadingFallback />}><MyGroupsPage /></Suspense> },
      { path: 'bulk', element: <Suspense fallback={<LoadingFallback />}><RequireTwoFactor><BulkOperationsPage /></RequireTwoFactor></Suspense> },
      { path: 'import-export', element: <Suspense fallback={<LoadingFallback />}><RequireTwoFactor><ImportExportPage /></RequireTwoFactor></Suspense> },
      { path: 'reports', element: <Suspense fallback={<LoadingFallback />}><RequireTwoFactor><ReportsPage /></RequireTwoFactor></Suspense> },
      { path: 'admin/permissions', element: <Suspense fallback={<LoadingFallback />}><RequireTwoFactor><PermissionsPage /></RequireTwoFactor></Suspense> },
      { path: 'admin/permission-templates', element: <Suspense fallback={<LoadingFallback />}><RequireTwoFactor><PermissionTemplatesPage /></RequireTwoFactor></Suspense> },
      { path: 'admin/roles', element: <Suspense fallback={<LoadingFallback />}><RequireTwoFactor><RolesPage /></RequireTwoFactor></Suspense> },
      { path: 'admin/users', element: <Suspense fallback={<LoadingFallback />}><RequireTwoFactor><UsersPage /></RequireTwoFactor></Suspense> },
      { path: 'admin/navigation', element: <Suspense fallback={<LoadingFallback />}><RequireTwoFactor><NavigationPage /></RequireTwoFactor></Suspense> },
      { path: 'admin/slas', element: <Suspense fallback={<LoadingFallback />}><RequireTwoFactor><SLAsPage /></RequireTwoFactor></Suspense> },
      { path: 'admin/ticket-categories', element: <Suspense fallback={<LoadingFallback />}><RequireTwoFactor><TicketCategoriesPage /></RequireTwoFactor></Suspense> },
      { path: 'admin/email', element: <Suspense fallback={<LoadingFallback />}><RequireTwoFactor><EmailPage /></RequireTwoFactor></Suspense> },
      { path: 'admin/2fa', element: <Suspense fallback={<LoadingFallback />}><RequireTwoFactor><Admin2FAPage /></RequireTwoFactor></Suspense> },
      { path: 'admin/lockout', element: <Suspense fallback={<LoadingFallback />}><RequireTwoFactor><AdminLockoutPage /></RequireTwoFactor></Suspense> },
      { path: 'admin/quarantine', element: <Suspense fallback={<LoadingFallback />}><RequireTwoFactor><AdminQuarantinePage /></RequireTwoFactor></Suspense> },
      { path: 'admin/api-keys', element: <Suspense fallback={<LoadingFallback />}><RequireTwoFactor><ApiKeysPage /></RequireTwoFactor></Suspense> },
      { path: 'admin/validation', element: <Suspense fallback={<LoadingFallback />}><RequireTwoFactor><ValidationPage /></RequireTwoFactor></Suspense> },
      { path: 'admin/compliance', element: <Suspense fallback={<LoadingFallback />}><RequireTwoFactor><CompliancePage /></RequireTwoFactor></Suspense> }
    ]
  }
]);
