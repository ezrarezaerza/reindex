import React from 'react';
import { FileItem, SearchFiltersState, Tag, FileTagRelation } from '../types';
import { formatBytes } from '../utils/treeBuilder';
import { 
  File, 
  ChevronLeft, 
  ChevronRight, 
  Video, 
  Music, 
  Image as ImageIcon, 
  FileText, 
  FileArchive, 
  Code2,
  HardDrive,
  Info,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

interface FlatGridViewProps {
  files: FileItem[];
  filters: SearchFiltersState;
  setFilters: React.Dispatch<React.SetStateAction<SearchFiltersState>>;
  onSelectFile: (fullName: string) => void;
  tags?: Tag[];
  fileTags?: FileTagRelation[];
}

// Map file extensions to matching Icons and Color classes
const getFileIconAndColor = (extension?: string) => {
  if (!extension) return { Icon: File, color: 'text-slate-400' };
  const ext = extension.toLowerCase();
  
  if (['.mp4', '.mkv', '.mov', '.avi', '.wmv'].includes(ext)) {
    return { Icon: Video, color: 'text-rose-600' };
  }
  if (['.mp3', '.flac', '.wav', '.m4a', '.ogg'].includes(ext)) {
    return { Icon: Music, color: 'text-emerald-600' };
  }
  if (['.jpg', '.jpeg', '.png', '.gif', '.cr2', '.nef', '.psd', '.tiff'].includes(ext)) {
    return { Icon: ImageIcon, color: 'text-violet-600' };
  }
  if (['.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.doc', '.csv'].includes(ext)) {
    return { Icon: FileText, color: 'text-amber-600' };
  }
  if (['.zip', '.rar', '.7z', '.tar', '.gz', '.iso'].includes(ext)) {
    return { Icon: FileArchive, color: 'text-blue-600' };
  }
  if (['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.py', '.go'].includes(ext)) {
    return { Icon: Code2, color: 'text-cyan-600' };
  }
  
  return { Icon: File, color: 'text-slate-400' };
};

export default function FlatGridView({
  files,
  filters,
  setFilters,
  onSelectFile,
  tags = [],
  fileTags = []
}: FlatGridViewProps) {
  // Pagination State
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 50;

  // Whenever files change (search/filter), reset to page 1
  React.useEffect(() => {
    setCurrentPage(1);
  }, [files]);

  // Compute pages
  const totalPages = Math.max(1, Math.ceil(files.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, files.length);
  const paginatedFiles = files.slice(startIndex, endIndex);

  // Trigger column header sort
  const handleSortHeader = (columnKey: 'name' | 'size') => {
    let nextSort: SearchFiltersState['sortBy'] = 'name-asc';
    
    if (columnKey === 'name') {
      nextSort = filters.sortBy === 'name-asc' ? 'name-desc' : 'name-asc';
    } else if (columnKey === 'size') {
      nextSort = filters.sortBy === 'size-asc' ? 'size-desc' : 'size-asc';
    }
    
    setFilters(prev => ({ ...prev, sortBy: nextSort }));
  };

  const getSortIcon = (columnKey: 'name' | 'size') => {
    if (columnKey === 'name') {
      if (filters.sortBy === 'name-asc') return <ChevronUp className="w-3.5 h-3.5 ml-1 text-indigo-600" />;
      if (filters.sortBy === 'name-desc') return <ChevronDown className="w-3.5 h-3.5 ml-1 text-indigo-600" />;
    }
    if (columnKey === 'size') {
      if (filters.sortBy === 'size-asc') return <ChevronUp className="w-3.5 h-3.5 ml-1 text-indigo-600" />;
      if (filters.sortBy === 'size-desc') return <ChevronDown className="w-3.5 h-3.5 ml-1 text-indigo-600" />;
    }
    return null;
  };

  // Helper to highlight match query letters in file text
  const renderHighlightedText = (text: string, query: string) => {
    if (!query.trim()) return <span>{text}</span>;
    const cleanQuery = query.toLowerCase().trim();
    const index = text.toLowerCase().indexOf(cleanQuery);
    if (index === -1) return <span>{text}</span>;

    const before = text.substring(0, index);
    const match = text.substring(index, index + cleanQuery.length);
    const after = text.substring(index + cleanQuery.length);

    return (
      <span className="font-semibold text-slate-800 dark:text-slate-200">
        {before}
        <mark className="bg-yellow-100 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-400 px-0.5 rounded border border-yellow-250 dark:border-yellow-900/60 font-semibold">{match}</mark>
        {after}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900" id="flat-grid-wrapper">
      {/* Table grid scrollable view */}
      <div className="flex-1 overflow-auto" id="flat-table-scroller">
        <table className="w-full text-left border-collapse" id="flat-files-table">
          {/* Sticky Table Header */}
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 sticky top-0 backdrop-blur-md z-10 text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider select-none font-bold">
              <th 
                className="py-3 px-5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                onClick={() => handleSortHeader('name')}
              >
                <div className="flex items-center">
                  <span>File Name</span>
                  {getSortIcon('name')}
                </div>
              </th>
              <th className="py-3 px-4">Absolute Path / Directory</th>
              <th className="py-3 px-4 w-28">Extension</th>
              <th 
                className="py-3 px-5 w-32 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                onClick={() => handleSortHeader('size')}
              >
                <div className="flex items-center justify-end">
                  <span>Size</span>
                  {getSortIcon('size')}
                </div>
              </th>
              <th className="py-3 px-4 w-12 text-center">Detail</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs text-slate-600 dark:text-slate-400">
            {paginatedFiles.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center font-sans text-slate-400 dark:text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <Info className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                    <span className="font-semibold text-slate-500 dark:text-slate-400">No index matches found</span>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-xs mt-1 font-medium">Try deleting some letters in the global search input or switching off active extension buttons.</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedFiles.map((file, idx) => {
                const { Icon, color } = getFileIconAndColor(file.Extension);
                
                // Extract drive letter (e.g. "E" from "E:\...")
                const driveLetter = file.FullName.match(/^([A-Za-z]):\\/)?.[1] || '';

                // Find active tags associated with this file
                const activeFileTags = fileTags
                  .filter(ft => ft.driveId === file.DriveId && ft.fullName === file.FullName)
                  .map(ft => tags.find(t => t.id === ft.tagId))
                  .filter(Boolean);

                return (
                  <tr 
                    key={idx}
                    onClick={() => onSelectFile(file.FullName)}
                    className="hover:bg-slate-50/75 dark:hover:bg-slate-800/30 cursor-pointer group transition-colors font-sans"
                  >
                    {/* Filename with matching Icon */}
                    <td className="py-3.5 px-5 font-bold text-slate-800 dark:text-slate-200 max-w-xs truncate">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <Icon className={`w-4.5 h-4.5 shrink-0 ${color}`} />
                        <span className="truncate">{renderHighlightedText(file.Name, filters.query)}</span>
                        {activeFileTags.map((t, tIdx) => (
                          <span 
                            key={tIdx} 
                            className={`px-1.5 py-0.2 rounded text-[8px] font-bold border shrink-0 uppercase tracking-wide scale-90 ${t?.color}`}
                          >
                            {t?.name}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Full Directory Path */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400 max-w-md truncate">
                      {driveLetter && (
                        <span className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 px-1.5 py-0.2 rounded mr-1.5 font-bold uppercase">
                          {driveLetter}:
                        </span>
                      )}
                      <span className="truncate">{renderHighlightedText(file.FullName, filters.query)}</span>
                    </td>

                    {/* Extension */}
                    <td className="py-3.5 px-4 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        {file.Extension.toLowerCase()}
                      </span>
                    </td>

                    {/* Formatted File Size */}
                    <td className="py-3.5 px-5 font-mono text-right text-slate-600 dark:text-slate-400 font-semibold">
                      {formatBytes(file.Length)}
                    </td>

                    {/* Inspect Icon Action Column */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectFile(file.FullName);
                        }}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-405 rounded transition-colors cursor-pointer"
                        title="View path properties"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controller Row */}
      <div className="py-3 px-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0" id="flat-grid-pagination">
        {/* Results Counter info */}
        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-medium">
          Showing <span className="text-slate-700 dark:text-slate-300 font-bold">{files.length === 0 ? 0 : startIndex + 1}</span> - <span className="text-slate-700 dark:text-slate-300 font-bold">{endIndex}</span> of <span className="text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900 shrink-0">{files.length.toLocaleString()}</span> entries
        </div>

        {/* Navigation controls */}
        <div className="flex items-center gap-2" id="pagination-buttons">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:dark:hover:bg-slate-900 disabled:hover:text-slate-400 disabled:dark:hover:text-slate-600 text-xs font-semibold tracking-wide flex items-center gap-1 cursor-pointer shadow-xs"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>
          
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono px-3 font-medium">
            Page <span className="text-slate-700 dark:text-slate-300 font-semibold">{currentPage}</span> of <span className="text-slate-700 dark:text-slate-300 font-semibold">{totalPages}</span>
          </div>

          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:dark:hover:bg-slate-900 disabled:hover:text-slate-400 disabled:dark:hover:text-slate-600 text-xs font-semibold tracking-wide flex items-center gap-1 cursor-pointer shadow-xs"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
