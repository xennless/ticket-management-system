import { prisma } from '../setup.js';
import { hashPassword } from '../../utils/password.js';
import { signAccessToken } from '../../utils/jwt.js';

/**
 * Test kullanıcısı oluştur
 */
export async function createTestUser(data?: {
  email?: string;
  password?: string;
  name?: string;
  isActive?: boolean;
}) {
  const email = data?.email || `test-${Date.now()}@example.com`;
  const password = data?.password || 'TestPassword123!';
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
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
  await prisma.user.delete({
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

  const session = await prisma.session.create({
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
  return prisma.role.create({
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
  return prisma.ticket.create({
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

