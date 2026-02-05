// ÖNEMLİ: Setup dosyasını app'ten ÖNCE import et
import '../setup.js'; // Integration test setup

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../../index.js';

describe('Health Check API', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await request(app)
        .get('/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('ok');
      expect(res.body).toHaveProperty('status');
    });
  });

  describe('GET /api/health', () => {
    it('should return simple health check', async () => {
      const res = await request(app)
        .get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('ok');
      expect(res.body.ok).toBe(true);
    });
  });

  describe('GET /api/v1/health', () => {
    it('should return simple health check', async () => {
      const res = await request(app)
        .get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('ok');
      expect(res.body.ok).toBe(true);
    });
  });
});

