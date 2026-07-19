import React from 'react';
import { FileItem, Drive } from '../types';
import { formatBytes } from '../utils/treeBuilder';
import { 
  X, 
  Copy, 
  Check, 
  Terminal, 
  FileText, 
  Folder, 
  HardDrive, 
  Calendar, 
  Info,
  ExternalLink,
  ChevronRight,
  Video,
  Music,
  Image as ImageIcon,
  FileArchive,
  Code2,
  FileCode
} from 'lucide-react';

interface FileDetailModalProps {
  file: FileItem | null;
  drives: Drive[];
  onClose: () => void;
}

// Map file extensions to matching Icons and Color classes
const getFileIconAndColor = (extension?: string) => {
  if (!extension) return { Icon: FileText, color: 'text-slate-400' };
  const ext = extension.toLowerCase();
  
  if (['.mp4', '.mkv', '.mov', '.avi', '.wmv'].includes(ext)) {
    return { Icon: Video, color: 'text-rose-600' };
  }
  if (['.mp3', '.flac', '.wav', '.m4a', '.ogg'].includes(ext)) {
    return { Icon: Music, color: 'text-emerald-600' };
  }
  if (['.jpg', '.jpeg', '.png', '.gif', '.cr2', '.nef', '.psd', '.tiff'].includes(ext)) {
    return { Icon: ImageIcon, color: 'text-violet-600' };
  }
  if (['.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.doc', '.csv'].includes(ext)) {
    return { Icon: FileText, color: 'text-amber-600' };
  }
  if (['.zip', '.rar', '.7z', '.tar', '.gz', '.iso'].includes(ext)) {
    return { Icon: FileArchive, color: 'text-blue-600' };
  }
  if (['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.py', '.go'].includes(ext)) {
    return { Icon: Code2, color: 'text-cyan-600' };
  }
  
  return { Icon: FileText, color: 'text-slate-400' };
};

