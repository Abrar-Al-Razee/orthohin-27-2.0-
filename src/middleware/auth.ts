import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';

export const AUTHORIZED_ADMIN_EMAIL = 'abraralraze@gmail.com';

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
    if (decodedToken.email) {
      await getOrCreateUser(decodedToken.uid, decodedToken.email);
    }
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  const email = req.user?.email?.toLowerCase();
  if (!req.user || email !== AUTHORIZED_ADMIN_EMAIL || !req.user.email_verified) {
    res.status(403).json({ error: 'Forbidden: Authorized admin privileges required' });
    return;
  }
  next();
};
