import { config } from '../config';

export type ApiError = {
  message: string;
  code?: string;
  issues?: unknown;
  status?: number;
};

const TOKEN_KEY = 'ticket_token';
const CSRF_TOKEN_KEY = 'csrf_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (!token) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, token);
}

// CSRF token yönetimi
let csrfToken: string | null = null;

export function getCsrfToken(): string | null {
  return csrfToken || localStorage.getItem(CSRF_TOKEN_KEY);
}

export function setCsrfToken(token: string | null) {
  csrfToken = token;
  if (token) {
    localStorage.setItem(CSRF_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(CSRF_TOKEN_KEY);
  }
}

// CSRF token'ı backend'den al (herhangi bir GET endpoint'inden)
export async function fetchCsrfToken(): Promise<string | null> {
  try {
    // Health endpoint'ine GET isteği yaparak CSRF token al (public endpoint)
    const res = await fetch(`${config.apiBaseUrl}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    const token = res.headers.get('X-CSRF-Token');
    if (token) {
      setCsrfToken(token);
      return token;
    }
  } catch (error) {
    console.warn('CSRF token alınamadı:', error);
  }
  return null;
}

// Session terminated event for handling forced logout
const SESSION_TERMINATED_EVENT = 'session:terminated';

export function onSessionTerminated(callback: () => void) {
  window.addEventListener(SESSION_TERMINATED_EVENT, callback);
  return () => window.removeEventListener(SESSION_TERMINATED_EVENT, callback);
}

function dispatchSessionTerminated() {
  window.dispatchEvent(new CustomEvent(SESSION_TERMINATED_EVENT));
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown; auth?: boolean }
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init?.json ? { 'Content-Type': 'application/json' } : {}),
    ...(init?.headers ? (init.headers as any) : {})
  };

  const auth = init?.auth ?? true;
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  // POST, PUT, DELETE, PATCH istekleri için CSRF token ekle (public endpoint'ler hariç)
  const method = (init?.method || 'GET').toUpperCase();
  const isPublicEndpoint = 
    path.startsWith('/api/auth/login') || 
    path.startsWith('/api/auth/forgot-password') || 
    path.startsWith('/api/auth/password-reset') ||
    path.startsWith('/api/auth/change-password-required') ||
    path.startsWith('/api/v1/auth/login') ||
    path.startsWith('/api/v1/auth/forgot-password') ||
    path.startsWith('/api/v1/auth/password-reset') ||
    path.startsWith('/api/v1/auth/change-password-required') ||
    path === '/health' ||
    path === '/api/health' ||
    path === '/api/v1/health';
  
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && !isPublicEndpoint) {
    let csrfToken = getCsrfToken();
    if (!csrfToken) {
      // Token yoksa al (await ile bekle)
      csrfToken = await fetchCsrfToken();
    }
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }

  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers,
    body: init?.json ? JSON.stringify(init.json) : init?.body
  });

  // Response'dan CSRF token'ı al ve sakla
  const responseCsrfToken = res.headers.get('X-CSRF-Token');
  if (responseCsrfToken) {
    setCsrfToken(responseCsrfToken);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err = (data ?? { message: res.statusText }) as ApiError;
    err.status = res.status;
    
    // 401 Unauthorized - token expired veya invalid
    if (res.status === 401) {
      // Session terminated handling
      if (err.code === 'SESSION_TERMINATED') {
        setToken(null);
        dispatchSessionTerminated();
      } else if (!path.includes('/refresh') && !path.includes('/login')) {
        // Token expired - refresh dene (refresh endpoint'i hariç, sonsuz döngüyü önlemek için)
        const { refreshToken } = await import('./tokenRefresh');
        const newToken = await refreshToken();
        
        if (newToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(init?.method || 'GET')) {
          // Token refresh başarılı, isteği tekrar dene (sadece state-changing methodlar için)
          // GET istekleri için retry yapmıyoruz çünkü side effect olabilir
          const retryHeaders: Record<string, string> = {
            Accept: 'application/json',
            ...(init?.json ? { 'Content-Type': 'application/json' } : {}),
            ...(init?.headers ? (init.headers as any) : {})
          };
          
          retryHeaders.Authorization = `Bearer ${newToken}`;
          
          // CSRF token ekle
          const method = (init?.method || 'GET').toUpperCase();
          const isPublicEndpoint = 
            path.startsWith('/api/auth/login') || 
            path.startsWith('/api/auth/forgot-password') || 
            path.startsWith('/api/auth/password-reset') ||
            path.startsWith('/api/auth/change-password-required') ||
            path.startsWith('/api/v1/auth/login') ||
            path.startsWith('/api/v1/auth/forgot-password') ||
            path.startsWith('/api/v1/auth/password-reset') ||
            path.startsWith('/api/v1/auth/change-password-required') ||
            path === '/health' ||
            path === '/api/health' ||
            path === '/api/v1/health';
          
          if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && !isPublicEndpoint) {
            const csrfToken = getCsrfToken();
            if (csrfToken) {
              retryHeaders['X-CSRF-Token'] = csrfToken;
            }
          }
          
          const retryRes = await fetch(`${config.apiBaseUrl}${path}`, {
            ...init,
            headers: retryHeaders,
            body: init?.json ? JSON.stringify(init.json) : init?.body
          });
          
          if (retryRes.status === 204) return undefined as T;
          
          const retryText = await retryRes.text();
          const retryData = retryText ? JSON.parse(retryText) : null;
          
          if (retryRes.ok) {
            return retryData as T;
          }
        } else if (!newToken) {
          // Token refresh başarısız - logout
          setToken(null);
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
      }
    }
    
    throw err;
  }
  return data as T;
}
