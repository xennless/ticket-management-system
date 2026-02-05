import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Test database setup
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
});

// Global test setup
beforeAll(async () => {
  // Test database bağlantısını kontrol et
  try {
    await prisma.$connect();
  } catch (error) {
    console.error('Test database connection failed:', error);
    throw error;
  }
});

// Her testten önce
beforeEach(async () => {
  // Test verilerini temizle (isteğe bağlı)
  // await prisma.$executeRaw`TRUNCATE TABLE ...`;
});

// Her testten sonra
afterEach(async () => {
  // Cleanup if needed
});

// Global test teardown
afterAll(async () => {
  await prisma.$disconnect();
});

// Export prisma for use in tests
export { prisma };

