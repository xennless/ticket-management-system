import { beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Test ortamı için environment variables set et
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-min-16-chars-for-testing-only';
}

// Test database URL - integration testler için gerekli
const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

// Prisma client - sadece integration testler için kullanılacak
let prisma: PrismaClient | null = null;

// Sadece test database URL varsa Prisma client oluştur
if (testDbUrl) {
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: testDbUrl,
      },
    },
  });

  // Global test setup - sadece integration testler için
  beforeAll(async () => {
    if (prisma && testDbUrl) {
      try {
        await prisma.$connect();
        console.log('✅ Test database connected');
      } catch (error) {
        console.warn('⚠️ Test database connection failed (unit tests will still work):', error);
        // Unit testler için hata fırlatma - sadece uyarı ver
        // Integration testler kendi setup'larında kontrol edecek
      }
    }
  });

  // Global test teardown
  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect().catch(() => {
        // Ignore disconnect errors
      });
    }
  });
}

// Export prisma for use in tests (null olabilir - unit testler için)
export { prisma };

