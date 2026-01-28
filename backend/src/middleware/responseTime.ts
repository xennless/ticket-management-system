import { Request, Response, NextFunction } from 'express';

// Response time metrikleri için basit bir store
const responseTimeMetrics: Array<{
  path: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: Date;
}> = [];

const MAX_METRICS = 500; // Son 500 isteği sakla (performans için azaltıldı)

/**
 * Response time middleware
 */
export function responseTimeMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    
    // Metrikleri kaydet
    responseTimeMetrics.push({
      path: req.path,
      method: req.method,
      responseTime,
      statusCode: res.statusCode,
      timestamp: new Date()
    });
    
    // Eski metrikleri temizle
    if (responseTimeMetrics.length > MAX_METRICS) {
      responseTimeMetrics.shift();
    }
  });
  
  next();
}

/**
 * Response time metriklerini getir
 */
export function getResponseTimeMetrics() {
  return {
    metrics: responseTimeMetrics.slice(-100), // Son 100 metrik
    summary: {
      total: responseTimeMetrics.length,
      average: responseTimeMetrics.length > 0
        ? responseTimeMetrics.reduce((sum, m) => sum + m.responseTime, 0) / responseTimeMetrics.length
        : 0,
      min: responseTimeMetrics.length > 0
        ? Math.min(...responseTimeMetrics.map(m => m.responseTime))
        : 0,
      max: responseTimeMetrics.length > 0
        ? Math.max(...responseTimeMetrics.map(m => m.responseTime))
        : 0,
      byPath: responseTimeMetrics.reduce((acc, m) => {
        if (!acc[m.path]) {
          acc[m.path] = { count: 0, totalTime: 0, avgTime: 0 };
        }
        acc[m.path].count++;
        acc[m.path].totalTime += m.responseTime;
        acc[m.path].avgTime = acc[m.path].totalTime / acc[m.path].count;
        return acc;
      }, {} as Record<string, { count: number; totalTime: number; avgTime: number }>),
      byStatusCode: responseTimeMetrics.reduce((acc, m) => {
        if (!acc[m.statusCode]) {
          acc[m.statusCode] = 0;
        }
        acc[m.statusCode]++;
        return acc;
      }, {} as Record<number, number>)
    }
  };
}

/**
 * Response time metriklerini temizle
 */
export function clearResponseTimeMetrics() {
  responseTimeMetrics.length = 0;
}

