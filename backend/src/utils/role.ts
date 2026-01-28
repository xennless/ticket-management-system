import { prisma } from '../db/prisma.js';

const SYSTEM_DEVELOPER_ROLE_CODE = 'system-developer';

/**
 * Kullanıcının system-developer rolüne sahip olup olmadığını kontrol eder
 */
export async function hasSystemDeveloperRole(userId: string): Promise<boolean> {
  const userRole = await prisma.userRole.findFirst({
    where: {
      userId,
      role: { code: SYSTEM_DEVELOPER_ROLE_CODE }
    },
    select: { roleId: true }
  });
  return !!userRole;
}

/**
 * Rolün system-developer rolü olup olmadığını kontrol eder
 */
export function isSystemDeveloperRole(roleCode: string): boolean {
  return roleCode === SYSTEM_DEVELOPER_ROLE_CODE;
}

// Backward compatibility aliases
export const hasSuperAdminRole = hasSystemDeveloperRole;
export const isSuperAdminRole = isSystemDeveloperRole;

