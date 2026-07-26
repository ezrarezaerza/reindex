import React from 'react';
import { CacheMetadata } from '../utils/indexedDBCache';
import { Drive } from '../types';
import { X, Trash2, RefreshCw, CheckCircle, Database, ShieldAlert, Sparkles, AlertCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatBytes } from '../utils/treeBuilder';

interface CacheManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  cacheStats: CacheMetadata[];
  drives: Drive[];
  onClearCache: (id?: string) => Promise<void>;
  onRefreshStats: () => void;
  onForceVerify: () => Promise<void>;
  serverManifest: Record<string, { lastUpdated: string; fileCount: number }> | null;
  isChecking: boolean;
  theme: 'light' | 'dark';
}

export default function CacheManagerModal({
  isOpen,
  onClose,
  cacheStats,
  drives,
  onClearCache,
  onRefreshStats,
  onForceVerify,
  serverManifest,
  isChecking,
  theme
}: CacheManagerModalProps) {
  React.useEffect(() => {
    if (isOpen) {
      onRefreshStats();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Calculations for summary card
  const totalOriginalSize = cacheStats.reduce((acc, stat) => acc + (stat.originalSize || 0), 0);
  const totalCompressedSize = cacheStats.reduce((acc, stat) => acc + (stat.compressedSize || 0), 0);
  const compressionSavings = totalOriginalSize > 0 
    ? ((1 - totalCompressedSize / totalOriginalSize) * 100).toFixed(1)
    : '0';

  const getDriveName = (driveId: string) => {
    const drive = drives.find(d => d.id === driveId);
    return drive ? drive.name : `Drive ${driveId.substring(0, 8)}`;
  };

  const getDriveLetter = (driveId: string) => {
    const drive = drives.find(d => d.id === driveId);
    return drive ? drive.letter : '';
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 backdrop-blur-xs p-4 sm:p-6" id="cache-manager-overlay">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
          id="cache-manager-card"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">IndexedDB Browser Cache</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Local compression storage management</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Overview / Educational Banner */}
            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl flex items-start gap-3">
              <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans space-y-1">
                <p>
                  <strong>How Persistent Caching Works:</strong> When you download a drive catalog from the database, it is compressed using the browser's native <strong>GZIP Compression Stream API</strong> and cached in <strong>IndexedDB</strong>.
                </p>
                <p>
                  On your next visit or refresh, ReIndex instantly pulls the catalog from local memory in milliseconds, verify-checking only timestamps from a lightweight manifest API to ensure your offline files are completely up-to-date!
                </p>
              </div>
            </div>

            {/* Global Cache Stats Card */}
            {cacheStats.length > 0 ? (
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-150 dark:border-slate-850 rounded-xl flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 font-mono">Original JSON</span>
                  <span className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1 font-mono">{formatBytes(totalOriginalSize)}</span>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-150 dark:border-slate-850 rounded-xl flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 font-mono">Compressed Size</span>
                  <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-1 font-mono">{formatBytes(totalCompressedSize)}</span>
                </div>
                <div className="p-4 bg-gradient-to-br from-indigo-50/50 to-emerald-50/30 dark:from-indigo-950/15 dark:to-emerald-950/10 border border-indigo-100/50 dark:border-indigo-900/30 rounded-xl flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-500 dark:text-indigo-400 font-mono">Storage Saved</span>
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">{compressionSavings}%</span>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/20">
                <Database className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500 dark:text-slate-400">No drive files currently cached in browser.</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Select a drive in the sidebar to download and cache its catalog.</p>
              </div>
            )}

            {/* List of Cached Drives */}
            {cacheStats.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">Cached Storage Volumes</h4>
                
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-150 dark:divide-slate-850 overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                  {cacheStats.map((stat) => {
                    const driveLetter = getDriveLetter(stat.id);
                    const driveName = getDriveName(stat.id);
                    
                    // Verify if matching server manifest
                    let status: 'valid' | 'expired' | 'unverified' = 'unverified';
                    if (serverManifest) {
                      const serverDrive = serverManifest[stat.id];
                      if (serverDrive) {
                        status = serverDrive.lastUpdated === stat.lastUpdated ? 'valid' : 'expired';
                      }
                    }

                    const savings = stat.originalSize > 0 
                      ? ((1 - stat.compressedSize / stat.originalSize) * 100).toFixed(0)
                      : '0';

                    return (
                      <div key={stat.id} className="p-4 flex items-center justify-between hover:bg-slate-50/55 dark:hover:bg-slate-850/20 transition-colors">
                        <div className="space-y-1 pr-4 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-slate-700 dark:text-slate-200 truncate">{driveName}</span>
                            {driveLetter && (
                              <span className="text-[9px] font-mono font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 px-1 rounded">
                                {driveLetter}:
                              </span>
                            )}
                            
                            {/* Validation Badges */}
                            {status === 'valid' && (
                              <span className="text-[8px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                                <CheckCircle className="w-2 h-2" /> Verified Up-to-Date
                              </span>
                            )}
                            {status === 'expired' && (
                              <span className="text-[8px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/60 px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                                <AlertCircle className="w-2 h-2" /> Server has Updates
                              </span>
                            )}
                            {status === 'unverified' && (
                              <span className="text-[8px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-850 border border-slate-150 dark:border-slate-750 px-1.5 py-0.2 rounded-full">
                                Not Verified
                              </span>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-slate-400 dark:text-slate-500">
                            <span>{stat.fileCount.toLocaleString()} files</span>
                            <span>•</span>
                            <span>Size: <strong>{formatBytes(stat.compressedSize)}</strong> <span className="opacity-70">({formatBytes(stat.originalSize)} original)</span></span>
                            <span>•</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{savings}% Saved</span>
                          </div>
                          
                          <div className="text-[9px] font-mono text-slate-400 dark:text-slate-500">
                            Cached: {new Date(stat.cachedAt).toLocaleString()}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => onClearCache(stat.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg cursor-pointer transition-colors"
                            title="Purge drive cache"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer controls */}
          <div className="p-6 border-t border-slate-150 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/40 shrink-0">
            <button
              onClick={() => onClearCache()}
              disabled={cacheStats.length === 0}
              className="px-3 py-1.5 text-xs font-semibold border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/60 hover:text-rose-700 dark:hover:bg-rose-900/40 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Purge Entire Cache
            </button>
            
            <div className="flex items-center gap-2">
              <button
                onClick={onForceVerify}
                disabled={isChecking}
                className="px-3 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                <span>Verify with Server</span>
              </button>
              
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
