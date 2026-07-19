import React from 'react';
import { FileItem, Drive, Tag, VirtualCollection, FileTagRelation } from '../types';
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
  FolderHeart,
  Tags,
  Plus,
  Minus
} from 'lucide-react';

interface FileDetailModalProps {
  file: FileItem | null;
  drives: Drive[];
  onClose: () => void;
  collections: VirtualCollection[];
  setCollections: React.Dispatch<React.SetStateAction<VirtualCollection[]>>;
  tags: Tag[];
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>;
  fileTags: FileTagRelation[];
  setFileTags: React.Dispatch<React.SetStateAction<FileTagRelation[]>>;
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

export default function FileDetailModal({ 
  file, 
  drives, 
  onClose,
  collections,
  setCollections,
  tags,
  setTags,
  fileTags,
  setFileTags
}: FileDetailModalProps) {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [newTagNameLocal, setNewTagNameLocal] = React.useState('');
  const [isAddingNewTag, setIsAddingNewTag] = React.useState(false);

  if (!file) return null;

  const currentDriveId = file.DriveId || '';

  // Find associated drive
  const associatedDrive = drives.find(d => d.id === currentDriveId);

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

  // Toggle file's inclusion in a virtual collection
  const handleToggleCollection = (collId: string) => {
    setCollections(prev => prev.map(c => {
      if (c.id === collId) {
        const isAlreadyIn = c.files.some(f => f.driveId === currentDriveId && f.fullName === file.FullName);
        if (isAlreadyIn) {
          return {
            ...c,
            files: c.files.filter(f => !(f.driveId === currentDriveId && f.fullName === file.FullName))
          };
        } else {
          return {
            ...c,
            files: [...c.files, { driveId: currentDriveId, fullName: file.FullName }]
          };
        }
      }
      return c;
    }));
  };

  // Toggle file tag relation
  const isTagged = (tagId: string) => {
    return fileTags.some(ft => ft.driveId === currentDriveId && ft.fullName === file.FullName && ft.tagId === tagId);
  };

  const handleToggleTag = (tagId: string) => {
    const exists = isTagged(tagId);
    if (exists) {
      setFileTags(prev => prev.filter(ft => !(ft.driveId === currentDriveId && ft.fullName === file.FullName && ft.tagId === tagId)));
    } else {
      setFileTags(prev => [...prev, { driveId: currentDriveId, fullName: file.FullName, tagId }]);
    }
  };

  // Fast inline tag creator
  const handleCreateTagInline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagNameLocal.trim()) return;

    // Check duplicate
    const existing = tags.find(t => t.name.toLowerCase() === newTagNameLocal.trim().toLowerCase());
    let targetTagId = '';

    if (existing) {
      targetTagId = existing.id;
    } else {
      const colors = [
        'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
        'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
        'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
        'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
        'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100',
        'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
        'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
        'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100'
      ];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const newTag: Tag = {
        id: `tag_${Date.now()}`,
        name: newTagNameLocal.trim(),
        color: randomColor
      };
      setTags(prev => [...prev, newTag]);
      targetTagId = newTag.id;
    }

    // Attach to file
    setFileTags(prev => {
      const exists = prev.some(ft => ft.driveId === currentDriveId && ft.fullName === file.FullName && ft.tagId === targetTagId);
      if (exists) return prev;
      return [...prev, { driveId: currentDriveId, fullName: file.FullName, tagId: targetTagId }];
    });

    setNewTagNameLocal('');
    setIsAddingNewTag(false);
  };

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

          {/* ==========================================
              VIRTUAL COLLECTIONS ASSIGNMENT
              ========================================== */}
          <div className="space-y-3 p-4 bg-indigo-50/20 border border-indigo-100 rounded-2xl">
            <h5 className="text-[11px] font-mono uppercase tracking-widest text-indigo-600 font-bold flex items-center gap-1.5">
              <FolderHeart className="w-3.5 h-3.5 text-indigo-500" />
              <span>Virtual Collections</span>
            </h5>
            
            {collections.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic font-medium leading-relaxed">
                No virtual collections created. You can create logical collections under the "Virtual Collections" tab in the sidebar navigation.
              </p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-500 font-sans font-medium mb-1">
                  Assign this file mapping to one or more physical storage groupings:
                </p>
                <div className="max-h-28 overflow-y-auto space-y-1 pr-1" id="modal-collections-toggle-list">
                  {collections.map(c => {
                    const isIn = c.files.some(f => f.driveId === currentDriveId && f.fullName === file.FullName);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleToggleCollection(c.id)}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-left text-xs font-sans font-bold flex items-center justify-between transition-all cursor-pointer ${
                          isIn
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
                        }`}
                      >
                        <span className="truncate">{c.name}</span>
                        {isIn ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5 opacity-50" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ==========================================
              CUSTOM TAG LABELS TOGGLER
              ========================================== */}
          <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="flex items-center justify-between">
              <h5 className="text-[11px] font-mono uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1.5">
                <Tags className="w-3.5 h-3.5 text-slate-400" />
                <span>Custom Labels & Tags</span>
              </h5>
              
              {!isAddingNewTag && (
                <button
                  onClick={() => setIsAddingNewTag(true)}
                  className="text-[10px] text-indigo-600 hover:text-indigo-850 font-bold flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>New Tag</span>
                </button>
              )}
            </div>

            {/* Inline tag creator form */}
            {isAddingNewTag && (
              <form onSubmit={handleCreateTagInline} className="flex gap-1.5 items-center bg-white p-1 rounded-lg border border-slate-200 shadow-xs">
                <input
                  type="text"
                  placeholder="Tag label..."
                  value={newTagNameLocal}
                  onChange={(e) => setNewTagNameLocal(e.target.value)}
                  required
                  className="flex-1 px-2 py-1 text-xs font-sans text-slate-700 bg-transparent focus:outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingNewTag(false)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            )}

            {tags.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic font-medium leading-relaxed">
                No custom tags registered. Click "New Tag" above to create custom metadata flags.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5" id="modal-tags-bubble-selector">
                {tags.map(t => {
                  const active = isTagged(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleToggleTag(t.id)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                        active 
                          ? `${t.color} scale-105 shadow-xs border-slate-400 ring-1 ring-slate-250`
                          : 'bg-white text-slate-400 border-slate-200 hover:text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>{t.name}</span>
                      {active && <Check className="w-2.5 h-2.5" />}
                    </button>
                  );
                })}
              </div>
            )}
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
