import { motion } from 'framer-motion';
import { Pin, Trash2, Users } from 'lucide-react';
import { Note } from '../types';
import { Avatar } from './ui/Avatar';

interface NoteCardProps {
  note: Note;
  onOpen: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  onDelete: (note: Note) => void;
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent ?? tmp.innerText ?? '').trim();
}

export function NoteCard({ note, onOpen, onTogglePin, onDelete }: NoteCardProps) {
  const preview = stripHtml(note.content);
  const isDark = document.documentElement.classList.contains('dark');
  // Tint the card with the note color (subtle so dark text stays readable).
  const tint = note.color && note.color !== '#ffffff' ? note.color : undefined;

  return (
    <motion.div
      layout
      layoutId={`note-${note._id}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
      onClick={() => onOpen(note)}
      className="glass group relative flex cursor-pointer flex-col gap-3 rounded-2xl p-4"
      style={tint ? { backgroundColor: isDark ? `${tint}22` : `${tint}aa` } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 flex-1 text-base font-semibold">{note.title || 'Untitled'}</h3>
        <motion.button
          whileTap={{ scale: 0.8 }}
          animate={{ rotate: note.isPinned ? 0 : 0, scale: note.isPinned ? 1.1 : 1 }}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin(note);
          }}
          className={`rounded-lg p-1.5 transition ${
            note.isPinned
              ? 'text-brand-600'
              : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:text-brand-500'
          }`}
          aria-label={note.isPinned ? 'Unpin note' : 'Pin note'}
        >
          <Pin className="h-4 w-4" fill={note.isPinned ? 'currentColor' : 'none'} />
        </motion.button>
      </div>

      <p className="line-clamp-4 min-h-[2rem] text-sm text-slate-600 dark:text-slate-300">
        {preview || 'No content yet…'}
      </p>

      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {note.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="chip bg-white/60 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between pt-1 text-xs text-slate-500">
        <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
        <div className="flex items-center gap-2">
          {note.sharedWith.length > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {note.sharedWith.length}
            </span>
          )}
          <Avatar src={note.owner?.avatar} name={note.owner?.username ?? '?'} size={22} />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(note);
            }}
            className="rounded-lg p-1 text-slate-400 opacity-0 transition hover:text-rose-500 group-hover:opacity-100"
            aria-label="Delete note"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
