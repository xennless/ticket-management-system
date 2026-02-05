import nodemailer, { Transporter } from 'nodemailer';
import { prisma } from '../db/prisma.js';
import { getSystemSettings } from './settings.js';
import { logger } from './logger.js';

export type EmailConfig = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean; // true for 465, false for other ports
  user: string;
  password: string;
  from: string; // "Name <email@example.com>" or "email@example.com"
};

let emailConfigCache: EmailConfig | null = null;
let transporterCache: Transporter | null = null;

// Email ayarlarını veritabanından yükle (cache'li settings kullanarak)
export async function loadEmailConfig(): Promise<EmailConfig | null> {
  // Settings cache'inden email ayarlarını al (TTL ile)
  const settings = await getSystemSettings();
  
  if (!settings.emailEnabled || !settings.emailHost || !settings.emailUser) {
    return null;
  }

  return {
    enabled: settings.emailEnabled === true,
    host: settings.emailHost,
    port: settings.emailPort ?? (settings.emailSecure ? 465 : 587),
    secure: settings.emailSecure === true,
    user: settings.emailUser,
    password: settings.emailPassword || '',
    from: settings.emailFrom || settings.emailUser
  };
}

// Transporter oluştur
async function getTransporter(): Promise<Transporter | null> {
  const config = await loadEmailConfig();
  if (!config || !config.enabled) {
    return null;
  }

  // Config değişmemişse cache'i kullan
  if (emailConfigCache && JSON.stringify(config) === JSON.stringify(emailConfigCache) && transporterCache) {
    return transporterCache;
  }

  emailConfigCache = config;

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password
    }
  });

  // Bağlantıyı test et
  try {
    await transporter.verify();
    transporterCache = transporter;
    return transporter;
  } catch (error: any) {
    logger.error('[Email] SMTP bağlantı hatası', {
      error: error?.message || String(error),
      stack: error?.stack,
      host: config.host,
      port: config.port
    });
    transporterCache = null;
    return null;
  }
}

// Cache'i temizle (ayarlar değiştiğinde kullanılır)
export function clearEmailCache() {
  emailConfigCache = null;
  transporterCache = null;
}

// Email template'lerindeki değişkenleri replace et
export async function replaceEmailVariables(content: string): Promise<string> {
  if (!content) return content;

  // Sistem ayarlarını al
  const settings = await prisma.systemSettings.findMany({
    where: {
      key: { in: ['companyName'] }
    }
  });

  const settingsMap: Record<string, any> = {};
  settings.forEach((s) => {
    settingsMap[s.key] = s.value;
  });

  // Yıl değişkeni
  const currentYear = new Date().getFullYear().toString();
  const companyName = (settingsMap.companyName as string) || '';

  // Değişkenleri replace et
  let result = content;
  result = result.replace(/\{\{year\}\}/g, currentYear);
  result = result.replace(/\{\{currentYear\}\}/g, currentYear);
  result = result.replace(/\{\{companyName\}\}/g, companyName);
  result = result.replace(/\{\{company\}\}/g, companyName);

  return result;
}

export type SendEmailOptions = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  userId?: string;
  metadata?: Record<string, any>;
};

// Email gönder
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  let { to, subject, html, text, userId, metadata } = options;
  
  // Template değişkenlerini replace et
  subject = await replaceEmailVariables(subject);
  if (html) html = await replaceEmailVariables(html);
  if (text) text = await replaceEmailVariables(text);

  // Email log kaydı oluştur (pending)
  let emailLogId: string;
  try {
    const emailLog = await prisma.emailLog.create({
      data: {
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        body: html || text || null,
        status: 'PENDING',
        userId: userId || null,
        metadata: metadata ? (metadata as any) : undefined
      }
    });
    emailLogId = emailLog.id;
  } catch (error: any) {
    logger.error('[Email] Log kaydı oluşturma hatası', {
      error: error?.message || String(error),
      stack: error?.stack,
      to: options.to,
      subject: options.subject
    });
    emailLogId = 'unknown';
  }

  const transporter = await getTransporter();
  if (!transporter) {
    // Log'u failed olarak işaretle
    if (emailLogId !== 'unknown') {
      await prisma.emailLog.update({
        where: { id: emailLogId },
        data: { status: 'FAILED', errorMessage: 'Email servisi aktif değil veya yapılandırılmamış' }
      }).catch(() => {});
    }
    return { success: false, error: 'Email servisi aktif değil veya yapılandırılmamış' };
  }

  const config = await loadEmailConfig();
  if (!config) {
    return { success: false, error: 'Email yapılandırması bulunamadı' };
  }

  try {
    const info = await transporter.sendMail({
      from: config.from,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      text
    });

    // Log'u success olarak güncelle
    if (emailLogId !== 'unknown') {
      await prisma.emailLog.update({
        where: { id: emailLogId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          errorMessage: null
        }
      }).catch(() => {});
    }

    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    const errorMessage = error.message || 'Bilinmeyen hata';
    
    // Log'u failed olarak güncelle
    if (emailLogId !== 'unknown') {
      await prisma.emailLog.update({
        where: { id: emailLogId },
        data: {
          status: 'FAILED',
          errorMessage,
          sentAt: null
        }
      }).catch(() => {});
    }

    logger.error('[Email] Gönderim hatası', {
      error: errorMessage,
      to: options.to,
      subject: options.subject,
      emailLogId
    });
    return { success: false, error: errorMessage };
  }
}

