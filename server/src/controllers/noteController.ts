import { Request, Response } from 'express';
import { FilterQuery, ProjectionType, Types } from 'mongoose';
import { INote, Note } from '../models/Note';
import { NoteVersion } from '../models/NoteVersion';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { sanitizeHtml, sanitizePlainText } from '../utils/sanitize';
import { resolveAccess } from '../middleware/accessControl';
import { emitNoteUpdate } from '../sockets/io';

const POPULATE_OWNER = { path: 'owner', select: 'username email avatar' };
const POPULATE_SHARED = { path: 'sharedWith.userId', select: 'username email avatar' };

function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .map((t) => sanitizePlainText(String(t)).toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 40)
    )
  );
}

/** POST /api/notes */
export const createNote = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId as string;

  const note = await Note.create({
    title: sanitizePlainText(String(req.body.title ?? 'Untitled')) || 'Untitled',
    content: sanitizeHtml(String(req.body.content ?? '')),
    tags: normalizeTags(req.body.tags),
    color: req.body.color ?? '#ffffff',
    isPinned: Boolean(req.body.isPinned),
    owner: new Types.ObjectId(userId),
    lastEditedBy: new Types.ObjectId(userId),
  });

  const populated = await note.populate([POPULATE_OWNER, POPULATE_SHARED]);
  res.status(201).json({ success: true, note: populated.toJSON() });
});

/** GET /api/notes — list notes accessible to the user (owned + shared). */
export const getNotes = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId as string;
  const includeShared = req.query.shared !== 'false';

  const ownership: FilterQuery<INote>[] = [{ owner: userId }];
  if (includeShared) {
    ownership.push({ 'sharedWith.userId': userId });
  }

  const notes = await Note.find({ isDeleted: false, $or: ownership })
    .sort({ isPinned: -1, updatedAt: -1 })
    .populate([POPULATE_OWNER, POPULATE_SHARED])
    .lean();

  res.json({ success: true, count: notes.length, notes });
});

/** GET /api/notes/:id — single note (access enforced by middleware). */
export const getNote = asyncHandler(async (req: Request, res: Response) => {
  const note = req.note!;
  const populated = await note.populate([POPULATE_OWNER, POPULATE_SHARED]);
  res.json({ success: true, note: populated.toJSON(), permission: req.permission });
});

/** PUT /api/notes/:id — triggers the versioning hook. */
export const updateNote = asyncHandler(async (req: Request, res: Response) => {
  const note = req.note!;
  const userId = req.userId as string;

  if (req.body.title !== undefined) {
    note.title = sanitizePlainText(String(req.body.title)) || 'Untitled';
  }
  if (req.body.content !== undefined) {
    note.content = sanitizeHtml(String(req.body.content));
  }
  if (req.body.tags !== undefined) {
    note.tags = normalizeTags(req.body.tags);
  }
  if (req.body.color !== undefined) {
    note.color = String(req.body.color);
  }
  if (req.body.isPinned !== undefined) {
    note.isPinned = Boolean(req.body.isPinned);
  }

  note.lastEditedBy = new Types.ObjectId(userId);
  await note.save(); // pre('save') hook snapshots the previous version

  const populated = await note.populate([POPULATE_OWNER, POPULATE_SHARED]);
  const json = populated.toJSON();

  emitNoteUpdate(note.id, { note: json, by: userId });
  res.json({ success: true, note: json });
});

/** DELETE /api/notes/:id — soft delete (moves to trash). */
export const deleteNote = asyncHandler(async (req: Request, res: Response) => {
  const note = req.note!;
  note.isDeleted = true;
  note.deletedAt = new Date();
  await note.save();
  emitNoteUpdate(note.id, { noteId: note.id }, 'note-deleted');
  res.json({ success: true, message: 'Note moved to trash' });
});

