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
  Check
} from 'lucide-react';

interface ImportModalProps {
  onClose: () => void;
  onImport: (drive: Omit<Drive, 'fileCount' | 'totalSize' | 'lastUpdated'>) => void;
}

export default function ImportModal({ onClose, onImport }: ImportModalProps) {
  // Form State
  const [name, setName] = React.useState('');
  const [letter, setLetter] = React.useState('D');
  const [icon, setIcon] = React.useState<Drive['icon']>('hard-drive');
  const [color, setColor] = React.useState('emerald');
  const [description, setDescription] = React.useState('');
  
  // JSON input sources
  const [jsonPaste, setJsonPaste] = React.useState('');
  const [importedItems, setImportedItems] = React.useState<FileItem[]>([]);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [successCount, setSuccessCount] = React.useState<number | null>(null);

  const [copiedScript, setCopiedScript] = React.useState(false);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (importedItems.length === 0) {
      setValidationError('Please validate a valid JSON catalog before importing.');
      return;
    }
    if (!name.trim()) {
      setValidationError('Please provide a descriptive name for this drive catalog.');
      return;
    }

    // Assign internal drive IDs to each item
    const driveId = `drive-user-${Date.now()}`;
    const finalizedItems = importedItems.map(item => ({
      ...item,
      DriveId: driveId
    }));

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
  };

  // Color config buttons
  const colors = ['emerald', 'blue', 'violet', 'rose', 'amber'];
  const colorLabels: { [key: string]: string } = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    violet: 'bg-violet-500',
    rose: 'bg-rose-500',
    amber: 'bg-amber-500'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200" id="import-modal-overlay">
      {/* Light backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-slate-500/30 backdrop-blur-xs cursor-pointer"></div>

      {/* Dialog Frame */}
      <div 
        className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-200"
        id="import-modal-box"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <FileJson className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-bold text-slate-850 text-base">Import External Hard Drive Catalog</h3>
              <p className="text-[11px] text-slate-500">Add custom PowerShell outputs to your local index</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scroll Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
          
          {/* Section 1: PowerShell Instructions */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3.5" id="powershell-instructions">
            <h4 className="text-xs font-mono font-bold text-indigo-700 flex items-center gap-1.5 uppercase tracking-wide">
              <Terminal className="w-4 h-4" />
              <span>How to generate the JSON catalog?</span>
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              To catalog your external drive, open <strong>Windows PowerShell</strong> and run the command below. It scans your drive and exports a flat JSON containing filenames and metadata.
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 font-semibold">
                <span>Select Target Drive Letter: </span>
                <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-slate-200">
                  {['D', 'E', 'F', 'G', 'H', 'I'].map(char => (
                    <button
                      key={char}
                      onClick={() => setLetter(char)}
                      className={`w-5 h-5 text-[10px] font-bold rounded flex items-center justify-center transition-all ${
                        letter === char
                          ? 'bg-indigo-600 text-white shadow shadow-indigo-600/20 font-bold'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {char}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="relative">
                <div className="p-3 bg-white border border-slate-200 rounded-xl font-mono text-[10px] text-slate-600 leading-normal select-all whitespace-pre-wrap break-all pr-12 max-h-[100px] overflow-y-auto font-medium">
                  {powershellCommand}
                </div>
                <button
                  onClick={copyPowershell}
                  className="absolute top-2.5 right-2.5 p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg transition-all"
                  title="Copy PowerShell script snippet"
                >
                  {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <p className="text-[10px] italic text-slate-400 leading-relaxed font-medium">
              Note: -Recurse scans all subfolders. For massive drives (100k+ files), this might take a few minutes to finish.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5" id="import-form">
            
            {/* Step 2: Upload / Paste JSON */}
            <div className="space-y-2">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 block">
                Step 2: Upload or Paste Catalog JSON
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* File picker */}
                <div className="border border-dashed border-slate-200 hover:border-indigo-500 rounded-2xl p-5 flex flex-col items-center justify-center text-center transition-colors relative group bg-slate-50/50">
                  <Upload className="w-8 h-8 text-slate-400 group-hover:text-indigo-600 mb-2 transition-colors" />
                  <span className="text-xs text-slate-700 font-bold">Upload catalog .json file</span>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[180px] font-medium">Select drive_catalog.json file generated from PowerShell</p>
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
                    className="w-full h-32 p-3 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-2xl text-xs text-slate-750 placeholder-slate-400 focus:outline-none font-mono resize-none shadow-inner"
                  ></textarea>
                </div>
              </div>

              {/* Status and valid errors */}
              {validationError && (
                <div className="p-3.5 bg-rose-50 border border-rose-250 text-rose-700 text-xs rounded-xl flex items-start gap-2 animate-in slide-in-from-top duration-150 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{validationError}</span>
                </div>
              )}

              {successCount !== null && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2 animate-in slide-in-from-top duration-150 font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>Successfully validated <strong className="font-mono">{successCount.toLocaleString()}</strong> file indices. Complete step 3 to add this storage catalog.</span>
                </div>
              )}
            </div>

            {/* Step 3: Drive properties config */}
            <div className="space-y-4 pt-2 border-t border-slate-200">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 block">
                Step 3: Drive Profile Customization
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Drive Name / Label */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-slate-500 font-bold">Drive Display Name</span>
                  <input
                    type="text"
                    placeholder="e.g. Work Backups HDD"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all font-sans"
                    required
                  />
                </div>

                {/* Theme colors */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-slate-500 font-bold">Styling Theme Accent</span>
                  <div className="flex items-center gap-2 h-9">
                    {colors.map(col => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setColor(col)}
                        className={`w-6 h-6 rounded-full transition-all flex items-center justify-center ${colorLabels[col]} ${
                          color === col
                            ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-white scale-110 shadow-md'
                            : 'hover:scale-105 opacity-60 hover:opacity-100'
                        }`}
                        title={`Accent Color ${col}`}
                      >
                        {color === col && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Icon option selection */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-slate-500 font-bold">Hardware Storage Icon</span>
                  <div className="flex items-center gap-2 bg-slate-55 p-1.5 rounded-xl border border-slate-200">
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
                          onClick={() => setIcon(opt.key as any)}
                          className={`flex-1 py-1 px-2 rounded-lg flex flex-col items-center gap-1 transition-all border ${
                            isSel
                              ? 'bg-white border-slate-250 text-indigo-600 shadow-xs font-semibold font-bold'
                              : 'border-transparent text-slate-400 hover:text-slate-650 hover:bg-slate-100'
                          }`}
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
                  <span className="text-[11px] text-slate-500 font-bold">Description Memo (Optional)</span>
                  <input
                    type="text"
                    placeholder="e.g. 2TB expansion disk containing legacy software"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all font-sans"
                  />
                </div>
              </div>
            </div>

            {/* Submission Actions Row */}
            <div className="p-4 bg-slate-55 border-t border-slate-200 rounded-b-2xl flex items-center justify-end gap-3 pt-4 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-850 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer shadow-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={importedItems.length === 0}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-250 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl tracking-wide transition-all shadow-xs cursor-pointer"
              >
                Assemble & Add to Index
              </button>
            </div>

          </form>

        </div>
      </div>
    </div>
  );
}
