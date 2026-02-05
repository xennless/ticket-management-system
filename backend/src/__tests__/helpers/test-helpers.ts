import { hashPassword } from '../../utils/password.js';
import { signAccessToken } from '../../utils/jwt.js';
import { PrismaClient } from '@prisma/client';

// Test helper'lar için prisma instance'ı
function getTestPrisma(): PrismaClient {
  const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!testDbUrl) {
    throw new Error(
      'TEST_DATABASE_URL or DATABASE_URL must be set for integration tests.\n' +
      'Please add TEST_DATABASE_URL to your .env file.'
    );
  }
  return new PrismaClient({
    datasources: {
      db: {
        url: testDbUrl,
      },
    },
  });
}

/**
 * Test kullanıcısı oluştur
 */
export async function createTestUser(data?: {
  email?: string;
  password?: string;
  name?: string;
  isActive?: boolean;
  withProfilePermission?: boolean; // profile.read yetkisi ekle
}) {
  const email = data?.email || `test-${Date.now()}@example.com`;
  const password = data?.password || 'TestPassword123!';
  const passwordHash = await hashPassword(password);

  const testPrisma = getTestPrisma();
  
  // Eğer profile.read yetkisi isteniyorsa, önce permission'ı kontrol et/oluştur
  // Varsayılan olarak true (açıkça false verilmediği sürece)
  const shouldAddProfilePermission = data?.withProfilePermission !== false;
  
  if (shouldAddProfilePermission) {
    // profile.read permission'ını kontrol et veya oluştur
    let profileReadPermission = await testPrisma.permission.findUnique({
      where: { code: 'profile.read' }
    });
    
    if (!profileReadPermission) {
      profileReadPermission = await testPrisma.permission.create({
        data: {
          code: 'profile.read',
          name: 'Profil Görüntüle',
          description: 'Kendi profil bilgilerini görüntüleme',
          isSystem: true
        }
      });
    }
    
    // Test rolü oluştur veya bul
    let testRole = await testPrisma.role.findUnique({
      where: { code: 'test-user' }
    });
    
    if (!testRole) {
      testRole = await testPrisma.role.create({
        data: {
          code: 'test-user',
          name: 'Test User',
          description: 'Test kullanıcıları için varsayılan rol',
          isSystem: false
        }
      });
      
      // profile.read yetkisini role ekle
      await testPrisma.rolePermission.create({
        data: {
          roleId: testRole.id,
          permissionId: profileReadPermission.id
        }
      });
    } else {
      // Role'un permission'ı var mı kontrol et
      const hasPermission = await testPrisma.rolePermission.findFirst({
        where: {
          roleId: testRole.id,
          permissionId: profileReadPermission.id
        }
      });
      
      if (!hasPermission) {
        await testPrisma.rolePermission.create({
          data: {
            roleId: testRole.id,
            permissionId: profileReadPermission.id
          }
        });
      }
    }
    
    // Kullanıcıyı role ile oluştur
    const user = await testPrisma.user.create({
      data: {
        email,
        passwordHash,
        name: data?.name || 'Test User',
        isActive: data?.isActive ?? true,
        roles: {
          create: {
            roleId: testRole.id
          }
        }
      },
    });

    return { user, password };
  }
  
  // Yetki olmadan kullanıcı oluştur
  const user = await testPrisma.user.create({
    data: {
      email,
      passwordHash,
      name: data?.name || 'Test User',
      isActive: data?.isActive ?? true,
    },
  });

  return { user, password };
}

/**
 * Test kullanıcısını sil
 */
export async function deleteTestUser(userId: string) {
  const testPrisma = getTestPrisma();
  await testPrisma.user.delete({
    where: { id: userId },
  }).catch(() => {
    // Ignore if already deleted
  });
}

/**
 * Test için JWT token oluştur
 */
export async function createTestToken(userId: string): Promise<string> {
  return signAccessToken({ sub: userId });
}

/**
 * Test session oluştur
 */
export async function createTestSession(userId: string, token?: string) {
  const sessionToken = token || await createTestToken(userId);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  const testPrisma = getTestPrisma();
  const session = await testPrisma.session.create({
    data: {
      token: sessionToken,
      userId,
      expiresAt,
      lastActivity: new Date(),
    },
  });

  return { session, token: sessionToken };
}

/**
 * Test rolü oluştur
 */
export async function createTestRole(code: string, name: string) {
  const testPrisma = getTestPrisma();
  return testPrisma.role.create({
    data: {
      code,
      name,
      description: `Test role: ${name}`,
    },
  });
}

/**
 * Test ticket oluştur
 */
export async function createTestTicket(data: {
  createdById: string;
  title: string;
  description?: string;
  status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}) {
  const testPrisma = getTestPrisma();
  return testPrisma.ticket.create({
    data: {
      title: data.title,
      description: data.description || 'Test ticket description',
      status: data.status || 'OPEN',
      priority: data.priority || 'MEDIUM',
      createdById: data.createdById,
    },
  });
}

/**
 * Tüm test verilerini temizle
 */
export async function cleanupTestData() {
  // Test verilerini temizle (dikkatli kullan!)
  // await prisma.ticket.deleteMany({ where: { ... } });
  // await prisma.user.deleteMany({ where: { email: { startsWith: 'test-' } } });
}

