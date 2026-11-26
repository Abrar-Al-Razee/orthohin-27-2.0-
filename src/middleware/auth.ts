import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';

export const AUTHORIZED_ADMIN_EMAIL = 'abraralraze@gmail.com';
export const AUTHORIZED_ADMIN_EMAILS = [
  'abraralraze@gmail.com',
  'hisamulhisam208@gmail.com',
] as const;

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing token' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  const email = req.user?.email?.toLowerCase();
  if (!req.user || !email || !(AUTHORIZED_ADMIN_EMAILS as readonly string[]).includes(email) || !req.user.email_verified) {
    res.status(403).json({ error: 'Forbidden: Authorized admin privileges required' });
    return;
  }
  next();
};
