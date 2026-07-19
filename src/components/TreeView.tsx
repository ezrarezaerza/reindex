import React from 'react';
import { FileNode } from '../types';
import { formatBytes } from '../utils/treeBuilder';
import { 
  Folder, 
  FolderOpen, 
  File, 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  Video, 
  Music, 
  Image as ImageIcon, 
  FileArchive, 
  Code2, 
  Info,
  Layers,
  HelpCircle
} from 'lucide-react';

interface TreeViewProps {
  nodes: FileNode[];
  onSelectFile: (fullName: string) => void;
  searchQuery: string;
}

// Map file extensions to matching Icons and Color classes
const getFileIconAndColor = (extension?: string) => {
  if (!extension) return { Icon: File, color: 'text-slate-400' };
  const ext = extension.toLowerCase();
  
  if (['.mp4', '.mkv', '.mov', '.avi', '.wmv'].includes(ext)) {
    return { Icon: Video, color: 'text-rose-600' };
  }
  if (['.mp3', '.flac', '.wav', '.m4a', '.ogg'].includes(ext)) {
    return { Icon: Music, color: 'text-emerald-600' };
  }
  if (['.jpg', '.jpeg', '.png', '.gif', '.cr2', '.nef', '.psd', '.tiff', '.jpg'].includes(ext)) {
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
  
  return { Icon: File, color: 'text-slate-400' };
};

export default function TreeView({ nodes, onSelectFile, searchQuery }: TreeViewProps) {
  // We maintain expanded state in a dictionary map mapping node fullNames to boolean expanded state.
  const [expandedPaths, setExpandedPaths] = React.useState<{ [key: string]: boolean }>({});

  const toggleExpand = (fullName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPaths(prev => ({
      ...prev,
      [fullName]: !prev[fullName]
    }));
  };

  const handleExpandAll = () => {
    const newExpanded: { [key: string]: boolean } = {};
    const recurse = (list: FileNode[]) => {
      for (const node of list) {
        if (node.type === 'folder') {
          newExpanded[node.fullName] = true;
          if (node.children) recurse(node.children);
        }
      }
    };
    recurse(nodes);
    setExpandedPaths(newExpanded);
  };

  const handleCollapseAll = () => {
    setExpandedPaths({});
  };

  // Helper to highlight matched query letters in node name
  const renderHighlightedName = (name: string, query: string) => {
    if (!query.trim()) return <span>{name}</span>;
    const cleanQuery = query.toLowerCase().trim();
    const index = name.toLowerCase().indexOf(cleanQuery);
    if (index === -1) return <span>{name}</span>;

    const before = name.substring(0, index);
    const match = name.substring(index, index + cleanQuery.length);
    const after = name.substring(index + cleanQuery.length);

    return (
      <span className="font-semibold text-slate-800">
        {before}
        <mark className="bg-yellow-100 text-yellow-800 px-0.5 rounded border border-yellow-250">{match}</mark>
        {after}
      </span>
    );
  };

  // Single TreeNode Component (Recursive Rendering with Lazy Expand)
  const TreeNodeItem = ({ node, depth }: { node: FileNode; depth: number; key?: any }) => {
    const isFolder = node.type === 'folder';
    const isExpanded = !!expandedPaths[node.fullName];
    const hasChildren = isFolder && node.children && node.children.length > 0;
    
    // Icon configuration
    const { Icon, color } = isFolder 
      ? { Icon: isExpanded ? FolderOpen : Folder, color: 'text-amber-500' }
      : getFileIconAndColor(node.extension);

    // Dynamic padding indent based on depth
    const indentStyle = { paddingLeft: `${depth * 16 + 12}px` };

    const childCount = isFolder && node.children ? node.children.length : 0;

    return (
      <div className="w-full flex flex-col font-sans" id={`tree-node-${encodeURIComponent(node.fullName)}`}>
        {/* Node Label Row */}
        <div
          onClick={(e) => {
            if (isFolder) {
              toggleExpand(node.fullName, e);
            } else {
              onSelectFile(node.fullName);
            }
          }}
          style={indentStyle}
          className={`group flex items-center justify-between py-2 pr-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer select-none transition-colors ${
            isFolder ? 'text-slate-800' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Folder Toggle Arrow */}
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              {isFolder ? (
                hasChildren ? (
                  isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                  )
                ) : null
              ) : (
                <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
              )}
            </div>

            {/* Icon */}
            <Icon className={`w-4.5 h-4.5 shrink-0 ${color}`} />

            {/* Name */}
            <span className="text-xs truncate py-0.5 font-medium">
              {renderHighlightedName(node.name, searchQuery)}
            </span>

            {/* Folder children statistics preview */}
            {isFolder && (
              <span className="text-[10px] font-mono text-slate-400 shrink-0 font-semibold">
                ({childCount} {childCount === 1 ? 'item' : 'items'})
              </span>
            )}
          </div>

          {/* Size & Info Trigger */}
          <div className="flex items-center gap-3 shrink-0 ml-4 font-mono text-[11px] text-slate-400 font-semibold">
            <span>{formatBytes(node.size, 1)}</span>
            
            {/* Quick action button for files */}
            {!isFolder && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectFile(node.fullName);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded transition-all"
                title="Inspect file"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Children Render Block (Lazy loading: only render when expanded!) */}
        {isFolder && isExpanded && hasChildren && (
          <div className="flex flex-col" id={`children-of-${encodeURIComponent(node.fullName)}`}>
            {node.children!.map((childNode, index) => (
              <TreeNodeItem key={index} node={childNode} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white" id="tree-view-wrapper">
      {/* Tree toolbar action line */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50 shrink-0" id="tree-toolbar">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500 font-semibold">
          <Layers className="w-3.5 h-3.5 text-indigo-600" />
          <span>Interactive Folder Tree Map</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExpandAll}
            className="px-2.5 py-1 text-[10px] font-sans font-semibold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded transition-colors shadow-xs cursor-pointer"
          >
            Expand All
          </button>
          <button
            onClick={handleCollapseAll}
            className="px-2.5 py-1 text-[10px] font-sans font-semibold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded transition-colors shadow-xs cursor-pointer"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Tree Content list container */}
      <div className="flex-1 overflow-y-auto" id="tree-nodes-container">
        {nodes.length === 0 ? (
          <div className="p-10 flex flex-col items-center justify-center text-center space-y-3" id="tree-empty-state">
            <HelpCircle className="w-10 h-10 text-slate-300 animate-pulse" />
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-slate-500">No folders match search filters</h3>
              <p className="text-xs text-slate-400 max-w-sm font-medium">
                Try widening your search text query, clearing active extension tags, or enabling other storage drives.
              </p>
            </div>
          </div>
        ) : (
          <div className="pb-8">
            {nodes.map((node, index) => (
              <TreeNodeItem key={index} node={node} depth={0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
