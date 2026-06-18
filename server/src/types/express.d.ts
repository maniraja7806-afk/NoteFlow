import { INoteDocument } from '../models/Note';

declare global {
  namespace Express {
    interface Request {
      // Populated by the auth middleware
      userId?: string;
      // Populated by the accessControl middleware
      note?: INoteDocument;
      permission?: 'owner' | 'write' | 'read';
    }
  }
}

export {};
