import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signAccessToken, verifyAccessToken, JwtPayload } from '../../../utils/jwt.js';
import jwt from 'jsonwebtoken';
import { env } from '../../../config/env.js';

// Mock settings
vi.mock('../../../utils/settings.js', () => ({
  getSystemSetting: vi.fn().mockResolvedValue(3600), // 1 hour default
}));

describe('JWT Utils', () => {
  describe('signAccessToken', () => {
    it('should sign a token with user ID', async () => {
      const payload: JwtPayload = { sub: 'user123' };
      const token = await signAccessToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should create different tokens for different users', async () => {
      const token1 = await signAccessToken({ sub: 'user1' });
      const token2 = await signAccessToken({ sub: 'user2' });

      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid token', async () => {
      const payload: JwtPayload = { sub: 'user123' };
      const token = await signAccessToken(payload);

      const verified = verifyAccessToken(token);
      expect(verified.sub).toBe('user123');
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => {
        verifyAccessToken(invalidToken);
      }).toThrow();
    });

    it('should throw error for expired token', async () => {
      // Create an expired token manually
      const expiredToken = jwt.sign(
        { sub: 'user123' },
        env.JWT_SECRET,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      expect(() => {
        verifyAccessToken(expiredToken);
      }).toThrow();
    });

    it('should throw error for token with wrong secret', async () => {
      const payload: JwtPayload = { sub: 'user123' };
      const token = await signAccessToken(payload);

      // Try to verify with wrong secret
      const wrongSecretToken = jwt.sign(
        { sub: 'user123' },
        'wrong-secret',
        { expiresIn: '1h' }
      );

      expect(() => {
        verifyAccessToken(wrongSecretToken);
      }).toThrow();
    });
  });
});

