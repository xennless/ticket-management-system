import { getToken, setToken } from './api';
import { apiFetch } from './api';

let refreshTimer: number | null = null;
let refreshInProgress = false;

/**
 * JWT token'ı decode et (expiration kontrolü için)
 */
function decodeToken(token: string): { exp?: number; sub?: string } | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Token'ın süresi dolmak üzere mi kontrol et
 */
function isTokenExpiringSoon(token: string, thresholdSeconds: number = 300): boolean {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;

  const expirationTime = decoded.exp * 1000; // JWT exp saniye cinsinden
  const now = Date.now();
  const timeUntilExpiry = expirationTime - now;

  return timeUntilExpiry < thresholdSeconds * 1000; // 5 dakika kala
}

/**
 * Token'ı refresh et
 */
export async function refreshToken(): Promise<string | null> {
  if (refreshInProgress) {
    // Zaten refresh işlemi devam ediyor, bekle
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!refreshInProgress) {
          clearInterval(checkInterval);
          resolve(getToken());
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(null);
      }, 5000);
    });
  }

  const currentToken = getToken();
  if (!currentToken) return null;

  refreshInProgress = true;

  try {
    const response = await apiFetch<{ token: string }>('/api/v1/auth/refresh', {
      method: 'POST',
      auth: true
    });

    if (response.token) {
      setToken(response.token);
      refreshInProgress = false;
      return response.token;
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
    // Refresh başarısız, token'ı temizle
    setToken(null);
    refreshInProgress = false;
    return null;
  }

  refreshInProgress = false;
  return null;
}

/**
 * Token refresh mekanizmasını başlat
 */
export function startTokenRefresh(intervalSeconds: number = 60): () => void {
  // Mevcut timer'ı temizle
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  // Periyodik kontrol
  refreshTimer = window.setInterval(() => {
    const token = getToken();
    if (!token) return;

    // Token süresi dolmak üzereyse refresh et
    if (isTokenExpiringSoon(token, 300)) { // 5 dakika kala
      refreshToken().catch(console.error);
    }
  }, intervalSeconds * 1000);

  // Cleanup fonksiyonu
  return () => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  };
}

/**
 * Token refresh mekanizmasını durdur
 */
export function stopTokenRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

