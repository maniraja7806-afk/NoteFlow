import { motion } from 'framer-motion';
import { Pin, Search, SlidersHorizontal, X } from 'lucide-react';
import { SearchFilters } from '../types';

const COLOR_OPTIONS = ['#ffffff', '#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#ddd6fe', '#fecaca'];

interface SearchBarProps {
  filters: SearchFilters;
  setFilters: React.Dispatch<React.SetStateAction<SearchFilters>>;
  tags: string[];
}

export function SearchBar({ filters, setFilters, tags }: SearchBarProps) {
  const activeFilterCount =
    (filters.tag ? 1 : 0) + (filters.pinned ? 1 : 0) + (filters.color ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.q ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder="Search notes by title or content…"
            className="input pl-10"
          />
          {filters.q && (
            <button
              onClick={() => setFilters((f) => ({ ...f, q: '' }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <select
          value={`${filters.sort ?? 'updated'}:${filters.order ?? 'desc'}`}
          onChange={(e) => {
            const [sort, order] = e.target.value.split(':') as [
              SearchFilters['sort'],
              SearchFilters['order']
            ];
            setFilters((f) => ({ ...f, sort, order }));
          }}
          className="input w-auto"
        >
          <option value="updated:desc">Recently updated</option>
          <option value="created:desc">Newest first</option>
          <option value="created:asc">Oldest first</option>
          <option value="title:asc">Title A–Z</option>
          <option value="title:desc">Title Z–A</option>
          <option value="relevance:desc">Most relevant</option>
        </select>

        <button
          onClick={() =>
            setFilters((f) => ({ ...f, pinned: f.pinned === 'true' ? undefined : 'true' }))
          }
          className={`btn ${
            filters.pinned === 'true'
              ? 'bg-brand-600 text-white'
              : 'btn-ghost border border-slate-300 dark:border-slate-700'
          }`}
        >
          <Pin className="h-4 w-4" /> Pinned
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={() => setFilters((f) => ({ q: f.q, sort: f.sort, order: f.order }))}
            className="btn-ghost text-xs"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Reset filters ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {tags.slice(0, 12).map((tag) => {
          const active = filters.tag === tag;
          return (
            <motion.button
              key={tag}
              whileTap={{ scale: 0.92 }}
              onClick={() => setFilters((f) => ({ ...f, tag: active ? undefined : tag }))}
              className={`chip ${
                active
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-200/70 text-slate-600 hover:bg-slate-300/70 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              #{tag}
            </motion.button>
          );
        })}

        <div className="ml-auto flex items-center gap-1.5">
          {COLOR_OPTIONS.map((color) => (
            <button
              key={color}
              onClick={() =>
                setFilters((f) => ({ ...f, color: f.color === color ? undefined : color }))
              }
              style={{ backgroundColor: color }}
              className={`h-5 w-5 rounded-full border transition ${
                filters.color === color
                  ? 'scale-110 border-brand-500 ring-2 ring-brand-500/40'
                  : 'border-slate-300 dark:border-slate-600'
              }`}
              aria-label={`Filter by color ${color}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
