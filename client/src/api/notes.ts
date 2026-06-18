import { api } from './client';
import { Note, NoteVersion, Pagination, SearchFilters, User } from '../types';

interface ListResponse {
  success: boolean;
  notes: Note[];
  count?: number;
}

interface SearchResponse {
  success: boolean;
  notes: Note[];
  pagination: Pagination;
}

interface NoteResponse {
  success: boolean;
  note: Note;
}

export const notesApi = {
  list: async (): Promise<Note[]> => {
    const { data } = await api.get<ListResponse>('/notes');
    return data.notes;
  },

  search: async (filters: SearchFilters, page = 1): Promise<SearchResponse> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, String(v));
    });
    params.set('page', String(page));
    const { data } = await api.get<SearchResponse>(`/notes/search?${params.toString()}`);
    return data;
  },

  get: async (id: string): Promise<Note> => {
    const { data } = await api.get<NoteResponse>(`/notes/${id}`);
    return data.note;
  },

  create: async (payload: Partial<Note>): Promise<Note> => {
    const { data } = await api.post<NoteResponse>('/notes', payload);
    return data.note;
  },

  update: async (id: string, payload: Partial<Note>): Promise<Note> => {
    const { data } = await api.put<NoteResponse>(`/notes/${id}`, payload);
    return data.note;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/notes/${id}`);
  },

  trash: async (): Promise<Note[]> => {
    const { data } = await api.get<ListResponse>('/notes/trash');
    return data.notes;
  },

  restoreFromTrash: async (id: string): Promise<Note> => {
    const { data } = await api.post<NoteResponse>(`/notes/${id}/restore-trash`);
    return data.note;
  },

  permanentDelete: async (id: string): Promise<void> => {
    await api.delete(`/notes/${id}/permanent`);
  },

  tags: async (): Promise<string[]> => {
    const { data } = await api.get<{ success: boolean; tags: string[] }>('/notes/tags');
    return data.tags;
  },

  history: async (
    id: string,
    page = 1
  ): Promise<{ versions: NoteVersion[]; pagination: Pagination }> => {
    const { data } = await api.get<{ success: boolean; versions: NoteVersion[]; pagination: Pagination }>(
      `/notes/${id}/history?page=${page}`
    );
    return { versions: data.versions, pagination: data.pagination };
  },

  getVersion: async (id: string, versionNumber: number): Promise<NoteVersion> => {
    const { data } = await api.get<{ success: boolean; version: NoteVersion }>(
      `/notes/${id}/history/${versionNumber}`
    );
    return data.version;
  },

  restoreVersion: async (id: string, versionNumber: number): Promise<Note> => {
    const { data } = await api.post<NoteResponse>(`/notes/${id}/restore/${versionNumber}`);
    return data.note;
  },

  collaborators: async (
    id: string
  ): Promise<{ owner: User; collaborators: { user: User; permission: 'read' | 'write' }[] }> => {
    const { data } = await api.get<{
      success: boolean;
      owner: User;
      collaborators: { user: User; permission: 'read' | 'write' }[];
    }>(`/notes/${id}/collaborators`);
    return { owner: data.owner, collaborators: data.collaborators };
  },

  share: async (id: string, email: string, permission: 'read' | 'write'): Promise<Note> => {
    const { data } = await api.post<NoteResponse>(`/notes/${id}/share`, { email, permission });
    return data.note;
  },

  removeCollaborator: async (id: string, userId: string): Promise<void> => {
    await api.delete(`/notes/${id}/share/${userId}`);
  },

  findUser: async (email: string): Promise<User> => {
    const { data } = await api.get<{ success: boolean; user: User }>(
      `/auth/users?email=${encodeURIComponent(email)}`
    );
    return data.user;
  },
};