export default function FileDetailModal({ file, drives, onClose }: FileDetailModalProps) {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  if (!file) return null;

  // Find associated drive
  const associatedDrive = drives.find(d => d.id === file.DriveId);

  const triggerCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const getParentDirectory = (pathStr: string): string => {
    const lastSlash = pathStr.lastIndexOf('\\');
    if (lastSlash === -1) return '';
    return pathStr.substring(0, lastSlash);
  };

  const parentDir = getParentDirectory(file.FullName);
  
  // Custom PowerShell scripts commands for Windows systems
  const psGetItemCmd = `Get-Item -Path "${file.FullName}"`;
  const psExplorerSelectCmd = `explorer.exe /select,"${file.FullName}"`;
  const psCdCmd = `Set-Location -Path "${parentDir}"`;

  const { Icon, color } = getFileIconAndColor(file.Extension);

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200" id="file-detail-overlay">
      {/* Light backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-slate-500/30 backdrop-blur-xs cursor-pointer"
      ></div>

      {/* Slide-out Sidebar Panel */}
      <div 
        className="relative w-full max-w-md h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300"
        id="file-detail-panel"
      >
        {/* Panel Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Info className="w-4.5 h-4.5 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider font-sans">Item Inspection</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            id="close-detail-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Panel Scroll Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* File Card Header */}
          <div className="p-5 bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-2xl flex flex-col items-center text-center">
            <div className={`p-4 bg-white rounded-2xl border border-slate-200 shadow-xs mb-3`}>
              <Icon className={`w-8 h-8 ${color}`} />
            </div>
            <h4 className="font-bold text-slate-800 text-sm break-all leading-snug px-2">
              {file.Name}
            </h4>
            <div className="text-[10px] uppercase font-mono font-bold text-slate-500 mt-2 px-2.5 py-0.5 rounded bg-white border border-slate-200">
              {file.Extension.toLowerCase() || 'no extension'} File
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="space-y-4">
            <h5 className="text-[11px] font-mono uppercase tracking-widest text-slate-400 font-bold border-b border-slate-150 pb-1.5">Properties</h5>
            
            <div className="space-y-3">
              {/* Size property */}
              <div className="flex items-start justify-between text-xs">
                <span className="text-slate-500 font-sans">File Size</span>
                <div className="text-right">
                  <span className="text-slate-800 font-mono font-bold block">{formatBytes(file.Length)}</span>
                  <span className="text-[10px] text-slate-400 font-mono block">({file.Length.toLocaleString()} bytes)</span>
                </div>
              </div>

              {/* Host Drive Info */}
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-slate-500 font-sans">Host Hard Drive</span>
                {associatedDrive ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-800 font-bold">{associatedDrive.name}</span>
                    <span className="px-1.5 py-0.2 rounded border text-[9px] font-bold font-mono bg-indigo-50 text-indigo-700 border-indigo-200/50">
                      {associatedDrive.letter}:
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-400 italic">Unknown drive index</span>
                )}
              </div>

              {/* Format extension */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-sans">Extension format</span>
                <span className="text-slate-800 font-mono font-bold uppercase">{file.Extension.toLowerCase()}</span>
              </div>
            </div>
          </div>

          {/* Absolute File Paths with Instant Copy */}
          <div className="space-y-3">
            <h5 className="text-[11px] font-mono uppercase tracking-widest text-slate-400 font-bold border-b border-slate-150 pb-1.5">Absolute Paths</h5>
            
            {/* Full File Path Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-sans flex items-center gap-1">Full Path</span>
                <button
                  onClick={() => triggerCopy(file.FullName, 'fullname')}
                  className="text-[10px] text-indigo-700 hover:text-indigo-850 font-mono font-semibold flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200/50"
                >
                  {copiedKey === 'fullname' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'fullname' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-700 break-all leading-normal select-all font-medium">
                {file.FullName}
              </div>
            </div>

            {/* Parent Directory Box */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-sans flex items-center gap-1">Parent Folder</span>
                <button
                  onClick={() => triggerCopy(parentDir, 'parentdir')}
                  className="text-[10px] text-indigo-700 hover:text-indigo-850 font-mono font-semibold flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200/50"
                >
                  {copiedKey === 'parentdir' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'parentdir' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-500 break-all leading-normal select-all font-medium">
                {parentDir || 'Drive Root'}
              </div>
            </div>
          </div>

          {/* PowerShell Commands Helper for Local Usage */}
          <div className="space-y-3">
            <h5 className="text-[11px] font-mono uppercase tracking-widest text-slate-400 font-bold border-b border-slate-150 pb-1.5 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-400" />
              <span>Windows CLI Helpers</span>
            </h5>
            
            <div className="space-y-3 text-xs">
              {/* Cmd 1: Locate File in Explorer */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="font-sans">Open Explorer & Highlight File</span>
                  <button
                    onClick={() => triggerCopy(psExplorerSelectCmd, 'psexp')}
                    className="text-[10px] text-indigo-700 hover:text-indigo-850 font-mono font-semibold flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200/50"
                  >
                    {copiedKey === 'psexp' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'psexp' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[10px] text-slate-700 break-all leading-relaxed font-semibold">
                  {psExplorerSelectCmd}
                </div>
              </div>

              {/* Cmd 2: PowerShell Get-Item check */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="font-sans">Query File Properties (PowerShell)</span>
                  <button
                    onClick={() => triggerCopy(psGetItemCmd, 'psitem')}
                    className="text-[10px] text-indigo-700 hover:text-indigo-850 font-mono font-semibold flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200/50"
                  >
                    {copiedKey === 'psitem' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'psitem' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[10px] text-slate-700 break-all leading-relaxed font-semibold">
                  {psGetItemCmd}
                </div>
              </div>

              {/* Cmd 3: cd Parent Directory */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="font-sans">CD into Parent Folder (Terminal)</span>
                  <button
                    onClick={() => triggerCopy(psCdCmd, 'pscd')}
                    className="text-[10px] text-indigo-700 hover:text-indigo-850 font-mono font-semibold flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200/50"
                  >
                    {copiedKey === 'pscd' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'pscd' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[10px] text-slate-700 break-all leading-relaxed font-semibold">
                  {psCdCmd}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Panel Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center gap-2">
          <button
            onClick={() => triggerCopy(file.FullName, 'fullname-footer')}
            className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold tracking-wide shadow-xs shadow-indigo-600/10 cursor-pointer transition-colors text-center"
          >
            Copy Full Absolute Path
          </button>
        </div>
      </div>
    </div>
  );
}
