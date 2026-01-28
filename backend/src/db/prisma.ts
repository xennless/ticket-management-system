import { PrismaClient } from '@prisma/client';

// Bazı ortamlarda (Windows environment variables / yanlış .env) PRISMA_CLIENT_ENGINE_TYPE=dataproxy/accelerate
// set edilmiş olabiliyor. Bu durumda Prisma, DATABASE_URL için prisma:// bekler ve P6001 ile patlar.
// Eğer DATABASE_URL postgresql:// ise engine'i otomatik olarak "library" moduna zorlayarak sistemi çalışır tutuyoruz.
const rawDbUrl = process.env.DATABASE_URL ?? '';
// Trim + çevreleyen tırnakları temizle (örn: "postgresql://..." gibi durumlarda startsWith bozulabiliyor)
const dbUrl = rawDbUrl.trim().replace(/^['"]|['"]$/g, '');
const engine = (process.env.PRISMA_CLIENT_ENGINE_TYPE ?? '').toLowerCase();

// Prisma'nın engine seçimi bazı durumlarda process.env.DATABASE_URL üzerinden yapıldığı için,
// normalize edilmiş değeri geri yazıyoruz (tırnak/boşluk vb. sorunları tamamen ortadan kaldırır).
if (dbUrl) process.env.DATABASE_URL = dbUrl;

// Fail-safe: DATABASE_URL prisma:// değilse Data Proxy/Accelerate motorunu devre dışı bırak.
// (Aksi halde prisma client request anında "URL must start with prisma://" hatası veriyor.)
if (!dbUrl.startsWith('prisma://')) {
  if (engine === 'dataproxy' || engine === 'accelerate') {
    process.env.PRISMA_CLIENT_ENGINE_TYPE = 'library';
  }
}

if (process.env.NODE_ENV !== 'production' && process.env.PRISMA_DEBUG === '1') {
  const shownRaw = rawDbUrl ? `${rawDbUrl.trim().slice(0, 20)}…` : '<empty>';
  const shown = dbUrl ? `${dbUrl.slice(0, 20)}…` : '<empty>';
  // debug amaçlı: esbuild overlay'deki P6001 sebebini net görmek için
  console.log(
    `[prisma] engine=${process.env.PRISMA_CLIENT_ENGINE_TYPE ?? '<unset>'} rawDbUrl=${shownRaw} dbUrl=${shown} startsWithPrisma=${dbUrl.startsWith('prisma://')} startsWithPg=${dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')}`
  );
}

// Global Prisma instance to prevent connection pool exhaustion during hot-reloads
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Supabase connection pooler optimization
// - connection_limit: pgbouncer tarafından yönetiliyor
// - Prisma tarafında da connection pool'u sınırlıyoruz
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: { url: dbUrl }
    },
    log: process.env.NODE_ENV === 'development' 
      ? ['error', 'warn'] 
      : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

if (process.env.NODE_ENV !== 'production' && process.env.PRISMA_DEBUG === '1') {
  const engineName = (prisma as any)?._engine?.constructor?.name ?? '<unknown>';
  console.log(`[prisma] engineImpl=${engineName}`);
}

// Graceful shutdown - Supabase connection pooler için önemli
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});