/** POST /api/notes/:id/restore-trash — restore a soft-deleted note. */
export const restoreFromTrash = asyncHandler(async (req: Request, res: Response) => {
  const noteId = req.params.id;
  const userId = req.userId as string;
  const note = await Note.findOne({ _id: noteId, owner: userId, isDeleted: true });
  if (!note) {
    throw ApiError.notFound('Deleted note not found');
  }
  note.isDeleted = false;
  note.deletedAt = null;
  await note.save();
  res.json({ success: true, message: 'Note restored', note: note.toJSON() });
});

/** GET /api/notes/trash — list soft-deleted notes owned by the user. */
export const getTrash = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId as string;
  const notes = await Note.find({ owner: userId, isDeleted: true })
    .sort({ deletedAt: -1 })
    .lean();
  res.json({ success: true, count: notes.length, notes });
});

/** DELETE /api/notes/:id/permanent — owner-only hard delete + version cleanup. */
export const permanentDelete = asyncHandler(async (req: Request, res: Response) => {
  const note = req.note!;
  await NoteVersion.deleteMany({ noteId: note._id });
  await note.deleteOne();
  res.json({ success: true, message: 'Note permanently deleted' });
});

/**
 * GET /api/notes/search — MongoDB text search with filters & sorting.
 * Query params: q, tag, pinned(true/false), color, sort(updated|created|title|relevance), order(asc|desc), page, limit
 */
