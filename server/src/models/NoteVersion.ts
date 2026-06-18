import { Document, Schema, Types, model } from 'mongoose';

export interface INoteVersion {
  noteId: Types.ObjectId;
  versionNumber: number;
  title: string;
  content: string;
  tags: string[];
  color: string;
  changedBy: Types.ObjectId;
  changedAt: Date;
  // Optional human-readable label, e.g. "Restored from v3"
  note?: string;
}

export interface INoteVersionDocument extends INoteVersion, Document {}

const noteVersionSchema = new Schema<INoteVersionDocument>(
  {
    noteId: {
      type: Schema.Types.ObjectId,
      ref: 'Note',
      required: true,
    },
    versionNumber: {
      type: Number,
      required: true,
    },
    title: { type: String, default: '' },
    content: { type: String, default: '' },
    tags: { type: [String], default: [] },
    color: { type: String, default: '#ffffff' },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    note: { type: String },
  },
  { versionKey: false }
);

// Fast lookup of a note's history, newest version first.
noteVersionSchema.index({ noteId: 1, versionNumber: -1 });

export const NoteVersion = model<INoteVersionDocument>(
  'NoteVersion',
  noteVersionSchema
);
