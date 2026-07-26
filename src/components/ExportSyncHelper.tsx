import React from 'react';
import { Drive, FileItem } from '../types';
import { formatBytes } from '../utils/treeBuilder';
import { 
  FolderSync, 
  Download, 
  Copy, 
  Check, 
  Terminal, 
  HardDrive, 
  FileJson, 
  FileSpreadsheet, 
  FileText, 
  Settings, 
  ChevronRight, 
  AlertTriangle,
  Info,
  Sliders,
  CheckCircle2,
  ListFilter
} from 'lucide-react';

interface ExportSyncHelperProps {
  drives: Drive[];
  isOnline: boolean;
  authToken: string | null;
  currentUser: any;
}

export default function ExportSyncHelper({ drives, isOnline, authToken, currentUser }: ExportSyncHelperProps) {
  // Navigation Tabs: 'sync' | 'export'
  const [activeTab, setActiveTab] = React.useState<'sync' | 'export'>('sync');

  // --- PowerShell Sync Generator States ---
  const [sourceDrive, setSourceDrive] = React.useState<string>('');
  const [destDrive, setDestDrive] = React.useState<string>('');
  const [customSource, setCustomSource] = React.useState<string>('');
  const [customDest, setCustomDest] = React.useState<string>('');
  const [syncMode, setSyncMode] = React.useState<'mirror' | 'update' | 'dry-run'>('update');
  const [retryCount, setRetryCount] = React.useState<number>(3);
  const [retryWait, setRetryWait] = React.useState<number>(5);
  const [excludeSystemFiles, setExcludeSystemFiles] = React.useState<boolean>(true);
  const [excludeGitModules, setExcludeGitModules] = React.useState<boolean>(true);
  const [writeLogFile, setWriteLogFile] = React.useState<boolean>(true);
  const [copiedSyncScript, setCopiedSyncScript] = React.useState<boolean>(false);

  // --- Export Metadata States ---
  const [exportDriveId, setExportDriveId] = React.useState<string>('all');
  const [exportFormat, setExportFormat] = React.useState<'csv' | 'json' | 'txt'>('csv');
  const [exportQuery, setExportQuery] = React.useState<string>('');
  const [exportExtension, setExportExtension] = React.useState<string>('');
  const [exportMinSize, setExportMinSize] = React.useState<string>('0');
  const [exportLoading, setExportLoading] = React.useState<boolean>(false);
  const [exportStatus, setExportStatus] = React.useState<string | null>(null);

  // Auto-populate first two drives as source and dest if available
  React.useEffect(() => {
    if (drives.length > 0 && !sourceDrive) {
      setSourceDrive(drives[0].letter || drives[0].name.substring(0, 1));
    }
    if (drives.length > 1) {
      if (!destDrive) {
        setDestDrive(drives[1].letter || drives[1].name.substring(0, 1));
      }
    } else if (!destDrive) {
      setDestDrive('custom');
    }
  }, [drives]);

  // Generate PowerShell code
  const generatedPowerShell = React.useMemo(() => {
    const finalSource = sourceDrive === 'custom' ? customSource.trim() : `${sourceDrive}:\\`;
    const finalDest = destDrive === 'custom' ? customDest.trim() : `${destDrive}:\\`;

    let script = `# PowerShell Storage Synchronizer Script
# Built with ReIndex Partition Sync Tools
# Uses high-speed Windows Robocopy (Robust File Copy)

# Define synchronization endpoints
$Source = "${finalSource}"
$Destination = "${finalDest}"

# Sync Mode: ${syncMode.toUpperCase()}
`;

    let robocopyFlags = [];
    
    if (syncMode === 'mirror') {
      robocopyFlags.push('/MIR'); // Mirror directory tree (deletes destination files that don\'t exist in source)
    } else if (syncMode === 'update') {
      robocopyFlags.push('/E');   // Copy subdirectories including empty ones
      robocopyFlags.push('/XO');  // Exclude older files (copy only newer or updated files)
    } else {
      robocopyFlags.push('/E');   // Copy subdirectories including empty ones
      robocopyFlags.push('/L');   // List only - dry run preview, doesn\'t copy or delete any files
    }

    // Retries on flaky USB connection
    robocopyFlags.push(`/R:${retryCount}`); // Number of Retries
    robocopyFlags.push(`/W:${retryWait}`);  // Wait time in seconds between retries

    // Performance thread parallelism (Robocopy multi-threading)
    robocopyFlags.push('/MT:8'); // Use 8 parallel copy threads for high speed

    // Exclusions
    const excludedDirs: string[] = [];
    if (excludeSystemFiles) {
      excludedDirs.push('"System Volume Information"', '"$RECYCLE.BIN"', '"$Recycle.Bin"');
    }
    if (excludeGitModules) {
      excludedDirs.push('".git"', '"node_modules"');
    }

    let exclusionsStr = '';
    if (excludedDirs.length > 0) {
      exclusionsStr = ` /XD ${excludedDirs.join(' ')}`;
    }

    // Logging flags
    let loggingFlags = '';
    if (writeLogFile) {
      loggingFlags = ' /LOG+:"$HOME\\Desktop\\ReIndex_Sync_Log.txt" /TEE /V /FP';
    } else {
      loggingFlags = ' /NP'; // No percentage progress indicators to keep terminal clean
    }

    script += `\n# Execute verification checks
if (-not (Test-Path -Path $Source)) {
    Write-Error "Source path '$Source' could not be found. Please insert the correct external hard drive."
    Exit
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Starting synchronization process..." -ForegroundColor Cyan
Write-Host " Source: $Source"
Write-Host " Destination: $Destination"
Write-Host " Mode: ${syncMode === 'mirror' ? 'MIRROR (Deletes missing target files)' : syncMode === 'dry-run' ? 'DRY RUN (Preview)' : 'INCREMENTAL UPDATE (Safe)'}" -ForegroundColor Yellow
Write-Host "=========================================================="

# Invoking Robocopy engine with optimal parameters
$RoboArgs = @(
    $Source,
    $Destination,
    ${robocopyFlags.map(f => `"${f}"`).join(', ')}${exclusionsStr ? `,\n    "/XD", ${excludedDirs.join(', ')}` : ''}
)

`;

    if (writeLogFile) {
      script += `# Execute sync and pipe output both to a desktop log file and live terminal window\n`;
      script += `robocopy $Source $Destination ${robocopyFlags.join(' ')}${exclusionsStr}${loggingFlags}\n`;
    } else {
      script += `robocopy $Source $Destination ${robocopyFlags.join(' ')}${exclusionsStr}${loggingFlags}\n`;
    }

    script += `\nWrite-Host "==========================================================" -ForegroundColor Green
Write-Host " Sync completed successfully!" -ForegroundColor Green
Write-Host "=========================================================="`;

    return script;
  }, [sourceDrive, destDrive, customSource, customDest, syncMode, retryCount, retryWait, excludeSystemFiles, excludeGitModules, writeLogFile]);

  // Copy sync script
  const handleCopySyncScript = () => {
    navigator.clipboard.writeText(generatedPowerShell);
    setCopiedSyncScript(true);
    setTimeout(() => setCopiedSyncScript(false), 2000);
  };

  // Run catalog index metadata export
  const handleExportCatalog = async () => {
    setExportLoading(true);
    setExportStatus('Retrieving catalog items...');
    
    try {
      let exportFilesList: FileItem[] = [];

      // 1. Obtain files depending on mode (Online Server-side Search vs Local Drives Cache)
      if (isOnline) {
        setExportStatus('Fetching filtered file catalog indices from database...');
        const queryParams = new URLSearchParams({
          query: exportQuery,
          driveId: exportDriveId === 'all' ? '' : exportDriveId,
          extension: exportExtension,
          minSize: exportMinSize,
          maxSize: '-1',
          sortBy: 'name-asc',
          limit: '100000', // Support up to 100k records on high-speed export
          offset: '0'
        });

        const res = await fetch(`/api/search?${queryParams.toString()}`, {
          headers: { 'X-Auth-Token': authToken || '' }
        });

        if (res.ok) {
          const data = await res.json();
          exportFilesList = data.files || [];
        } else {
          throw new Error('Database search query rejected by server.');
        }
      } else {
        // Offline: perform search and collect locally
        setExportStatus('Filtering local backup indexes...');
        const selectedDrives = exportDriveId === 'all' ? drives : drives.filter(d => d.id === exportDriveId);
        
        selectedDrives.forEach(drv => {
          drv.items.forEach(file => {
            // Apply text query
            if (exportQuery && !file.Name.toLowerCase().includes(exportQuery.toLowerCase()) && !file.FullName.toLowerCase().includes(exportQuery.toLowerCase())) {
              return;
            }
            // Apply extension
            if (exportExtension && file.Extension?.toLowerCase() !== exportExtension.toLowerCase()) {
              return;
            }
            // Apply min size
            if (Number(exportMinSize) > 0 && file.Length < Number(exportMinSize)) {
              return;
            }
            exportFilesList.push(file);
          });
        });
      }

      if (exportFilesList.length === 0) {
        setExportStatus('⚠️ No files matched your criteria.');
        setExportLoading(false);
        return;
      }

      setExportStatus(`Compiling ${exportFilesList.length.toLocaleString()} items to ${exportFormat.toUpperCase()} format...`);

      // 2. Format compiler
      let fileContent = '';
      let mimeType = 'text/plain';
      let fileExtension = 'txt';

      if (exportFormat === 'json') {
        fileContent = JSON.stringify(exportFilesList, null, 2);
        mimeType = 'application/json';
        fileExtension = 'json';
      } else if (exportFormat === 'csv') {
        mimeType = 'text/csv';
        fileExtension = 'csv';
        
        // CSV headers
        const headers = ['File Name', 'Full Path', 'Extension', 'Size (Bytes)', 'Size (Readable)', 'Drive ID'];
        const csvRows = [headers.join(',')];

        exportFilesList.forEach(f => {
          const row = [
            `"${f.Name.replace(/"/g, '""')}"`,
            `"${f.FullName.replace(/"/g, '""')}"`,
            `"${(f.Extension || '').replace(/"/g, '""')}"`,
            f.Length || 0,
            `"${formatBytes(f.Length || 0, 1)}"`,
            `"${f.DriveId || ''}"`
          ];
          csvRows.push(row.join(','));
        });
        
        fileContent = csvRows.join('\n');
      } else {
        // Text plain list
        fileContent = exportFilesList.map(f => `${f.FullName} (${formatBytes(f.Length || 0, 1)})`).join('\n');
      }

      // 3. Initiate browser download
      setExportStatus('Downloading compiled file package...');
      const blob = new Blob([fileContent], { type: `${mimeType};charset=utf-8;` });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `reindex_export_${exportDriveId}_${Date.now()}.${fileExtension}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportStatus(`✅ Exported ${exportFilesList.length.toLocaleString()} rows successfully!`);
    } catch (err: any) {
      console.error('Index export task failed:', err);
      setExportStatus(`❌ Export failed: ${err.message}`);
    } finally {
      setExportLoading(false);
    }
  };

  // Extensions list for search dropdown
  const uniqueExtensions = React.useMemo(() => {
    const exts = new Set<string>();
    drives.forEach(d => {
      d.items.forEach(f => {
        if (f.Extension) exts.add(f.Extension.toLowerCase());
      });
    });
    return Array.from(exts).sort();
  }, [drives]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-800 dark:text-slate-200" id="export-sync-viewport">
      
      {/* Tab Header navigation */}
      <div className="px-6 py-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4" id="export-sync-header">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
            <FolderSync className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Export &amp; Sync Assistant</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sync files across backup arrays, clone structures with Robocopy, or generate offline indices.
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200/40 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('sync')}
            className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'sync'
                ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm border border-slate-200/50 dark:border-slate-800'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>PowerShell Sync Generator</span>
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'export'
                ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm border border-slate-200/50 dark:border-slate-800'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Catalog Index Export</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6" id="export-sync-viewport-content">
        {activeTab === 'sync' ? (
          /* ========================================================
             POWERSHELL ROBOCOPY SYNC GENERATOR VIEW
             ======================================================== */
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            
            {/* Left Hand Options Panel */}
            <div className="lg:col-span-2 space-y-4">
              
              {/* Drive Selection Map */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <h3 className="text-xs font-bold font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <span>Sync Path Endpoints</span>
                </h3>

                {/* Source Directory selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block">Source Partition / Directory</label>
                  <select
                    value={sourceDrive}
                    onChange={(e) => setSourceDrive(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {drives.map(d => (
                      <option key={d.id} value={d.letter || d.name.substring(0, 1)}>
                        Drive {d.letter || d.name.substring(0,1).toUpperCase()}: ({d.name})
                      </option>
                    ))}
                    <option value="custom">Custom System Path...</option>
                  </select>

                  {sourceDrive === 'custom' && (
                    <input
                      type="text"
                      placeholder="e.g. D:\Media\Archive"
                      value={customSource}
                      onChange={(e) => setCustomSource(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 mt-2"
                    />
                  )}
                </div>

                {/* Destination Directory selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block">Destination Partition / Directory</label>
                  <select
                    value={destDrive}
                    onChange={(e) => setDestDrive(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {drives.map(d => (
                      <option key={d.id} value={d.letter || d.name.substring(0, 1)}>
                        Drive {d.letter || d.name.substring(0,1).toUpperCase()}: ({d.name})
                      </option>
                    ))}
                    <option value="custom">Custom System Path...</option>
                  </select>

                  {destDrive === 'custom' && (
                    <input
                      type="text"
                      placeholder="e.g. E:\Backup\DriveD"
                      value={customDest}
                      onChange={(e) => setCustomDest(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 mt-2"
                    />
                  )}
                </div>
              </div>

              {/* Advanced Robocopy Settings Config */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <h3 className="text-xs font-bold font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <span>Robocopy Core Engine Config</span>
                </h3>

                {/* Synchronization mode */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block">Sync Algorithm Preset</label>
                  <div className="space-y-2">
                    {/* Mirror Mode Option */}
                    <label className="flex items-start gap-2.5 p-2 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100/70 dark:hover:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="sync-mode"
                        checked={syncMode === 'mirror'}
                        onChange={() => setSyncMode('mirror')}
                        className="mt-1 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Bi-directional / MIRROR (/MIR)</div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
                          Makes destination identical to source. <strong className="text-rose-600 dark:text-rose-400">WARNING: Deletes files</strong> on destination if missing in source.
                        </p>
                      </div>
                    </label>

                    {/* Incremental Update Mode Option */}
                    <label className="flex items-start gap-2.5 p-2 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100/70 dark:hover:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="sync-mode"
                        checked={syncMode === 'update'}
                        onChange={() => setSyncMode('update')}
                        className="mt-1 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Safe Update Copy (/E /XO)</div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
                          Safely copies new or modified files. Preserves extra directories inside the backup drive. Recommended.
                        </p>
                      </div>
                    </label>

                    {/* Dry Run Option */}
                    <label className="flex items-start gap-2.5 p-2 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100/70 dark:hover:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="sync-mode"
                        checked={syncMode === 'dry-run'}
                        onChange={() => setSyncMode('dry-run')}
                        className="mt-1 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Audit Only / Dry Run (/L)</div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
                          Logs what would be synchronized without writing or editing any physical block files.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Exclusions toggles */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block">Exclusion Filters (/XD)</label>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={excludeSystemFiles}
                        onChange={(e) => setExcludeSystemFiles(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Exclude System Partition Directories</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={excludeGitModules}
                        onChange={(e) => setExcludeGitModules(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Exclude Code Metadata (.git, node_modules)</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={writeLogFile}
                        onChange={(e) => setWriteLogFile(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Generate Sync Log on Windows Desktop</span>
                    </label>
                  </div>
                </div>

                {/* Retries and network settings */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase">Fail Retries (/R)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={retryCount}
                      onChange={(e) => setRetryCount(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-700 dark:text-slate-300 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase">Wait Delay Sec (/W)</label>
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      value={retryWait}
                      onChange={(e) => setRetryWait(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-700 dark:text-slate-300 font-mono"
                    />
                  </div>
                </div>

              </div>

            </div>

            {/* Right Hand Code Terminal Panel */}
            <div className="lg:col-span-3 flex flex-col min-h-[450px]">
              <div className="bg-slate-900 border border-slate-950 rounded-2xl flex-1 flex flex-col overflow-hidden shadow-lg">
                
                {/* Terminal top header */}
                <div className="px-5 py-3.5 bg-slate-950/60 border-b border-slate-950 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 font-bold uppercase ml-2">powershell_backup_synchronizer.ps1</span>
                  </div>

                  <button
                    onClick={handleCopySyncScript}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      copiedSyncScript 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/50'
                    }`}
                  >
                    {copiedSyncScript ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Script Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Script</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Live Console Output */}
                <div className="flex-1 p-5 overflow-auto font-mono text-xs text-indigo-200 select-all leading-relaxed whitespace-pre-wrap">
                  {generatedPowerShell}
                </div>

                {/* Robocopy Instructions Warning footer */}
                <div className="px-5 py-3 bg-slate-950 border-t border-slate-950 flex items-start gap-3 text-[10px] text-slate-400">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 animate-bounce" />
                  <p className="leading-normal">
                    <strong>Important Note:</strong> Paste this code block into an Administrator PowerShell prompt on Windows. Robocopy runs directly inside the kernel, yielding transfer speeds much faster than manual drag-and-drop. Make sure your target backup paths exist before execution.
                  </p>
                </div>

              </div>
            </div>

          </div>
        ) : (
          /* ========================================================
             CATALOG METADATA INDEX EXPORT VIEW
             ======================================================== */
          <div className="max-w-3xl mx-auto space-y-6">
            
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-850 pb-4">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <Download className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Export Cataloged Directories</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Filter, configure, and compile your external backup drive catalogs into structured offline spreadsheets or plain texts.</p>
                </div>
              </div>

              {/* Grid selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Select target catalog */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <span>Source Catalog Scope:</span>
                  </label>
                  <select
                    value={exportDriveId}
                    onChange={(e) => setExportDriveId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">All Cataloged Storage Maps Combined</option>
                    {drives.map(d => (
                      <option key={d.id} value={d.id}>
                        Drive Partition {d.letter}: ({d.name})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Choose Export Format */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Export Document Format:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {/* CSV */}
                    <button
                      onClick={() => setExportFormat('csv')}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        exportFormat === 'csv'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100/50'
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>CSV Spreadsheet</span>
                    </button>

                    {/* JSON */}
                    <button
                      onClick={() => setExportFormat('json')}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        exportFormat === 'json'
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100/50'
                      }`}
                    >
                      <FileJson className="w-4 h-4" />
                      <span>JSON Index</span>
                    </button>

                    {/* TXT list */}
                    <button
                      onClick={() => setExportFormat('txt')}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        exportFormat === 'txt'
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100/50'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      <span>Text Path List</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Inline Filters Panel */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-850 rounded-xl space-y-4">
                <div className="text-[11px] font-bold font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <ListFilter className="w-4 h-4 text-slate-400" />
                  <span>Optional Sub-Filters Before Export</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* File Name search query */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">File Name Query Match</label>
                    <input
                      type="text"
                      placeholder="e.g. video, backup..."
                      value={exportQuery}
                      onChange={(e) => setExportQuery(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs focus:outline-none"
                    />
                  </div>

                  {/* Extension Match */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Extension Filter</label>
                    <select
                      value={exportExtension}
                      onChange={(e) => setExportExtension(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs focus:outline-none"
                    >
                      <option value="">All Extensions</option>
                      {uniqueExtensions.map(ext => (
                        <option key={ext} value={ext}>{ext.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                  {/* Minimum Size */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Min File Size (Bytes)</label>
                    <input
                      type="number"
                      placeholder="e.g. 1048576"
                      value={exportMinSize}
                      onChange={(e) => setExportMinSize(Math.max(0, parseInt(e.target.value) || 0).toString())}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-700 dark:text-slate-200 font-mono focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Status or loading box */}
              {exportStatus && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-xl flex items-center gap-2">
                  <Info className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                  <span>{exportStatus}</span>
                </div>
              )}

              {/* Trigger export button */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleExportCatalog}
                  disabled={exportLoading}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exportLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Compiling Catalog...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Compile &amp; Download Index</span>
                    </>
                  )
                }
                </button>
              </div>

            </div>

            {/* Offline Index Restoration Help card */}
            <div className="bg-gradient-to-br from-slate-800 to-indigo-950 p-5 rounded-2xl border border-indigo-900/40 text-slate-200 space-y-3 shadow-md">
              <h4 className="text-xs font-bold font-mono text-indigo-300 uppercase tracking-widest flex items-center gap-1.5">
                <Info className="w-4 h-4" />
                <span>Index Management &amp; Persistence Details</span>
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                When using the **JSON Index Export**, ReIndex compiles every file record including path strings, extensions, and exact byte counts into a single highly compact archive. This index can be restored back into any other browser or server environment without needing to re-run the PowerShell scanning utility on the physical hardware.
              </p>
              <div className="text-[10px] text-indigo-200 font-mono bg-indigo-950/50 px-3 py-2 rounded-lg border border-indigo-900/30">
                ⚡ Full index maps are persisted client-side utilizing stable IndexedDB/localStorage keys or cloud-synchronized via PostgreSQL.
              </div>
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
