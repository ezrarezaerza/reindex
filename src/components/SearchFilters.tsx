import React from 'react';
import { SearchFiltersState } from '../types';
import { 
  Search, 
  FolderTree, 
  List, 
  SlidersHorizontal, 
  X, 
  Clock, 
  Sparkles, 
  TrendingDown, 
  Database,
  ArrowUpDown,
  LayoutGrid
} from 'lucide-react';

interface SearchFiltersProps {
  filters: SearchFiltersState;
  setFilters: React.Dispatch<React.SetStateAction<SearchFiltersState>>;
  viewMode: 'tree' | 'flat' | 'treemap';
  setViewMode: (mode: 'tree' | 'flat' | 'treemap') => void;
  matchCount: number;
  availableExtensions: string[];
}

export default function SearchFilters({
  filters,
  setFilters,
  viewMode,
  setViewMode,
  matchCount,
  availableExtensions
}: SearchFiltersProps) {
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  // Common quick extension filters dynamically aggregated from the database files
  const quickExts = React.useMemo(() => {
    // Standard popular ones to prioritize if they exist in the database
    const priority = ['.mkv', '.mp4', '.pdf', '.zip', '.flac', '.jpg', '.ts', '.png', '.mp3', '.iso', '.exe', '.rar'];
    const activePriority = priority.filter(p => availableExtensions.includes(p));
    
    // If we don't have enough active priority extensions, fill them with other available ones
    const others = availableExtensions.filter(ext => ext && !activePriority.includes(ext));
    const combined = [...activePriority, ...others].slice(0, 8);
    
    // Fallback list if database has no files yet
    return combined.length > 0 ? combined : ['.mkv', '.mp4', '.pdf', '.zip', '.flac', '.jpg', '.ts'];
  }, [availableExtensions]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, query: e.target.value }));
  };

  const toggleExtension = (ext: string) => {
    setFilters(prev => ({
      ...prev,
      extension: prev.extension === ext ? '' : ext
    }));
  };

  const setSizeRange = (min: number, max: number) => {
    setFilters(prev => ({ ...prev, minSize: min, maxSize: max }));
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters(prev => ({ ...prev, sortBy: e.target.value as any }));
  };

  const handleResetFilters = () => {
    setFilters({
      query: '',
      extension: '',
      minSize: 0,
      maxSize: -1,
      sortBy: 'name-asc'
    });
  };

  // Check if any filters are active (besides default)
  const hasActiveFilters = 
    filters.query !== '' || 
    filters.extension !== '' || 
    filters.minSize !== 0 || 
    filters.maxSize !== -1;

  // Active size label
  const getSizeLabel = () => {
    if (filters.minSize === 0 && filters.maxSize === -1) return 'Any size';
    if (filters.minSize === 0 && filters.maxSize === 1024 * 1024) return 'Tiny (< 1 MB)';
    if (filters.minSize === 1024 * 1024 && filters.maxSize === 100 * 1024 * 1024) return 'Medium (1 - 100 MB)';
    if (filters.minSize === 100 * 1024 * 1024 && filters.maxSize === 1024 * 1024 * 1024) return 'Large (100 MB - 1 GB)';
    if (filters.minSize === 1024 * 1024 * 1024 && filters.maxSize === -1) return 'Huge (> 1 GB)';
    return 'Custom size';
  };

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-5 space-y-4 transition-colors duration-200" id="filters-container">
      {/* Row 1: Search Input, View Mode, and Toggle Filters */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between" id="filters-main-row">
        {/* Search Input Box */}
        <div className="relative flex-1" id="search-input-box">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search filenames, folders, extensions, absolute paths... (Updates instantly)"
            value={filters.query}
            onChange={handleQueryChange}
            className="w-full pl-11 pr-10 py-3 bg-slate-100 dark:bg-slate-950 border-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-all font-sans shadow-inner"
            id="global-search-input"
          />
          {filters.query && (
            <button
              onClick={() => setFilters(prev => ({ ...prev, query: '' }))}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 rounded-full transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Action Controls & View Mode */}
        <div className="flex items-center gap-3 shrink-0" id="filters-controls-section">
          {/* Advanced Filter Dropdown Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-2 px-3.5 py-3 rounded-xl border text-sm transition-all font-sans font-semibold cursor-pointer ${
              showAdvanced || hasActiveFilters
                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-850 text-indigo-700 dark:text-indigo-400'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            title="Advanced Search Filters"
            id="advanced-filters-btn"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse"></span>
            )}
          </button>

          {/* View Toggles */}
          <div className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1 rounded-xl flex items-center gap-1 shrink-0 transition-colors" id="view-mode-toggles">
            <button
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                viewMode === 'tree'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200 dark:border-slate-800'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="Browse Collapsible Folder Tree"
              id="view-tree-btn"
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Tree</span>
            </button>
            <button
              onClick={() => setViewMode('flat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                viewMode === 'flat'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200 dark:border-slate-800'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="Fast Search Flat Grid View"
              id="view-flat-btn"
            >
              <List className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
            <button
              onClick={() => setViewMode('treemap')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                viewMode === 'treemap'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200 dark:border-slate-800'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="WinDirStat Style Interactive Storage TreeMap"
              id="view-treemap-btn"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>TreeMap</span>
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Quick Filter Shortcuts */}
      <div className="flex flex-wrap items-center gap-2" id="filters-quick-row">
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 dark:text-slate-500 mr-2 font-bold">Extensions:</span>
        <button
          onClick={() => setFilters(prev => ({ ...prev, extension: '' }))}
          className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
            filters.extension === ''
              ? 'bg-slate-800 dark:bg-indigo-600 text-white border-slate-800 dark:border-indigo-600 font-bold'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          All
        </button>
        {quickExts.map(ext => {
          const isActive = filters.extension === ext;
          return (
            <button
              key={ext}
              onClick={() => toggleExtension(ext)}
              className={`px-2.5 py-1 text-xs font-mono rounded-lg border transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {ext}
            </button>
          );
        })}

        {/* Dynamic extension overflow select dropdown */}
        {availableExtensions.length > 0 && (
          <div className="relative inline-block shrink-0">
            <select
              value={quickExts.includes(filters.extension) ? '' : filters.extension}
              onChange={(e) => setFilters(prev => ({ ...prev, extension: e.target.value }))}
              className={`px-2.5 py-1 text-xs font-sans rounded-lg border transition-all cursor-pointer font-semibold ${
                filters.extension !== '' && !quickExts.includes(filters.extension)
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <option value="">
                {filters.extension && !quickExts.includes(filters.extension)
                  ? `Active: ${filters.extension}`
                  : 'Other Extensions...'}
              </option>
              {availableExtensions
                .filter(ext => ext && !quickExts.includes(ext.toLowerCase()))
                .map(ext => (
                  <option key={ext} value={ext} className="font-mono text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-300">
                    {ext}
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Render indicator of matched files count */}
        <div className="ml-auto text-xs text-slate-500 dark:text-slate-400 font-sans font-medium">
          Matches: <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">{matchCount.toLocaleString()}</span> items
        </div>
      </div>

      {/* Advanced Drawer Panel (Slides out when toggled) */}
      {showAdvanced && (
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-5 animate-in fade-in duration-200" id="advanced-drawer-panel">
          {/* File Size Filter Segment */}
          <div className="space-y-2.5">
            <span className="text-xs font-mono tracking-wide text-slate-500 dark:text-slate-400 block font-bold">File Size Boundaries</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSizeRange(0, -1)}
                className={`text-[10px] px-2 py-1 rounded font-mono border cursor-pointer ${
                  filters.minSize === 0 && filters.maxSize === -1
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 font-semibold'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Any size
              </button>
              <button
                onClick={() => setSizeRange(0, 1024 * 1024)}
                className={`text-[10px] px-2 py-1 rounded font-mono border cursor-pointer ${
                  filters.minSize === 0 && filters.maxSize === 1024 * 1024
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 font-semibold'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Tiny (&lt; 1MB)
              </button>
              <button
                onClick={() => setSizeRange(1024 * 1024, 100 * 1024 * 1024)}
                className={`text-[10px] px-2 py-1 rounded font-mono border cursor-pointer ${
                  filters.minSize === 1024 * 1024 && filters.maxSize === 100 * 1024 * 1024
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 font-semibold'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Medium (1-100MB)
              </button>
              <button
                onClick={() => setSizeRange(100 * 1024 * 1024, 1024 * 1024 * 1024)}
                className={`text-[10px] px-2 py-1 rounded font-mono border cursor-pointer ${
                  filters.minSize === 100 * 1024 * 1024 && filters.maxSize === 1024 * 1024 * 1024
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 font-semibold'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Large (100MB-1GB)
              </button>
              <button
                onClick={() => setSizeRange(1024 * 1024 * 1024, -1)}
                className={`text-[10px] px-2 py-1 rounded font-mono border cursor-pointer ${
                  filters.minSize === 1024 * 1024 * 1024 && filters.maxSize === -1
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 font-semibold'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Huge (&gt; 1GB)
              </button>
            </div>
            <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-medium">
              Active filter: <span className="text-slate-600 dark:text-slate-300 font-bold">{getSizeLabel()}</span>
            </div>
          </div>

          {/* Sorting Control Selection (Flat view only) */}
          <div className="space-y-2">
            <span className="text-xs font-mono tracking-wide text-slate-500 dark:text-slate-400 block font-bold flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              Sort Sequence (Flat Grid only)
            </span>
            <select
              value={filters.sortBy}
              onChange={handleSortChange}
              disabled={viewMode === 'tree'}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-300 focus:border-indigo-500 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed font-sans shadow-xs cursor-pointer"
            >
              <option value="name-asc" className="bg-white dark:bg-slate-900">File Name (Alphabetical A-Z)</option>
              <option value="name-desc" className="bg-white dark:bg-slate-900">File Name (Alphabetical Z-A)</option>
              <option value="size-asc" className="bg-white dark:bg-slate-900">Size (Smallest First)</option>
              <option value="size-desc" className="bg-white dark:bg-slate-900">Size (Largest First)</option>
              <option value="path-asc" className="bg-white dark:bg-slate-900">Absolute Path (Directory sequence)</option>
            </select>
            {viewMode === 'tree' && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 italic block font-medium">Tree nodes automatically sort directories first, then files alphabetically.</span>
            )}
          </div>

          {/* Action Tools & Reset */}
          <div className="flex flex-col justify-end space-y-2">
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg py-2.5 text-xs font-semibold tracking-wide transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear All Active Filters</span>
              </button>
            )}
            <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 leading-relaxed text-right font-medium">
              Tip: Index search performs full substring matches on paths. Use folders names (e.g. \"RAW\") to find paths containing it.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
