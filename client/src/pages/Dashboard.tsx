import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { RotateCcw, StickyNote, Trash2 } from 'lucide-react';
import { Layout, DashboardView } from '../components/Layout';
import { SearchBar } from '../components/SearchBar';
import { NoteCard } from '../components/NoteCard';
import { Spinner } from '../components/ui/Spinner';
import { useNotes } from '../hooks/useNotes';
import { notesApi } from '../api/notes';
import { getErrorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';
import { Note } from '../types';

export function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const {
    notes,
    tags,
    loading,
    filters,
    setFilters,
    refresh,
    createNote,
    updateNoteLocal,
    removeNoteLocal,
  } = useNotes();

  const [view, setView] = useState<DashboardView>('notes');
  const [trash, setTrash] = useState<Note[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);

  const loadTrash = useCallback(async () => {
    setTrashLoading(true);
    try {
      setTrash(await notesApi.trash());
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setTrashLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (view === 'trash') void loadTrash();
  }, [view, loadTrash]);

  const handleCreate = async () => {
    try {
      const note = await createNote();
      navigate(`/notes/${note._id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleTogglePin = async (note: Note) => {
    try {
      const updated = await notesApi.update(note._id, { isPinned: !note.isPinned });
      updateNoteLocal(updated);
      toast.success(updated.isPinned ? 'Note pinned' : 'Note unpinned');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async (note: Note) => {
    try {
      await notesApi.remove(note._id);
      removeNoteLocal(note._id);
      toast.info('Note moved to trash');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleRestore = async (note: Note) => {
    try {
      await notesApi.restoreFromTrash(note._id);
      setTrash((prev) => prev.filter((n) => n._id !== note._id));
      toast.success('Note restored');
      void refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handlePermanentDelete = async (note: Note) => {
    if (!window.confirm('Permanently delete this note? This cannot be undone.')) return;
    try {
      await notesApi.permanentDelete(note._id);
      setTrash((prev) => prev.filter((n) => n._id !== note._id));
      toast.info('Note permanently deleted');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Layout
      view={view}
      onViewChange={setView}
      tags={tags}
      activeTag={filters.tag}
      onSelectTag={(tag) => setFilters((f) => ({ ...f, tag }))}
      onCreate={handleCreate}
    >
      {view === 'notes' ? (
        <div className="space-y-6">
          <SearchBar filters={filters} setFilters={setFilters} tags={tags} />

          {loading ? (
            <div className="flex justify-center py-20">
              <Spinner className="h-8 w-8" />
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-slate-500">
              <StickyNote className="h-12 w-12 opacity-40" />
              <p className="text-lg font-medium">No notes found</p>
              <button onClick={handleCreate} className="btn-primary">
                Create your first note
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <AnimatePresence mode="popLayout">
                {notes.map((note) => (
                  <NoteCard
                    key={note._id}
                    note={note}
                    onOpen={(n) => navigate(`/notes/${n._id}`)}
                    onTogglePin={handleTogglePin}
                    onDelete={handleDelete}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {trashLoading ? (
            <div className="flex justify-center py-20">
              <Spinner className="h-8 w-8" />
            </div>
          ) : trash.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-slate-500">
              <Trash2 className="h-12 w-12 opacity-40" />
              <p className="text-lg font-medium">Trash is empty</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {trash.map((note) => (
                <li
                  key={note._id}
                  className="glass flex items-center gap-3 rounded-2xl p-4"
                >
                  <div className="flex-1">
                    <p className="font-semibold">{note.title || 'Untitled'}</p>
                    <p className="text-xs text-slate-500">
                      Deleted {note.deletedAt ? new Date(note.deletedAt).toLocaleString() : ''}
                    </p>
                  </div>
                  <button onClick={() => handleRestore(note)} className="btn-ghost" title="Restore">
                    <RotateCcw className="h-4 w-4" /> Restore
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(note)}
                    className="btn-danger"
                    title="Delete permanently"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Layout>
  );
}
