import { beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Test ortamında DATABASE_URL'i TEST_DATABASE_URL'e set et
// Bu, app'in test veritabanını kullanmasını sağlar
// ÖNEMLİ: Bu dosya import edilir edilmez çalışır (beforeAll'dan önce)
if (process.env.TEST_DATABASE_URL) {
  // Global Prisma instance'ını temizle (yeniden oluşturulması için)
  const globalForPrisma = globalThis as unknown as {
    prisma: any;
  };
  if (globalForPrisma.prisma) {
    globalForPrisma.prisma.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
  }
  
  // DATABASE_URL'i test veritabanına set et
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DIRECT_URL = process.env.TEST_DATABASE_URL;
}

// Integration testler için Prisma client
let prisma: PrismaClient | null = null;

beforeAll(async () => {
  const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!testDbUrl) {
    throw new Error(
      'TEST_DATABASE_URL or DATABASE_URL must be set for integration tests.\n' +
      'Please add TEST_DATABASE_URL to your .env file.\n' +
      'Example: TEST_DATABASE_URL="postgresql://user:password@localhost:5432/ticket_test"'
    );
  }

  prisma = new PrismaClient({
    datasources: {
      db: {
        url: testDbUrl,
      },
    },
  });

  try {
    await prisma.$connect();
    console.log('✅ Integration test database connected');
  } catch (error) {
    console.error('❌ Integration test database connection failed:', error);
    throw error;
  }
});

afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect().catch(() => {
      // Ignore disconnect errors
    });
  }
});

export { prisma };

