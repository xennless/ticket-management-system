import { z } from 'zod';
import { env } from '../config/env.js';

/**
 * Environment variable tanımları ve validasyon kuralları
 */
export interface EnvVariable {
  key: string;
  name: string;
  description: string;
  required: boolean;
  requiredInProduction: boolean;
  type: 'string' | 'number' | 'boolean' | 'url' | 'email' | 'path';
  defaultValue?: string;
  currentValue?: string;
  isSensitive: boolean; // Şifre, secret gibi hassas bilgiler
  category: 'database' | 'security' | 'server' | 'email' | 'features' | 'logging' | 'other';
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    allowedValues?: string[];
  };
}

/**
 * Tüm environment variable tanımları
 */
export function getEnvVariables(): EnvVariable[] {
  const variables: EnvVariable[] = [
    {
      key: 'NODE_ENV',
      name: 'Node Environment',
      description: 'Çalışma ortamı (development, production, test)',
      required: false,
      requiredInProduction: true,
      type: 'string',
      defaultValue: 'development',
      currentValue: env.NODE_ENV,
      isSensitive: false,
      category: 'server',
      validation: {
        allowedValues: ['development', 'production', 'test']
      }
    },
    {
      key: 'PORT',
      name: 'Port',
      description: 'Server port numarası',
      required: false,
      requiredInProduction: false,
      type: 'number',
      defaultValue: '3001',
      currentValue: String(env.PORT),
      isSensitive: false,
      category: 'server'
    },
    {
      key: 'DATABASE_URL',
      name: 'Database URL',
      description: 'PostgreSQL veritabanı bağlantı URL\'si',
      required: true,
      requiredInProduction: true,
      type: 'url',
      currentValue: env.DATABASE_URL ? '***' : undefined,
      isSensitive: true,
      category: 'database'
    },
    {
      key: 'DIRECT_URL',
      name: 'Direct Database URL',
      description: 'Migration için direkt veritabanı bağlantısı (opsiyonel)',
      required: false,
      requiredInProduction: false,
      type: 'url',
      currentValue: process.env.DIRECT_URL ? '***' : undefined,
      isSensitive: true,
      category: 'database'
    },
    {
      key: 'JWT_SECRET',
      name: 'JWT Secret',
      description: 'JWT token imzalama için gizli anahtar (en az 16 karakter)',
      required: true,
      requiredInProduction: true,
      type: 'string',
      currentValue: env.JWT_SECRET ? '***' : undefined,
      isSensitive: true,
      category: 'security',
      validation: {
        minLength: 16
      }
    },
    {
      key: 'CORS_ORIGINS',
      name: 'CORS Origins',
      description: 'İzin verilen CORS origin\'leri (virgülle ayrılmış)',
      required: false,
      requiredInProduction: true,
      type: 'string',
      currentValue: env.CORS_ORIGINS,
      isSensitive: false,
      category: 'security'
    },
    {
      key: 'FRONTEND_URL',
      name: 'Frontend URL',
      description: 'Frontend uygulama URL\'si (şifre sıfırlama linkleri için)',
      required: false,
      requiredInProduction: true,
      type: 'url',
      defaultValue: 'http://localhost:5173',
      currentValue: env.FRONTEND_URL,
      isSensitive: false,
      category: 'server'
    },
    {
      key: 'SYSTEMDEVELOPER_EMAIL',
      name: 'System Developer Email',
      description: 'İlk sistem yöneticisi email adresi (seed için)',
      required: false,
      requiredInProduction: false,
      type: 'email',
      currentValue: env.SYSTEMDEVELOPER_EMAIL,
      isSensitive: false,
      category: 'server'
    },
    {
      key: 'SYSTEMDEVELOPER_PASSWORD',
      name: 'System Developer Password',
      description: 'İlk sistem yöneticisi şifresi (seed için)',
      required: false,
      requiredInProduction: false,
      type: 'string',
      currentValue: env.SYSTEMDEVELOPER_PASSWORD ? '***' : undefined,
      isSensitive: true,
      category: 'server'
    },
    {
      key: 'SYSTEMDEVELOPER_NAME',
      name: 'System Developer Name',
      description: 'İlk sistem yöneticisi adı (seed için)',
      required: false,
      requiredInProduction: false,
      type: 'string',
      currentValue: env.SYSTEMDEVELOPER_NAME,
      isSensitive: false,
      category: 'server'
    },
    {
      key: 'LOG_LEVEL',
      name: 'Log Level',
      description: 'Log seviyesi (error, warn, info, debug)',
      required: false,
      requiredInProduction: false,
      type: 'string',
      currentValue: env.LOG_LEVEL,
      isSensitive: false,
      category: 'logging',
      validation: {
        allowedValues: ['error', 'warn', 'info', 'debug']
      }
    },
    {
      key: 'SENTRY_DSN',
      name: 'Sentry DSN',
      description: 'Sentry hata izleme DSN (opsiyonel)',
      required: false,
      requiredInProduction: false,
      type: 'url',
      currentValue: process.env.SENTRY_DSN ? '***' : undefined,
      isSensitive: true,
      category: 'logging'
    },
    {
      key: 'CLAMAV_ENABLED',
      name: 'ClamAV Enabled',
      description: 'ClamAV virus taraması aktif mi?',
      required: false,
      requiredInProduction: false,
      type: 'boolean',
      defaultValue: 'false',
      currentValue: String(env.CLAMAV_ENABLED),
      isSensitive: false,
      category: 'features'
    },
    {
      key: 'QUARANTINE_DIR',
      name: 'Quarantine Directory',
      description: 'Karantinaya alınan dosyaların saklanacağı klasör',
      required: false,
      requiredInProduction: false,
      type: 'path',
      defaultValue: './quarantine',
      currentValue: env.QUARANTINE_DIR,
      isSensitive: false,
      category: 'features'
    },
    {
      key: 'PRISMA_CLIENT_ENGINE_TYPE',
      name: 'Prisma Client Engine Type',
      description: 'Prisma client engine tipi (dataproxy, accelerate, default)',
      required: false,
      requiredInProduction: false,
      type: 'string',
      currentValue: env.PRISMA_CLIENT_ENGINE_TYPE,
      isSensitive: false,
      category: 'database'
    }
  ];

  return variables;
}

