import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { apiFetch, setToken as persistToken, getToken, onSessionTerminated, fetchCsrfToken } from './api';
import { startTokenRefresh, stopTokenRefresh } from './tokenRefresh';
import { startInactivityTimeout, stopInactivityTimeout } from './inactivityTimeout';
import { useToast } from '../ui/components/Toast';

export type Me = {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    isActive: boolean;
    lastLoginAt?: string | null;
    lastLoginIp?: string | null;
    activatedAt?: string | null;
    activatedBy?: { id: string; email: string; name: string | null } | null;
    deactivatedAt?: string | null;
    deactivatedBy?: { id: string; email: string; name: string | null } | null;
    createdAt?: string;
    updatedAt?: string;
  };
  roles: Array<{ id: string; code: string; name: string; label?: string | null; color?: string | null }>;
  permissions: Array<{ code: string; name: string }>;
};

type AuthContextValue = {
  token: string | null;
  me: Me | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  has: (perm: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getToken());
  const [me, setMe] = useState<Me | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  async function refreshMe() {
    if (!token) {
      setMe(null);
      return;
    }
    const res = await apiFetch<Me>('/api/auth/me', { auth: true });
    setMe(res);
  }

  async function login(email: string, password: string, twoFactorCode?: string, tempToken?: string) {
    const res = await apiFetch<{ token?: string; user?: any; requiresTwoFactor?: boolean; requiresPasswordChange?: boolean; tempToken?: string; userId?: string }>('/api/auth/login', {
      method: 'POST',
      auth: false,
      json: { email, password, twoFactorCode, tempToken }
    });
    
    // 2FA gerekliyse response'u döndür (frontend 2FA adımını gösterecek)
    if (res.requiresTwoFactor) {
      return { requiresTwoFactor: true, tempToken: res.tempToken, userId: res.userId };
    }
    
    // Zorunlu şifre değişikliği gerekliyse response'u döndür
    if (res.requiresPasswordChange) {
      return { requiresPasswordChange: true, tempToken: res.tempToken, userId: res.userId };
    }
    
    if (!res.token) {
      throw new Error('Giriş başarısız');
    }
    
    persistToken(res.token);
    setToken(res.token);
    return { success: true };
  }

  const logout = useCallback(() => {
    persistToken(null);
    setToken(null);
    setMe(null);
  }, []);

  const has = useCallback((perm: string) => !!me?.permissions?.some((p) => p.code === perm), [me?.permissions]);

  // Listen for session terminated events
  useEffect(() => {
    const cleanup = onSessionTerminated(() => {
      console.log('[Auth] Session terminated by another session');
      logout();
      // Show alert to user
      alert('Oturumunuz başka bir yerden sonlandırıldı. Lütfen tekrar giriş yapın.');
      window.location.href = '/login';
    });
    return cleanup;
  }, [logout]);

  // Uygulama başladığında CSRF token'ı al
  useEffect(() => {
    fetchCsrfToken().catch(console.error);
  }, []);

  // Token refresh mekanizması
  useEffect(() => {
    if (!token) {
      stopTokenRefresh();
      return;
    }

    const cleanup = startTokenRefresh(60); // Her 60 saniyede bir kontrol et
    return cleanup;
  }, [token]);

  // Inactivity timeout
  useEffect(() => {
    if (!token) {
      stopInactivityTimeout();
      return;
    }

    const cleanup = startInactivityTimeout(
      30, // 30 dakika inactivity timeout
      5,  // 5 dakika kala uyarı ver
      () => {
        // Timeout - logout
        logout();
        window.location.href = '/login';
      },
      (secondsLeft) => {
        // Warning - kullanıcıya uyarı göster
        const minutes = Math.floor(secondsLeft / 60);
        const seconds = secondsLeft % 60;
        const message = `Oturumunuz ${minutes} dakika ${seconds} saniye sonra sonlanacak. Lütfen aktif kalın.`;
        // Toast göster (eğer ToastProvider mevcutsa)
        if (typeof window !== 'undefined' && (window as any).toast) {
          (window as any).toast.push({
            type: 'warning',
            title: 'Oturum Sonlanıyor',
            message
          });
        } else {
          // Fallback: alert
          alert(message);
        }
      }
    );

    return cleanup;
  }, [token, logout]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        if (token) await refreshMe();
      } catch {
        // token invalid vs.
        if (!cancelled) logout();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({ token, me, isLoading, login, logout, refreshMe, has }),
    [token, me, isLoading, has, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth AuthProvider dışında kullanılamaz');
  return ctx;
}
