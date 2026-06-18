import { useCallback, useEffect, useRef, useState } from 'react';
import { notesApi } from '../api/notes';
import { getErrorMessage } from '../api/client';
import { Note, SearchFilters } from '../types';
import { useSocketContext } from '../context/SocketContext';
import { useDebounce } from './useDebounce';

interface UseNotesResult {
  notes: Note[];
  tags: string[];
  loading: boolean;
  error: string | null;
  filters: SearchFilters;
  setFilters: React.Dispatch<React.SetStateAction<SearchFilters>>;
  refresh: () => Promise<void>;
  createNote: (payload?: Partial<Note>) => Promise<Note>;
  updateNoteLocal: (note: Note) => void;
  removeNoteLocal: (id: string) => void;
}

/**
 * Fetches, searches and live-subscribes to the user's notes. Search is debounced
 * and re-runs whenever any filter changes. Socket events keep the list fresh.
 */
export function useNotes(): UseNotesResult {
  const { socket } = useSocketContext();
  const [notes, setNotes] = useState<Note[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({ sort: 'updated' });

  const debouncedQuery = useDebounce(filters.q ?? '', 350);
  const reqId = useRef(0);

  const effectiveFilters: SearchFilters = { ...filters, q: debouncedQuery };

  const load = useCallback(async (f: SearchFilters) => {
    const current = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const { notes: results } = await notesApi.search(f);
      if (current === reqId.current) setNotes(results);
    } catch (err) {
      if (current === reqId.current) setError(getErrorMessage(err));
    } finally {
      if (current === reqId.current) setLoading(false);
    }
  }, []);

  // Re-run search when filters change.
  useEffect(() => {
    void load(effectiveFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, filters.tag, filters.pinned, filters.color, filters.sort, filters.order]);

  // Load tag cloud once.
  useEffect(() => {
    notesApi.tags().then(setTags).catch(() => undefined);
  }, []);

  const refresh = useCallback(async () => {
    await load(effectiveFilters);
    notesApi.tags().then(setTags).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, debouncedQuery, filters]);

  const createNote = useCallback(async (payload: Partial<Note> = {}) => {
    const note = await notesApi.create({ title: 'Untitled', content: '', ...payload });
    setNotes((prev) => [note, ...prev]);
    return note;
  }, []);

  const updateNoteLocal = useCallback((note: Note) => {
    setNotes((prev) => prev.map((n) => (n._id === note._id ? note : n)));
  }, []);

  const removeNoteLocal = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n._id !== id));
  }, []);

  // Live updates from other collaborators.
  useEffect(() => {
    if (!socket) return;
    const onUpdate = (payload: { note?: Note }) => {
      if (payload.note) updateNoteLocal(payload.note);
    };
    const onDeleted = (payload: { noteId: string }) => {
      removeNoteLocal(payload.noteId);
    };
    socket.on('broadcast-update', onUpdate);
    socket.on('note-deleted', onDeleted);
    return () => {
      socket.off('broadcast-update', onUpdate);
      socket.off('note-deleted', onDeleted);
    };
  }, [socket, updateNoteLocal, removeNoteLocal]);

  return {
    notes,
    tags,
    loading,
    error,
    filters,
    setFilters,
    refresh,
    createNote,
    updateNoteLocal,
    removeNoteLocal,
  };
}