export const searchNotes = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId as string;
  const q = sanitizePlainText(String(req.query.q ?? '')).trim();
  const tag = req.query.tag ? sanitizePlainText(String(req.query.tag)).toLowerCase() : undefined;
  const color = req.query.color ? String(req.query.color) : undefined;
  const pinnedParam = req.query.pinned;

  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '30'), 10) || 30));
  const skip = (page - 1) * limit;

  const filter: FilterQuery<INote> = {
    isDeleted: false,
    $or: [{ owner: userId }, { 'sharedWith.userId': userId }],
  };

  if (tag) filter.tags = tag;
  if (color) filter.color = color;
  if (pinnedParam === 'true') filter.isPinned = true;
  if (pinnedParam === 'false') filter.isPinned = false;

  const useTextSearch = q.length > 0;
  const projection: Record<string, unknown> = {};
  if (useTextSearch) {
    filter.$text = { $search: q };
    projection.score = { $meta: 'textScore' };
  }

  // Sorting
  const order = req.query.order === 'asc' ? 1 : -1;
  let sort: Record<string, number | { $meta: string }> = { isPinned: -1, updatedAt: -1 };
  switch (req.query.sort) {
    case 'created':
      sort = { createdAt: order };
      break;
    case 'title':
      sort = { title: order };
      break;
    case 'updated':
      sort = { updatedAt: order };
      break;
    case 'relevance':
      sort = useTextSearch ? { score: { $meta: 'textScore' } } : { updatedAt: -1 };
      break;
    default:
      sort = useTextSearch
        ? { score: { $meta: 'textScore' }, updatedAt: -1 }
        : { isPinned: -1, updatedAt: -1 };
  }

  const [notes, total] = await Promise.all([
    Note.find(filter, projection as ProjectionType<INote>)
      .sort(sort as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .populate([POPULATE_OWNER, POPULATE_SHARED])
      .lean(),
    Note.countDocuments(filter),
  ]);

  res.json({
    success: true,
    notes,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

/** GET /api/notes/:id/history — paginated version history. */
export const getHistory = asyncHandler(async (req: Request, res: Response) => {
  const noteId = req.params.id;
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
  const skip = (page - 1) * limit;

  const [versions, total] = await Promise.all([
    NoteVersion.find({ noteId })
      .sort({ versionNumber: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'changedBy', select: 'username email avatar' })
      .lean(),
    NoteVersion.countDocuments({ noteId }),
  ]);

  res.json({
    success: true,
    versions,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

/** GET /api/notes/:id/history/:versionNumber — preview a single version. */
export const getVersion = asyncHandler(async (req: Request, res: Response) => {
  const noteId = req.params.id;
  const versionNumber = parseInt(req.params.versionNumber, 10);
  const version = await NoteVersion.findOne({ noteId, versionNumber })
    .populate({ path: 'changedBy', select: 'username email avatar' })
    .lean();
  if (!version) {
    throw ApiError.notFound('Version not found');
  }
  res.json({ success: true, version });
});

/** POST /api/notes/:id/restore/:versionNumber — restore a version (write access). */
export const restoreVersion = asyncHandler(async (req: Request, res: Response) => {
  const note = req.note!;
  const userId = req.userId as string;
  const versionNumber = parseInt(req.params.versionNumber, 10);

  const version = await NoteVersion.findOne({ noteId: note._id, versionNumber });
  if (!version) {
    throw ApiError.notFound('Version not found');
  }

  // Applying these and saving triggers the versioning hook, which bumps
  // currentVersion and records a new snapshot for the restore action.
  note.title = version.title;
  note.content = version.content;
  note.tags = version.tags;
  note.color = version.color;
  note.lastEditedBy = new Types.ObjectId(userId);
  note._restoreLabel = `Restored from v${versionNumber}`;
  await note.save();

  const populated = await note.populate([POPULATE_OWNER, POPULATE_SHARED]);
  const json = populated.toJSON();
  emitNoteUpdate(note.id, { note: json, by: userId });

  res.json({ success: true, message: `Restored to version ${versionNumber}`, note: json });
});

/** POST /api/notes/:id/share — owner shares note with a user by email. */
export const shareNote = asyncHandler(async (req: Request, res: Response) => {
  const note = req.note!;
  const email = String(req.body.email ?? '').toLowerCase().trim();
  const permission = req.body.permission === 'write' ? 'write' : 'read';

  if (!email) {
    throw ApiError.badRequest('Email is required');
  }

  const target = await User.findByEmail(email);
  if (!target) {
    throw ApiError.notFound('No user found with that email');
  }
  if (target.id === note.owner.toString()) {
    throw ApiError.badRequest('You already own this note');
  }

  const existing = note.sharedWith.find((s) => s.userId.toString() === target.id);
  if (existing) {
    existing.permission = permission;
  } else {
    note.sharedWith.push({ userId: target._id as Types.ObjectId, permission });
  }
  await note.save();

  const populated = await note.populate([POPULATE_OWNER, POPULATE_SHARED]);
  res.json({ success: true, message: 'Note shared', note: populated.toJSON() });
});

/** DELETE /api/notes/:id/share/:userId — owner removes a collaborator. */
export const removeCollaborator = asyncHandler(async (req: Request, res: Response) => {
  const note = req.note!;
  const targetUserId = req.params.userId;
  if (!Types.ObjectId.isValid(targetUserId)) {
    throw ApiError.badRequest('Invalid user id');
  }

  const before = note.sharedWith.length;
  note.sharedWith = note.sharedWith.filter((s) => s.userId.toString() !== targetUserId);
  if (note.sharedWith.length === before) {
    throw ApiError.notFound('Collaborator not found on this note');
  }
  await note.save();

  res.json({ success: true, message: 'Collaborator removed' });
});

/** GET /api/notes/:id/collaborators — list collaborators (any access). */
export const getCollaborators = asyncHandler(async (req: Request, res: Response) => {
  const note = req.note!;
  const populated = await note.populate([POPULATE_OWNER, POPULATE_SHARED]);
  const owner = populated.owner;
  const collaborators = populated.sharedWith.map((s) => ({
    user: s.userId,
    permission: s.permission,
  }));
  res.json({ success: true, owner, collaborators });
});

/** GET /api/notes/tags — distinct tags used across the user's notes. */
export const getTags = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId as string;
  const tags = await Note.distinct('tags', {
    isDeleted: false,
    $or: [{ owner: userId }, { 'sharedWith.userId': userId }],
  });
  res.json({ success: true, tags: (tags as string[]).filter(Boolean).sort() });
});

// Re-export so other modules (sockets) can reuse access resolution.
export { resolveAccess };
