import { FileItem, FileNode, SearchFiltersState } from '../types';

/**
 * Normalizes slash symbols to work with standard path operations.
 */
export function normalizePath(path: string): string {
  return path.replace(/\//g, '\\');
}

/**
 * Gets the parent path from a full path string (Windows styled).
 */
export function getParentPath(pathStr: string): string {
  const norm = normalizePath(pathStr);
  const lastSlash = norm.lastIndexOf('\\');
  if (lastSlash === -1) return '';
  
  // If parent is a drive letter root (e.g. "E:\")
  if (lastSlash === 2 && norm[1] === ':') {
    return norm.substring(0, 3); // Return "E:\"
  }
  
  // If it's already just "E:\", there is no parent
  if (norm.length <= 3 && norm[1] === ':') {
    return '';
  }
  
  return norm.substring(0, lastSlash);
}

/**
 * Gets the file or folder name from a full path.
 */
export function getBaseName(pathStr: string): string {
  const norm = normalizePath(pathStr);
  
  // If it's a drive letter (e.g. "E:\"), name should be "Drive E" or "E:\"
  if (norm.length <= 3 && norm[1] === ':') {
    return norm;
  }
  
  const lastSlash = norm.lastIndexOf('\\');
  if (lastSlash === -1) return norm;
  return norm.substring(lastSlash + 1) || norm;
}

/**
 * Builds a folder structure tree from flat files list.
 * Optimized for memory and fast lookups.
 */
export function buildTreeFromFiles(files: FileItem[], driveNamesMap?: Record<string, string>): FileNode[] {
  const roots: FileNode[] = [];
  const nodeMap = new Map<string, FileNode>();

  const getOrCreateFolder = (dirPath: string, parentPath: string, dirName: string, driveId?: string): FileNode => {
    const key = `${driveId || ''}::${dirPath.toLowerCase()}`;
    let node = nodeMap.get(key);
    
    if (!node) {
      // Human-friendly name for drive letters like "E:\"
      let friendlyName = dirName;
      if (dirName.endsWith(':\\') || dirName.endsWith(':')) {
        const customName = driveId && driveNamesMap?.[driveId];
        if (customName) {
          friendlyName = `${customName} (${dirName})`;
        } else {
          friendlyName = `Drive ${dirName.substring(0, 1).toUpperCase()}`;
        }
      }

      node = {
        name: friendlyName,
        fullName: dirPath,
        type: 'folder',
        size: 0,
        children: [],
        driveId
      };
      nodeMap.set(key, node);

      if (parentPath && parentPath !== dirPath) {
        const parentNode = getOrCreateFolder(parentPath, getParentPath(parentPath), getBaseName(parentPath), driveId);
        parentNode.children!.push(node);
      } else {
        roots.push(node);
      }
    }
    return node;
  };

  // Process all files
  for (const file of files) {
    const fileNormPath = normalizePath(file.FullName);
    const parentPath = getParentPath(fileNormPath);
    const driveId = file.DriveId;

    if (parentPath) {
      // Build folder hierarchy
      const pathParts: string[] = [];
      let current = parentPath;
      
      while (current) {
        pathParts.unshift(current);
        const nextParent = getParentPath(current);
        // Avoid infinite loop if we hit a wall (e.g. "E:\" parent is "E:\")
        if (nextParent === current || !nextParent || nextParent.length >= current.length) {
          if (nextParent && nextParent !== current) {
            pathParts.unshift(nextParent);
          }
          break;
        }
        current = nextParent;
      }

      let prevPart = '';
      for (const part of pathParts) {
        getOrCreateFolder(part, prevPart, getBaseName(part), driveId);
        prevPart = part;
      }

      // Add the file to its parent folder
      const parentNode = nodeMap.get(`${driveId || ''}::${parentPath.toLowerCase()}`);
      if (parentNode) {
        parentNode.children!.push({
          name: file.Name,
          fullName: fileNormPath,
          type: 'file',
          size: file.Length,
          extension: file.Extension,
          driveId
        });

        // Add size to parent and trace up
        let tracePath: string | null = parentPath;
        while (tracePath) {
          const pNode = nodeMap.get(`${driveId || ''}::${tracePath.toLowerCase()}`);
          if (pNode) {
            pNode.size += file.Length;
          }
          const nextParent = getParentPath(tracePath);
          if (nextParent === tracePath || !nextParent) break;
          tracePath = nextParent;
        }
      }
    } else {
      // It's a root level file
      roots.push({
        name: file.Name,
        fullName: fileNormPath,
        type: 'file',
        size: file.Length,
        extension: file.Extension,
        driveId
      });
    }
  }

  // Sort nodes helper: folders first, then files alphabetically
  const sortTreeNodes = (nodes: FileNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
    });
    for (const node of nodes) {
      if (node.children) {
        sortTreeNodes(node.children);
      }
    }
  };

  sortTreeNodes(roots);
  return roots;
}

