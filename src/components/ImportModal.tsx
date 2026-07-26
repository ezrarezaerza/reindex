import React from 'react';
import { Drive, FileItem } from '../types';
import { 
  X, 
  Upload, 
  Terminal, 
  FileJson, 
  CheckCircle2, 
  AlertCircle, 
  HardDrive, 
  Database, 
  Disc, 
  Server, 
  Archive,
  Copy,
  Check,
  Activity,
  RotateCcw,
  Loader2,
  Plus,
  FolderPlus
} from 'lucide-react';
import { motion } from 'motion/react';

interface ImportModalProps {
  onClose: () => void;
  onImport: (drive: Omit<Drive, 'fileCount' | 'totalSize' | 'lastUpdated'> & { skipDbSync?: boolean }) => void;
  onAppend?: (driveId: string, items: FileItem[], stats: { fileCount: number; totalSize: number; lastUpdated: string }) => void;
  drives?: Drive[];
  isOnline?: boolean;
  authToken?: string | null;
}

export default function ImportModal({ 
  onClose, 
  onImport, 
  onAppend, 
  drives = [], 
  isOnline = false, 
  authToken = null 
}: ImportModalProps) {
  // Mode Selector State
  const [importMode, setImportMode] = React.useState<'create' | 'append'>('create');
  const [targetDriveId, setTargetDriveId] = React.useState<string>('');

  // Form State
  const [name, setName] = React.useState('');
  const [letter, setLetter] = React.useState('D');
  const [icon, setIcon] = React.useState<Drive['icon']>('hard-drive');
  const [color, setColor] = React.useState('emerald');
  const [description, setDescription] = React.useState('');
  const [useChunked, setUseChunked] = React.useState<boolean>(true);
  
  // JSON input sources
  const [jsonPaste, setJsonPaste] = React.useState('');
  const [importedItems, setImportedItems] = React.useState<FileItem[]>([]);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [successCount, setSuccessCount] = React.useState<number | null>(null);

  const [copiedScript, setCopiedScript] = React.useState(false);

  // Uploading Engine States
  const [uploadState, setUploadState] = React.useState<'idle' | 'initializing' | 'uploading' | 'completed' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [uploadPercent, setUploadPercent] = React.useState(0);
  const [totalChunks, setTotalChunks] = React.useState(0);
  const [completedChunks, setCompletedChunks] = React.useState(0);
  const [uploadedFilesCount, setUploadedFilesCount] = React.useState(0);
  const [uploadSpeed, setUploadSpeed] = React.useState(0); // Files per second
  const [eta, setEta] = React.useState<number | null>(null); // seconds
  const [workerStates, setWorkerStates] = React.useState<string[]>([]);

  // PowerShell extraction command template
  const powershellCommand = `Get-ChildItem -Path "${letter}:\\" -Recurse -File | Select-Object Name, FullName, Extension, Length | ConvertTo-Json -Depth 5 | Out-File -FilePath "C:\\drive_${letter.toLowerCase()}_catalog.json" -Encoding utf8`;

  const copyPowershell = () => {
    navigator.clipboard.writeText(powershellCommand);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleValidateJSON = (jsonString: string) => {
    try {
      if (!jsonString.trim()) {
        setValidationError('Please paste or upload a JSON catalog file.');
        setImportedItems([]);
        setSuccessCount(null);
        return;
      }

      const parsed = JSON.parse(jsonString);
      
      if (!Array.isArray(parsed)) {
        setValidationError('Invalid catalog schema: Expected a JSON Array, but received an Object.');
        setImportedItems([]);
        setSuccessCount(null);
        return;
      }

      if (parsed.length === 0) {
        setValidationError('Empty catalog: The provided array contains no file records.');
        setImportedItems([]);
        setSuccessCount(null);
        return;
      }

      // Check first item properties to validate schema
      const sample = parsed[0];
      const hasName = 'Name' in sample || 'name' in sample;
      const hasFullName = 'FullName' in sample || 'fullName' in sample;
      
      if (!hasName || !hasFullName) {
        setValidationError('Schema Mismatch: Items must contain at least "Name" and "FullName" properties.');
        setImportedItems([]);
        setSuccessCount(null);
        return;
      }

      // Format parsed data into expected FileItem schema
      const normalizedItems: FileItem[] = parsed.map((item: any) => ({
        Name: item.Name || item.name || 'Unnamed file',
        FullName: item.FullName || item.fullName || '',
        Extension: item.Extension || item.extension || '.' + (item.Name || item.name || '').split('.').pop() || '',
        Length: Number(item.Length ?? item.length ?? item.Size ?? item.size ?? 0),
      }));

      setImportedItems(normalizedItems);
      setValidationError(null);
      setSuccessCount(normalizedItems.length);
      
      // Auto-fill drive name if empty
      if (!name) {
        setName(`Local Drive ${letter}`);
      }

    } catch (err: any) {
      setValidationError(`Syntax Error: Failed to parse JSON. Ensure it is valid JSON syntax. (${err.message})`);
      setImportedItems([]);
      setSuccessCount(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonPaste(content);
      handleValidateJSON(content);
    };
    reader.readAsText(file);
  };

  // High-performance Concurrent Chunk Upload Engine
  const startChunkedUpload = async (driveId: string, finalizedItems: FileItem[], isAppend = false) => {
    setUploadState('initializing');
    setErrorMessage(null);
    setUploadPercent(0);
    setCompletedChunks(0);
    setUploadedFilesCount(0);
    setUploadSpeed(0);
    setEta(null);

    const CHUNK_SIZE = 2500; // Optimal safe chunk size for Vercel 4.5MB request limit (approx 200KB per request)
    const CONCURRENCY = 3; // Upload up to 3 chunks concurrently for massive performance throughput
    
    // Split finalizedItems into chunks
    const chunks: FileItem[][] = [];
    for (let i = 0; i < finalizedItems.length; i += CHUNK_SIZE) {
      chunks.push(finalizedItems.slice(i, i + CHUNK_SIZE));
    }

    setTotalChunks(chunks.length);
    const initialWorkers = Array.from({ length: CONCURRENCY }, () => 'Idle');
    setWorkerStates(initialWorkers);

    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (!isAppend) {
      // Step 1: Initialize the drive profile and clear stale records on Postgres (Phase 1)
      try {
        const drivePayload = {
          id: driveId,
          name: name.trim(),
          letter: letter.toUpperCase(),
          color,
          icon,
          lastUpdated: timestamp,
          fileCount: finalizedItems.length,
          totalSize: finalizedItems.reduce((acc, item) => acc + (Number(item.Length) || 0), 0),
          description: description.trim() || `PowerShell index of partition ${letter}:\\`,
          items: [] // Sent as empty array so backend clears old logs and updates metadata
        };

        const res = await fetch('/api/drives', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': authToken || ''
          },
          body: JSON.stringify(drivePayload)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to initialize drive metadata.');
        }
      } catch (err: any) {
        setUploadState('failed');
        setErrorMessage(`Metadata Initialization Failed: ${err.message}`);
        return;
      }
    }

    // Step 2: Begin Chunked Upload using Concurrent Upload Queue Controller (Phase 2 & 3)
    setUploadState('uploading');
    
    let activeChunkIndex = 0;
    let successfulChunks = 0;
    let totalUploadedFiles = 0;
    const startTime = Date.now();
    
    const currentWorkerStates = [...initialWorkers];
    const updateWorkerState = (workerIdx: number, stateStr: string) => {
      currentWorkerStates[workerIdx] = stateStr;
      setWorkerStates([...currentWorkerStates]);
    };

    // Worker process
    const runWorker = async (workerIdx: number) => {
      while (activeChunkIndex < chunks.length) {
        // Retrieve next chunk index atomicaly
        const chunkIndex = activeChunkIndex;
        activeChunkIndex++;

        if (chunkIndex >= chunks.length) {
          break;
        }

        const chunk = chunks[chunkIndex];
        const chunkNum = chunkIndex + 1;

        // Upload chunk with retries
        let success = false;
        let attempt = 0;
        const maxAttempts = 3;

        while (!success && attempt < maxAttempts) {
          attempt++;
          updateWorkerState(workerIdx, `Uploading chunk ${chunkNum}/${chunks.length} (Attempt ${attempt}/${maxAttempts})...`);
          
          try {
            const response = await fetch(`/api/drives/${driveId}/chunks`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': authToken || ''
              },
              body: JSON.stringify({ items: chunk })
            });

            if (response.ok) {
              success = true;
            } else {
              const errText = await response.text();
              console.warn(`Chunk ${chunkNum} attempt ${attempt} failed:`, errText);
              if (attempt < maxAttempts) {
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
              }
            }
          } catch (error) {
            console.error(`Chunk ${chunkNum} attempt ${attempt} network error:`, error);
            if (attempt < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
          }
        }

        if (!success) {
          throw new Error(`Failed to upload chunk #${chunkNum} after ${maxAttempts} consecutive attempts.`);
        }

        // Update progress counts
        successfulChunks++;
        totalUploadedFiles += chunk.length;
        
        setCompletedChunks(successfulChunks);
        setUploadedFilesCount(totalUploadedFiles);

        // Real-time speed & ETA metrics
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        const speed = elapsedSeconds > 0 ? totalUploadedFiles / elapsedSeconds : 0;
        setUploadSpeed(Math.round(speed));

        const remainingFiles = finalizedItems.length - totalUploadedFiles;
        const remainingTime = speed > 0 ? remainingFiles / speed : 0;
        setEta(remainingFiles > 0 ? Math.round(remainingTime) : 0);

        const percent = Math.min(100, Math.round((successfulChunks / chunks.length) * 100));
        setUploadPercent(percent);
      }

      updateWorkerState(workerIdx, 'Idle');
    };

    try {
      // Spawn concurrent upload workers
      const workers = Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, (_, i) => runWorker(i));
      await Promise.all(workers);

      // Recalculate metadata on the backend to ensure absolute ground truth in DB
      const targetDrive = drives?.find(d => d.id === driveId);
      const prevFileCount = targetDrive?.fileCount || 0;
      const prevTotalSize = targetDrive?.totalSize || 0;

      let finalFileCount = prevFileCount + finalizedItems.length;
      let finalTotalSize = prevTotalSize + finalizedItems.reduce((acc, item) => acc + (Number(item.Length) || 0), 0);

      try {
        const recalcRes = await fetch(`/api/drives/${driveId}/recalculate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': authToken || ''
          }
        });

        if (recalcRes.ok) {
          const recalcData = await recalcRes.json();
          if (recalcData.success && recalcData.drive) {
            finalFileCount = recalcData.drive.fileCount;
            finalTotalSize = recalcData.drive.totalSize;
          }
        } else {
          console.warn('Backend recalculation failed, using computed fallback');
        }
      } catch (recalcErr) {
        console.warn('Error during backend recalculation:', recalcErr);
      }

      setUploadState('completed');
      
      // Delay to show 100% completion before close
      setTimeout(() => {
        if (isAppend && onAppend) {
          onAppend(driveId, finalizedItems, {
            fileCount: finalFileCount,
            totalSize: finalTotalSize,
            lastUpdated: timestamp
          });
        } else {
          onImport({
            id: driveId,
            name: name.trim(),
            letter: letter.toUpperCase(),
            color,
            icon,
            items: finalizedItems,
            description: description.trim() || `PowerShell index of partition ${letter}:\\`,
            skipDbSync: true
          });
        }
        onClose();
      }, 1000);

    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadState('failed');
      setErrorMessage(err.message || 'An error occurred during chunked transfer.');
    }
  };

  const startDirectUpload = async (driveId: string, finalizedItems: FileItem[], isAppend = false) => {
    setUploadState('initializing');
    setErrorMessage(null);
    setUploadPercent(10);
    setCompletedChunks(0);
    setTotalChunks(1);
    setUploadedFilesCount(0);
    setUploadSpeed(0);
    setEta(null);

    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    try {
      setUploadState('uploading');
      setUploadPercent(40);

      if (!isAppend) {
        // Direct creation: send everything to /api/drives
        const drivePayload = {
          id: driveId,
          name: name.trim(),
          letter: letter.toUpperCase(),
          color,
          icon,
          lastUpdated: timestamp,
          fileCount: finalizedItems.length,
          totalSize: finalizedItems.reduce((acc, item) => acc + (Number(item.Length) || 0), 0),
          description: description.trim() || `PowerShell index of partition ${letter}:\\`,
          items: finalizedItems
        };

        const res = await fetch('/api/drives', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': authToken || ''
          },
          body: JSON.stringify(drivePayload)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to import drive catalog.');
        }
      } else {
        // Direct append: send everything to /api/drives/:id/chunks
        const res = await fetch(`/api/drives/${driveId}/chunks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': authToken || ''
          },
          body: JSON.stringify({ items: finalizedItems })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to append files.');
        }

        // Recalculate stats on database
        const recalcRes = await fetch(`/api/drives/${driveId}/recalculate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': authToken || ''
          }
        });

        if (!recalcRes.ok) {
          console.warn('Backend recalculation failed, stats might be slightly out of sync until next manual recalculate.');
        }
      }

      setUploadPercent(100);
      setUploadedFilesCount(finalizedItems.length);
      setUploadState('completed');

      // Fetch the updated drives to ensure UI sync
      const targetDrive = drives?.find(d => d.id === driveId);
      const prevFileCount = targetDrive?.fileCount || 0;
      const prevTotalSize = targetDrive?.totalSize || 0;

      let finalFileCount = prevFileCount + finalizedItems.length;
      let finalTotalSize = prevTotalSize + finalizedItems.reduce((acc, item) => acc + (Number(item.Length) || 0), 0);

      // Try reading updated stats
      try {
        const recalcStatsRes = await fetch(`/api/drives/${driveId}/recalculate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': authToken || ''
          }
        });
        if (recalcStatsRes.ok) {
          const recalcData = await recalcStatsRes.json();
          if (recalcData.success && recalcData.drive) {
            finalFileCount = recalcData.drive.fileCount;
            finalTotalSize = recalcData.drive.totalSize;
          }
        }
      } catch (err) {
        console.warn('Recalculate stats fetch failed:', err);
      }

      setTimeout(() => {
        if (isAppend && onAppend) {
          onAppend(driveId, finalizedItems, {
            fileCount: finalFileCount,
            totalSize: finalTotalSize,
            lastUpdated: timestamp
          });
        } else {
          onImport({
            id: driveId,
            name: name.trim(),
            letter: letter.toUpperCase(),
            color,
            icon,
            items: finalizedItems,
            description: description.trim() || `PowerShell index of partition ${letter}:\\`,
            skipDbSync: true
          });
        }
        onClose();
      }, 1000);

    } catch (err: any) {
      console.error('Direct upload failed:', err);
      setUploadState('failed');
      setErrorMessage(err.message || 'An error occurred during direct upload.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (importedItems.length === 0) {
      setValidationError('Please validate a valid JSON catalog before importing.');
      return;
    }

    if (importMode === 'create') {
      if (!name.trim()) {
        setValidationError('Please provide a descriptive name for this drive catalog.');
        return;
      }

      const driveId = `drive-user-${Date.now()}`;
      const finalizedItems = importedItems.map(item => ({
        ...item,
        DriveId: driveId
      }));

      if (isOnline) {
        if (useChunked) {
          startChunkedUpload(driveId, finalizedItems, false);
        } else {
          startDirectUpload(driveId, finalizedItems, false);
        }
      } else {
        onImport({
          id: driveId,
          name: name.trim(),
          letter: letter.toUpperCase(),
          color,
          icon,
          items: finalizedItems,
          description: description.trim() || `PowerShell index of partition ${letter}:\\`
        });
        onClose();
      }
    } else {
      // Append mode
      if (!targetDriveId) {
        setValidationError('Please select a target storage catalog to append to.');
        return;
      }

      const targetDrive = drives.find(d => d.id === targetDriveId);
      if (!targetDrive) {
        setValidationError('Selected target storage catalog not found.');
        return;
      }

      const finalizedItems = importedItems.map(item => ({
        ...item,
        DriveId: targetDriveId
      }));

      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const prevFileCount = targetDrive.fileCount || 0;
      const prevTotalSize = targetDrive.totalSize || 0;
      const updatedFileCount = prevFileCount + finalizedItems.length;
      const updatedTotalSize = prevTotalSize + finalizedItems.reduce((acc, item) => acc + (Number(item.Length) || 0), 0);

      if (isOnline) {
        if (useChunked) {
          startChunkedUpload(targetDriveId, finalizedItems, true);
        } else {
          startDirectUpload(targetDriveId, finalizedItems, true);
        }
      } else {
        if (onAppend) {
          onAppend(targetDriveId, finalizedItems, {
            fileCount: updatedFileCount,
            totalSize: updatedTotalSize,
            lastUpdated: timestamp
          });
        }
        onClose();
      }
    }
  };

  // Color theme mapper
  const colors = ['emerald', 'blue', 'violet', 'rose', 'amber'];
  const colorLabels: { [key: string]: string } = {
    emerald: 'bg-emerald-500 text-emerald-600',
    blue: 'bg-blue-500 text-blue-600',
    violet: 'bg-violet-500 text-violet-600',
    rose: 'bg-rose-500 text-rose-600',
    amber: 'bg-amber-500 text-amber-600'
  };

  const selectedThemeColor = colorLabels[color] || 'bg-indigo-500 text-indigo-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" id="import-modal-overlay">
      {/* Light/Dark backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={uploadState === 'idle' || uploadState === 'failed' ? onClose : undefined} 
        className="absolute inset-0 bg-slate-500/35 dark:bg-slate-950/70 backdrop-blur-xs cursor-pointer"
      />

      {/* Dialog Frame */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
        id="import-modal-box"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0">
          <div className="flex items-center gap-2.5">
            <FileJson className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">Import External Hard Drive Catalog</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {uploadState === 'idle' 
                  ? 'Add custom PowerShell outputs to your local index' 
                  : 'Syncing file records directly with Vercel Postgres'}
              </p>
            </div>
          </div>
          {(uploadState === 'idle' || uploadState === 'failed') && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Scroll Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-900 flex flex-col justify-between">
          
          {uploadState === 'idle' ? (
            <div className="space-y-6">
              {/* Section 1: PowerShell Instructions */}
              <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-3.5" id="powershell-instructions">
                <h4 className="text-xs font-mono font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5 uppercase tracking-wide">
                  <Terminal className="w-4 h-4" />
                  <span>How to generate the JSON catalog?</span>
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
                  To catalog your external drive, open <strong>Windows PowerShell</strong> and run the command below. It scans your drive and exports a flat JSON containing filenames and metadata.
                </p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 font-semibold">
                    <span>Select Target Drive Letter: </span>
                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 px-2 py-1 rounded border border-slate-200 dark:border-slate-800">
                      {['D', 'E', 'F', 'G', 'H', 'I'].map(char => (
                        <button
                          key={char}
                          onClick={() => setLetter(char)}
                          className={`w-5 h-5 text-[10px] font-bold rounded flex items-center justify-center transition-all cursor-pointer ${
                            letter === char
                              ? 'bg-indigo-600 text-white shadow shadow-indigo-600/20 font-bold'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                          }`}
                        >
                          {char}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="relative">
                    <div className="p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-[10px] text-slate-600 dark:text-slate-400 leading-normal select-all whitespace-pre-wrap break-all pr-12 max-h-[100px] overflow-y-auto font-medium">
                      {powershellCommand}
                    </div>
                    <button
                      onClick={copyPowershell}
                      className="absolute top-2.5 right-2.5 p-1.5 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg transition-all cursor-pointer"
                      title="Copy PowerShell script snippet"
                    >
                      {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <p className="text-[10px] italic text-slate-400 dark:text-slate-500 leading-relaxed font-medium">
                  Note: -Recurse scans all subfolders. For massive drives (100k+ files), this might take a few minutes to finish.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5" id="import-form">
                
                {/* Step 2: Upload / Paste JSON */}
                <div className="space-y-2">
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                    Step 2: Upload or Paste Catalog JSON
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {/* File picker */}
                    <div className="border border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-5 flex flex-col items-center justify-center text-center transition-colors relative group bg-slate-50/50 dark:bg-slate-950/20">
                      <Upload className="w-8 h-8 text-slate-400 group-hover:text-indigo-600 mb-2 transition-colors" />
                      <span className="text-xs text-slate-700 dark:text-slate-300 font-bold">Upload catalog .json file</span>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 max-w-[180px] font-medium">Select drive_catalog.json file generated from PowerShell</p>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>

                    {/* Text box */}
                    <div className="space-y-1.5">
                      <textarea
                        placeholder='Or paste the raw JSON array here... e.g. [{"Name": "vacation.mp4", "FullName": "E:\\vacation.mp4"}]'
                        value={jsonPaste}
                        onChange={(e) => {
                           setJsonPaste(e.target.value);
                           handleValidateJSON(e.target.value);
                        }}
                        className="w-full h-32 p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-2xl text-xs text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none font-mono resize-none shadow-inner"
                      ></textarea>
                    </div>
                  </div>

                  {/* Status and valid errors */}
                  {validationError && (
                    <div className="p-3.5 bg-rose-50 dark:bg-rose-950/25 border border-rose-250 dark:border-rose-900/55 text-rose-700 dark:text-rose-400 text-xs rounded-xl flex items-start gap-2 animate-in slide-in-from-top duration-150 font-semibold">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                      <span>{validationError}</span>
                    </div>
                  )}

                  {successCount !== null && (
                    <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-xs rounded-xl flex items-center gap-2 animate-in slide-in-from-top duration-150 font-semibold">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>Successfully validated <strong className="font-mono">{successCount.toLocaleString()}</strong> file indices. Complete step 3 to add this storage catalog.</span>
                    </div>
                  )}
                </div>

                {/* Step 2.5: Choose Catalog Target Mode */}
                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                    Choose Catalog Target Mode
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 p-1.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => {
                        setImportMode('create');
                        setName('');
                        setLetter('D');
                        setColor('emerald');
                        setIcon('hard-drive');
                        setDescription('');
                        setValidationError(null);
                      }}
                      className={`py-2.5 px-4 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                        importMode === 'create'
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create New Catalog Profile</span>
                    </button>
                    <button
                      type="button"
                      disabled={!drives || drives.length === 0}
                      onClick={() => {
                        setImportMode('append');
                        setValidationError(null);
                        if (drives && drives.length > 0) {
                          const firstDrive = drives[0];
                          setTargetDriveId(firstDrive.id);
                          setName(firstDrive.name);
                          setLetter(firstDrive.letter);
                          setColor(firstDrive.color);
                          setIcon(firstDrive.icon);
                          setDescription(firstDrive.description || '');
                        }
                      }}
                      className={`py-2.5 px-4 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                        importMode === 'append'
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                      title={(!drives || drives.length === 0) ? "No existing storage catalogs to append to" : "Select an existing catalog to append files to"}
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>Append to Existing Catalog</span>
                    </button>
                  </div>
                </div>

                {/* Step 3: Drive properties config */}
                <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                    {importMode === 'create' ? 'Step 3: Drive Profile Customization' : 'Step 3: Target Catalog Details (Read Only)'}
                  </label>

                  {importMode === 'append' && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">Select Target Storage Catalog to Append To</span>
                      <select
                        value={targetDriveId}
                        onChange={(e) => {
                          const dId = e.target.value;
                          setTargetDriveId(dId);
                          const targetDrive = drives.find(d => d.id === dId);
                          if (targetDrive) {
                            setName(targetDrive.name);
                            setLetter(targetDrive.letter);
                            setColor(targetDrive.color);
                            setIcon(targetDrive.icon);
                            setDescription(targetDrive.description || '');
                          }
                        }}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none transition-all font-sans cursor-pointer font-semibold shadow-xs"
                        required={importMode === 'append'}
                      >
                        <option value="" disabled>-- Select an existing storage catalog --</option>
                        {drives.map(drive => (
                          <option key={drive.id} value={drive.id} className="dark:bg-slate-950">
                            {drive.name} ({drive.letter}:\\) — {drive.fileCount?.toLocaleString() || 0} files
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Drive Name / Label */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">Drive Display Name</span>
                      <input
                        type="text"
                        placeholder="e.g. Work Backups HDD"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={`w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none transition-all font-sans ${importMode === 'append' ? 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed font-medium' : ''}`}
                        required
                        disabled={importMode === 'append'}
                      />
                    </div>

                    {/* Theme colors */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">Styling Theme Accent</span>
                      <div className="flex items-center gap-2 h-9">
                        {colors.map(col => (
                          <button
                            key={col}
                            type="button"
                            disabled={importMode === 'append'}
                            onClick={() => setColor(col)}
                            className={`w-6 h-6 rounded-full transition-all flex items-center justify-center ${colorLabels[col].split(' ')[0]} ${
                              color === col
                                ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-110 shadow-md'
                                : 'hover:scale-105 opacity-60 hover:opacity-100 disabled:opacity-40 disabled:scale-100'
                            } ${importMode === 'append' ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                            title={`Accent Color ${col}`}
                          >
                            {color === col && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Icon option selection */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">Hardware Storage Icon</span>
                      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
                        {[
                          { key: 'hard-drive', icon: HardDrive, label: 'HDD' },
                          { key: 'database', icon: Database, label: 'SSD' },
                          { key: 'disc', icon: Disc, label: 'CD/DVD' },
                          { key: 'server', icon: Server, label: 'NAS' },
                          { key: 'archive', icon: Archive, label: 'Archive' },
                        ].map(opt => {
                          const IconComponent = opt.icon;
                          const isSel = icon === opt.key;
                          return (
                            <button
                              key={opt.key}
                              type="button"
                              disabled={importMode === 'append'}
                              onClick={() => setIcon(opt.key as any)}
                              className={`flex-1 py-1 px-2 rounded-lg flex flex-col items-center gap-1 transition-all border ${
                                isSel
                                  ? 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                                  : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:hover:bg-transparent'
                              } ${importMode === 'append' ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                              title={opt.label}
                            >
                              <IconComponent className="w-4 h-4" />
                              <span className="text-[8px] font-mono font-bold uppercase tracking-wider">{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">Description Memo (Optional)</span>
                      <input
                        type="text"
                        placeholder="e.g. 2TB expansion disk containing legacy software"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className={`w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none transition-all font-sans ${importMode === 'append' ? 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed font-medium' : ''}`}
                        disabled={importMode === 'append'}
                      />
                    </div>
                  </div>
                </div>                 {/* Step 3.5: Upload Pipeline Engine Selection */}
                <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">Upload Pipeline Engine</span>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Choose how database file insertion transactions are structured.</p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setUseChunked(true)}
                        className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                          useChunked
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                      >
                        Segmented Chunker (Robust)
                      </button>
                      <button
                        type="button"
                        onClick={() => setUseChunked(false)}
                        className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                          !useChunked
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                      >
                        Direct Upload (Fast)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Submission Actions Row */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800 rounded-b-2xl flex items-center justify-end gap-3 pt-4 shrink-0">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer shadow-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={importedItems.length === 0}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 dark:disabled:bg-slate-950 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:border-slate-300 dark:disabled:border-slate-800 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl tracking-wide transition-all shadow-xs cursor-pointer"
                  >
                    {importMode === 'create' ? 'Assemble & Add to Index' : 'Append to Existing Catalog'}
                  </button>
                </div>

              </form>
            </div>
          ) : (
            /* Phase 3: High-Fidelity Upload Progress Screen */
            <div className="py-6 space-y-6 flex flex-col items-center justify-center text-center animate-in fade-in duration-200">
              
              {uploadState === 'initializing' && (
                <div className="space-y-4">
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full w-14 h-14 flex items-center justify-center animate-pulse mx-auto">
                    <Database className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Initializing Remote Partition</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Contacting Postgres database to instantiate drive profile and reset older files map.
                  </p>
                  <Loader2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mt-2" />
                </div>
              )}

              {uploadState === 'uploading' && (
                <div className="w-full space-y-6">
                  {/* Status Indicator */}
                  <div className="space-y-1">
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-405 rounded-full w-12 h-12 flex items-center justify-center animate-spin mx-auto">
                      <Activity className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Uploading File Indices...</h4>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                      Segmenting {importedItems.length.toLocaleString()} indices into chunks to bypass server limits
                    </p>
                  </div>

                  {/* High Fidelity Progress Bar */}
                  <div className="space-y-2 max-w-md mx-auto">
                    <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 font-semibold font-mono">
                      <span>{completedChunks} / {totalChunks} Chunks Sent</span>
                      <span className={selectedThemeColor.split(' ')[1]}>{uploadPercent}%</span>
                    </div>
                    
                    <div className="w-full bg-slate-100 dark:bg-slate-950 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${selectedThemeColor.split(' ')[0]}`}
                        style={{ width: `${uploadPercent}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Real-time statistics Grid */}
                  <div className="grid grid-cols-2 gap-4 max-w-md mx-auto bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
                    <div className="text-center">
                      <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 dark:text-slate-500 block">Uploaded Files</span>
                      <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200 font-mono mt-0.5 block">
                        {uploadedFilesCount.toLocaleString()} / {importedItems.length.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-center border-l border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 dark:text-slate-500 block">Transfer Speed</span>
                      <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200 font-mono mt-0.5 block">
                        {uploadSpeed > 0 ? `${uploadSpeed.toLocaleString()} files/sec` : 'Calculating...'}
                      </span>
                    </div>
                    <div className="text-center border-t border-slate-200 dark:border-slate-800 pt-3 col-span-2">
                      <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 dark:text-slate-500 block">Estimated Time Remaining</span>
                      <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5 block">
                        {eta === null ? 'Calculating...' : eta === 0 ? 'Finishing up...' : `${eta} seconds`}
                      </span>
                    </div>
                  </div>

                  {/* Parallel Workers Monitor (Phase 2 & 3 Concurrency Monitor) */}
                  <div className="max-w-md mx-auto border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 text-left">
                    <div className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-3.5 py-1.5 flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      <span>Concurrent Worker Status (Queue Controller)</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-mono">3 workers active</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 p-1">
                      {workerStates.map((status, idx) => (
                        <div key={idx} className="px-3 py-2 flex items-center justify-between text-xs font-mono">
                          <span className="text-slate-400 dark:text-slate-500 font-medium">Worker {idx + 1}:</span>
                          <span className="text-slate-700 dark:text-slate-300 truncate max-w-[280px] font-semibold">{status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {uploadState === 'completed' && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full w-14 h-14 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">Sync Completed Successfully!</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    All <strong className="font-mono">{importedItems.length.toLocaleString()}</strong> indices have been parsed, split, and written into the main index safely.
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">Updating client view...</p>
                </div>
              )}

              {uploadState === 'failed' && (
                <div className="w-full space-y-5">
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/45 text-rose-600 dark:text-rose-450 rounded-full w-14 h-14 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">Upload Interrupt Error</h4>
                  
                  <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl text-left text-xs max-w-md mx-auto font-mono text-rose-700 dark:text-rose-400 leading-relaxed whitespace-pre-wrap">
                    {errorMessage || 'Unknown database payload failure.'}
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Server limits or network drops interrupted chunk transfers. You can retry safely; the backend database keeps previous transactions intact.
                  </p>

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer shadow-xs"
                    >
                      Close Window
                    </button>
                    <button
                      onClick={() => {
                        const activeId = importMode === 'create' ? `drive-user-${Date.now()}` : targetDriveId;
                        const finalizedItems = importedItems.map(item => ({
                          ...item,
                          DriveId: activeId
                        }));
                        startChunkedUpload(activeId, finalizedItems, importMode === 'append');
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retry Upload Pipeline</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </motion.div>
    </div>
  );
}
