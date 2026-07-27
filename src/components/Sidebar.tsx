import React from 'react';
import { Drive } from '../types';
import { formatBytes } from '../utils/treeBuilder';
import { 
  HardDrive, 
  Database, 
  Disc, 
  Server, 
  Archive, 
  Plus, 
  FolderSync, 
  Trash2, 
  Edit3, 
  X, 
  Check, 
  FolderOpen,
  LogOut,
  User,
  Sparkles,
  FolderHeart,
  ChevronLeft,
  Sun,
  Moon
} from 'lucide-react';

interface SidebarProps {
  drives: Drive[];
  activeDriveId: string | null;
  setActiveDriveId: (id: string | null) => void;
  onOpenImport: () => void;
  onDeleteDrive: (id: string) => void;
  onRenameDrive: (id: string, newName: string) => void;
  currentUser?: { id: number; username: string } | null;
  onLogout?: () => void;
  showDuplicates: boolean;
  setShowDuplicates: (val: boolean) => void;
  showExportSync: boolean;
  setShowExportSync: (val: boolean) => void;
  showCollections: boolean;
  setShowCollections: (val: boolean) => void;
  isCollapsed?: boolean;
  setIsCollapsed?: (val: boolean) => void;
  loadingDrives?: Record<string, boolean>;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export default function Sidebar({
  drives,
  activeDriveId,
  setActiveDriveId,
  onOpenImport,
  onDeleteDrive,
  onRenameDrive,
  currentUser,
  onLogout,
  showDuplicates,
  setShowDuplicates,
  showExportSync,
  setShowExportSync,
  showCollections,
  setShowCollections,
  isCollapsed = false,
  setIsCollapsed,
  loadingDrives = {},
  theme,
  toggleTheme
}: SidebarProps) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState('');
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const handleStartEdit = (drive: Drive, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(drive.id);
    setEditName(drive.name);
  };

