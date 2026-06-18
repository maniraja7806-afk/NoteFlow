import { AnimatePresence, motion } from 'framer-motion';
import { PresenceUser } from '../types';
import { Avatar } from './ui/Avatar';

interface PresenceBarProps {
  users: PresenceUser[];
  connected: boolean;
}

export function PresenceBar({ users, connected }: PresenceBarProps) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-400'}`}
        title={connected ? 'Connected' : 'Offline'}
      />
      <div className="flex -space-x-2">
        <AnimatePresence>
          {users.map((u) => (
            <motion.div
              key={u.userId}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
            >
              <Avatar src={u.avatar} name={u.username} size={28} title={`${u.username} (online)`} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {users.length > 0 && (
        <span className="text-xs text-slate-500">
          {users.length} {users.length === 1 ? 'person' : 'people'} editing
        </span>
      )}
    </div>
  );
}
