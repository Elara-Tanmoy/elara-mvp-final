import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logger } from '../config/logger.js';

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  organizationId: string;
}

export const hashPassword = async (password: string): Promise<string> => {
  try {
    return await bcrypt.hash(password, SALT_ROUNDS);
  } catch (error) {
    logger.error('Error hashing password:', error);
    throw new Error('Password hashing failed');
  }
};

export const verifyPassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    logger.error('Error verifying password:', error);
    return false;
  }
};

export const generateAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const generateRefreshToken = (): string => {
  return crypto.randomBytes(64).toString('hex');
};

export const verifyAccessToken = (token: string): JWTPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    logger.debug('Token verification failed:', error);
    return null;
  }
};

export const generateApiKey = (): string => {
  return `elara_${crypto.randomBytes(32).toString('hex')}`;
};

export const generateApiSecret = (): string => {
  return crypto.randomBytes(48).toString('hex');
};

export const hashApiSecret = async (secret: string): Promise<string> => {
  return hashPassword(secret);
};

export const getRefreshTokenExpiry = (): Date => {
  const days = parseInt(REFRESH_TOKEN_EXPIRES_IN.replace('d', ''));
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  return expiryDate;
};

export const generateContentHash = (content: string): string => {
  return crypto.createHash('sha256').update(content).digest('hex');
};
