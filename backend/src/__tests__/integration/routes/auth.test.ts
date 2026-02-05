// ÖNEMLİ: Setup dosyasını app'ten ÖNCE import et
// Bu, DATABASE_URL'in test veritabanına set edilmesini sağlar
import '../setup.js'; // Integration test setup - DATABASE_URL'i set eder

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../index.js';
import { createTestUser, deleteTestUser } from '../../helpers/test-helpers.js';

describe('Auth API', () => {
  let testUserId: string;
  let testUserEmail: string;
  let testUserPassword: string;

  beforeAll(async () => {
    // Test kullanıcısı oluştur
    try {
      const { user, password } = await createTestUser({
        email: `test-auth-${Date.now()}@example.com`,
        password: 'TestPassword123!',
      });
      testUserId = user.id;
      testUserEmail = user.email;
      testUserPassword = password;
      console.log('✅ Test user created:', testUserEmail);
    } catch (error) {
      console.error('❌ Failed to create test user:', error);
      throw error;
    }
  });

  afterAll(async () => {
    // Test kullanıcısını temizle
    if (testUserId) {
      await deleteTestUser(testUserId);
    }
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
          password: testUserPassword,
        });

      // Debug: Hata mesajını göster
      if (res.status !== 200) {
        console.error('Login failed:', res.status, res.body);
      }

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user).toHaveProperty('email');
      expect(res.body.user.email).toBe(testUserEmail);
    });

    it('should reject login with invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('message');
    });

    it('should reject login with invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
          password: 'WrongPassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('message');
    });

    it('should reject login with missing email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'TestPassword123!',
        });

      expect(res.status).toBe(400);
    });

    it('should reject login with missing password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
        });

      expect(res.status).toBe(400);
    });

    it('should reject login with invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'TestPassword123!',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken: string;

    beforeAll(async () => {
      // Login to get token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
          password: testUserPassword,
        });

      authToken = loginRes.body.token;
    });

    it('should return user info with valid token', async () => {
      // GET requests don't require CSRF token
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user).toHaveProperty('email');
      expect(res.body.user.email).toBe(testUserEmail);
      expect(res.body).toHaveProperty('roles');
      expect(res.body).toHaveProperty('permissions');
    });

    it('should reject request without token', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });
});

