import DOMPurify from 'dompurify';

/**
 * HTML içeriğini sanitize et (XSS koruması)
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string') return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false
  });
}

/**
 * String içeriğini sanitize et (HTML olmayan)
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';
  return DOMPurify.sanitize(input, { 
    ALLOWED_TAGS: [], 
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  });
}

/**
 * URL'i sanitize et
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') return '';
  try {
    // URL validation
    new URL(url);
    return DOMPurify.sanitize(url, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      ALLOW_DATA_ATTR: false,
      KEEP_CONTENT: true
    });
  } catch {
    // Invalid URL
    return '';
  }
}

/**
 * Form input değerini sanitize et (genel kullanım)
 */
export function sanitizeInput(input: unknown): string {
  if (typeof input !== 'string') return '';
  return sanitizeString(input);
}

/**
 * Email adresini sanitize et
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') return '';
  // Email formatını koru, sadece XSS karakterlerini temizle
  const sanitized = sanitizeString(email.toLowerCase().trim());
  // Email regex kontrolü
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(sanitized) ? sanitized : '';
}

/**
 * Sayısal değeri sanitize et
 */
export function sanitizeNumber(input: unknown): number {
  if (typeof input === 'number') return input;
  if (typeof input === 'string') {
    const num = parseFloat(input);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

