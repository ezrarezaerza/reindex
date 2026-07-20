import React from 'react';
import { Drive, FileItem } from '../types';
import { formatBytes } from '../utils/treeBuilder';
import { 
  Copy, 
  Trash2, 
  Sparkles, 
  Layers, 
  Search, 
  ChevronDown, 
  ChevronRight, 
  Info, 
  ExternalLink, 
  FileCode, 
  CheckCircle2,
  HardDrive,
  FileWarning,
  ArrowRight,
  ClipboardCheck,
  Filter
} from 'lucide-react';

interface DuplicateOccurrence extends FileItem {
  DriveName: string;
}

interface DuplicateGroup {
  name: string;
  length: number;
  duplicate_count: number;
  occurrences: DuplicateOccurrence[];
}

interface SpaceOptimizerProps {
  drives: Drive[];
  isOnline: boolean;
  authToken: string | null;
  currentUser: any;
  setDrives: React.Dispatch<React.SetStateAction<Drive[]>>;
  refreshDrives: () => Promise<void>;
}

export default function SpaceOptimizer({ drives, isOnline, authToken, currentUser, setDrives, refreshDrives }: SpaceOptimizerProps) {
  // Filters
  const [query, setQuery] = React.useState('');
  const [extension, setExtension] = React.useState('');
  const [minSize, setMinSize] = React.useState('0'); // In bytes
  const [limit, setLimit] = React.useState('100');

  // Master drive selected to preserve during script generation
  const [preserveDriveId, setPreserveDriveId] = React.useState<string>('primary');

  // UI state
  const [loading, setLoading] = React.useState(false);
  const [duplicates, setDuplicates] = React.useState<DuplicateGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());
  const [copiedPath, setCopiedPath] = React.useState<string | null>(null);
  const [copiedScript, setCopiedScript] = React.useState(false);
  const [cleaning, setCleaning] = React.useState(false);
  const [cleanSuccess, setCleanSuccess] = React.useState(false);
  const [selectedFiles, setSelectedFiles] = React.useState<Set<string>>(new Set());

  // Helper to retrieve all currently visible redundant files
  const getRedundantFilesList = React.useCallback(() => {
    const list: Array<{ DriveId: string; FullName: string; size: number }> = [];
    duplicates.forEach(g => {
      let masterIdx = 0;
      if (preserveDriveId !== 'primary') {
        const foundIdx = g.occurrences.findIndex(o => o.DriveId === preserveDriveId);
        if (foundIdx !== -1) masterIdx = foundIdx;
      }
      g.occurrences.forEach((occ, idx) => {
        if (idx !== masterIdx) {
          list.push({
            DriveId: occ.DriveId || '',
            FullName: occ.FullName,
            size: occ.Length || 0
          });
        }
      });
    });
    return list;
  }, [duplicates, preserveDriveId]);

  // Synchronize selection: select all redundant files by default when duplicates load or preserveDriveId changes
  React.useEffect(() => {
    const red = getRedundantFilesList();
    setSelectedFiles(new Set(red.map(r => `${r.DriveId}::${r.FullName}`)));
  }, [duplicates, getRedundantFilesList]);

  // Available extensions list for filtering
  const availableExtensions = React.useMemo(() => {
    const exts = new Set<string>();
    if (isOnline) {
      // Collect unique extensions from currently loaded duplicates
      duplicates.forEach(g => {
        const ext = g.name.substring(g.name.lastIndexOf('.')).toLowerCase();
        if (ext && ext.length > 1 && ext.length < 8) exts.add(ext);
      });
    } else {
      // Local computation
      drives.forEach(d => {
        d.items.forEach(f => {
          if (f.Extension) exts.add(f.Extension.toLowerCase());
        });
      });
    }
    return Array.from(exts).sort();
  }, [drives, isOnline, duplicates]);

  // Handle client-side offline calculations
  const computeLocalDuplicates = React.useCallback(() => {
    setLoading(true);
    try {
      const groups = new Map<string, FileItem[]>();
      
      // Combine all files across all drives
      drives.forEach(d => {
        d.items.forEach(f => {
          if (!f.Length || f.Length <= 0) return;
          
          // Apply extension filter
          if (extension && f.Extension?.toLowerCase() !== extension.toLowerCase()) return;
          
          // Apply query filter
          if (query && !f.Name.toLowerCase().includes(query.toLowerCase())) return;
          
          // Apply min size filter
          if (Number(minSize) > 0 && f.Length < Number(minSize)) return;

          const key = `${f.Name.toLowerCase()}_${f.Length}`;
          if (!groups.has(key)) {
            groups.set(key, []);
          }
          groups.get(key)!.push({ ...f, DriveId: d.id });
        });
      });

      const list: DuplicateGroup[] = [];
      groups.forEach((items) => {
        if (items.length > 1) {
          const first = items[0];
          const occurrences = items.map(item => {
            const driveObj = drives.find(drv => drv.id === item.DriveId);
            return {
              ...item,
              DriveName: driveObj ? driveObj.name : 'Unknown Drive'
            };
          });

          list.push({
            name: first.Name,
            length: first.Length,
            duplicate_count: items.length,
            occurrences
          });
        }
      });

      // Sort by size descending (largest duplicates first)
      list.sort((a, b) => b.length - a.length);
      
      // Enforce limit
      setDuplicates(list.slice(0, Number(limit)));
    } catch (err) {
      console.error('Failed to compute client-side duplicates:', err);
    } finally {
      setLoading(false);
    }
  }, [drives, query, extension, minSize, limit]);

  // Handle server-side online queries
  const fetchServerDuplicates = React.useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        query,
        extension,
        minSize,
        limit
      });

      const res = await fetch(`/api/duplicates?${queryParams.toString()}`, {
        headers: { 'X-Auth-Token': authToken || '' }
      });

      if (res.ok) {
        const data = await res.json();
        setDuplicates(data.duplicates || []);
      }
    } catch (err) {
      console.error('Failed to retrieve server duplicates:', err);
    } finally {
      setLoading(false);
    }
  }, [query, extension, minSize, limit, authToken]);

  // Trigger search on changes
  React.useEffect(() => {
    if (isOnline) {
      const timer = setTimeout(fetchServerDuplicates, 300);
      return () => clearTimeout(timer);
    } else {
      computeLocalDuplicates();
    }
  }, [isOnline, fetchServerDuplicates, computeLocalDuplicates]);

  // Toggle single expanded group
  const toggleGroup = (key: string) => {
    const next = new Set(expandedGroups);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setExpandedGroups(next);
  };

  // Toggle all groups
  const toggleAllGroups = () => {
    if (expandedGroups.size === duplicates.length) {
      setExpandedGroups(new Set());
    } else {
      setExpandedGroups(new Set(duplicates.map(g => `${g.name}_${g.length}`)));
    }
  };

  // Stats calculation
  const stats = React.useMemo(() => {
    let totalGroups = duplicates.length;
    let totalRedundantFiles = 0;
    let potentialSaving = 0;

    duplicates.forEach(g => {
      totalRedundantFiles += (g.duplicate_count - 1);
      potentialSaving += (g.duplicate_count - 1) * g.length;
    });

    return {
      totalGroups,
      totalRedundantFiles,
      potentialSaving
    };
  }, [duplicates]);

  // Global selection helpers
  const allRedundantList = getRedundantFilesList();
  const allRedundantKeys = allRedundantList.map(r => `${r.DriveId}::${r.FullName}`);
  const allSelected = allRedundantKeys.length > 0 && allRedundantKeys.every(k => selectedFiles.has(k));
  const someSelected = allRedundantKeys.length > 0 && allRedundantKeys.some(k => selectedFiles.has(k)) && !allSelected;

  // Copy helper
  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  // Generate safe PowerShell Script content
  const generatePowerShellScript = () => {
    let script = `# PowerShell Storage Reclamation Script
# Generated by ReIndex Offline Path Indexer
# This script targets redundant cross-drive files to recover space.
# ONLY duplicates on non-preserved paths are targeted.

# --- REMOVAL PRESETS ---
$ReportOnly = $true       # Writes a detailed report file of matches
$LogPath = "$HOME\\Desktop\\ReIndex_Cleanup_Log.txt"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "     ReIndex Space Optimization Cleanup Script      " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Preserving Drive: ${preserveDriveId === 'primary' ? 'First found master file' : preserveDriveId}" -ForegroundColor Yellow
Write-Host "Logs and reports will be saved to: $LogPath"
Write-Host "========================================================"\n\n`;

    duplicates.forEach((g, idx) => {
      // Determine master occurrence to preserve
      let masterIdx = 0;
      if (preserveDriveId !== 'primary') {
        const foundIdx = g.occurrences.findIndex(o => o.DriveId === preserveDriveId);
        if (foundIdx !== -1) masterIdx = foundIdx;
      }

      const master = g.occurrences[masterIdx];
      const targetDeletes = g.occurrences.filter((_, i) => i !== masterIdx);

      script += `# Duplicate Set #${idx + 1}: "${g.name}" (${formatBytes(g.length)})\n`;
      script += `# Keeping master file location: "${master.FullName}"\n`;
      
      targetDeletes.forEach(target => {
        script += `Remove-Item -Path "${target.FullName}" -Force -ErrorAction SilentlyContinue\n`;
      });
      script += `\n`;
    });

    script += `Write-Host "========================================================" -ForegroundColor Green
Write-Host "Cleanup execution complete." -ForegroundColor Green
Write-Host "========================================================"`;
    return script;
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(generatePowerShellScript());
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const handleAlreadyCleanUp = async () => {
    if (duplicates.length === 0 || cleaning) return;

    const selectedCount = selectedFiles.size;
    if (selectedCount === 0) {
      alert("Please select at least one redundant file for cleanup.");
      return;
    }
    
    const proceed = window.confirm(`Are you sure you want to synchronize the catalog and clean up the database index for ${selectedCount} selected redundant file(s)? This action is irreversible.`);
    if (!proceed) return;

    setCleaning(true);
    setCleanSuccess(false);

    try {
      // Calculate files to delete from selected ones
      const filesToDelete: Array<{ DriveId: string; FullName: string }> = [];

      duplicates.forEach((g) => {
        let masterIdx = 0;
        if (preserveDriveId !== 'primary') {
          const foundIdx = g.occurrences.findIndex(o => o.DriveId === preserveDriveId);
          if (foundIdx !== -1) masterIdx = foundIdx;
        }
        const targetDeletes = g.occurrences.filter((_, i) => i !== masterIdx);
        targetDeletes.forEach(target => {
          const key = `${target.DriveId}::${target.FullName}`;
          if (selectedFiles.has(key)) {
            filesToDelete.push({
              DriveId: target.DriveId || '',
              FullName: target.FullName
            });
          }
        });
      });

      if (filesToDelete.length === 0) {
        setCleaning(false);
        alert("No selected redundant files were found in the current view.");
        return;
      }

      if (isOnline) {
        // Send to API
        const res = await fetch('/api/duplicates/cleanup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': authToken || ''
          },
          body: JSON.stringify({ filesToDelete })
        });

        if (res.ok) {
          setCleanSuccess(true);
          await refreshDrives();
          await fetchServerDuplicates();
        } else {
          const errData = await res.json();
          alert(`Failed to apply cleanup in database: ${errData.error || 'Unknown error'}`);
        }
      } else {
        // Local offline cleanup
        const updatedDrives = drives.map(drv => {
          const targetsOnThisDrive = new Set(
            filesToDelete.filter(f => f.DriveId === drv.id).map(f => f.FullName)
          );
          if (targetsOnThisDrive.size === 0) return drv;

          const updatedItems = drv.items.filter(item => !targetsOnThisDrive.has(item.FullName));
          const totalSize = updatedItems.reduce((acc, item) => acc + (Number(item.Length) || 0), 0);

          return {
            ...drv,
            items: updatedItems,
            fileCount: updatedItems.length,
            totalSize
          };
        });

        setDrives(updatedDrives);
        localStorage.setItem('drivecatalog_drives_v1', JSON.stringify(updatedDrives));
        setCleanSuccess(true);
        setTimeout(() => {
          computeLocalDuplicates();
        }, 100);
      }
    } catch (err: any) {
      console.error('Error applying duplicates cleanup:', err);
      alert(`Cleanup sync failed: ${err.message}`);
    } finally {
      setCleaning(false);
      setTimeout(() => setCleanSuccess(false), 3000);
    }
  };

  const presetMinSizes = [
    { label: 'All Duplicates', value: '0' },
    { label: '> 1 MB', value: '1048576' },
    { label: '> 10 MB', value: '10485760' },
    { label: '> 100 MB', value: '104857600' },
    { label: '> 1 GB', value: '1073741824' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden" id="space-optimizer-viewport">
      
      {/* 1. Header & Quick Info */}
      <div className="px-6 py-5 bg-white border-b border-slate-200 shrink-0" id="optimizer-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <span>Cross-Drive Duplicate Finder</span>
                <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded font-mono">
                  Space Optimizer
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Scan multiple hard drive partition mappings to discover perfect replica files wasting physical storage space.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              {isOnline ? '🚀 DB Indexed Mode (Ultra-Fast)' : '📦 Local Memory Mode (Offline Cache)'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Bento Stats Reclaim Indicators */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 shrink-0" id="optimizer-stats">
        {/* Potentially Saved Space */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-4 rounded-2xl text-white border border-indigo-950/20 shadow-md relative overflow-hidden">
          <div className="absolute right-2.5 bottom-2.5 opacity-5 pointer-events-none">
            <Layers className="w-32 h-32" />
          </div>
          <span className="text-[11px] font-mono text-indigo-200 uppercase tracking-wider font-bold">
            Recoverable Space
          </span>
          <div className="text-2xl font-bold mt-1 font-mono text-indigo-50">
            {formatBytes(stats.potentialSaving)}
          </div>
          <p className="text-[10px] text-indigo-200 mt-2 font-sans">
            Total storage physical drive space freed by preserving 1 master file.
          </p>
        </div>

        {/* Duplicate Sets */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold block">
            Redundant File Sets
          </span>
          <div className="text-2xl font-bold mt-1 font-mono text-slate-800">
            {stats.totalGroups}
          </div>
          <p className="text-[10px] text-slate-500 mt-2 font-sans flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>Files matching exact Name and size.</span>
          </p>
        </div>

        {/* Total redundant duplicates */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold block">
            Removable Clones
          </span>
          <div className="text-2xl font-bold mt-1 font-mono text-emerald-600">
            {stats.totalRedundantFiles.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-500 mt-2 font-sans">
            Extra file copies currently sitting across different folders or volumes.
          </p>
        </div>
      </div>

      {/* 3. Search Filters Row */}
      <div className="px-6 py-4 border-y border-slate-200 bg-white flex flex-wrap items-center gap-4 shrink-0" id="optimizer-filters">
        {/* Name Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search duplicates by file name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-sans"
          />
        </div>

        {/* Preset Min Size Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Size:
          </span>
          <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
            {presetMinSizes.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setMinSize(preset.value)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${
                  minSize === preset.value
                    ? 'bg-white text-slate-800 shadow-xs border border-slate-200/50'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Extension Dropdown */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500">Extension:</span>
          <select
            value={extension}
            onChange={(e) => setExtension(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Extensions</option>
            {availableExtensions.map((ext) => (
              <option key={ext} value={ext}>
                {ext.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Results limit */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500">Show:</span>
          <select
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none"
          >
            <option value="50">Top 50</option>
            <option value="100">Top 100</option>
            <option value="200">Top 200</option>
          </select>
        </div>
      </div>

      {/* 4. Action Bar / Script Generator Panel */}
      <div className="px-6 py-3.5 bg-indigo-50/50 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-3 shrink-0" id="script-generator-panel">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
            <FileCode className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-indigo-900">Physical Cleanup Assistant</div>
            <div className="text-[10px] text-indigo-700 font-medium">Generate scripts or reports to clean up targeted duplicates in physical Explorer.</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-600">Preserve Master Drive:</span>
            <select
              value={preserveDriveId}
              onChange={(e) => setPreserveDriveId(e.target.value)}
              className="px-2 py-1 bg-white border border-indigo-200 rounded-md text-[11px] text-slate-700 focus:outline-none font-semibold focus:ring-1 focus:ring-indigo-500"
            >
              <option value="primary">Preserve First Location (Auto)</option>
              {drives.map(d => (
                <option key={d.id} value={d.id}>
                  Preserve Partition {d.letter}: ({d.name})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleCopyScript}
            disabled={duplicates.length === 0}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
              duplicates.length === 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                : copiedScript 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {copiedScript ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Script Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy PowerShell Cleanup Script</span>
              </>
            )}
          </button>

          <button
            onClick={handleAlreadyCleanUp}
            disabled={duplicates.length === 0 || cleaning || selectedFiles.size === 0}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
              duplicates.length === 0 || selectedFiles.size === 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                : cleanSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-teal-600 hover:bg-teal-700 text-white'
            }`}
          >
            {cleaning ? (
              <>
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Syncing Database...</span>
              </>
            ) : cleanSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Index Cleaned!</span>
              </>
            ) : (
              <>
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Already CleanUp! ({selectedFiles.size} Selected)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 5. Main Results View */}
      <div className="flex-1 overflow-y-auto p-6" id="optimizer-results-list">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3 bg-white border border-slate-200 rounded-2xl">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-slate-500 font-mono font-medium">Scanning catalog structures...</span>
          </div>
        ) : duplicates.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center p-8 bg-white border border-slate-200/60 rounded-2xl text-center">
            <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl mb-3 border border-slate-100">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">No Duplicates Found!</h3>
            <p className="text-xs text-slate-500 max-w-md mt-1">
              Perfect storage map! No duplicate files found satisfying your filters. Clear query parameters or try lowering the size filter threshold.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 py-2 bg-slate-100 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="global-select-all"
                  checked={allSelected}
                  ref={el => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={() => {
                    if (allSelected) {
                      setSelectedFiles(new Set());
                    } else {
                      setSelectedFiles(new Set(allRedundantKeys));
                    }
                  }}
                  className="w-4 h-4 text-rose-600 border-slate-300 rounded focus:ring-rose-500 cursor-pointer"
                />
                <label htmlFor="global-select-all" className="text-xs font-bold text-slate-700 select-none cursor-pointer">
                  Select All {allRedundantKeys.length} Redundant Files ({selectedFiles.size} checked)
                </label>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4">
                <span className="text-[10px] font-mono text-slate-500 uppercase font-bold tracking-wider">
                  ({duplicates.length} sets shown)
                </span>
                <button 
                  onClick={toggleAllGroups} 
                  className="text-indigo-600 hover:text-indigo-700 font-sans font-semibold text-[11px]"
                >
                  {expandedGroups.size === duplicates.length ? 'Collapse All' : 'Expand All'}
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {duplicates.map((g) => {
                const key = `${g.name}_${g.length}`;
                const isExpanded = expandedGroups.has(key);
                const wasteSize = (g.duplicate_count - 1) * g.length;

                // Identify redundant occurrences for this group
                let masterIdx = 0;
                if (preserveDriveId !== 'primary') {
                  const preservationTargetIdx = g.occurrences.findIndex(o => o.DriveId === preserveDriveId);
                  if (preservationTargetIdx !== -1) {
                    masterIdx = preservationTargetIdx;
                  }
                }
                const groupRedundantKeys = g.occurrences
                  .filter((_, idx) => idx !== masterIdx)
                  .map(occ => `${occ.DriveId}::${occ.FullName}`);

                const allGroupSelected = groupRedundantKeys.length > 0 && groupRedundantKeys.every(k => selectedFiles.has(k));
                const someGroupSelected = groupRedundantKeys.length > 0 && groupRedundantKeys.some(k => selectedFiles.has(k)) && !allGroupSelected;

                return (
                  <div 
                    key={key}
                    className={`bg-white border rounded-xl overflow-hidden shadow-xs transition-all ${
                      isExpanded ? 'border-slate-300 ring-1 ring-slate-100' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Collapsed Header Summary */}
                    <div 
                      onClick={() => toggleGroup(key)}
                      className="p-3.5 flex items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="text-slate-400">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </div>
                        
                        <input
                          type="checkbox"
                          checked={allGroupSelected}
                          ref={el => {
                            if (el) el.indeterminate = someGroupSelected;
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            const next = new Set(selectedFiles);
                            if (allGroupSelected) {
                              groupRedundantKeys.forEach(k => next.delete(k));
                            } else {
                              groupRedundantKeys.forEach(k => next.add(k));
                            }
                            setSelectedFiles(next);
                          }}
                          className="w-4 h-4 text-rose-600 border-slate-300 rounded focus:ring-rose-500 cursor-pointer shrink-0"
                          title="Select / deselect all redundant files in this set"
                        />

                        <div className="p-1.5 bg-slate-100 text-slate-500 rounded-lg shrink-0">
                          <Layers className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-800 truncate" title={g.name}>
                            {g.name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-slate-500">
                            <span>Single File: <strong className="text-slate-700">{formatBytes(g.length)}</strong></span>
                            <span>•</span>
                            <span className="text-amber-700 font-bold bg-amber-50 px-1.5 rounded">{g.duplicate_count} copies</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-mono font-bold text-rose-600">
                          -{formatBytes(wasteSize)}
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium font-sans uppercase">
                          Waste Storage
                        </div>
                      </div>
                    </div>

                    {/* Expanded Occurrence Detail List */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 space-y-2.5">
                        <div className="text-[10px] font-semibold text-slate-500 font-mono flex items-center gap-1">
                          <FileWarning className="w-3.5 h-3.5 text-amber-500" />
                          <span>Exact storage locations across partitions:</span>
                        </div>

                        <div className="space-y-1.5">
                          {g.occurrences.map((occ, occIdx) => {
                            // Highlight first or selected preserved file
                            let isPreserved = occIdx === 0;
                            if (preserveDriveId !== 'primary') {
                              const preservationTargetIdx = g.occurrences.findIndex(o => o.DriveId === preserveDriveId);
                              if (preservationTargetIdx !== -1) {
                                isPreserved = occIdx === preservationTargetIdx;
                              } else {
                                isPreserved = occIdx === 0; // Fallback to first occurrence
                              }
                            }

                            const occKey = `${occ.DriveId}::${occ.FullName}`;
                            const isSelected = selectedFiles.has(occKey);

                            return (
                              <div 
                                key={occIdx}
                                className={`p-2.5 rounded-lg border flex items-center justify-between gap-4 ${
                                  isPreserved 
                                    ? 'bg-emerald-50/70 border-emerald-100 text-emerald-900' 
                                    : 'bg-white border-slate-200 text-slate-700'
                                }`}
                              >
                                <div className="min-w-0 flex-1 flex items-center gap-2.5">
                                  {!isPreserved && (
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {
                                        const next = new Set(selectedFiles);
                                        if (next.has(occKey)) {
                                          next.delete(occKey);
                                        } else {
                                          next.add(occKey);
                                        }
                                        setSelectedFiles(next);
                                      }}
                                      className="w-4 h-4 text-rose-600 border-slate-300 rounded focus:ring-rose-500 cursor-pointer shrink-0"
                                    />
                                  )}

                                  <div className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border uppercase shrink-0 ${
                                    isPreserved 
                                      ? 'bg-emerald-100 border-emerald-200 text-emerald-800'
                                      : 'bg-indigo-50 border-indigo-100 text-indigo-700'
                                  }`}>
                                    {occ.DriveName} ({formatBytes(occ.Length, 1)})
                                  </div>
                                  
                                  <span className="text-xs font-mono truncate text-slate-600" title={occ.FullName}>
                                    {occ.FullName}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isPreserved ? (
                                    <span className="text-[9px] bg-emerald-100 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-md font-sans font-bold flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      <span>Preserved</span>
                                    </span>
                                  ) : (
                                    <span className="text-[9px] bg-rose-50 border border-rose-100 text-rose-700 px-2 py-0.5 rounded-md font-sans font-semibold flex items-center gap-1">
                                      <span>Redundant</span>
                                    </span>
                                  )}

                                  <button
                                    onClick={() => handleCopyPath(occ.FullName)}
                                    className={`p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer ${
                                      copiedPath === occ.FullName ? 'text-emerald-600' : 'text-slate-400'
                                    }`}
                                    title="Copy full path to clipboard"
                                  >
                                    {copiedPath === occ.FullName ? (
                                      <ClipboardCheck className="w-3.5 h-3.5" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
