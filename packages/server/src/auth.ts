/**
 * Authentication utilities
 * Password hashing, JWT generation/verification, middleware
 */

import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_prod';
const JWT_EXPIRY = '7d';
const BCRYPT_ROUNDS = 10;

/**
 * Hash a password using bcryptjs
 */
export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a plaintext password against a hash
 */
export async function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(plainPassword, hash);
}

/**
 * JWT payload type
 */
export interface JWTPayload {
  userId: string;
  username: string;
  iat?: number;
  exp?: number;
}

/**
 * Generate a JWT token
 */
export function generateToken(userId: string, username: string): string {
  return jwt.sign(
    {
      userId,
      username,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRY,
    }
  );
}

/**
 * Verify and decode a JWT token
 * Returns payload if valid, null if invalid/expired
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (err) {
    return null;
  }
}

/**
 * Extract token from Bearer header
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  return parts[1];
}

/**
 * Fastify preHandler middleware for protected routes
 * Validates Bearer token and attaches decoded payload to request
 */
export async function authMiddleware(request: any, reply: any) {
  try {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) {
      return reply.status(401).send({ error: 'No token provided' });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return reply.status(401).send({ error: 'Token inválido o vencido' });
    }

    // Attach decoded payload to request
    request.user = payload;
  } catch (err) {
    return reply.status(401).send({ error: 'Authentication failed' });
  }
}
