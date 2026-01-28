import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Log dizini oluştur
const logDir = path.join(__dirname, '../../logs');
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

// Log formatı
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console formatı (daha okunabilir)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Daily rotate file transport (error)
const errorFileTransport = new DailyRotateFile({
  filename: path.join(logDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d', // 30 gün sakla
  level: 'error',
  format: logFormat
});

// Daily rotate file transport (combined - tüm loglar)
const combinedFileTransport = new DailyRotateFile({
  filename: path.join(logDir, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d', // 30 gün sakla
  format: logFormat
});

// Winston logger oluştur
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: logFormat,
  defaultMeta: { service: 'ticket-system' },
  transports: [
    // Console'a yaz (development'ta renkli, production'da basit)
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? winston.format.simple() : consoleFormat,
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    }),
    // Error logları ayrı dosyaya
    errorFileTransport,
    // Tüm loglar combined dosyaya
    combinedFileTransport
  ],
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'exceptions.log'),
      format: logFormat
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'rejections.log'),
      format: logFormat
    })
  ]
});

// Sentry entegrasyonu (opsiyonel)
let sentryInitialized = false;

export async function initSentry(dsn?: string) {
  if (!dsn || sentryInitialized) return;
  
  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 1.0, // Production'da düşürülebilir (örn: 0.1)
      beforeSend(event) {
        // Error loglarına da yaz
        logger.error('Sentry Error', { event });
        return event;
      }
    });
    sentryInitialized = true;
    logger.info('Sentry initialized', { dsn: dsn.substring(0, 20) + '...' });
  } catch (error) {
    logger.warn('Sentry initialization failed', { error });
  }
}

// Helper fonksiyonlar
export const log = {
  error: (message: string, meta?: Record<string, unknown>) => logger.error(message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => logger.warn(message, meta),
  info: (message: string, meta?: Record<string, unknown>) => logger.info(message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => logger.debug(message, meta),
  http: (message: string, meta?: Record<string, unknown>) => logger.http(message, meta)
};

// Express middleware için morgan stream
export const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  }
};

