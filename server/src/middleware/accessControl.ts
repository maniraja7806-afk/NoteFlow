import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { ApiError } from '../utils/ApiError';
import { Note, SharePermission } from '../models/Note';

export type AccessLevel = 'owner' | SharePermission;

/**
 * Resolves the access level a user has on a note.
 * Returns null when the user has no access at all.
 */
export function resolveAccess(
  note: { owner: Types.ObjectId; sharedWith: { userId: Types.ObjectId; permission: SharePermission }[] },
  userId: string
): AccessLevel | null {
  if (note.owner.toString() === userId) {
    return 'owner';
  }
  const share = note.sharedWith.find((entry) => entry.userId.toString() === userId);
  if (!share) {
    return null;
  }
  return share.permission;
}

const ACCESS_RANK: Record<AccessLevel, number> = {
  read: 1,
  write: 2,
  owner: 3,
};

/**
 * Middleware factory: loads the note from `:id`/`:noteId` and ensures the
 * authenticated user has at least the required permission. Owners always pass.
 */
export function requireNoteAccess(minPermission: SharePermission = 'read') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const noteId = req.params.id ?? req.params.noteId;
      if (!noteId || !Types.ObjectId.isValid(noteId)) {
        throw ApiError.badRequest('Invalid note id');
      }
      if (!req.userId) {
        throw ApiError.unauthorized();
      }

      const note = await Note.findById(noteId);
      if (!note || note.isDeleted) {
        throw ApiError.notFound('Note not found');
      }

      const access = resolveAccess(note, req.userId);
      if (!access) {
        throw ApiError.forbidden('You do not have access to this note');
      }
      if (ACCESS_RANK[access] < ACCESS_RANK[minPermission]) {
        throw ApiError.forbidden(`This action requires '${minPermission}' permission`);
      }

      req.note = note;
      req.permission = access;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Owner-only guard (sharing, hard delete, etc.). */
export function requireOwner() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const noteId = req.params.id ?? req.params.noteId;
      if (!noteId || !Types.ObjectId.isValid(noteId)) {
        throw ApiError.badRequest('Invalid note id');
      }
      if (!req.userId) {
        throw ApiError.unauthorized();
      }
      const note = await Note.findById(noteId);
      if (!note || note.isDeleted) {
        throw ApiError.notFound('Note not found');
      }
      if (note.owner.toString() !== req.userId) {
        throw ApiError.forbidden('Only the owner can perform this action');
      }
      req.note = note;
      req.permission = 'owner';
      next();
    } catch (error) {
      next(error);
    }
  };
}
