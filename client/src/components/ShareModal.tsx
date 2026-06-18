import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Trash2, UserPlus } from 'lucide-react';
import { Note, Permission, User } from '../types';
import { notesApi } from '../api/notes';
import { getErrorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';
import { Modal } from './ui/Modal';
import { Avatar } from './ui/Avatar';
import { Spinner } from './ui/Spinner';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  note: Note;
  isOwner: boolean;
  onUpdated: (note: Note) => void;
}

interface Collaborator {
  user: User;
  permission: Permission;
}

export function ShareModal({ open, onClose, note, isOwner, onUpdated }: ShareModalProps) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<Permission>('read');
  const [owner, setOwner] = useState<User | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { owner: o, collaborators: c } = await notesApi.collaborators(note._id);
      setOwner(o);
      setCollaborators(c);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [note._id, toast]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const updated = await notesApi.share(note._id, email.trim(), permission);
      toast.success(`Shared with ${email.trim()}`);
      setEmail('');
      onUpdated(updated);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await notesApi.removeCollaborator(note._id, userId);
      setCollaborators((prev) => prev.filter((c) => c.user._id !== userId));
      toast.info('Collaborator removed');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Share note">
      {isOwner && (
        <form onSubmit={handleShare} className="mb-5 space-y-3">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Collaborator email…"
              className="input pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={permission}
              onChange={(e) => setPermission(e.target.value as Permission)}
              className="input w-auto"
            >
              <option value="read">Can view</option>
              <option value="write">Can edit</option>
            </select>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? <Spinner className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              Share
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">People with access</h4>
        {loading ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : (
          <ul className="space-y-2">
            {owner && (
              <li className="flex items-center gap-3 rounded-xl bg-slate-100/60 p-2.5 dark:bg-slate-800/60">
                <Avatar src={owner.avatar} name={owner.username} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{owner.username}</p>
                  <p className="text-xs text-slate-500">{owner.email}</p>
                </div>
                <span className="chip bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
                  Owner
                </span>
              </li>
            )}
            {collaborators.map((c) => (
              <motion.li
                key={c.user._id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 rounded-xl bg-slate-100/60 p-2.5 dark:bg-slate-800/60"
              >
                <Avatar src={c.user.avatar} name={c.user.username} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{c.user.username}</p>
                  <p className="text-xs text-slate-500">{c.user.email}</p>
                </div>
                <span className="chip bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {c.permission === 'write' ? 'Can edit' : 'Can view'}
                </span>
                {isOwner && (
                  <button
                    onClick={() => handleRemove(c.user._id)}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:text-rose-500"
                    aria-label="Remove collaborator"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </motion.li>
            ))}
            {collaborators.length === 0 && (
              <p className="py-2 text-center text-sm text-slate-500">No collaborators yet.</p>
            )}
          </ul>
        )}
      </div>
    </Modal>
  );
}
