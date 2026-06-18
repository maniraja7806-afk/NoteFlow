import { CallbackError, Document, Schema, Types, model } from 'mongoose';
import { NoteVersion } from './NoteVersion';

export type SharePermission = 'read' | 'write';

export interface ISharedWith {
  userId: Types.ObjectId;
  permission: SharePermission;
}

export interface INote {
  title: string;
  content: string;
  tags: string[];
  color: string;
  isPinned: boolean;
  owner: Types.ObjectId;
  sharedWith: ISharedWith[];
  currentVersion: number;
  isDeleted: boolean;
  deletedAt: Date | null;
  lastEditedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface INoteDocument extends INote, Document {
  // Transient flag consumed by the versioning hook to label a restore action.
  _restoreLabel?: string;
  // Transient flags set in pre-save and consumed in post-save.
  _shouldVersion?: boolean;
  _versionLabel?: string;
}

const sharedWithSchema = new Schema<ISharedWith>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    permission: {
      type: String,
      enum: ['read', 'write'],
      default: 'read',
    },
  },
  { _id: false }
);

const noteSchema = new Schema<INoteDocument>(
  {
    title: {
      type: String,
      default: 'Untitled',
      trim: true,
      maxlength: [200, 'Title must be at most 200 characters'],
    },
    content: {
      type: String,
      default: '',
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    color: {
      type: String,
      default: '#ffffff',
      match: [/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Color must be a valid hex code'],
    },
    isPinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sharedWith: {
      type: [sharedWithSchema],
      default: [],
    },
    currentVersion: {
      type: Number,
      default: 1,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    lastEditedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Full-text search across title and content (title weighted higher).
noteSchema.index(
  { title: 'text', content: 'text' },
  { weights: { title: 5, content: 1 }, name: 'note_text_search' }
);

// Optimises the dashboard query: a user's notes, pinned first, newest first.
noteSchema.index({ owner: 1, isPinned: -1, updatedAt: -1 });

// Speeds up "shared with me" lookups.
noteSchema.index({ 'sharedWith.userId': 1 });

/**
 * CRITICAL: the versioning hook. On every meaningful save we bump
 * `currentVersion` (pre-save, so the new number is persisted on the note) and
 * write a matching immutable snapshot into NoteVersion (post-save, once the new
 * state is committed). This keeps a complete, gap-free history where the newest
 * snapshot always mirrors the live note.
 */
noteSchema.pre('save', function versioningHook(next) {
  try {
    if (this.isNew) {
      this.currentVersion = 1;
      this._shouldVersion = true;
      this._versionLabel = 'Initial version';
      return next();
    }

    const tracked: Array<keyof INote> = ['title', 'content', 'tags', 'color'];
    const hasTrackedChange = tracked.some((field) => this.isModified(field));
    if (!hasTrackedChange) {
      return next();
    }

    this.currentVersion += 1;
    this._shouldVersion = true;
    this._versionLabel = this._restoreLabel;
    this._restoreLabel = undefined;
    return next();
  } catch (error) {
    return next(error as CallbackError);
  }
});

// Persist the immutable snapshot for the version computed in pre-save.
noteSchema.post('save', async function writeVersionSnapshot(doc: INoteDocument) {
  if (!doc._shouldVersion) {
    return;
  }
  const label = doc._versionLabel;
  doc._shouldVersion = false;
  doc._versionLabel = undefined;

  await NoteVersion.create({
    noteId: doc._id,
    versionNumber: doc.currentVersion,
    title: doc.title,
    content: doc.content,
    tags: doc.tags,
    color: doc.color,
    changedBy: doc.lastEditedBy ?? doc.owner,
    changedAt: new Date(),
    note: label,
  });
});

export const NoteModel = model<INoteDocument>('Note', noteSchema);
export const Note = NoteModel;
