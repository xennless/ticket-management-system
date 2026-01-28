import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

// Request ID'yi her istek için oluştur ve header'a ekle
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // Eğer client tarafından gönderilmişse onu kullan, yoksa yeni oluştur
  const requestId = (req.headers['x-request-id'] as string) || 
                    randomBytes(16).toString('hex');
  
  // Request objesine ekle (loglama için)
  (req as any).requestId = requestId;
  
  // Response header'a ekle
  res.setHeader('X-Request-ID', requestId);
  
  next();
}

