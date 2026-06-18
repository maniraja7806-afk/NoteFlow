import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, History, RotateCcw } from 'lucide-react';
import { NoteVersion } from '../types';
import { notesApi } from '../api/notes';
import { getErrorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';
import { Avatar } from './ui/Avatar';
import { Modal } from './ui/Modal';
import { Spinner } from './ui/Spinner';

interface VersionTimelineProps {
  noteId: string;
  canWrite: boolean;
  onRestored: () => void;
}

export function VersionTimeline({ noteId, canWrite, onRestored }: VersionTimelineProps) {
  const toast = useToast();
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<NoteVersion | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { versions: v } = await notesApi.history(noteId);
      setVersions(v);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [noteId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRestore = async (versionNumber: number) => {
    setRestoring(versionNumber);
    try {
      await notesApi.restoreVersion(noteId, versionNumber);
      toast.success(`Restored to version ${versionNumber}`);
      onRestored();
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRestoring(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (versions.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">No version history yet.</p>;
  }

  return (
    <>
      <div className="relative space-y-4 pl-6">
        <div className="absolute left-2 top-2 bottom-2 w-px bg-slate-300 dark:bg-slate-700" />
        {versions.map((version, index) => (
          <motion.div
            key={version._id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            className="relative"
          >
            <span
              className={`absolute -left-[1.4rem] top-1.5 h-3 w-3 rounded-full ring-4 ring-white dark:ring-slate-900 ${
                index === 0 ? 'bg-brand-600' : 'bg-slate-400'
              }`}
            />
            <div className="glass rounded-xl p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="chip bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
                    v{version.versionNumber}
                  </span>
                  <span className="text-sm font-medium">{version.title || 'Untitled'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPreview(version)}
                    className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200/70 hover:text-brand-600 dark:hover:bg-slate-700"
                    title="Preview"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  {canWrite && index !== 0 && (
                    <button
                      onClick={() => handleRestore(version.versionNumber)}
                      disabled={restoring !== null}
                      className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200/70 hover:text-emerald-600 disabled:opacity-50 dark:hover:bg-slate-700"
                      title="Restore this version"
                    >
                      {restoring === version.versionNumber ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <Avatar
                  src={version.changedBy?.avatar}
                  name={version.changedBy?.username ?? '?'}
                  size={18}
                />
                <span>{version.changedBy?.username ?? 'Unknown'}</span>
                <span>·</span>
                <span>{new Date(version.changedAt).toLocaleString()}</span>
                {version.note && (
                  <span className="chip bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    {version.note}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <Modal
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={preview ? `Preview — v${preview.versionNumber}` : ''}
        maxWidth="max-w-2xl"
      >
        {preview && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <History className="h-4 w-4" />
              {new Date(preview.changedAt).toLocaleString()}
            </div>
            <h2 className="text-xl font-bold">{preview.title || 'Untitled'}</h2>
            <div
              className="ProseMirror max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200 p-4 dark:border-slate-700"
              dangerouslySetInnerHTML={{ __html: preview.content || '<p><em>Empty</em></p>' }}
            />
            {canWrite && (
              <button
                onClick={() => {
                  void handleRestore(preview.versionNumber);
                  setPreview(null);
                }}
                className="btn-primary w-full"
              >
                <RotateCcw className="h-4 w-4" /> Restore this version
              </button>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
