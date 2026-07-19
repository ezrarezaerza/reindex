export interface FileItem {
  Name: string;
  FullName: string;
  Extension: string;
  Length: number;
  DriveId?: string; // Associated drive ID
}

export interface Drive {
  id: string;
  name: string;
  letter: string; // e.g. "E", "F", "G"
  color: string;  // Tailwind color class prefix (e.g. "emerald", "blue", "violet", "rose", "amber")
  icon: 'hard-drive' | 'database' | 'disc' | 'server' | 'archive';
  lastUpdated: string;
  fileCount: number;
  totalSize: number; // bytes
  items: FileItem[];
  description?: string;
}

export interface FileNode {
  name: string;
  fullName: string;
  type: 'file' | 'folder';
  size: number;
  extension?: string;
  children?: FileNode[];
  driveId?: string;
}

export interface SearchFiltersState {
  query: string;
  extension: string; // "" for all
  minSize: number; // in bytes, 0 for no limit
  maxSize: number; // in bytes, -1 for no limit
  sortBy: 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc' | 'path-asc';
}