/**
 * Filter tree: returns a new tree structure containing only the nodes matching the criteria,
 * maintaining folder hierarchy for any matching child node.
 */
export function filterTree(nodes: FileNode[], query: string, ext: string, minSize: number, maxSize: number): FileNode[] {
  const normalizedQuery = query.toLowerCase().trim();
  const normalizedExt = ext.toLowerCase().trim();

  const filterNode = (node: FileNode): FileNode | null => {
    // 1. If it's a file, test if it matches criteria
    if (node.type === 'file') {
      const nameMatch = normalizedQuery === '' || node.name.toLowerCase().includes(normalizedQuery) || node.fullName.toLowerCase().includes(normalizedQuery);
      const extMatch = normalizedExt === '' || node.extension?.toLowerCase() === normalizedExt;
      const minSizeMatch = minSize === 0 || node.size >= minSize;
      const maxSizeMatch = maxSize === -1 || node.size <= maxSize;

      if (nameMatch && extMatch && minSizeMatch && maxSizeMatch) {
        return { ...node };
      }
      return null;
    }

    // 2. If it's a folder, recursively filter children
    if (node.children) {
      const filteredChildren: FileNode[] = [];
      let totalSizeOfMatches = 0;
      
      for (const child of node.children) {
        const filteredChild = filterNode(child);
        if (filteredChild) {
          filteredChildren.push(filteredChild);
          totalSizeOfMatches += filteredChild.size;
        }
      }

      // If folder contains matching elements, keep it
      if (filteredChildren.length > 0) {
        let matchCount = 0;
        for (const child of filteredChildren) {
          if (child.type === 'file') {
            matchCount += 1;
          } else {
            matchCount += child.matchCount || 0;
          }
        }
        return {
          ...node,
          size: totalSizeOfMatches, // update directory size to represent matching contents
          children: filteredChildren,
          matchCount
        };
      }
    }

    return null;
  };

  const result: FileNode[] = [];
  for (const node of nodes) {
    const filtered = filterNode(node);
    if (filtered) {
      result.push(filtered);
    }
  }
  return result;
}

/**
 * Highly optimized search filter for flat list representation.
 * Supports quick searching of 100,000+ files.
 */
export function filterFlatFiles(
  files: FileItem[],
  filters: SearchFiltersState,
  activeDriveId: string | null
): FileItem[] {
  const { query, extension, minSize, maxSize, sortBy } = filters;
  const normalizedQuery = query.toLowerCase().trim();
  const normalizedExt = extension.toLowerCase().trim();

  // Filter
  let result = files.filter(file => {
    // Drive filter
    if (activeDriveId && file.DriveId !== activeDriveId) {
      return false;
    }

    // Text search (matches Name or FullName)
    if (normalizedQuery !== '') {
      if (!file.Name.toLowerCase().includes(normalizedQuery) && !file.FullName.toLowerCase().includes(normalizedQuery)) {
        return false;
      }
    }

    // Extension filter
    if (normalizedExt !== '') {
      if (file.Extension.toLowerCase() !== normalizedExt) {
        return false;
      }
    }

    // Size filter
    if (minSize > 0 && file.Length < minSize) return false;
    if (maxSize > -1 && file.Length > maxSize) return false;

    return true;
  });

  // Sort
  if (sortBy === 'name-asc') {
    result.sort((a, b) => a.Name.localeCompare(b.Name, undefined, { numeric: true, sensitivity: 'base' }));
  } else if (sortBy === 'name-desc') {
    result.sort((a, b) => b.Name.localeCompare(a.Name, undefined, { numeric: true, sensitivity: 'base' }));
  } else if (sortBy === 'size-asc') {
    result.sort((a, b) => a.Length - b.Length);
  } else if (sortBy === 'size-desc') {
    result.sort((a, b) => b.Length - a.Length);
  } else if (sortBy === 'path-asc') {
    result.sort((a, b) => a.FullName.localeCompare(b.FullName));
  }

  return result;
}

/**
 * Format bytes into human-readable strings (e.g. GB, TB, MB).
 */
export function formatBytes(bytes: number | string | null | undefined, decimals: number = 2): string {
  if (bytes === null || bytes === undefined) return '0 Bytes';
  const parsedBytes = typeof bytes === 'string' ? parseFloat(bytes) : bytes;
  if (isNaN(parsedBytes) || !isFinite(parsedBytes)) {
    return '0 Bytes';
  }
  if (parsedBytes <= 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(parsedBytes) / Math.log(k));

  if (i < 0 || i >= sizes.length || isNaN(i)) {
    return parsedBytes.toFixed(dm) + ' Bytes';
  }

  return parseFloat((parsedBytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
