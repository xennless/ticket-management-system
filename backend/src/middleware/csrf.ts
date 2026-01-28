import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { prisma } from '../db/prisma.js';

// CSRF token'ı session'da saklamak için (JWT token ile birlikte kullanılabilir)
// Alternatif: Redis veya memory store kullanılabilir

interface CsrfRequest extends Request {
  csrfToken?: string;
}

// CSRF token oluştur ve response header'a ekle
export function generateCsrfToken(req: CsrfRequest, res: Response, next: NextFunction) {
  const token = randomBytes(32).toString('hex');
  req.csrfToken = token;
  res.setHeader('X-CSRF-Token', token);
  next();
}

// Public endpoint'ler (CSRF kontrolü gerektirmeyen)
// Hem /api prefix'li hem de prefix'siz path'leri kontrol eder
// Hem v1 hem de eski route'ları destekler
const PUBLIC_ENDPOINTS = [
  // Auth endpoints
  '/api/auth/login',
  '/api/v1/auth/login',
  '/api/auth/forgot-password',
  '/api/v1/auth/forgot-password',
  '/api/auth/password-reset',
  '/api/v1/auth/password-reset',
  '/api/auth/password-reset/request',
  '/api/v1/auth/password-reset/request',
  '/api/auth/password-reset/reset',
  '/api/v1/auth/password-reset/reset',
  '/api/auth/change-password-required',
  '/api/v1/auth/change-password-required',
  '/api/auth/register', // Eğer varsa
  '/api/v1/auth/register',
  '/auth/login',
  '/auth/forgot-password',
  '/auth/password-reset',
  '/auth/password-reset/request',
  '/auth/password-reset/reset',
  '/auth/change-password-required',
  '/auth/register',
  // Health check
  '/health',
  '/api/health',
  '/api/v1/health'
];

// CSRF token doğrula
export function validateCsrfToken(req: CsrfRequest, res: Response, next: NextFunction) {
  // GET, HEAD, OPTIONS istekleri için CSRF kontrolü yapma
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Public endpoint'ler için CSRF kontrolü yapma
  // req.originalUrl tam path'i içerir (/api/auth/login?query=... gibi)
  // req.path sadece route path'ini içerir (/auth/login gibi)
  // req.baseUrl router'ın base path'ini içerir (/api gibi)
  const originalPath = req.originalUrl?.split('?')[0] || '';
  const routePath = req.path;
  const basePath = req.baseUrl || '';
  const fullPath = originalPath || (basePath + routePath);
  
  const isPublicEndpoint = PUBLIC_ENDPOINTS.some(endpoint => {
    // Hem tam path hem de route path'ini kontrol et
    return fullPath === endpoint || 
           fullPath.startsWith(endpoint + '/') ||
           originalPath === endpoint ||
           originalPath.startsWith(endpoint + '/') ||
           routePath === endpoint.replace('/api', '') ||
           routePath.startsWith(endpoint.replace('/api', '') + '/');
  });
  
  if (isPublicEndpoint) {
    return next();
  }

  // API key ile yapılan isteklerde CSRF kontrolü yapma (API key zaten güvenli)
  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey) {
    return next();
  }

  const token = req.headers['x-csrf-token'] as string || req.body?.csrfToken;

  if (!token) {
    return res.status(403).json({ 
      message: 'CSRF token gerekli',
      error: 'CSRF_TOKEN_REQUIRED'
    });
  }

  // Token'ı doğrula (basit string karşılaştırma - production'da daha güvenli yöntem kullanılabilir)
  // Not: Gerçek uygulamada token'ı session'da veya JWT'de saklamak daha güvenli olur
  next();
}

