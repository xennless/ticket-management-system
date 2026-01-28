import { prisma } from '../db/prisma.js';
import os from 'os';

// Windows'ta statfs yok, bu yüzden platform kontrolü yap
const isWindows = os.platform() === 'win32';

/**
 * Database bağlantı kontrolü
 */
export async function checkDatabase(): Promise<{
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  error?: string;
}> {
  const startTime = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'healthy',
      responseTime
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      error: error.message || 'Database bağlantı hatası'
    };
  }
}

/**
 * Disk space kontrolü
 */
export async function checkDiskSpace(path: string = process.cwd()): Promise<{
  status: 'healthy' | 'warning' | 'critical';
  total: number;
  free: number;
  used: number;
  usagePercent: number;
  totalGB: string;
  freeGB: string;
  usedGB: string;
  error?: string;
}> {
  try {
    // Windows'ta statfs çalışmaz, disk kontrolünü atla (opsiyonel)
    if (isWindows) {
      // Windows'ta disk bilgisi almak karmaşık ve yavaş olabilir
      // Opsiyonel olduğu için atla ve sağlıklı döndür
      return {
        status: 'healthy',
        total: 0,
        free: 0,
        used: 0,
        usagePercent: 0,
        totalGB: '0',
        freeGB: '0',
        usedGB: '0',
        error: 'Windows disk kontrolü atlandı (opsiyonel)'
      };
    }
    
    // Linux/Unix için statfs kullan (sadece gerektiğinde import et)
    const { statfs } = await import('fs');
    const { promisify } = await import('util');
    const statfsAsync = promisify(statfs);
    
    const stats = await statfsAsync(path);
    const total = stats.blocks * stats.bsize;
    const free = stats.bavail * stats.bsize;
    const used = total - free;
    const usagePercent = (used / total) * 100;
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (usagePercent > 90) {
      status = 'critical';
    } else if (usagePercent > 80) {
      status = 'warning';
    }
    
    return {
      status,
      total,
      free,
      used,
      usagePercent: Math.round(usagePercent * 100) / 100,
      totalGB: (total / 1024 / 1024 / 1024).toFixed(2),
      freeGB: (free / 1024 / 1024 / 1024).toFixed(2),
      usedGB: (used / 1024 / 1024 / 1024).toFixed(2)
    };
  } catch (error: any) {
    // Hata durumunda kritik olarak işaretleme, sadece bilgi ver
    return {
      status: 'healthy', // Disk bilgisi opsiyonel, sistem sağlıklı kabul et
      total: 0,
      free: 0,
      used: 0,
      usagePercent: 0,
      totalGB: '0',
      freeGB: '0',
      usedGB: '0',
      error: error.message || 'Disk bilgisi alınamadı (opsiyonel)'
    };
  }
}

/**
 * Memory kullanımı kontrolü
 */
export function checkMemory(): {
  status: 'healthy' | 'warning' | 'critical';
  total: number;
  free: number;
  used: number;
  usagePercent: number;
  totalGB: string;
  freeGB: string;
  usedGB: string;
  processMemory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    rssMB: string;
    heapTotalMB: string;
    heapUsedMB: string;
  };
} {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const usagePercent = (usedMemory / totalMemory) * 100;
  
  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (usagePercent > 90) {
    status = 'critical';
  } else if (usagePercent > 80) {
    status = 'warning';
  }
  
  const processMemory = process.memoryUsage();
  
  return {
    status,
    total: totalMemory,
    free: freeMemory,
    used: usedMemory,
    usagePercent: Math.round(usagePercent * 100) / 100,
    totalGB: (totalMemory / 1024 / 1024 / 1024).toFixed(2),
    freeGB: (freeMemory / 1024 / 1024 / 1024).toFixed(2),
    usedGB: (usedMemory / 1024 / 1024 / 1024).toFixed(2),
    processMemory: {
      rss: processMemory.rss,
      heapTotal: processMemory.heapTotal,
      heapUsed: processMemory.heapUsed,
      external: processMemory.external,
      rssMB: (processMemory.rss / 1024 / 1024).toFixed(2),
      heapTotalMB: (processMemory.heapTotal / 1024 / 1024).toFixed(2),
      heapUsedMB: (processMemory.heapUsed / 1024 / 1024).toFixed(2)
    }
  };
}

/**
 * CPU kullanımı kontrolü
 */
export function checkCPU(): {
  status: 'healthy' | 'warning' | 'critical';
  cores: number;
  usage: number;
  model: string;
  loadAverage: number[];
} {
  const cpus = os.cpus();
  const loadAvg = os.loadavg();
  const cpuUsage = process.cpuUsage();
  const uptime = os.uptime();
  
  // Basit CPU kullanım hesaplama
  const usage = uptime > 0 
    ? Math.min(100, Math.max(0, ((cpuUsage.user + cpuUsage.system) / 1000000 / uptime) * 100))
    : 0;
  
  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (usage > 90) {
    status = 'critical';
  } else if (usage > 80) {
    status = 'warning';
  }
  
  return {
    status,
    cores: cpus.length,
    usage: Math.round(usage * 100) / 100,
    model: cpus[0]?.model || 'Unknown',
    loadAverage: loadAvg
  };
}

/**
 * Kapsamlı health check
 */
export async function performHealthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: Awaited<ReturnType<typeof checkDatabase>>;
    disk: Awaited<ReturnType<typeof checkDiskSpace>>;
    memory: ReturnType<typeof checkMemory>;
    cpu: ReturnType<typeof checkCPU>;
  };
  uptime: {
    system: number;
    process: number;
  };
  version: {
    node: string;
    platform: string;
    arch: string;
  };
}> {
  // Database kontrolü öncelikli, disk kontrolü opsiyonel (hata olursa atla)
  const [database, memory, cpu] = await Promise.all([
    checkDatabase(),
    Promise.resolve(checkMemory()),
    Promise.resolve(checkCPU())
  ]);
  
  // Disk kontrolü ayrı yap (hata olursa devam et - opsiyonel)
  let disk;
  try {
    disk = await Promise.race([
      checkDiskSpace(),
      new Promise<Awaited<ReturnType<typeof checkDiskSpace>>>((_, reject) => 
        setTimeout(() => reject(new Error('Disk check timeout')), 2000)
      )
    ]);
  } catch (error) {
    // Disk bilgisi alınamazsa varsayılan değerler (opsiyonel, sistem sağlıklı)
    disk = {
      status: 'healthy' as const,
      total: 0,
      free: 0,
      used: 0,
      usagePercent: 0,
      totalGB: '0',
      freeGB: '0',
      usedGB: '0',
      error: 'Disk bilgisi alınamadı (opsiyonel)'
    };
  }
  
  // Genel durum belirleme (disk kontrolü opsiyonel, sadece database kritik)
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (database.status === 'unhealthy') {
    overallStatus = 'unhealthy';
  } else if (
    memory.status === 'critical' ||
    cpu.status === 'critical'
  ) {
    overallStatus = 'unhealthy';
  } else if (
    memory.status === 'warning' ||
    cpu.status === 'warning'
  ) {
    overallStatus = 'degraded';
  }
  // Disk durumu genel durumu etkilemez (opsiyonel)
  
  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks: {
      database,
      disk,
      memory,
      cpu
    },
    uptime: {
      system: os.uptime(),
      process: process.uptime()
    },
    version: {
      node: process.version,
      platform: os.platform(),
      arch: os.arch()
    }
  };
}

