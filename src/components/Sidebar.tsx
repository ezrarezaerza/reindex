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
  User
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
}

export default function Sidebar({
  drives,
  activeDriveId,
  setActiveDriveId,
  onOpenImport,
  onDeleteDrive,
  onRenameDrive,
  currentUser,
  onLogout
}: SidebarProps) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState('');

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

  const totalCatalogSize = drives.reduce((acc, d) => acc + d.totalSize, 0);
  const totalCatalogFiles = drives.reduce((acc, d) => acc + d.fileCount, 0);

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
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  };

  return (
    <aside className="w-80 border-r border-slate-200 bg-white flex flex-col h-full overflow-hidden" id="app-sidebar">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-150 flex items-center justify-between" id="sidebar-header">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shadow-sm border border-indigo-100">
            <FolderSync className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-sans font-bold text-slate-800 tracking-tight text-lg">ReIndex</h1>
            <p className="text-[10px] text-slate-400 font-mono font-medium">Offline Path Indexer</p>
          </div>
        </div>
        <div className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-mono text-slate-500 border border-slate-200 font-medium">
          v1.0
        </div>
      </div>

      {/* Catalog Overview */}
      <div className="p-5 border-b border-slate-150 bg-slate-50/50" id="sidebar-overview">
        <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-3">Catalog Summary</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
            <div className="text-[10px] text-slate-500 font-sans font-medium">Indexed Drives</div>
            <div className="text-xl font-semibold text-slate-800 mt-1 font-mono">{drives.length}</div>
          </div>
          <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
            <div className="text-[10px] text-slate-500 font-sans font-medium">Total Size</div>
            <div className="text-xs font-semibold text-slate-800 mt-1.5 font-mono truncate" title={formatBytes(totalCatalogSize)}>
              {formatBytes(totalCatalogSize, 1)}
            </div>
          </div>
        </div>
        <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5 font-mono px-1 font-medium">
          <FolderOpen className="w-3.5 h-3.5 text-indigo-500" />
          <span>{totalCatalogFiles.toLocaleString()} files cataloged</span>
        </div>
      </div>

      {/* Drives Navigation List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" id="sidebar-drives-container">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold">My Storages</span>
          <button
            onClick={onOpenImport}
            className="flex items-center gap-1 text-[11px] font-sans font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors px-2.5 py-1 rounded-lg border border-indigo-100"
            id="add-drive-btn"
          >
            <Plus className="w-3 h-3" />
            <span>Add Catalog</span>
          </button>
        </div>

        <div className="space-y-1.5" id="sidebar-drive-list">
          {/* "All Drives" Toggle */}
          <button
            onClick={() => setActiveDriveId(null)}
            className={`w-full text-left px-3 py-3 rounded-xl transition-all duration-200 flex items-center justify-between border ${
              activeDriveId === null
                ? 'bg-slate-100 border-slate-200 text-slate-900 shadow-sm'
                : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-800'
            }`}
            id="drive-all-toggle"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${
                activeDriveId === null ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
              }`}>
                <Server className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-semibold font-sans">All Connected Drives</span>
                <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Unified global database search</p>
              </div>
            </div>
            <div className="text-xs font-mono px-2 py-0.5 rounded bg-white text-slate-500 border border-slate-200">
              {totalCatalogFiles}
            </div>
          </button>

          {/* Drive Catalog Cards */}
          {drives.map((drive) => {
            const isActive = activeDriveId === drive.id;
            const Icon = getIconComponent(drive.icon);
            const style = colorMap[drive.color] || colorMap.blue;
            const isEditing = editingId === drive.id;

            return (
              <div
                key={drive.id}
                onClick={() => !isEditing && setActiveDriveId(drive.id)}
                className={`group relative w-full text-left p-3 rounded-xl transition-all duration-200 border cursor-pointer ${
                  isActive
                    ? 'bg-slate-100/80 border-slate-200 shadow-sm'
                    : 'bg-transparent border-transparent hover:bg-slate-50'
                }`}
                id={`drive-card-${drive.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      isActive ? `${style.bg} ${style.text}` : 'bg-slate-100 text-slate-400'
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
                            className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full font-sans"
                            autoFocus
                          />
                          <button
                            onClick={(e) => handleSaveEdit(drive.id, e)}
                            className="p-1 hover:bg-emerald-100 text-emerald-600 rounded"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 hover:bg-rose-100 text-rose-600 rounded"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-semibold truncate ${
                            isActive ? 'text-slate-800' : 'text-slate-600 group-hover:text-slate-800'
                          }`}>
                            {drive.name}
                          </span>
                          <span className={`text-[10px] uppercase font-bold font-mono px-1.5 py-0.2 rounded border ${style.bg} ${style.text} ${style.border}`}>
                            {drive.letter}:
                          </span>
                        </div>
                      )}
                      
                      <div className="flex flex-col gap-0.5 mt-1">
                        <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between">
                          <span>{drive.fileCount.toLocaleString()} files</span>
                          <span>{formatBytes(drive.totalSize, 1)}</span>
                        </div>
                        <div className="text-[9px] font-mono text-slate-400 mt-1">
                          Last sync: {drive.lastUpdated}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Settings / Edit Trigger for Drive (Shown on Hover) */}
                  {!isEditing && (
                    <div className="absolute right-2.5 top-2.5 hidden group-hover:flex items-center gap-1 bg-white p-1 rounded-md border border-slate-200 shadow-sm">
                      <button
                        onClick={(e) => handleStartEdit(drive, e)}
                        className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-50 transition-colors"
                        title="Rename drive"
                        id={`edit-drive-${drive.id}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Are you sure you want to remove the database catalog for "${drive.name}"?`)) {
                            onDeleteDrive(drive.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-50 transition-colors"
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
        </div>
      </div>

      {/* User profile / session state */}
      {currentUser ? (
        <div className="p-4 border-t border-slate-150 bg-slate-50 flex items-center justify-between" id="sidebar-user-footer">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0 font-mono">
              {currentUser.username[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-700 truncate font-sans">{currentUser.username}</p>
              <p className="text-[9px] text-indigo-600 font-bold tracking-wide uppercase font-sans">Synced Member</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Log out of cloud"
            id="sidebar-logout-btn"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="p-4 border-t border-slate-150 bg-slate-50 text-center text-[10px] text-slate-500 font-mono flex items-center justify-center gap-1.5">
          <span>Active Catalog Cache</span>
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
          <span>Ready</span>
        </div>
      )}
    </aside>
  );
}