  const handleSaveEdit = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editName.trim()) {
      onRenameDrive(id, editName.trim());
    }
    setEditingId(null);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const totalCatalogSize = drives.reduce((acc, d) => acc + (Number(d.totalSize) || 0), 0);
  const totalCatalogFiles = drives.reduce((acc, d) => acc + (Number(d.fileCount) || 0), 0);

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'database': return Database;
      case 'disc': return Disc;
      case 'server': return Server;
      case 'archive': return Archive;
      default: return HardDrive;
    }
  };

  // Color mapping for badges and icons
  const colorMap: { [key: string]: { bg: string, text: string, border: string } } = {
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
    violet: { bg: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800' },
    rose: { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
  };

  return (
    <aside className={`border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 border-r-0' : 'w-80 border-r'}`} id="app-sidebar">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between whitespace-nowrap" id="sidebar-header">
        <div className="flex items-center gap-3">
          <div className="p-1 bg-slate-50 dark:bg-slate-800 rounded-lg shadow-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center w-9 h-9 shrink-0">
            <img 
              src={theme === 'dark' ? '/icon-192x192-white.png' : '/icon-192x192.png'} 
              alt="ReIndex Logo" 
              className="w-7 h-7 object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h1 className="font-sans font-bold text-slate-800 dark:text-slate-100 tracking-tight text-lg leading-none">ReIndex</h1>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-medium mt-1">Offline Path Indexer</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-medium">
            v1.0
          </div>
          {setIsCollapsed && (
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              title="Hide Sidebar"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Catalog Overview */}
      <div className="p-5 border-b border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20" id="sidebar-overview">
        <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold mb-3">Catalog Summary</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans font-medium">Indexed Drives</div>
            <div className="text-xl font-semibold text-slate-800 dark:text-slate-100 mt-1 font-mono">{drives.length}</div>
          </div>
          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans font-medium">Total Size</div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 mt-1.5 font-mono truncate" title={formatBytes(totalCatalogSize)}>
              {formatBytes(totalCatalogSize, 1)}
            </div>
          </div>
        </div>
        <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-mono px-1 font-medium">
          <FolderOpen className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
          <span>{totalCatalogFiles.toLocaleString()} files cataloged</span>
        </div>
      </div>

      {/* Drives Navigation List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" id="sidebar-drives-container">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-mono uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold">My Storages</span>
          <button
            onClick={onOpenImport}
            className="flex items-center gap-1 text-[11px] font-sans font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900 cursor-pointer"
            id="add-drive-btn"
          >
            <Plus className="w-3 h-3" />
            <span>Add Catalog</span>
          </button>
        </div>

        <div className="space-y-1.5" id="sidebar-drive-list">
          {/* "All Drives" Toggle */}
          <button
            onClick={() => {
              setActiveDriveId(null);
              setShowDuplicates(false);
              setShowExportSync(false);
              setShowCollections(false);
            }}
            className={`w-full text-left px-3 py-3 rounded-xl transition-all duration-200 flex items-center justify-between border cursor-pointer ${
              activeDriveId === null && !showDuplicates && !showExportSync && !showCollections
                ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'bg-transparent border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            id="drive-all-toggle"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${
                activeDriveId === null && !showDuplicates && !showExportSync && !showCollections ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
              }`}>
                <Server className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-semibold font-sans">All Connected Drives</span>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">Unified global database search</p>
              </div>
            </div>
            <div className="text-xs font-mono px-2 py-0.5 rounded bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
              {totalCatalogFiles}
            </div>
          </button>

          {/* Drive Catalog Cards */}
          {drives.map((drive) => {
            const isActive = activeDriveId === drive.id && !showDuplicates && !showExportSync && !showCollections;
            const Icon = getIconComponent(drive.icon);
            const style = colorMap[drive.color] || colorMap.blue;
            const isEditing = editingId === drive.id;

            return (
              <div
                key={drive.id}
                onClick={() => {
                  if (!isEditing) {
                    setActiveDriveId(drive.id);
                    setShowDuplicates(false);
                    setShowExportSync(false);
                    setShowCollections(false);
                  }
                }}
                className={`group relative w-full text-left p-3 rounded-xl transition-all duration-200 border cursor-pointer ${
                  isActive
                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm'
                    : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
                id={`drive-card-${drive.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      isActive ? `${style.bg} ${style.text}` : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0 pr-6">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 mt-0.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(drive.id, e as any);
                              if (e.key === 'Escape') handleCancelEdit(e as any);
                            }}
                            className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full font-sans"
                            autoFocus
                          />
                          <button
                            onClick={(e) => handleSaveEdit(drive.id, e)}
                            className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : deletingId === drive.id ? (
                        <div className="flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 font-sans leading-tight">Delete entire catalog?</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteDrive(drive.id);
                                setDeletingId(null);
                              }}
                              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded cursor-pointer transition-colors shadow-xs"
                              id={`confirm-delete-yes-${drive.id}`}
                            >
                              Yes, Delete
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingId(null);
                              }}
                              className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold rounded border border-slate-300 dark:border-slate-700 cursor-pointer transition-colors shadow-xs"
                              id={`confirm-delete-no-${drive.id}`}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-sm font-semibold truncate ${
                            isActive ? 'text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-100'
                          }`}>
                            {drive.name}
                          </span>
                          {loadingDrives?.[drive.id] && (
                            <span className="w-2.5 h-2.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" title="Loading complete database catalog..." />
                          )}
                          <span className={`text-[10px] uppercase font-bold font-mono px-1.5 py-0.2 rounded border shrink-0 ${style.bg} ${style.text} ${style.border}`}>
                            {drive.letter}:
                          </span>
                        </div>
                      )}
                      
                      <div className="flex flex-col gap-0.5 mt-1">
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center justify-between">
                          <span>{drive.fileCount.toLocaleString()} files</span>
                          <span>{formatBytes(drive.totalSize, 1)}</span>
                        </div>
                        <div className="text-[9px] font-mono text-slate-400 dark:text-slate-500 mt-1">
                          Last sync: {drive.lastUpdated}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Settings / Edit Trigger for Drive (Shown on Hover) */}
                  {!isEditing && deletingId !== drive.id && (
                    <div className="absolute right-2.5 top-2.5 hidden group-hover:flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-md border border-slate-200 dark:border-slate-800 shadow-sm">
                      <button
                        onClick={(e) => handleStartEdit(drive, e)}
                        className="p-1 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Rename drive"
                        id={`edit-drive-${drive.id}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(drive.id);
                        }}
                        className="p-1 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Remove catalog"
                        id={`delete-drive-${drive.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Space Optimizer Toggle */}
          <button
            onClick={() => {
              setShowDuplicates(true);
              setShowExportSync(false);
              setShowCollections(false);
              setActiveDriveId(null);
            }}
            className={`w-full text-left px-3 py-3 rounded-xl transition-all duration-200 flex items-center justify-between border cursor-pointer ${
              showDuplicates && !showExportSync && !showCollections
                ? 'bg-gradient-to-r from-indigo-50 to-slate-100 dark:from-indigo-950/40 dark:to-slate-800/40 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-350 shadow-xs'
                : 'bg-transparent border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            id="space-optimizer-toggle"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${
                showDuplicates && !showExportSync && !showCollections ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
              }`}>
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-semibold font-sans flex items-center gap-1.5">
                  <span>Space Optimizer</span>
                </span>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">Cross-drive duplicate detector</p>
              </div>
            </div>
            <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/50 font-bold px-1.5 py-0.5 rounded font-sans scale-90">
              FREE UP
            </span>
          </button>

          {/* Export & Sync Assistant Toggle */}
          <button
            onClick={() => {
              setShowExportSync(true);
              setShowDuplicates(false);
              setShowCollections(false);
              setActiveDriveId(null);
            }}
            className={`w-full text-left px-3 py-3 rounded-xl transition-all duration-200 flex items-center justify-between border cursor-pointer ${
              showExportSync && !showCollections
                ? 'bg-gradient-to-r from-emerald-50 to-slate-100 dark:from-emerald-950/40 dark:to-slate-800/40 border-emerald-200 dark:border-emerald-800 text-slate-900 dark:text-emerald-350 shadow-xs'
                : 'bg-transparent border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            id="export-sync-assistant-toggle"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${
                showExportSync && !showCollections ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
              }`}>
                <FolderSync className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-semibold font-sans flex items-center gap-1.5">
                  <span>Export &amp; Sync</span>
                </span>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">Robocopy script generator</p>
              </div>
            </div>
            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-400 border border-emerald-250/55 dark:border-emerald-900/50 font-bold px-1.5 py-0.5 rounded font-sans scale-90">
              TOOLS
            </span>
          </button>

          {/* Virtual Collections Toggle */}
          <button
            onClick={() => {
              setShowCollections(true);
              setShowExportSync(false);
              setShowDuplicates(false);
              setActiveDriveId(null);
            }}
            className={`w-full text-left px-3 py-3 rounded-xl transition-all duration-200 flex items-center justify-between border cursor-pointer ${
              showCollections
                ? 'bg-gradient-to-r from-indigo-50 to-slate-100 dark:from-indigo-950/40 dark:to-slate-800/40 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-350 shadow-xs'
                : 'bg-transparent border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            id="virtual-collections-toggle"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${
                showCollections ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
              }`}>
                <FolderHeart className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-semibold font-sans flex items-center gap-1.5">
                  <span>Virtual Collections</span>
                </span>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">Custom tags &amp; grouping</p>
              </div>
            </div>
            <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-400 border border-indigo-250/55 dark:border-indigo-900/50 font-bold px-1.5 py-0.5 rounded font-sans scale-90">
              LABELS
            </span>
          </button>
        </div>
      </div>

      {/* User profile / session state */}
      {currentUser ? (
        <div className="p-4 border-t border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between" id="sidebar-user-footer">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold text-xs shrink-0 font-mono">
              {currentUser.username[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate font-sans">{currentUser.username}</p>
              <p className="text-[9px] text-indigo-600 dark:text-indigo-455 font-bold tracking-wide uppercase font-sans">Active Member</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Log out of cloud"
            id="sidebar-logout-btn"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="p-4 border-t border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-center text-[10px] text-slate-500 dark:text-slate-400 font-mono flex items-center justify-center gap-1.5">
          <span>Active Catalog Cache</span>
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
          <span>Ready</span>
        </div>
      )}
    </aside>
  );
}
