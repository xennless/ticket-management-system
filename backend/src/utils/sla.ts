import { TicketPriority, PrismaClient } from '@prisma/client';

// Varsayılan SLA süreleri (dinamik SLA bulunamazsa kullanılır - dakika cinsinden)
const DEFAULT_SLA_TIMES: Record<TicketPriority, { firstResponse: number; resolution: number }> = {
  LOW: { firstResponse: 24 * 60, resolution: 72 * 60 }, // 24 saat, 72 saat
  MEDIUM: { firstResponse: 12 * 60, resolution: 48 * 60 }, // 12 saat, 48 saat
  HIGH: { firstResponse: 4 * 60, resolution: 24 * 60 }, // 4 saat, 24 saat
  URGENT: { firstResponse: 60, resolution: 8 * 60 } // 1 saat, 8 saat
};

export type SLAStatus = 'on_time' | 'at_risk' | 'breached';

export interface SLACalculation {
  firstResponseSLA: number; // dakika
  resolutionSLA: number; // saat
  firstResponseDeadline: Date | null;
  resolutionDeadline: Date | null;
  firstResponseStatus: SLAStatus | null;
  resolutionStatus: SLAStatus | null;
  overallStatus: SLAStatus | null;
  slaId?: string | null;
}

/**
 * Ticket için uygun SLA'yı bul
 */
export async function findSLAForTicket(
  prisma: PrismaClient,
  priority: TicketPriority,
  categoryId: string | null
): Promise<{ firstResponseTime: number | null; resolutionTime: number | null; slaId: string | null }> {
  // Önce kategori + öncelik kombinasyonunu ara
  if (categoryId) {
    const slaByCategoryAndPriority = await prisma.ticketSLA.findFirst({
      where: {
        categoryId,
        priority,
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (slaByCategoryAndPriority) {
      return {
        firstResponseTime: slaByCategoryAndPriority.firstResponseTime,
        resolutionTime: slaByCategoryAndPriority.resolutionTime,
        slaId: slaByCategoryAndPriority.id
      };
    }
  }

  // Sadece kategori bazlı SLA ara
  if (categoryId) {
    const slaByCategory = await prisma.ticketSLA.findFirst({
      where: {
        categoryId,
        priority: null,
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (slaByCategory) {
      return {
        firstResponseTime: slaByCategory.firstResponseTime,
        resolutionTime: slaByCategory.resolutionTime,
        slaId: slaByCategory.id
      };
    }
  }

  // Sadece öncelik bazlı SLA ara
  const slaByPriority = await prisma.ticketSLA.findFirst({
    where: {
      priority,
      categoryId: null,
      isActive: true
    },
    orderBy: { createdAt: 'desc' }
  });

  if (slaByPriority) {
    return {
      firstResponseTime: slaByPriority.firstResponseTime,
      resolutionTime: slaByPriority.resolutionTime,
      slaId: slaByPriority.id
    };
  }

  // Varsayılan SLA'yı döndür
  const defaultTimes = DEFAULT_SLA_TIMES[priority];
  return {
    firstResponseTime: defaultTimes.firstResponse,
    resolutionTime: defaultTimes.resolution,
    slaId: null
  };
}

/**
 * Ticket için SLA hesaplama (dinamik)
 */
export async function calculateSLA(
  prisma: PrismaClient,
  priority: TicketPriority,
  categoryId: string | null,
  createdAt: Date,
  firstRespondedAt: Date | null,
  resolvedAt: Date | null
): Promise<SLACalculation> {
  const slaConfig = await findSLAForTicket(prisma, priority, categoryId);
  
  const firstResponseTime = slaConfig.firstResponseTime ?? DEFAULT_SLA_TIMES[priority].firstResponse;
  const resolutionTime = slaConfig.resolutionTime ?? DEFAULT_SLA_TIMES[priority].resolution;
  
  const now = new Date();
  
  // İlk yanıt deadline
  const firstResponseDeadline = firstResponseTime 
    ? new Date(createdAt.getTime() + firstResponseTime * 60 * 1000)
    : null;
  
  // Çözüm deadline (ilk yanıt varsa ondan, yoksa oluşturulma tarihinden)
  const resolutionStart = firstRespondedAt || createdAt;
  const resolutionDeadline = resolutionTime
    ? new Date(resolutionStart.getTime() + resolutionTime * 60 * 60 * 1000)
    : null;
  
  // İlk yanıt durumu
  let firstResponseStatus: SLAStatus | null = null;
  if (firstResponseTime) {
    if (firstRespondedAt) {
      const elapsed = (firstRespondedAt.getTime() - createdAt.getTime()) / (60 * 1000); // dakika
      const percent = elapsed / firstResponseTime;
      if (percent > 1) firstResponseStatus = 'breached';
      else if (percent > 0.8) firstResponseStatus = 'at_risk';
      else firstResponseStatus = 'on_time';
    } else {
      // Henüz yanıtlanmadı
      const elapsed = (now.getTime() - createdAt.getTime()) / (60 * 1000);
      const percent = elapsed / firstResponseTime;
      if (percent > 1) firstResponseStatus = 'breached';
      else if (percent > 0.8) firstResponseStatus = 'at_risk';
      else firstResponseStatus = 'on_time';
    }
  }
  
  // Çözüm durumu
  let resolutionStatus: SLAStatus | null = null;
  if (resolutionTime) {
    if (resolvedAt) {
      const elapsed = (resolvedAt.getTime() - resolutionStart.getTime()) / (60 * 1000); // dakika
      const percent = elapsed / (resolutionTime * 60);
      if (percent > 1) resolutionStatus = 'breached';
      else if (percent > 0.8) resolutionStatus = 'at_risk';
      else resolutionStatus = 'on_time';
    } else {
      // Henüz çözülmedi
      const elapsed = (now.getTime() - resolutionStart.getTime()) / (60 * 1000);
      const percent = elapsed / (resolutionTime * 60);
      if (percent > 1) resolutionStatus = 'breached';
      else if (percent > 0.8) resolutionStatus = 'at_risk';
      else resolutionStatus = 'on_time';
    }
  }
  
  // Genel durum (en kötü olan)
  const overallStatus: SLAStatus = 
    firstResponseStatus === 'breached' || resolutionStatus === 'breached' ? 'breached' :
    firstResponseStatus === 'at_risk' || resolutionStatus === 'at_risk' ? 'at_risk' :
    'on_time';
  
  return {
    firstResponseSLA: firstResponseTime,
    resolutionSLA: resolutionTime,
    firstResponseDeadline,
    resolutionDeadline,
    firstResponseStatus,
    resolutionStatus,
    overallStatus,
    slaId: slaConfig.slaId
  };
}

/**
 * Ticket güncellendiğinde SLA'yı güncelle (dinamik)
 */
export async function updateTicketSLA(
  prisma: PrismaClient,
  ticket: {
    priority: TicketPriority;
    categoryId: string | null;
    createdAt: Date;
    firstRespondedAt: Date | null;
    resolvedAt: Date | null;
  }
) {
  const sla = await calculateSLA(
    prisma,
    ticket.priority,
    ticket.categoryId,
    ticket.createdAt,
    ticket.firstRespondedAt,
    ticket.resolvedAt
  );
  
  return {
    firstResponseSLA: sla.firstResponseSLA,
    resolutionSLA: sla.resolutionSLA,
    slaStatus: sla.overallStatus,
    slaId: sla.slaId
  };
}

