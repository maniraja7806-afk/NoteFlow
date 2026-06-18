export interface User {
  _id: string;
  username: string;
  email: string;
  avatar: string;
  createdAt?: string;
  updatedAt?: string;
}

export type Permission = 'read' | 'write';
export type AccessLevel = 'owner' | Permission;

export interface SharedWith {
  userId: User;
  permission: Permission;
}

export interface Note {
  _id: string;
  title: string;
  content: string;
  tags: string[];
  color: string;
  isPinned: boolean;
  owner: User;
  sharedWith: SharedWith[];
  currentVersion: number;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoteVersion {
  _id: string;
  noteId: string;
  versionNumber: number;
  title: string;
  content: string;
  tags: string[];
  color: string;
  changedBy: User;
  changedAt: string;
  note?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PresenceUser {
  userId: string;
  username: string;
  avatar: string;
}

export interface SearchFilters {
  q?: string;
  tag?: string;
  pinned?: 'true' | 'false';
  color?: string;
  sort?: 'updated' | 'created' | 'title' | 'relevance';
  order?: 'asc' | 'desc';
}
