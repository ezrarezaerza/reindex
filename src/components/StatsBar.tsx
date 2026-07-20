import React from 'react';
import { Drive, FileItem } from '../types';
import { formatBytes } from '../utils/treeBuilder';
import { 
  FileText, 
  Folder, 
  HardDrive, 
  Layers, 
  Video, 
  Music, 
  Image as ImageIcon, 
  FileArchive, 
  Code2, 
  AlertCircle 
} from 'lucide-react';

interface StatsBarProps {
  activeDrive: Drive | null;
  filteredFiles: FileItem[];
  allFiles: FileItem[];
  drives?: Drive[];
}

export default function StatsBar({ activeDrive, filteredFiles, allFiles, drives = [] }: StatsBarProps) {
  // Compute precise statistics based on pre-calculated drive metadata when available (e.g., in cloud/online mode where drive.items is empty)
  const totalCount = activeDrive 
    ? (activeDrive.fileCount ?? activeDrive.items.length)
    : (drives.length > 0 ? drives.reduce((acc, d) => acc + (d.fileCount ?? 0), 0) : allFiles.length);

  const totalSize = activeDrive 
    ? (activeDrive.totalSize ?? activeDrive.items.reduce((acc, f) => acc + (Number(f.Length) || 0), 0))
    : (drives.length > 0 ? drives.reduce((acc, d) => acc + (Number(d.totalSize) || 0), 0) : allFiles.reduce((acc, f) => acc + (Number(f.Length) || 0), 0));

  // Categorize file extensions using whatever files are currently loaded in memory
  const activeScopeFiles = filteredFiles.length > 0 
    ? filteredFiles 
    : (activeDrive ? activeDrive.items : allFiles);

  // Categorize file extensions
  const categories = {
    video: { label: 'Video', exts: ['.mp4', '.mkv', '.mov', '.avi', '.wmv'], color: 'text-rose-600', bg: 'bg-rose-50', barBg: 'bg-rose-500', icon: Video, count: 0, size: 0 },
    audio: { label: 'Audio', exts: ['.mp3', '.flac', '.wav', '.m4a', '.ogg'], color: 'text-emerald-600', bg: 'bg-emerald-50', barBg: 'bg-emerald-500', icon: Music, count: 0, size: 0 },
    images: { label: 'Images', exts: ['.jpg', '.jpeg', '.png', '.gif', '.cr2', '.nef', '.psd', '.tiff'], color: 'text-violet-600', bg: 'bg-violet-50', barBg: 'bg-violet-500', icon: ImageIcon, count: 0, size: 0 },
    documents: { label: 'Documents', exts: ['.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.doc', '.csv'], color: 'text-amber-600', bg: 'bg-amber-50', barBg: 'bg-amber-500', icon: FileText, count: 0, size: 0 },
    archives: { label: 'Archives', exts: ['.zip', '.rar', '.7z', '.tar', '.gz', '.iso'], color: 'text-blue-600', bg: 'bg-blue-50', barBg: 'bg-blue-500', icon: FileArchive, count: 0, size: 0 },
    dev: { label: 'Development', exts: ['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.py', '.go'], color: 'text-cyan-600', bg: 'bg-cyan-50', barBg: 'bg-cyan-500', icon: Code2, count: 0, size: 0 },
  };

  // Other category for leftovers
  const otherCategory = { label: 'Other', count: 0, size: 0, color: 'text-slate-500', bg: 'bg-slate-100', barBg: 'bg-slate-400' };

  // Calculate size and count per category
  activeScopeFiles.forEach(file => {
    const ext = file.Extension.toLowerCase();
    const length = Number(file.Length) || 0;
    let found = false;
    for (const cat of Object.values(categories)) {
      if (cat.exts.includes(ext)) {
        cat.count++;
        cat.size += length;
        found = true;
        break;
      }
    }
    if (!found) {
      otherCategory.count++;
      otherCategory.size += length;
    }
  });

  // Calculate percentages based on size
  const extensionStats = [
    ...Object.values(categories),
    otherCategory
  ].filter(c => c.count > 0)
   .sort((a, b) => b.size - a.size);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-slate-50 border-b border-slate-200" id="stats-bar-container">
      {/* Box 1: Drive Overview */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col justify-between hover:border-slate-350 transition-colors shadow-xs" id="stats-box-identity">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 block mb-1 font-bold">Active Database</span>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 truncate">
            <HardDrive className={`w-5 h-5 ${activeDrive ? 'text-indigo-600' : 'text-slate-400'}`} />
            <span>{activeDrive ? activeDrive.name : 'All Drive Catalogs'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 truncate">
            {activeDrive ? activeDrive.description || 'Custom local external storage catalog.' : 'Unified search space across all drive indexes.'}
          </p>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs font-mono text-slate-500 font-medium">
          <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
          <span>Indexed Cache: Offline Ready</span>
        </div>
      </div>

      {/* Box 2: Total Storage Size */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col justify-between hover:border-slate-350 transition-colors shadow-xs" id="stats-box-storage">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 block mb-1 font-bold">Total Indexed Volume</span>
          <div className="text-3xl font-extrabold text-slate-800 font-mono tracking-tight mt-1">
            {formatBytes(totalSize)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Storage allocated on file table
          </p>
        </div>
        {/* Simple Progress Bar representing size index */}
        <div className="mt-4">
          <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-1 font-medium">
            <span>0 B</span>
            <span>Index Cap: Unlimited</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-indigo-600 h-full w-4/5 rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Box 3: Total Files & Folders */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col justify-between hover:border-slate-350 transition-colors shadow-xs" id="stats-box-filecount">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 block mb-1 font-bold">Total Items Cataloged</span>
          <div className="text-3xl font-extrabold text-indigo-600 font-mono tracking-tight mt-1">
            {totalCount.toLocaleString()}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Matching filter bounds: <strong className="text-slate-700 font-mono">{filteredFiles.length.toLocaleString()}</strong>
          </p>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-mono font-medium">
          <span className="flex items-center gap-1"><Folder className="w-3.5 h-3.5 text-slate-400" /> Directories: Auto-inferred</span>
          <span className="text-slate-600">{Math.ceil(totalCount / 7)} folders</span>
        </div>
      </div>

      {/* Box 4: Extension Category Breakdown */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl hover:border-slate-350 transition-colors flex flex-col justify-between shadow-xs" id="stats-box-breakdown">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 block mb-2 font-bold">Content Breakdown (By Size)</span>
          <div className="space-y-2 max-h-[100px] overflow-y-auto pr-1" id="extension-breakdown-list">
            {extensionStats.length === 0 ? (
              <div className="text-xs text-slate-400 font-mono py-2 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                No files in current index
              </div>
            ) : (
              extensionStats.map((item, idx) => {
                const percentage = totalSize > 0 ? (item.size / totalSize) * 100 : 0;
                const Icon = (item as any).icon || Layers;
                
                return (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Icon className={`w-3.5 h-3.5 ${(item as any).color || 'text-slate-400'} shrink-0`} />
                        <span className="text-slate-700 truncate font-sans font-semibold text-[11px]">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500 font-medium">
                        <span>{formatBytes(item.size, 0)}</span>
                        <span className="text-slate-400">({percentage.toFixed(0)}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-1 rounded-full">
                      <div 
                        className={`h-full rounded-full ${(item as any).barBg || 'bg-slate-400'}`}
                        style={{ width: `${Math.max(percentage, 2)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