// Email template'leri
export const emailTemplates = {
  // 2FA kod gönderme
  twoFactorCode: (code: string, userName?: string) => ({
    subject: 'İki Faktörlü Doğrulama Kodu',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .code { background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 5px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>İki Faktörlü Doğrulama Kodu</h2>
          <p>Merhaba ${userName || 'Kullanıcı'},</p>
          <p>Aşağıdaki kodu kullanarak giriş yapabilirsiniz:</p>
          <div class="code">${code}</div>
          <p>Bu kod 10 dakika süreyle geçerlidir.</p>
          <div class="footer">
            <p>Bu email otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
İki Faktörlü Doğrulama Kodu

Merhaba ${userName || 'Kullanıcı'},

Aşağıdaki kodu kullanarak giriş yapabilirsiniz:

${code}

Bu kod 10 dakika süreyle geçerlidir.

Bu email otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.
    `
  }),

  // Şifre sıfırlama
  passwordReset: (resetLink: string, userName?: string) => ({
    subject: 'Şifre Sıfırlama',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Şifre Sıfırlama</h2>
          <p>Merhaba ${userName || 'Kullanıcı'},</p>
          <p>Şifrenizi sıfırlamak için aşağıdaki linke tıklayın:</p>
          <p><a href="${resetLink}" class="button">Şifremi Sıfırla</a></p>
          <p>Veya aşağıdaki linki tarayıcınıza yapıştırın:</p>
          <p style="word-break: break-all;">${resetLink}</p>
          <p>Bu link 1 saat süreyle geçerlidir.</p>
          <div class="footer">
            <p>Eğer bu isteği siz yapmadıysanız, bu emaili görmezden gelebilirsiniz.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Şifre Sıfırlama

Merhaba ${userName || 'Kullanıcı'},

Şifrenizi sıfırlamak için aşağıdaki linke tıklayın:

${resetLink}

Bu link 1 saat süreyle geçerlidir.

Eğer bu isteği siz yapmadıysanız, bu emaili görmezden gelebilirsiniz.
    `
  }),

  // Şifre değişikliği bildirimi
  passwordChanged: (userName?: string, ip?: string, userAgent?: string) => ({
    subject: 'Şifreniz Değiştirildi',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .info { background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
          .button { display: inline-block; padding: 12px 24px; background: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Şifreniz Değiştirildi</h2>
          <p>Merhaba ${userName || 'Kullanıcı'},</p>
          <div class="alert">
            <p><strong>Hesabınızın şifresi başarıyla değiştirildi.</strong></p>
          </div>
          ${ip || userAgent ? `
          <div class="info">
            <p><strong>İşlem Detayları:</strong></p>
            ${ip ? `<p>IP Adresi: ${ip}</p>` : ''}
            ${userAgent ? `<p>Cihaz: ${userAgent}</p>` : ''}
            <p>Tarih: ${new Date().toLocaleString('tr-TR')}</p>
          </div>
          ` : ''}
          <p>Eğer bu işlemi siz yapmadıysanız, lütfen derhal:</p>
          <ul>
            <li>Hesabınızın güvenliğini kontrol edin</li>
            <li>Şifrenizi tekrar değiştirin</li>
            <li>Sistem yöneticinizle iletişime geçin</li>
          </ul>
          <div class="footer">
            <p>Bu email otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Şifreniz Değiştirildi

Merhaba ${userName || 'Kullanıcı'},

Hesabınızın şifresi başarıyla değiştirildi.

${ip || userAgent ? `
İşlem Detayları:
${ip ? `IP Adresi: ${ip}` : ''}
${userAgent ? `Cihaz: ${userAgent}` : ''}
Tarih: ${new Date().toLocaleString('tr-TR')}
` : ''}

Eğer bu işlemi siz yapmadıysanız, lütfen derhal:
- Hesabınızın güvenliğini kontrol edin
- Şifrenizi tekrar değiştirin
- Sistem yöneticinizle iletişime geçin

Bu email otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.
    `
  }),

  // Ticket bildirimi
  ticketNotification: (ticketKey: number, ticketTitle: string, action: string, userName?: string) => ({
    subject: `Ticket #${ticketKey}: ${action}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .ticket-info { background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Ticket Bildirimi</h2>
          <p>Merhaba ${userName || 'Kullanıcı'},</p>
          <p><strong>${action}</strong></p>
          <div class="ticket-info">
            <p><strong>Ticket:</strong> #${ticketKey}</p>
            <p><strong>Başlık:</strong> ${ticketTitle}</p>
          </div>
          <div class="footer">
            <p>Bu email otomatik olarak gönderilmiştir.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Ticket Bildirimi

Merhaba ${userName || 'Kullanıcı'},

${action}

Ticket: #${ticketKey}
Başlık: ${ticketTitle}

Bu email otomatik olarak gönderilmiştir.
    `
  })
};

// Email template'ini veritabanından yükle ve değişkenleri replace et
export async function getEmailTemplate(
  code: string,
  variables: Record<string, string> = {}
): Promise<{ subject: string; html: string; text: string } | null> {
  const template = await prisma.emailTemplate.findUnique({
    where: { code, isActive: true }
  });

  if (!template) {
    return null;
  }

  // Template içeriğindeki değişkenleri replace et
  let subject = template.subject || '';
  let html = template.html || '';
  let text = template.text || '';

  // Önce sistem değişkenlerini replace et (year, companyName, vb.)
  subject = await replaceEmailVariables(subject);
  html = await replaceEmailVariables(html);
  text = await replaceEmailVariables(text);

  // Sonra custom değişkenleri replace et
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    subject = subject.replace(regex, value);
    html = html.replace(regex, value);
    text = text.replace(regex, value);
  }

  return { subject, html, text };
}

