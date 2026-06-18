import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Moon,
  NotebookPen,
  Plus,
  StickyNote,
  Sun,
  Tag,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Avatar } from './ui/Avatar';

export type DashboardView = 'notes' | 'trash';

interface LayoutProps {
  view: DashboardView;
  onViewChange: (view: DashboardView) => void;
  tags: string[];
  activeTag?: string;
  onSelectTag: (tag?: string) => void;
  onCreate: () => void;
  children: React.ReactNode;
}

export function Layout({
  view,
  onViewChange,
  tags,
  activeTag,
  onSelectTag,
  onCreate,
  children,
}: LayoutProps) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  const navItems: { id: DashboardView; label: string; icon: React.ReactNode }[] = [
    { id: 'notes', label: 'Notes', icon: <StickyNote className="h-5 w-5" /> },
    { id: 'trash', label: 'Trash', icon: <Trash2 className="h-5 w-5" /> },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      <motion.aside
        animate={{ width: collapsed ? 76 : 264 }}
        transition={{ type: 'spring', stiffness: 280, damping: 30 }}
        className="glass z-20 flex flex-col border-r border-white/20 p-3"
      >
        <div className="mb-6 flex items-center gap-2 px-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <NotebookPen className="h-5 w-5" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-lg font-extrabold tracking-tight"
              >
                NoteFlow
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <button onClick={onCreate} className="btn-primary mb-4 w-full justify-center">
          <Plus className="h-4 w-4" />
          {!collapsed && <span>New note</span>}
        </button>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                view === item.id
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800/60'
              }`}
            >
              {item.icon}
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {!collapsed && view === 'notes' && tags.length > 0 && (
          <div className="mt-6 flex-1 overflow-y-auto">
            <p className="mb-2 flex items-center gap-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <Tag className="h-3.5 w-3.5" /> Tags
            </p>
            <div className="space-y-0.5">
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => onSelectTag(activeTag === tag ? undefined : tag)}
                  className={`block w-full truncate rounded-lg px-3 py-1.5 text-left text-sm transition ${
                    activeTag === tag
                      ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                      : 'text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="btn-ghost mt-auto justify-center"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </motion.aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="glass z-10 flex items-center justify-between border-b border-white/20 px-6 py-3">
          <h1 className="text-xl font-bold capitalize">{view}</h1>
          <div className="flex items-center gap-3">
            <button onClick={toggle} className="btn-ghost p-2" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            {user && (
              <div className="flex items-center gap-2">
                <Avatar src={user.avatar} name={user.username} size={34} />
                <div className="hidden sm:block">
                  <p className="text-sm font-semibold leading-tight">{user.username}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
              </div>
            )}
            <button onClick={logout} className="btn-ghost p-2" aria-label="Log out" title="Log out">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
