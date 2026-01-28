import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { getSystemSetting } from './settings.js';

export type JwtPayload = {
  sub: string; // userId
};

export async function signAccessToken(payload: JwtPayload): Promise<string> {
  const sessionTimeout = await getSystemSetting<number>('sessionTimeout', 3600);
  // sessionTimeout saniye cinsinden, JWT için saniye veya string formatı kullanılır
  const expiresIn = `${sessionTimeout}s`;
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}


