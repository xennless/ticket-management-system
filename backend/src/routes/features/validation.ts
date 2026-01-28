import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { audit } from '../../lib/audit.js';
import { getValidationLogs, logValidation } from '../../utils/inputValidation.js';
import { getSystemSetting, setSystemSetting } from '../../utils/settings.js';

export const validationRouter = Router();

validationRouter.use(requireAuth);

// Validation ayarlarını getir
validationRouter.get('/settings', requirePermission('validation.read'), async (_req, res) => {
  const settings = {
    xssProtectionEnabled: await getSystemSetting<boolean>('xssProtectionEnabled', true),
    pathTraversalProtectionEnabled: await getSystemSetting<boolean>('pathTraversalProtectionEnabled', true),
    commandInjectionProtectionEnabled: await getSystemSetting<boolean>('commandInjectionProtectionEnabled', true),
    sqlInjectionProtectionEnabled: await getSystemSetting<boolean>('sqlInjectionProtectionEnabled', true),
    urlValidationEnabled: await getSystemSetting<boolean>('urlValidationEnabled', true),
    emailValidationEnabled: await getSystemSetting<boolean>('emailValidationEnabled', true),
    logValidationEvents: await getSystemSetting<boolean>('logValidationEvents', true),
    autoBlockSuspiciousInput: await getSystemSetting<boolean>('autoBlockSuspiciousInput', false)
  };
  
  return res.json({ settings });
});

// Validation ayarlarını güncelle
validationRouter.put('/settings', requirePermission('validation.manage'), async (req, res) => {
  const Body = z.object({
    xssProtectionEnabled: z.boolean().optional(),
    pathTraversalProtectionEnabled: z.boolean().optional(),
    commandInjectionProtectionEnabled: z.boolean().optional(),
    sqlInjectionProtectionEnabled: z.boolean().optional(),
    urlValidationEnabled: z.boolean().optional(),
    emailValidationEnabled: z.boolean().optional(),
    logValidationEvents: z.boolean().optional(),
    autoBlockSuspiciousInput: z.boolean().optional()
  });
  
  const body = Body.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ message: 'Geçersiz veri', issues: body.error.issues });
  }
  
  const updates: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(body.data)) {
    if (value !== undefined) {
      await setSystemSetting(key, value);
      updates[key] = value;
    }
  }
  
  await audit(req, 'update', 'ValidationSettings', 'global', updates);
  
  return res.json({ success: true, updates });
});

// Validation loglarını getir
validationRouter.get('/logs', requirePermission('validation.read'), async (req, res) => {
  const Query = z.object({
    limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
    type: z.enum(['XSS', 'PATH_TRAVERSAL', 'COMMAND_INJECTION', 'SQL_INJECTION', 'INVALID_URL', 'INVALID_EMAIL']).optional()
  });
  
  const query = Query.safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({ message: 'Geçersiz sorgu', issues: query.error.issues });
  }
  
  let logs = getValidationLogs(query.data.limit);
  
  if (query.data.type) {
    logs = logs.filter(log => log.type === query.data.type);
  }
  
  return res.json({ logs, count: logs.length });
});

// Validation istatistiklerini getir
validationRouter.get('/stats', requirePermission('validation.read'), async (_req, res) => {
  const logs = getValidationLogs(10000); // Son 10000 log
  
  const stats = {
    total: logs.length,
    byType: {
      XSS: logs.filter(l => l.type === 'XSS').length,
      PATH_TRAVERSAL: logs.filter(l => l.type === 'PATH_TRAVERSAL').length,
      COMMAND_INJECTION: logs.filter(l => l.type === 'COMMAND_INJECTION').length,
      SQL_INJECTION: logs.filter(l => l.type === 'SQL_INJECTION').length,
      INVALID_URL: logs.filter(l => l.type === 'INVALID_URL').length,
      INVALID_EMAIL: logs.filter(l => l.type === 'INVALID_EMAIL').length
    },
    last24Hours: logs.filter(l => {
      const dayAgo = new Date();
      dayAgo.setHours(dayAgo.getHours() - 24);
      return l.timestamp > dayAgo;
    }).length,
    last7Days: logs.filter(l => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return l.timestamp > weekAgo;
    }).length
  };
  
  return res.json({ stats });
});

// Test endpoint - Validation fonksiyonlarını test et
validationRouter.post('/test', requirePermission('validation.manage'), async (req, res) => {
  const Body = z.object({
    input: z.string(),
    type: z.enum(['XSS', 'PATH_TRAVERSAL', 'COMMAND_INJECTION', 'SQL_INJECTION', 'URL', 'EMAIL'])
  });
  
  const body = Body.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ message: 'Geçersiz veri', issues: body.error.issues });
  }
  
  const { sanitizeHtml, sanitizeString, validatePath, validateCommand, validateSqlInput, validateUrl, validateEmail } = await import('../../utils/inputValidation.js');
  
  let result: any = {};
  
  switch (body.data.type) {
    case 'XSS':
      result = {
        original: body.data.input,
        sanitized: sanitizeHtml(body.data.input),
        sanitizedString: sanitizeString(body.data.input)
      };
      break;
    case 'PATH_TRAVERSAL':
      const pathResult = validatePath(body.data.input, process.cwd());
      result = pathResult;
      break;
    case 'COMMAND_INJECTION':
      const cmdResult = validateCommand(body.data.input);
      result = cmdResult;
      break;
    case 'SQL_INJECTION':
      const sqlResult = validateSqlInput(body.data.input);
      result = sqlResult;
      break;
    case 'URL':
      const urlResult = validateUrl(body.data.input);
      result = urlResult;
      break;
    case 'EMAIL':
      const emailResult = validateEmail(body.data.input);
      result = emailResult;
      break;
  }
  
  return res.json({ result });
});

