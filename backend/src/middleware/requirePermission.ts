import type { Response, NextFunction } from 'express';
import type { Request } from 'express';
import { prisma } from '../db/prisma.js';

export function requirePermission(permissionCode: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: 'Yetkisiz: token gerekli' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true, deletedAt: true }
    });

    if (!user || user.deletedAt || !user.isActive) {
      return res.status(403).json({ message: 'Hesap pasif' });
    }

    const has = await prisma.userRole.findFirst({
      where: {
        userId,
        role: {
          permissions: { some: { permission: { code: permissionCode } } }
        }
      },
      select: { roleId: true }
    });

    if (!has) {
      return res.status(403).json({ message: 'Yetki yok', permission: permissionCode });
    }

    return next();
  };
}


