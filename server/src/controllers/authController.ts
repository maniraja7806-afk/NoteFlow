import { Request, Response } from 'express';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { signToken } from '../utils/token';
import { sanitizePlainText } from '../utils/sanitize';

function gravatar(email: string): string {
  // Deterministic placeholder avatar based on the email (no external request).
  const seed = encodeURIComponent(email.toLowerCase().trim());
  return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}`;
}

/** POST /api/auth/register */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const username = sanitizePlainText(String(req.body.username ?? ''));
  const email = String(req.body.email ?? '').toLowerCase().trim();
  const password = String(req.body.password ?? '');

  const existing = await User.findByEmail(email);
  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const user = await User.create({
    username,
    email,
    password,
    avatar: gravatar(email),
  });

  const token = signToken({ userId: user.id });

  res.status(201).json({
    success: true,
    token,
    user: user.toJSON(),
  });
});

/** POST /api/auth/login */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const email = String(req.body.email ?? '').toLowerCase().trim();
  const password = String(req.body.password ?? '');

  // password is select:false, so request it explicitly.
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const matches = await user.comparePassword(password);
  if (!matches) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const token = signToken({ userId: user.id });

  res.json({
    success: true,
    token,
    user: user.toJSON(),
  });
});

/** GET /api/auth/me */
export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  res.json({ success: true, user: user.toJSON() });
});

/** GET /api/auth/users?email=... — used by the share modal to find a user. */
export const findUserByEmail = asyncHandler(async (req: Request, res: Response) => {
  const email = String(req.query.email ?? '').toLowerCase().trim();
  if (!email) {
    throw ApiError.badRequest('Email query parameter is required');
  }
  const user = await User.findByEmail(email);
  if (!user) {
    throw ApiError.notFound('No user found with that email');
  }
  res.json({ success: true, user: user.toJSON() });
});