/**
 * Environment variable validasyonu
 */
export function validateEnvVariables(): {
  valid: boolean;
  errors: Array<{ key: string; message: string }>;
  warnings: Array<{ key: string; message: string }>;
} {
  const variables = getEnvVariables();
  const errors: Array<{ key: string; message: string }> = [];
  const warnings: Array<{ key: string; message: string }> = [];
  const isProduction = env.NODE_ENV === 'production';

  for (const variable of variables) {
    const value = variable.currentValue;
    const isRequired = isProduction ? variable.requiredInProduction : variable.required;

    // Zorunlu değişken kontrolü
    if (isRequired && (!value || value.trim() === '')) {
      errors.push({
        key: variable.key,
        message: `${variable.name} zorunludur${isProduction ? ' (production)' : ''}`
      });
      continue;
    }

    // Değer varsa validasyon yap
    if (value && value !== '***') {
      // Type validation
      if (variable.type === 'url' && !value.startsWith('http://') && !value.startsWith('https://') && !value.startsWith('postgresql://') && !value.startsWith('prisma://')) {
        errors.push({
          key: variable.key,
          message: `${variable.name} geçerli bir URL olmalıdır`
        });
      }

      if (variable.type === 'email' && !value.includes('@')) {
        errors.push({
          key: variable.key,
          message: `${variable.name} geçerli bir email adresi olmalıdır`
        });
      }

      // Length validation
      if (variable.validation?.minLength && value.length < variable.validation.minLength) {
        errors.push({
          key: variable.key,
          message: `${variable.name} en az ${variable.validation.minLength} karakter olmalıdır`
        });
      }

      if (variable.validation?.maxLength && value.length > variable.validation.maxLength) {
        errors.push({
          key: variable.key,
          message: `${variable.name} en fazla ${variable.validation.maxLength} karakter olmalıdır`
        });
      }

      // Allowed values validation
      if (variable.validation?.allowedValues && !variable.validation.allowedValues.includes(value)) {
        errors.push({
          key: variable.key,
          message: `${variable.name} şu değerlerden biri olmalıdır: ${variable.validation.allowedValues.join(', ')}`
        });
      }
    }

    // Production uyarıları
    if (isProduction) {
      if (variable.key === 'JWT_SECRET' && value && value !== '***' && (value === 'change-me-change-me-change-me' || value.length < 32)) {
        warnings.push({
          key: variable.key,
          message: 'Production ortamında JWT_SECRET en az 32 karakter olmalı ve varsayılan değer kullanılmamalıdır'
        });
      }

      if (variable.key === 'FRONTEND_URL' && value && value.includes('localhost')) {
        warnings.push({
          key: variable.key,
          message: 'Production ortamında FRONTEND_URL localhost içermemelidir'
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Environment variable'ları kategorilere göre grupla
 */
export function getEnvVariablesByCategory(): Record<string, EnvVariable[]> {
  const variables = getEnvVariables();
  const grouped: Record<string, EnvVariable[]> = {};

  for (const variable of variables) {
    if (!grouped[variable.category]) {
      grouped[variable.category] = [];
    }
    grouped[variable.category].push(variable);
  }

  return grouped;
}

