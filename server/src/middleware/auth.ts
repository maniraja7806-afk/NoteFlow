import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { verifyToken } from '../utils/token';
import { User } from '../models/User';

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

/**
 * Express middleware that verifies the JWT and attaches `req.userId`.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      throw ApiError.unauthorized('Authentication token missing');
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw ApiError.unauthorized('Invalid or expired token');
    }

    const userExists = await User.exists({ _id: payload.userId });
    if (!userExists) {
      throw ApiError.unauthorized('User no longer exists');
    }

    req.userId = payload.userId;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Verifies a raw token (used by the Socket.IO handshake). Returns the userId or
 * throws.
 */
export async function authenticateToken(token: string): Promise<string> {
  const payload = verifyToken(token);
  const userExists = await User.exists({ _id: payload.userId });
  if (!userExists) {
    throw new Error('User no longer exists');
  }
  return payload.userId;
}
