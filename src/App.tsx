import React from 'react';
import { Drive, FileItem, SearchFiltersState, Tag, VirtualCollection, FileTagRelation } from './types';
import Sidebar from './components/Sidebar';
import StatsBar from './components/StatsBar';
import SpaceOptimizer from './components/SpaceOptimizer';
import ExportSyncHelper from './components/ExportSyncHelper';
import CollectionsAndTags from './components/CollectionsAndTags';
import SearchFilters from './components/SearchFilters';
import TreeView from './components/TreeView';
import FlatGridView from './components/FlatGridView';
import StorageTreeMap from './components/StorageTreeMap';
import FileDetailModal from './components/FileDetailModal';
import ImportModal from './components/ImportModal';
import AuthView from './components/AuthView';
import { generateSampleDrives } from './utils/sampleData';
import { buildTreeFromFiles, filterTree, filterFlatFiles } from './utils/treeBuilder';
import { FolderSync, HardDrive, HelpCircle, LayoutGrid, Terminal, Database, Cloud, CloudOff } from 'lucide-react';

const STORAGE_KEY_PREFIX = 'drivecatalog_drives_v1';

export default function App() {
  // --- Core State ---
  const [drives, setDrives] = React.useState<Drive[]>([]);
  const [activeDriveId, setActiveDriveId] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<'tree' | 'flat' | 'treemap'>('tree');
  const [selectedFileFullname, setSelectedFileFullname] = React.useState<string | null>(null);
  const [showDuplicates, setShowDuplicates] = React.useState(false);
  const [showExportSync, setShowExportSync] = React.useState(false);
  const [showCollections, setShowCollections] = React.useState(false);
  
  // Collections and custom tagging persistence
  const [collections, setCollections] = React.useState<VirtualCollection[]>(() => {
    const cached = localStorage.getItem('reindex_collections');
    return cached ? JSON.parse(cached) : [
      {
        id: 'coll_preset_1',
        name: 'Critical Backups',
        description: 'High-priority business files and assets to keep redundant copies of.',
        createdAt: new Date().toLocaleDateString(),
        files: []
      },
      {
        id: 'coll_preset_2',
        name: 'Archive & Unused Assets',
        description: 'Large archives that can safely stay offline on secondary storage arrays.',
        createdAt: new Date().toLocaleDateString(),
        files: []
      }
    ];
  });

  const [tags, setTags] = React.useState<Tag[]>(() => {
    const cached = localStorage.getItem('reindex_tags');
    return cached ? JSON.parse(cached) : [
      { id: 'tag_1', name: 'Work', color: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' },
      { id: 'tag_2', name: 'Personal', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
      { id: 'tag_3', name: 'Movies', color: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' },
      { id: 'tag_4', name: 'Photos', color: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100' },
    ];
  });

  const [fileTags, setFileTags] = React.useState<FileTagRelation[]>(() => {
    const cached = localStorage.getItem('reindex_file_tags');
    return cached ? JSON.parse(cached) : [];
  });

  React.useEffect(() => {
    localStorage.setItem('reindex_collections', JSON.stringify(collections));
  }, [collections]);

  React.useEffect(() => {
    localStorage.setItem('reindex_tags', JSON.stringify(tags));
  }, [tags]);

  React.useEffect(() => {
    localStorage.setItem('reindex_file_tags', JSON.stringify(fileTags));
  }, [fileTags]);
  
  // Database status tracking
  const [dbStatus, setDbStatus] = React.useState<{ connected: boolean; error?: string }>({ connected: false });
  const [dbLoading, setDbLoading] = React.useState(true);

  // User session state
  const [currentUser, setCurrentUser] = React.useState<{ id: number; username: string } | null>(null);
  const [authToken, setAuthToken] = React.useState<string | null>(localStorage.getItem('reindex_token'));
  const [bypassAuth, setBypassAuth] = React.useState(false);

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

  // --- Server-side Search States (for online mode) ---
  const [serverFiles, setServerFiles] = React.useState<FileItem[]>([]);
  const [serverTotalCount, setServerTotalCount] = React.useState(0);
  const [serverExtensions, setServerExtensions] = React.useState<string[]>([]);
  const [serverLoading, setServerLoading] = React.useState(false);

  // Dynamic Server-Side Search fetching effect
  React.useEffect(() => {
    const isOnline = dbStatus.connected && authToken && currentUser;
    if (!isOnline) {
      return;
    }

    const fetchServerSearchResults = async () => {
      setServerLoading(true);
      try {
        const queryParams = new URLSearchParams({
          query: filters.query,
          driveId: activeDriveId || '',
          extension: filters.extension,
          minSize: filters.minSize.toString(),
          maxSize: filters.maxSize.toString(),
          sortBy: filters.sortBy,
          limit: '1000', // Limit to 1,000 matches to keep client memory and DOM completely fluid
          offset: '0'
        });

        const res = await fetch(`/api/search?${queryParams.toString()}`, {
          headers: { 'X-Auth-Token': authToken! }
        });

        if (res.ok) {
          const data = await res.json();
          setServerFiles(data.files || []);
          setServerTotalCount(data.totalCount || 0);
          setServerExtensions(data.availableExtensions || []);
        }
      } catch (err) {
        console.error('Failed to execute server-side index search:', err);
      } finally {
        setServerLoading(false);
      }
    };

    // Debounce to reduce database load and make input snappy
    const debounceTimer = setTimeout(fetchServerSearchResults, 250);
    return () => clearTimeout(debounceTimer);
  }, [dbStatus.connected, authToken, currentUser, activeDriveId, filters, drives]);

  // --- Load and Store Drives from Database / Cache ---
  React.useEffect(() => {
    async function initData() {
      setDbLoading(true);
      try {
        const statusRes = await fetch('/api/db-status');
        const statusData = await statusRes.json();
        setDbStatus(statusData);

        if (statusData.connected) {
          // If we have an authentication token, verify it
          if (authToken) {
            const meRes = await fetch('/api/auth/me', {
              headers: { 'X-Auth-Token': authToken }
            });
            if (meRes.ok) {
              const meData = await meRes.json();
              setCurrentUser(meData.user);

              // Retrieve scoped drives from Postgres
              const drivesRes = await fetch('/api/drives', {
                headers: { 'X-Auth-Token': authToken }
              });
              if (drivesRes.ok) {
                const drivesData = await drivesRes.json();
                setDrives(drivesData);
                setDbLoading(false);
                return;
              }
            } else {
              // Token invalid/expired, reset credentials
              localStorage.removeItem('reindex_token');
              setAuthToken(null);
              setCurrentUser(null);
            }
          }

          // If db is connected but not logged in and bypass is not set, don't fallback to local storage yet.
          if (!bypassAuth) {
            setDrives([]);
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
  }, [authToken, bypassAuth]);

  // --- Auth Session Methods ---
  const handleAuthSuccess = (token: string, user: { id: number; username: string }) => {
    setAuthToken(token);
    setCurrentUser(user);
    setBypassAuth(false);
  };

  const handleLogout = async () => {
    try {
      if (authToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'X-Auth-Token': authToken }
        });
      }
    } catch (e) {
      console.error('Logout request failed:', e);
    }
    localStorage.removeItem('reindex_token');
    setAuthToken(null);
    setCurrentUser(null);
    setDrives([]);
    setActiveDriveId(null);
    setBypassAuth(false);
  };

  const handleBypassAuth = () => {
    setBypassAuth(true);
  };

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

    if (dbStatus.connected && authToken && currentUser) {
      try {
        const res = await fetch('/api/drives', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Auth-Token': authToken
          },
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

    if (dbStatus.connected && authToken && currentUser) {
      try {
        const res = await fetch(`/api/drives/${id}`, { 
          method: 'DELETE',
          headers: { 'X-Auth-Token': authToken }
        });
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

    if (dbStatus.connected && authToken && currentUser) {
      try {
        const res = await fetch(`/api/drives/${id}`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            'X-Auth-Token': authToken
          },
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

  // Hybrid Online/Offline Logic
  const isOnline = !!(dbStatus.connected && authToken && currentUser);

  // 1. Accumulate all file records across all drives
  const allFilesCombined = React.useMemo(() => {
    if (isOnline) {
      return serverFiles;
    }
    return drives.flatMap(d => d.items);
  }, [drives, isOnline, serverFiles]);

  // 2. Perform Flat Filtering on files (optimized with useMemo)
  const filteredFlatFiles = React.useMemo(() => {
    if (isOnline) {
      return serverFiles; // Pre-filtered by database server search
    }
    return filterFlatFiles(allFilesCombined, filters, activeDriveId);
  }, [allFilesCombined, filters, activeDriveId, isOnline, serverFiles]);

  // 3. Build tree based on active selection (active drive or all files)
  const activeScopeFiles = React.useMemo(() => {
    if (isOnline) {
      return serverFiles;
    }
    return activeDrive ? activeDrive.items : allFilesCombined;
  }, [activeDrive, allFilesCombined, isOnline, serverFiles]);

  const rawTreeNodes = React.useMemo(() => {
    return buildTreeFromFiles(activeScopeFiles);
  }, [activeScopeFiles]);

  // 4. Perform Tree Filtering based on Search inputs
  const filteredTreeNodes = React.useMemo(() => {
    if (isOnline) {
      return rawTreeNodes; // Tree built directly from pre-filtered server records
    }

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
  }, [rawTreeNodes, filters, isOnline]);

  // Find inspected file properties for the side panel
  const inspectedFile = React.useMemo(() => {
    if (!selectedFileFullname) return null;
    return allFilesCombined.find(f => f.FullName === selectedFileFullname) || null;
  }, [selectedFileFullname, allFilesCombined]);

  // Get list of unique file extensions across the database for filter hints
  const availableExtensions = React.useMemo(() => {
    if (isOnline) {
      return serverExtensions;
    }
    const exts = new Set<string>();
    allFilesCombined.forEach(f => {
      if (f.Extension) exts.add(f.Extension.toLowerCase());
    });
    return Array.from(exts).sort();
  }, [allFilesCombined, isOnline, serverExtensions]);

  if (dbLoading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-100 animate-in fade-in duration-300" id="db-loading-splash">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-mono text-slate-400">Verifying Workspace Connection...</p>
      </div>
    );
  }

  if (!currentUser && !bypassAuth) {
    return (
      <AuthView 
        onAuthSuccess={handleAuthSuccess} 
        onBypass={handleBypassAuth} 
        dbStatus={dbStatus}
      />
    );
  }

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
        currentUser={currentUser}
        onLogout={handleLogout}
        showDuplicates={showDuplicates}
        setShowDuplicates={setShowDuplicates}
        showExportSync={showExportSync}
        setShowExportSync={setShowExportSync}
        showCollections={showCollections}
        setShowCollections={setShowCollections}
      />

      {/* 2. Main content container (Right Space) */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-slate-50" id="app-main-viewport">
        
        {/* Main Workspace Header bar */}
        <header className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0" id="main-header">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Database className="w-4.5 h-4.5 text-indigo-600" />
              <span>{currentUser ? `${currentUser.username}'s ${dbStatus.connected ? 'Cloud Index' : 'Simulated Index'}` : 'Offline Indices Workspace'}</span>
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              Browsing {activeDrive ? `Partition ${activeDrive.letter}:\\` : 'Unified drive database storage map'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Database connection badge */}
            <div className={`px-3 py-1.5 rounded-full border text-xs flex items-center gap-1.5 font-medium ${
              dbStatus.connected 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              {dbStatus.connected ? (
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

        {showCollections ? (
          <CollectionsAndTags
            drives={drives}
            collections={collections}
            setCollections={setCollections}
            tags={tags}
            setTags={setTags}
            fileTags={fileTags}
            setFileTags={setFileTags}
            onSelectFile={setSelectedFileFullname}
          />
        ) : showExportSync ? (
          <ExportSyncHelper
            drives={drives}
            isOnline={isOnline}
            authToken={authToken}
            currentUser={currentUser}
          />
        ) : showDuplicates ? (
          <SpaceOptimizer
            drives={drives}
            isOnline={isOnline}
            authToken={authToken}
            currentUser={currentUser}
          />
        ) : (
          <>
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
            <div className="flex-1 min-h-0 relative flex flex-col" id="active-viewer-box">
              {/* Server Search Limit notice */}
              {isOnline && serverTotalCount > 1000 && (
                <div className="px-6 py-2 bg-indigo-50/60 border-b border-indigo-100 flex items-center justify-between text-xs text-indigo-700 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                    <span>Database matched <strong className="font-semibold">{serverTotalCount.toLocaleString()}</strong> files.</span>
                  </div>
                  <span className="text-[10px] bg-indigo-100/80 px-2.5 py-0.5 rounded font-mono text-indigo-600">
                    Showing first 1,000 rows. Narrow search with query or size filters.
                  </span>
                </div>
              )}

              <div className="flex-1 min-h-0 relative">
                {serverLoading && (
                  <div className="absolute inset-0 bg-slate-50/40 backdrop-blur-[1px] z-10 flex items-center justify-center transition-all">
                    <div className="flex flex-col items-center gap-2.5 bg-white py-4 px-6 rounded-2xl border border-slate-200/60 shadow-xl">
                      <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-[11px] font-medium text-slate-500 font-mono">Searching index map...</span>
                    </div>
                  </div>
                )}

                {viewMode === 'tree' ? (
                  <TreeView
                    nodes={filteredTreeNodes}
                    onSelectFile={setSelectedFileFullname}
                    searchQuery={filters.query}
                  />
                ) : viewMode === 'treemap' ? (
                  <StorageTreeMap
                    nodes={filteredTreeNodes}
                    onSelectFile={setSelectedFileFullname}
                  />
                ) : (
                  <FlatGridView
                    files={filteredFlatFiles}
                    filters={filters}
                    setFilters={setFilters}
                    onSelectFile={setSelectedFileFullname}
                    tags={tags}
                    fileTags={fileTags}
                  />
                )}
              </div>
            </div>
          </>
        )}

      </main>

      {/* 6. Inspect Side panel drawer (Detail) */}
      {inspectedFile && (
        <FileDetailModal
          file={inspectedFile}
          drives={drives}
          onClose={() => setSelectedFileFullname(null)}
          collections={collections}
          setCollections={setCollections}
          tags={tags}
          setTags={setTags}
          fileTags={fileTags}
          setFileTags={setFileTags}
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
