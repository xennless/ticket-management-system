import 'dotenv/config';
import { z } from 'zod';

const EmailLike = z
  .string()
  .min(3)
  // Not: zod .email() bazı "local" domainleri (örn: systemdeveloper@local) reddedebiliyor.
  // Ticket sistemi gibi internal kullanımlarda "@" içeren basit email formatı yeterli.
  .regex(/^[^\s@]+@[^\s@]+$/, 'Geçersiz email');

// Base schema - tüm değişkenler
const BaseEnvSchema = z.object({
  NODE_ENV: z.string().optional().default('development'),
  PORT: z.coerce.number().optional().default(3001),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET en az 16 karakter olmalı'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL zorunludur'),
  DIRECT_URL: z.string().optional(), // Direct connection for migrations
  // Prisma Data Proxy/Accelerate modunda prisma:// URL beklenir. Normal modda postgresql:// beklenir.
  PRISMA_CLIENT_ENGINE_TYPE: z.string().optional(),
  CORS_ORIGINS: z.string().optional(), // virgülle ayrılmış liste
  FRONTEND_URL: z.string().optional().default('http://localhost:5173'), // Frontend URL (şifre sıfırlama linkleri için)
  SYSTEMDEVELOPER_EMAIL: EmailLike.optional(),
  SYSTEMDEVELOPER_PASSWORD: z.string().min(8).optional(),
  SYSTEMDEVELOPER_NAME: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).optional(),
  SENTRY_DSN: z.string().url().optional(), // Sentry DSN (opsiyonel)
  CLAMAV_ENABLED: z.coerce.boolean().optional().default(false), // ClamAV virus taraması aktif mi?
  QUARANTINE_DIR: z.string().optional().default('./quarantine') // Quarantine klasörü yolu
});

// Production için ek validasyonlar
const EnvSchema = BaseEnvSchema.superRefine((data, ctx) => {
  const isProduction = data.NODE_ENV === 'production';
  
  if (isProduction) {
    // Production'da CORS_ORIGINS zorunlu (güvenlik için)
    if (!data.CORS_ORIGINS || data.CORS_ORIGINS.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Production ortamında CORS_ORIGINS zorunludur (güvenlik için)',
        path: ['CORS_ORIGINS']
      });
    }
    
    // Production'da FRONTEND_URL zorunlu
    if (!data.FRONTEND_URL || data.FRONTEND_URL === 'http://localhost:5173') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Production ortamında FRONTEND_URL zorunludur ve localhost olmamalıdır',
        path: ['FRONTEND_URL']
      });
    }
    
    // Production'da JWT_SECRET güvenli olmalı
    if (data.JWT_SECRET === 'change-me-change-me-change-me' || data.JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Production ortamında JWT_SECRET en az 32 karakter olmalı ve varsayılan değer kullanılmamalıdır',
        path: ['JWT_SECRET']
      });
    }
  }
});

export const env = EnvSchema.parse(process.env);

// Daha anlaşılır startup hatası (aksi halde request anında P6001 ile patlıyor)
const engine = (env.PRISMA_CLIENT_ENGINE_TYPE ?? '').toLowerCase();
if (engine === 'dataproxy' || engine === 'accelerate') {
  if (!env.DATABASE_URL.startsWith('prisma://')) {
    throw new Error(
      `DATABASE_URL prisma:// ile başlamalı (PRISMA_CLIENT_ENGINE_TYPE=${env.PRISMA_CLIENT_ENGINE_TYPE}). ` +
        `Çözüm: DATABASE_URL'yi prisma://... yapın veya PRISMA_CLIENT_ENGINE_TYPE'ı kaldırıp postgresql://... kullanın.`
    );
  }
} else {
  if (!env.DATABASE_URL.startsWith('postgresql://') && !env.DATABASE_URL.startsWith('postgres://')) {
    throw new Error(
      `DATABASE_URL postgresql:// ile başlamalı (mevcut engine=${env.PRISMA_CLIENT_ENGINE_TYPE ?? 'default'}). ` +
        `Örn: postgresql://USER:PASS@HOST:5432/DB?schema=public`
    );
  }
}


