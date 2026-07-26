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
import CacheManagerModal from './components/CacheManagerModal';
import { generateSampleDrives } from './utils/sampleData';
import { buildTreeFromFiles, filterTree, filterFlatFiles } from './utils/treeBuilder';
import { getCache, setCache, clearCache, getCacheStatsList, CacheMetadata } from './utils/indexedDBCache';
import { FolderSync, HardDrive, HelpCircle, LayoutGrid, Terminal, Database, Cloud, CloudOff, PanelLeftOpen, PanelLeftClose, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const STORAGE_KEY_PREFIX = 'drivecatalog_drives_v1';

export default function App() {
  // Theme State Engine (Phase 1)
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    const cached = localStorage.getItem('reindex_theme');
    if (cached === 'light' || cached === 'dark') {
      return cached;
    }
    return 'light';
  });

  React.useEffect(() => {
    localStorage.setItem('reindex_theme', theme);
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = React.useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  // --- Core State ---
  const [drives, setDrives] = React.useState<Drive[]>([]);
  const [activeDriveId, setActiveDriveId] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<'tree' | 'flat' | 'treemap'>('tree');
  const [selectedFileFullname, setSelectedFileFullname] = React.useState<string | null>(null);
  const [showDuplicates, setShowDuplicates] = React.useState(false);
  const [showExportSync, setShowExportSync] = React.useState(false);
  const [showCollections, setShowCollections] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  
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

  // Track background loading of complete drive catalogs (bypassing search/result pagination limits)
  const [loadingDrives, setLoadingDrives] = React.useState<Record<string, boolean>>({});

  // --- Persistent Browser Cache States ---
  const [isCacheOpen, setIsCacheOpen] = React.useState(false);
  const [cacheStats, setCacheStats] = React.useState<CacheMetadata[]>([]);
  const [serverManifest, setServerManifest] = React.useState<Record<string, { lastUpdated: string; fileCount: number }> | null>(null);
  const [isCheckingManifest, setIsCheckingManifest] = React.useState(false);

  const loadDriveItems = React.useCallback(async (driveId: string) => {
    const isOnline = !!(dbStatus.connected && authToken && currentUser);
    if (!isOnline || loadingDrives[driveId]) return;
    const drive = drives.find(d => d.id === driveId);
    if (!drive || (drive.items && drive.items.length > 0)) return;

    setLoadingDrives(prev => ({ ...prev, [driveId]: true }));
    try {
      // 1. Try to fetch from browser's persistent IndexedDB cache first
      console.log(`Checking local browser cache for drive '${driveId}'...`);
      const cached = await getCache(driveId);

      // 2. Identify the authoritative server update timestamp
      let serverLastUpdated = drive.lastUpdated;
      if (serverManifest && serverManifest[driveId]) {
        serverLastUpdated = serverManifest[driveId].lastUpdated;
      }

      const isCacheValid = cached && cached.lastUpdated === serverLastUpdated;

      if (isCacheValid) {
        console.log(`✨ Cache HIT for drive '${driveId}'! Instantly loaded ${cached.files.length} items from browser persistent cache.`);
        setDrives(prevDrives => prevDrives.map(d => {
          if (d.id === driveId) {
            return { ...d, items: cached.files || [] };
          }
          return d;
        }));
        
        // Refresh cache stats in state
        getCacheStatsList().then(setCacheStats).catch(console.warn);
        return; // Complete!
      }

      // 3. Cache Miss or Mismatch: Fetch from the server database
      console.log(`Cache MISS/MISMATCH for drive '${driveId}' (Local: ${cached?.lastUpdated || 'None'}, Server: ${serverLastUpdated}). Fetching full catalog.`);
      const res = await fetch(`/api/drives/${driveId}/files`, {
        headers: { 'X-Auth-Token': authToken! }
      });
      if (res.ok) {
        const data = await res.json();
        const filesList = data.files || [];
        
        setDrives(prevDrives => prevDrives.map(d => {
          if (d.id === driveId) {
            return { ...d, items: filesList };
          }
          return d;
        }));

        // Compress and save to IndexedDB cache in the background
        if (filesList.length > 0) {
          try {
            await setCache(driveId, serverLastUpdated, filesList.length, filesList);
            getCacheStatsList().then(setCacheStats).catch(console.warn);
          } catch (cacheErr) {
            console.warn(`Could not cache catalog for drive '${driveId}':`, cacheErr);
          }
        }
      }
    } catch (err) {
      console.error(`Failed to load files for drive ${driveId}:`, err);
    } finally {
      setLoadingDrives(prev => ({ ...prev, [driveId]: false }));
    }
  }, [dbStatus.connected, authToken, currentUser, drives, loadingDrives, serverManifest]);

  // Automatically load full file list of active drive when online and selected
  React.useEffect(() => {
    const isOnline = !!(dbStatus.connected && authToken && currentUser);
    if (isOnline && activeDriveId) {
      const drive = drives.find(d => d.id === activeDriveId);
      if (drive && (!drive.items || drive.items.length === 0)) {
        loadDriveItems(activeDriveId);
      }
    }
  }, [dbStatus.connected, authToken, currentUser, activeDriveId, drives, loadDriveItems]);

  // Automatically load all drives in parallel when browsing the unified workspace or using Tree Map/Tree View
  React.useEffect(() => {
    const isOnline = !!(dbStatus.connected && authToken && currentUser);
    if (isOnline && !activeDriveId && (viewMode === 'tree' || viewMode === 'treemap')) {
      drives.forEach(d => {
        if (!d.items || d.items.length === 0) {
          loadDriveItems(d.id);
        }
      });
    }
  }, [dbStatus.connected, authToken, currentUser, activeDriveId, viewMode, drives, loadDriveItems]);

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
  const refreshDrives = React.useCallback(async () => {
    if (dbStatus.connected && authToken && currentUser) {
      try {
        const drivesRes = await fetch('/api/drives', {
          headers: { 'X-Auth-Token': authToken }
        });
        if (drivesRes.ok) {
          const drivesData = await drivesRes.json();
          setDrives(drivesData);
        }
      } catch (err) {
        console.error('Failed to refresh drives from server:', err);
      }
    }
  }, [dbStatus.connected, authToken, currentUser]);

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

                // Fetch local IndexedDB cache stats & check server manifest
                getCacheStatsList().then(setCacheStats).catch(console.warn);
                fetch('/api/drives/manifest', {
                  headers: { 'X-Auth-Token': authToken }
                })
                  .then(r => r.json())
                  .then(data => {
                    if (data.success) {
                      setServerManifest(data.manifest);
                    }
                  })
                  .catch(console.warn);

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

  // --- Browser Cache Actions ---
  const refreshCacheStats = React.useCallback(async () => {
    try {
      const stats = await getCacheStatsList();
      setCacheStats(stats);
    } catch (e) {
      console.warn('Failed to fetch cache stats:', e);
    }
  }, []);

  const handleForceVerifyCache = React.useCallback(async () => {
    if (!dbStatus.connected || !authToken || !currentUser) return;
    setIsCheckingManifest(true);
    try {
      const res = await fetch('/api/drives/manifest', {
        headers: { 'X-Auth-Token': authToken }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setServerManifest(data.manifest);
        }
      }
    } catch (err) {
      console.error('Failed to verify local cache manifest:', err);
    } finally {
      setIsCheckingManifest(false);
    }
  }, [dbStatus.connected, authToken, currentUser]);

  const handleClearCache = React.useCallback(async (driveId?: string) => {
    try {
      await clearCache(driveId);
      await refreshCacheStats();
      
      // Reset files in memory for any purged drives so they can be reloaded on next focus
      if (driveId) {
        setDrives(prevDrives => prevDrives.map(d => {
          if (d.id === driveId) {
            return { ...d, items: [] };
          }
          return d;
        }));
      } else {
        setDrives(prevDrives => prevDrives.map(d => ({ ...d, items: [] })));
      }
    } catch (err) {
      console.error('Failed to clear cache:', err);
    }
  }, [refreshCacheStats]);

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
  const handleAddDrive = async (newDriveData: Omit<Drive, 'fileCount' | 'totalSize' | 'lastUpdated'> & { skipDbSync?: boolean }) => {
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const newDrive: Drive = {
      ...newDriveData,
      fileCount: newDriveData.items.length,
      totalSize: newDriveData.items.reduce((acc, item) => acc + (Number(item.Length) || 0), 0),
      lastUpdated: timestamp
    };

    // Optimistically update frontend state
    const updated = [...drives.filter(d => d.id !== newDrive.id), newDrive];
    setDrives(updated);

    if (newDriveData.skipDbSync) {
      // Already chunked & uploaded directly to DB, just update local backup cache and set active drive
      try {
        localStorage.setItem(STORAGE_KEY_PREFIX, JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
      setActiveDriveId(newDrive.id);
      await refreshDrives();
      return;
    }

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

  const handleAppendToDrive = async (
    driveId: string, 
    newItems: FileItem[], 
    stats: { fileCount: number; totalSize: number; lastUpdated: string }
  ) => {
    const updated = drives.map(d => {
      if (d.id === driveId) {
        return {
          ...d,
          items: d.items ? [...d.items, ...newItems.map(item => ({ ...item, DriveId: driveId }))] : [],
          fileCount: stats.fileCount,
          totalSize: stats.totalSize,
          lastUpdated: stats.lastUpdated
        };
      }
      return d;
    });

    setDrives(updated);

    // Write complete appended list to persistent IndexedDB cache
    const updatedDrive = updated.find(d => d.id === driveId);
    if (updatedDrive && updatedDrive.items && updatedDrive.items.length > 0) {
      try {
        await setCache(driveId, stats.lastUpdated, stats.fileCount, updatedDrive.items);
        getCacheStatsList().then(setCacheStats).catch(console.warn);
      } catch (cacheErr) {
        console.warn(`Could not update IndexedDB cache for appended drive '${driveId}':`, cacheErr);
      }
    }

    try {
      localStorage.setItem(STORAGE_KEY_PREFIX, JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }

    setActiveDriveId(driveId);
    await refreshDrives();
  };

  const handleDeleteDrive = async (id: string) => {
    const updated = drives.filter(d => d.id !== id);
    setDrives(updated);

    // Clear from persistent IndexedDB browser cache
    try {
      await clearCache(id);
      getCacheStatsList().then(setCacheStats).catch(console.warn);
    } catch (err) {
      console.warn(`Failed to clear IndexedDB cache for deleted drive '${id}':`, err);
    }

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
      const anyDrivesLoaded = drives.some(d => d.items && d.items.length > 0);
      if (anyDrivesLoaded) {
        return drives.flatMap(d => d.items || []);
      }
      return serverFiles;
    }
    return drives.flatMap(d => d.items || []);
  }, [drives, isOnline, serverFiles]);

  // 2. Perform Flat Filtering on files (optimized with useMemo)
  const filteredFlatFiles = React.useMemo(() => {
    if (isOnline) {
      // If we are online and have complete items loaded for the current active scope,
      // let's do fast client-side filtering to avoid database limits!
      if (activeDrive && activeDrive.items && activeDrive.items.length > 0) {
        return filterFlatFiles(activeDrive.items, filters, activeDriveId);
      }
      const allDrivesLoaded = drives.length > 0 && drives.every(d => d.items && d.items.length > 0);
      if (!activeDrive && allDrivesLoaded) {
        return filterFlatFiles(drives.flatMap(d => d.items || []), filters, activeDriveId);
      }
      return serverFiles; // Pre-filtered by database server search
    }
    return filterFlatFiles(allFilesCombined, filters, activeDriveId);
  }, [allFilesCombined, filters, activeDriveId, isOnline, serverFiles, activeDrive, drives]);

  // 3. Build tree based on active selection (active drive or all files)
  const activeScopeFiles = React.useMemo(() => {
    if (isOnline) {
      if (activeDrive && activeDrive.items && activeDrive.items.length > 0) {
        return activeDrive.items;
      }
      const allDrivesLoaded = drives.length > 0 && drives.every(d => d.items && d.items.length > 0);
      if (!activeDrive && allDrivesLoaded) {
        return drives.flatMap(d => d.items || []);
      }
      return serverFiles;
    }
    return activeDrive ? activeDrive.items : allFilesCombined;
  }, [activeDrive, allFilesCombined, isOnline, serverFiles, drives]);

  const driveNamesMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    drives.forEach(d => {
      map[d.id] = d.name;
    });
    return map;
  }, [drives]);

  const rawTreeNodes = React.useMemo(() => {
    return buildTreeFromFiles(activeScopeFiles, driveNamesMap);
  }, [activeScopeFiles, driveNamesMap]);

  // 4. Perform Tree Filtering based on Search inputs
  const filteredTreeNodes = React.useMemo(() => {
    if (isOnline) {
      // If we are online but are using serverFiles (pre-filtered by server), return rawTreeNodes as-is
      const isUsingFullLocalIndex = activeScopeFiles !== serverFiles;
      if (!isUsingFullLocalIndex) {
        return rawTreeNodes;
      }
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
  }, [rawTreeNodes, filters, isOnline, activeScopeFiles, serverFiles]);

  // Find inspected file properties for the side panel
  const inspectedFile = React.useMemo(() => {
    if (!selectedFileFullname) return null;
    return allFilesCombined.find(f => f.FullName === selectedFileFullname) || null;
  }, [selectedFileFullname, allFilesCombined]);

  // Check if any drive in the current view is currently loading its full items
  const isCurrentlyLoadingViewDrives = React.useMemo(() => {
    if (!isOnline) return false;
    if (activeDriveId) {
      return !!loadingDrives[activeDriveId];
    }
    // For all drives view:
    return drives.some(d => loadingDrives[d.id] && (!d.items || d.items.length === 0));
  }, [isOnline, activeDriveId, loadingDrives, drives]);

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
        theme={theme}
        toggleTheme={toggleTheme}
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
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        loadingDrives={loadingDrives}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      {/* 2. Main content container (Right Space) */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-slate-50 dark:bg-slate-950 transition-colors duration-200" id="app-main-viewport">
        
        {/* Main Workspace Header bar */}
        <header className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0 transition-colors duration-200" id="main-header">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 animate-in fade-in duration-200">
              <button
                onClick={() => setIsSidebarCollapsed(prev => !prev)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer mr-1"
                title={isSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <PanelLeftClose className="w-4 h-4 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400" />
                )}
              </button>
              <Database className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
              <span>{currentUser ? `${currentUser.username}'s ${dbStatus.connected ? 'Cloud Index' : 'Simulated Index'}` : 'Offline Indices Workspace'}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Browsing {activeDrive ? `Partition ${activeDrive.letter}:\\` : 'Unified drive database storage map'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Database connection badge */}
            <div className={`px-3 py-1.5 rounded-full border text-xs flex items-center gap-1.5 font-medium ${
              dbStatus.connected 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' 
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
            }`}>
              {dbStatus.connected ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                  <span className="font-sans">• Online</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="font-sans" title={dbStatus.error || 'Please configure POSTGRES_URL in setting panel.'}>Local Cache Mode (DB Offline)</span>
                </>
              )}
            </div>

            {/* Local Cache Management Button */}
            <button
              onClick={() => setIsCacheOpen(true)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center w-9 h-9 cursor-pointer shadow-2xs relative"
              title="Browser Cache Manager"
              id="browser-cache-status-btn"
            >
              <Database className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              {cacheStats.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
              )}
            </button>

            {/* Theme Switcher Button */}
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center w-9 h-9 cursor-pointer shadow-2xs"
              title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setIsImportOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <FolderSync className="w-3.5 h-3.5" />
              <span>Add Storage Drive</span>
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {showCollections ? (
            <motion.div
              key="collections"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col min-h-0"
            >
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
            </motion.div>
          ) : showExportSync ? (
            <motion.div
              key="exportsync"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col min-h-0"
            >
              <ExportSyncHelper
                drives={drives}
                isOnline={isOnline}
                authToken={authToken}
                currentUser={currentUser}
              />
            </motion.div>
          ) : showDuplicates ? (
            <motion.div
              key="duplicates"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col min-h-0"
            >
              <SpaceOptimizer
                drives={drives}
                isOnline={isOnline}
                authToken={authToken}
                currentUser={currentUser}
                setDrives={setDrives}
                refreshDrives={refreshDrives}
              />
            </motion.div>
          ) : (
            <motion.div
              key="workspace"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col min-h-0"
            >
              {/* 3. Bento Stats metrics layout */}
              <StatsBar
                activeDrive={activeDrive}
                filteredFiles={filteredFlatFiles}
                allFiles={allFilesCombined}
                drives={drives}
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
                  <div className="px-6 py-2 bg-indigo-50/60 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-950/60 flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                      <span>Database matched <strong className="font-semibold text-slate-800 dark:text-slate-100">{serverTotalCount.toLocaleString()}</strong> files.</span>
                    </div>
                    <span className="text-[10px] bg-indigo-100/80 dark:bg-indigo-900/40 px-2.5 py-0.5 rounded font-mono text-indigo-600 dark:text-indigo-400">
                      Showing first 1,000 rows. Narrow search with query or size filters.
                    </span>
                  </div>
                )}

                <div className="flex-1 min-h-0 relative">
                  {serverLoading && (
                    <div className="absolute inset-0 bg-slate-50/40 dark:bg-slate-950/40 backdrop-blur-[1px] z-10 flex items-center justify-center transition-all">
                      <div className="flex flex-col items-center gap-2.5 bg-white dark:bg-slate-900 py-4 px-6 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-xl">
                        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-mono">Searching index map...</span>
                      </div>
                    </div>
                  )}

                  {isCurrentlyLoadingViewDrives && (
                    <div className="absolute inset-0 bg-slate-50/60 dark:bg-slate-950/60 backdrop-blur-[1px] z-10 flex items-center justify-center transition-all">
                      <div className="flex flex-col items-center gap-2.5 bg-white dark:bg-slate-900 py-5 px-7 rounded-2xl border border-indigo-100 dark:border-slate-800 shadow-xl max-w-sm text-center animate-in fade-in zoom-in duration-200">
                        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 font-sans">Building Folder Directory Structure...</span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono leading-relaxed mt-1">
                          Caching full file database to generate the interactive, zero-lag Folder Tree Map.
                        </p>
                      </div>
                    </div>
                  )}

                  <AnimatePresence mode="wait">
                    {viewMode === 'tree' ? (
                      <motion.div
                        key="tree"
                        initial={{ opacity: 0, scale: 0.99 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.99 }}
                        transition={{ duration: 0.12 }}
                        className="absolute inset-0 flex flex-col"
                      >
                        <TreeView
                          nodes={filteredTreeNodes}
                          onSelectFile={setSelectedFileFullname}
                          searchQuery={filters.query}
                        />
                      </motion.div>
                    ) : viewMode === 'treemap' ? (
                      <motion.div
                        key="treemap"
                        initial={{ opacity: 0, scale: 0.99 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.99 }}
                        transition={{ duration: 0.12 }}
                        className="absolute inset-0 flex flex-col"
                      >
                        <StorageTreeMap
                          nodes={filteredTreeNodes}
                          onSelectFile={setSelectedFileFullname}
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="flat"
                        initial={{ opacity: 0, scale: 0.99 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.99 }}
                        transition={{ duration: 0.12 }}
                        className="absolute inset-0 flex flex-col"
                      >
                        <FlatGridView
                          files={filteredFlatFiles}
                          filters={filters}
                          setFilters={setFilters}
                          onSelectFile={setSelectedFileFullname}
                          tags={tags}
                          fileTags={fileTags}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* 6. Inspect Side panel drawer (Detail) */}
      <AnimatePresence>
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
      </AnimatePresence>

      {/* 7. Catalog Import Dialog */}
      <AnimatePresence>
        {isImportOpen && (
          <ImportModal
            onClose={() => setIsImportOpen(false)}
            onImport={handleAddDrive}
            onAppend={handleAppendToDrive}
            drives={drives}
            isOnline={!!isOnline}
            authToken={authToken}
          />
        )}
      </AnimatePresence>

      {/* 8. Browser Persistent Cache Manager Dialog */}
      <CacheManagerModal
        isOpen={isCacheOpen}
        onClose={() => setIsCacheOpen(false)}
        cacheStats={cacheStats}
        drives={drives}
        onClearCache={handleClearCache}
        onRefreshStats={refreshCacheStats}
        onForceVerify={handleForceVerifyCache}
        serverManifest={serverManifest}
        isChecking={isCheckingManifest}
        theme={theme}
      />
    </div>
  );
}
