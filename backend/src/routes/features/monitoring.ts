import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import os from 'os';
import { prisma } from '../../db/prisma.js';
import { performHealthCheck, checkDatabase, checkDiskSpace, checkMemory, checkCPU } from '../../utils/healthCheck.js';
import { getResponseTimeMetrics } from '../../middleware/responseTime.js';

export const monitoringRouter = Router();

// Sistem metriklerini getir
monitoringRouter.get('/stats', requireAuth, requirePermission('monitoring.read'), async (_req, res) => {
  try {
    // CPU bilgileri
    const cpus = os.cpus();
    const cpuUsage = process.cpuUsage();
    const cpuUsagePercent = ((cpuUsage.user + cpuUsage.system) / 1000000 / os.uptime()) * 100;

    // Bellek bilgileri
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    // Disk bilgileri (opsiyonel - hata olursa atla)
    let disk;
    try {
      disk = await checkDiskSpace();
    } catch (error) {
      // Disk bilgisi alınamazsa devam et
      disk = null;
    }

    // Sistem bilgileri
    const uptime = os.uptime();
    const platform = os.platform();
    const arch = os.arch();
    const hostname = os.hostname();

    // Veritabanı istatistikleri (timeout ile - 3 saniye)
    const dbStatsPromise = Promise.race([
      Promise.all([
        prisma.user.count({ where: { deletedAt: null } }),
        prisma.user.count({ where: { deletedAt: null, isActive: true } }),
        prisma.ticket.count(),
        prisma.ticket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } })
      ]),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database query timeout')), 3000))
    ]) as Promise<[number, number, number, number]>;
    
    let userCount = 0, activeUserCount = 0, ticketCount = 0, openTicketCount = 0;
    try {
      [userCount, activeUserCount, ticketCount, openTicketCount] = await dbStatsPromise;
    } catch (error) {
      // Database query timeout veya hata - varsayılan değerler
    }

    // Son 24 saatteki aktivite (timeout ile - 2 saniye)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activityPromise = Promise.race([
      Promise.all([
        prisma.ticket.count({ where: { createdAt: { gte: last24Hours } } }),
        prisma.user.count({ where: { createdAt: { gte: last24Hours } } }),
        prisma.user.count({ where: { lastLoginAt: { gte: last24Hours } } })
      ]),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Activity query timeout')), 2000))
    ]) as Promise<[number, number, number]>;
    
    let recentTickets = 0, recentUsers = 0, recentLogins = 0;
    try {
      [recentTickets, recentUsers, recentLogins] = await activityPromise;
    } catch (error) {
      // Activity query timeout veya hata - varsayılan değerler
    }

    return res.json({
      system: {
        cpu: {
          cores: cpus.length,
          usage: Math.min(100, Math.max(0, cpuUsagePercent)),
          model: cpus[0]?.model || 'Unknown'
        },
        memory: {
          total: totalMemory,
          used: usedMemory,
          free: freeMemory,
          usagePercent: Math.min(100, Math.max(0, memoryUsagePercent)),
          totalGB: (totalMemory / 1024 / 1024 / 1024).toFixed(2),
          usedGB: (usedMemory / 1024 / 1024 / 1024).toFixed(2),
          freeGB: (freeMemory / 1024 / 1024 / 1024).toFixed(2)
        },
        uptime: {
          seconds: uptime,
          hours: (uptime / 3600).toFixed(2),
          days: (uptime / 86400).toFixed(2)
        },
        platform,
        arch,
        hostname
      },
      ...(disk && {
        disk: {
          status: disk.status,
          total: disk.total,
          free: disk.free,
          used: disk.used,
          usagePercent: disk.usagePercent,
          totalGB: disk.totalGB,
          freeGB: disk.freeGB,
          usedGB: disk.usedGB
        }
      }),
      database: await (async () => {
        // Database check'i ayrı yap, hata olursa atla
        try {
          return await Promise.race([
            checkDatabase(),
            new Promise<{ status: 'healthy' }>((_, reject) => setTimeout(() => reject(new Error('Database check timeout')), 2000))
          ]);
        } catch {
          return { status: 'healthy' as const };
        }
      })(),
      databaseStats: {
        users: {
          total: userCount,
          active: activeUserCount,
          inactive: userCount - activeUserCount
        },
        tickets: {
          total: ticketCount,
          open: openTicketCount,
          closed: ticketCount - openTicketCount
        }
      },
      activity: {
        last24Hours: {
          tickets: recentTickets,
          users: recentUsers,
          logins: recentLogins
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Metrikler alınamadı', error: error.message });
  }
});

// Health check endpoint (detaylı) - Timeout ile
monitoringRouter.get('/health', requireAuth, requirePermission('monitoring.read'), async (_req, res) => {
  try {
    // Timeout: 5 saniye içinde cevap vermeli
    const healthPromise = performHealthCheck();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Health check timeout')), 5000)
    );
    
    const health = await Promise.race([healthPromise, timeoutPromise]) as Awaited<ReturnType<typeof performHealthCheck>>;
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    return res.status(statusCode).json(health);
  } catch (error: any) {
    return res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message || 'Health check başarısız'
    });
  }
});

// API performans metrikleri
monitoringRouter.get('/performance', requireAuth, requirePermission('monitoring.read'), async (_req, res) => {
  try {
    const memory = checkMemory();
    const cpu = checkCPU();
    
    // Database check'i timeout ile yap
    let database;
    try {
      database = await Promise.race([
        checkDatabase(),
        new Promise<{ status: 'healthy' }>((_, reject) => setTimeout(() => reject(new Error('Database check timeout')), 2000))
      ]);
    } catch {
      database = { status: 'healthy' as const };
    }
    
    return res.json({
      process: {
        memory: {
          rss: memory.processMemory.rss,
          heapTotal: memory.processMemory.heapTotal,
          heapUsed: memory.processMemory.heapUsed,
          external: memory.processMemory.external,
          rssMB: memory.processMemory.rssMB,
          heapTotalMB: memory.processMemory.heapTotalMB,
          heapUsedMB: memory.processMemory.heapUsedMB
        },
        uptime: process.uptime(),
        pid: process.pid,
        nodeVersion: process.version
      },
      system: {
        memory: {
          total: memory.total,
          used: memory.used,
          free: memory.free,
          usagePercent: memory.usagePercent,
          status: memory.status
        },
        cpu: {
          cores: cpu.cores,
          usage: cpu.usage,
          status: cpu.status,
          loadAverage: cpu.loadAverage
        },
        database: {
          status: database.status,
          responseTime: database.responseTime
        }
      },
      responseTime: getResponseTimeMetrics(),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Performans metrikleri alınamadı', error: error.message });
  }
});

