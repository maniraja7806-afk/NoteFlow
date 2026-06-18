import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, History, Loader2, Pin, Share2, Tag, X } from 'lucide-react';
import { Editor } from '../components/Editor';
import { PresenceBar } from '../components/PresenceBar';
import { VersionTimeline } from '../components/VersionTimeline';
import { ShareModal } from '../components/ShareModal';
import { FullScreenLoader } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { useSocketContext } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { notesApi } from '../api/notes';
import { api, getErrorMessage } from '../api/client';
import { AccessLevel, Note, PresenceUser } from '../types';

const COLORS = ['#ffffff', '#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#ddd6fe', '#fecaca'];
const SAVE_DELAY = 800;
type SaveState = 'idle' | 'saving' | 'saved';

export function EditorPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { socket, connected } = useSocketContext();

  const [note, setNote] = useState<Note | null>(null);
  const [permission, setPermission] = useState<AccessLevel>('read');
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingRemote = useRef(false);

  const canWrite = permission === 'owner' || permission === 'write';
  const isOwner = permission === 'owner';

  // Load the note.
  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<{ success: boolean; note: Note; permission: AccessLevel }>(`/notes/${id}`)
      .then(({ data }) => {
        if (!active) return;
        setNote(data.note);
        setPermission(data.permission);
      })
      .catch((err) => {
        toast.error(getErrorMessage(err));
        navigate('/', { replace: true });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, navigate, toast]);

  // Join the note room + subscribe to realtime events.
  useEffect(() => {
    if (!socket || !id) return;
    socket.emit('join-note', id);

    const onPresence = (p: { users: PresenceUser[] }) =>
      setPresence(p.users.filter((u) => u.userId !== user?._id));
    const onJoined = (p: { users: PresenceUser[] }) =>
      setPresence(p.users.filter((u) => u.userId !== user?._id));
    const onLeft = (p: { users: PresenceUser[] }) =>
      setPresence(p.users.filter((u) => u.userId !== user?._id));

    const onBroadcast = (p: {
      noteId: string;
      title?: string;
      content?: string;
      tags?: string[];
      color?: string;
      note?: Note;
    }) => {
      if (p.noteId && p.noteId !== id) return;
      applyingRemote.current = true;
      setNote((prev) => {
        if (!prev) return prev;
        if (p.note) return p.note;
        return {
          ...prev,
          title: p.title ?? prev.title,
          content: p.content ?? prev.content,
          tags: p.tags ?? prev.tags,
          color: p.color ?? prev.color,
        };
      });
      // Release the flag on the next tick after state has applied.
      setTimeout(() => {
        applyingRemote.current = false;
      }, 50);
    };

    socket.on('presence', onPresence);
    socket.on('user-joined', onJoined);
    socket.on('user-left', onLeft);
    socket.on('broadcast-update', onBroadcast);

    return () => {
      socket.emit('leave-note', id);
      socket.off('presence', onPresence);
      socket.off('user-joined', onJoined);
      socket.off('user-left', onLeft);
      socket.off('broadcast-update', onBroadcast);
    };
  }, [socket, id, user?._id]);

  // Debounced persistence + realtime broadcast of local edits.
  const scheduleSave = useCallback(
    (next: Partial<Note>) => {
      if (!canWrite || !id) return;
      socket?.emit('edit-note', { noteId: id, ...next });
      setSaveState('saving');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          const updated = await notesApi.update(id, next);
          setNote((prev) => (prev ? { ...prev, currentVersion: updated.currentVersion } : updated));
          setSaveState('saved');
          setTimeout(() => setSaveState('idle'), 1500);
        } catch (err) {
          toast.error(getErrorMessage(err));
          setSaveState('idle');
        }
      }, SAVE_DELAY);
    },
    [canWrite, id, socket, toast]
  );

  const handleTitleChange = (title: string) => {
    setNote((prev) => (prev ? { ...prev, title } : prev));
    scheduleSave({ title });
  };

  const handleContentChange = (content: string) => {
    if (applyingRemote.current) return;
    setNote((prev) => (prev ? { ...prev, content } : prev));
    scheduleSave({ content });
  };

  const handleColorChange = (color: string) => {
    setNote((prev) => (prev ? { ...prev, color } : prev));
    scheduleSave({ color });
  };

  const handleTogglePin = () => {
    if (!note) return;
    const isPinned = !note.isPinned;
    setNote({ ...note, isPinned });
    scheduleSave({ isPinned });
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag || !note || note.tags.includes(tag)) {
      setTagInput('');
      return;
    }
    const tags = [...note.tags, tag];
    setNote({ ...note, tags });
    scheduleSave({ tags });
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    if (!note) return;
    const tags = note.tags.filter((t) => t !== tag);
    setNote({ ...note, tags });
    scheduleSave({ tags });
  };

  const reloadNote = useCallback(async () => {
    try {
      const fresh = await notesApi.get(id);
      setNote(fresh);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }, [id, toast]);

  if (loading || !note) {
    return <FullScreenLoader label="Opening note…" />;
  }

  const isDark = document.documentElement.classList.contains('dark');

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="glass z-10 flex flex-wrap items-center gap-3 border-b border-white/20 px-4 py-3 sm:px-6">
        <button onClick={() => navigate('/')} className="btn-ghost p-2" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          {saveState === 'saving' && (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
            </>
          )}
          {saveState === 'saved' && (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500" /> Saved · v{note.currentVersion}
            </>
          )}
          {saveState === 'idle' && <span>v{note.currentVersion}</span>}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <PresenceBar users={presence} connected={connected} />
          <button
            onClick={handleTogglePin}
            disabled={!canWrite}
            className={`btn-ghost p-2 ${note.isPinned ? 'text-brand-600' : ''}`}
            title={note.isPinned ? 'Unpin' : 'Pin'}
          >
            <Pin className="h-5 w-5" fill={note.isPinned ? 'currentColor' : 'none'} />
          </button>
          <button onClick={() => setShowHistory((s) => !s)} className="btn-ghost p-2" title="History">
            <History className="h-5 w-5" />
          </button>
          <button onClick={() => setShowShare(true)} className="btn-ghost" title="Share">
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <div
            className="min-h-full px-4 py-8 transition-colors sm:px-12"
            style={
              note.color && note.color !== '#ffffff'
                ? { backgroundColor: isDark ? `${note.color}14` : `${note.color}55` }
                : undefined
            }
          >
            <div className="mx-auto max-w-3xl space-y-5">
              <input
                value={note.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                disabled={!canWrite}
                placeholder="Untitled"
                className="w-full bg-transparent text-4xl font-extrabold outline-none placeholder:text-slate-400"
              />

              {/* Tags + color row */}
              <div className="flex flex-wrap items-center gap-2">
                {note.tags.map((tag) => (
                  <span
                    key={tag}
                    className="chip bg-slate-200/70 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  >
                    #{tag}
                    {canWrite && (
                      <button onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
                {canWrite && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800/60">
                    <Tag className="h-3.5 w-3.5 text-slate-400" />
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      onBlur={addTag}
                      placeholder="Add tag…"
                      className="w-20 bg-transparent text-xs outline-none"
                    />
                  </span>
                )}

                {canWrite && (
                  <div className="ml-auto flex items-center gap-1.5">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => handleColorChange(color)}
                        style={{ backgroundColor: color }}
                        className={`h-5 w-5 rounded-full border transition ${
                          note.color === color
                            ? 'scale-110 border-brand-500 ring-2 ring-brand-500/40'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                        aria-label={`Set color ${color}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {!canWrite && (
                <div className="rounded-xl bg-amber-100 px-4 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  You have read-only access to this note.
                </div>
              )}

              <Editor
                content={note.content}
                editable={canWrite}
                onChange={handleContentChange}
              />
            </div>
          </div>
        </main>

        {/* History side panel */}
        <motion.aside
          initial={false}
          animate={{ width: showHistory ? 360 : 0, opacity: showHistory ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 32 }}
          className="glass overflow-hidden border-l border-white/20"
        >
          {showHistory && (
            <div className="h-full w-[360px] overflow-y-auto p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-lg font-bold">
                  <History className="h-5 w-5" /> History
                </h3>
                <button onClick={() => setShowHistory(false)} className="btn-ghost p-1.5">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <VersionTimeline noteId={id} canWrite={canWrite} onRestored={reloadNote} />
            </div>
          )}
        </motion.aside>
      </div>

      {note && (
        <ShareModal
          open={showShare}
          onClose={() => setShowShare(false)}
          note={note}
          isOwner={isOwner}
          onUpdated={(n) => setNote(n)}
        />
      )}
    </div>
  );
}
