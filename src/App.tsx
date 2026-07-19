import React from 'react';
import { Drive, FileItem, SearchFiltersState } from './types';
import Sidebar from './components/Sidebar';
import StatsBar from './components/StatsBar';
import SearchFilters from './components/SearchFilters';
import TreeView from './components/TreeView';
import FlatGridView from './components/FlatGridView';
import FileDetailModal from './components/FileDetailModal';
import ImportModal from './components/ImportModal';
import { generateSampleDrives } from './utils/sampleData';
import { buildTreeFromFiles, filterTree, filterFlatFiles } from './utils/treeBuilder';
import { FolderSync, HardDrive, HelpCircle, LayoutGrid, Terminal, Database, Cloud, CloudOff } from 'lucide-react';

const STORAGE_KEY_PREFIX = 'drivecatalog_drives_v1';

export default function App() {
  // --- Core State ---
  const [drives, setDrives] = React.useState<Drive[]>([]);
  const [activeDriveId, setActiveDriveId] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<'tree' | 'flat'>('tree');
  const [selectedFileFullname, setSelectedFileFullname] = React.useState<string | null>(null);
  
  // Database status tracking
  const [dbStatus, setDbStatus] = React.useState<{ connected: boolean; error?: string }>({ connected: false });
  const [dbLoading, setDbLoading] = React.useState(true);

  // Modal visibility
  const [isImportOpen, setIsImportOpen] = React.useState(false);

  // Search and filter parameters
  const [filters, setFilters] = React.useState<SearchFiltersState>({
    query: '',
    extension: '',
    minSize: 0,
    maxSize: -1,
    sortBy: 'name-asc'
  });

  // --- Load and Store Drives from Database / Cache ---
  React.useEffect(() => {
    async function initData() {
      setDbLoading(true);
      try {
        const statusRes = await fetch('/api/db-status');
        const statusData = await statusRes.json();
        setDbStatus(statusData);

        if (statusData.connected) {
          const drivesRes = await fetch('/api/drives');
          if (drivesRes.ok) {
            const drivesData = await drivesRes.json();
            setDrives(drivesData);
            setDbLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Backend API or Database is not accessible, using LocalStorage fallback:', err);
      }

      // Fallback to LocalStorage or procedurally generated sample data
      try {
        const cached = localStorage.getItem(STORAGE_KEY_PREFIX);
        if (cached) {
          setDrives(JSON.parse(cached));
        } else {
          // Set pre-loaded realistic sample drives
          const samples = generateSampleDrives();
          setDrives(samples);
          localStorage.setItem(STORAGE_KEY_PREFIX, JSON.stringify(samples));
        }
      } catch (e) {
        console.error('Failed to access localStorage:', e);
        setDrives(generateSampleDrives());
      }
      setDbLoading(false);
    }

    initData();
  }, []);

  // --- Drive Operations ---
  const handleAddDrive = async (newDriveData: Omit<Drive, 'fileCount' | 'totalSize' | 'lastUpdated'>) => {
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const newDrive: Drive = {
      ...newDriveData,
      fileCount: newDriveData.items.length,
      totalSize: newDriveData.items.reduce((acc, item) => acc + item.Length, 0),
      lastUpdated: timestamp
    };

    // Optimistically update frontend state
    const updated = [...drives.filter(d => d.id !== newDrive.id), newDrive];
    setDrives(updated);

    if (dbStatus.connected) {
      try {
        const res = await fetch('/api/drives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newDrive)
        });
        if (!res.ok) throw new Error('Database sync failed');
      } catch (err) {
        console.error('Database write failed, saving to local cache fallback:', err);
        try {
          localStorage.setItem(STORAGE_KEY_PREFIX, JSON.stringify(updated));
        } catch (e) {
          console.warn(e);
        }
      }
    } else {
      try {
        localStorage.setItem(STORAGE_KEY_PREFIX, JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
    }

    setActiveDriveId(newDrive.id); // Auto focus new drive catalog
  };

  const handleDeleteDrive = async (id: string) => {
    const updated = drives.filter(d => d.id !== id);
    setDrives(updated);

    if (dbStatus.connected) {
      try {
        const res = await fetch(`/api/drives/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Database delete sync failed');
      } catch (err) {
        console.error('Database delete failed, updating local cache only:', err);
        try {
          localStorage.setItem(STORAGE_KEY_PREFIX, JSON.stringify(updated));
        } catch (e) {
          console.warn(e);
        }
      }
    } else {
      try {
        localStorage.setItem(STORAGE_KEY_PREFIX, JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
    }
    
    // Reset active selection if we deleted the focused drive
    if (activeDriveId === id) {
      setActiveDriveId(null);
    }
  };

  const handleRenameDrive = async (id: string, newName: string) => {
    const updated = drives.map(d => {
      if (d.id === id) {
        return { ...d, name: newName };
      }
      return d;
    });
    setDrives(updated);

    if (dbStatus.connected) {
      try {
        const res = await fetch(`/api/drives/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName })
        });
        if (!res.ok) throw new Error('Database rename sync failed');
      } catch (err) {
        console.error('Database rename failed, updating local cache only:', err);
        try {
          localStorage.setItem(STORAGE_KEY_PREFIX, JSON.stringify(updated));
        } catch (e) {
          console.warn(e);
        }
      }
    } else {
      try {
        localStorage.setItem(STORAGE_KEY_PREFIX, JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
    }
  };

  // --- Calculations and Filtering ---
  const activeDrive = drives.find(d => d.id === activeDriveId) || null;

  // 1. Accumulate all file records across all drives
  const allFilesCombined = React.useMemo(() => {
    return drives.flatMap(d => d.items);
  }, [drives]);

  // 2. Perform Flat Filtering on files (optimized with useMemo)
  const filteredFlatFiles = React.useMemo(() => {
    return filterFlatFiles(allFilesCombined, filters, activeDriveId);
  }, [allFilesCombined, filters, activeDriveId]);

  // 3. Build tree based on active selection (active drive or all files)
  const activeScopeFiles = React.useMemo(() => {
    return activeDrive ? activeDrive.items : allFilesCombined;
  }, [activeDrive, allFilesCombined]);

  const rawTreeNodes = React.useMemo(() => {
    return buildTreeFromFiles(activeScopeFiles);
  }, [activeScopeFiles]);

  // 4. Perform Tree Filtering based on Search inputs
  const filteredTreeNodes = React.useMemo(() => {
    // If no active filters, return standard complete tree
    const hasActiveFilters = 
      filters.query !== '' || 
      filters.extension !== '' || 
      filters.minSize !== 0 || 
      filters.maxSize !== -1;

    if (!hasActiveFilters) {
      return rawTreeNodes;
    }

    return filterTree(
      rawTreeNodes,
      filters.query,
      filters.extension,
      filters.minSize,
      filters.maxSize
    );
  }, [rawTreeNodes, filters]);

  // Find inspected file properties for the side panel
  const inspectedFile = React.useMemo(() => {
    if (!selectedFileFullname) return null;
    return allFilesCombined.find(f => f.FullName === selectedFileFullname) || null;
  }, [selectedFileFullname, allFilesCombined]);

  // Get list of unique file extensions across the database for filter hints
  const availableExtensions = React.useMemo(() => {
    const exts = new Set<string>();
    allFilesCombined.forEach(f => {
      if (f.Extension) exts.add(f.Extension.toLowerCase());
    });
    return Array.from(exts).sort();
  }, [allFilesCombined]);

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-900 overflow-hidden font-sans" id="app-root-container">
      {/* 1. Sidebar Container (Left Rail) */}
      <Sidebar
        drives={drives}
        activeDriveId={activeDriveId}
        setActiveDriveId={setActiveDriveId}
        onOpenImport={() => setIsImportOpen(true)}
        onDeleteDrive={handleDeleteDrive}
        onRenameDrive={handleRenameDrive}
      />

      {/* 2. Main content container (Right Space) */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-slate-50" id="app-main-viewport">
        
        {/* Main Workspace Header bar */}
        <header className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0" id="main-header">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Database className="w-4.5 h-4.5 text-indigo-600" />
              <span>Offline Indices Workspace</span>
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              Browsing {activeDrive ? `Partition ${activeDrive.letter}:\\` : 'Unified drive database storage map'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Database connection badge */}
            <div className={`px-3 py-1.5 rounded-full border text-xs flex items-center gap-1.5 font-medium ${
              dbLoading 
                ? 'bg-slate-50 border-slate-200 text-slate-500'
                : dbStatus.connected 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                  : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              {dbLoading ? (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse"></div>
                  <span className="font-sans">Checking connection...</span>
                </>
              ) : dbStatus.connected ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                  <span className="font-sans">Vercel Postgres Connected</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-amber-600" />
                  <span className="font-sans" title={dbStatus.error || 'Please configure POSTGRES_URL in setting panel.'}>Local Cache Mode (DB Offline)</span>
                </>
              )}
            </div>

            <button
              onClick={() => setIsImportOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <FolderSync className="w-3.5 h-3.5" />
              <span>Add Hard Drive</span>
            </button>
          </div>
        </header>

        {/* 3. Bento Stats metrics layout */}
        <StatsBar
          activeDrive={activeDrive}
          filteredFiles={filteredFlatFiles}
          allFiles={allFilesCombined}
        />

        {/* 4. Global Search filters input dashboard */}
        <SearchFilters
          filters={filters}
          setFilters={setFilters}
          viewMode={viewMode}
          setViewMode={setViewMode}
          matchCount={filteredFlatFiles.length}
          availableExtensions={availableExtensions}
        />

        {/* 5. Active presentation panel (Dynamic List / Folder Tree) */}
        <div className="flex-1 min-h-0 relative" id="active-viewer-box">
          {viewMode === 'tree' ? (
            <TreeView
              nodes={filteredTreeNodes}
              onSelectFile={setSelectedFileFullname}
              searchQuery={filters.query}
            />
          ) : (
            <FlatGridView
              files={filteredFlatFiles}
              filters={filters}
              setFilters={setFilters}
              onSelectFile={setSelectedFileFullname}
            />
          )}
        </div>

      </main>

      {/* 6. Inspect Side panel drawer (Detail) */}
      {inspectedFile && (
        <FileDetailModal
          file={inspectedFile}
          drives={drives}
          onClose={() => setSelectedFileFullname(null)}
        />
      )}

      {/* 7. Catalog Import Dialog */}
      {isImportOpen && (
        <ImportModal
          onClose={() => setIsImportOpen(false)}
          onImport={handleAddDrive}
        />
      )}
    </div>
  );
}
