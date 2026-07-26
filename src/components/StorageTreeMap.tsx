import React from 'react';
import { FileNode } from '../types';
import { formatBytes } from '../utils/treeBuilder';
import { 
  Folder, 
  File, 
  ChevronRight, 
  ArrowLeft, 
  Layers, 
  FolderOpen, 
  Sparkles, 
  Info,
  Maximize2,
  HardDrive
} from 'lucide-react';

interface StorageTreeMapProps {
  nodes: FileNode[];
  onSelectFile: (fullName: string) => void;
}

interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
  node: FileNode;
  color: string;
}

// WinDirStat / DaisyDisk File Categories & Extension Groups
const EXTENSION_CATEGORIES = [
  { name: 'Videos', extensions: ['.mp4', '.mkv', '.avi', '.mov', '.ts', '.wmv', '.m4v'], color: 'bg-rose-500/85', hoverColor: 'hover:bg-rose-500', labelColor: 'text-rose-100', dotColor: 'bg-rose-500' },
  { name: 'Audio', extensions: ['.mp3', '.flac', '.wav', '.aac', '.m4a', '.ogg', '.wma'], color: 'bg-emerald-500/85', hoverColor: 'hover:bg-emerald-500', labelColor: 'text-emerald-100', dotColor: 'bg-emerald-500' },
  { name: 'Documents', extensions: ['.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.csv', '.rtf', '.md'], color: 'bg-amber-500/85', hoverColor: 'hover:bg-amber-500', labelColor: 'text-amber-100', dotColor: 'bg-amber-500' },
  { name: 'Images', extensions: ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.tiff', '.ico'], color: 'bg-fuchsia-500/85', hoverColor: 'hover:bg-fuchsia-500', labelColor: 'text-fuchsia-100', dotColor: 'bg-fuchsia-500' },
  { name: 'Archives', extensions: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.iso', '.dmg'], color: 'bg-sky-500/85', hoverColor: 'hover:bg-sky-500', labelColor: 'text-sky-100', dotColor: 'bg-sky-500' },
  { name: 'Code & Data', extensions: ['.json', '.js', '.ts', '.py', '.html', '.css', '.xml', '.sql', '.sh', '.bat', '.ps1'], color: 'bg-indigo-500/85', hoverColor: 'hover:bg-indigo-500', labelColor: 'text-indigo-100', dotColor: 'bg-indigo-500' },
  { name: 'Other', extensions: [], color: 'bg-slate-400/85', hoverColor: 'hover:bg-slate-400', labelColor: 'text-slate-100', dotColor: 'bg-slate-400' }
];

function getFileColor(node: FileNode): string {
  if (node.type === 'folder') {
    return 'bg-slate-700/20 border-slate-600/30 text-slate-300';
  }
  const ext = (node.extension || '').toLowerCase().trim();
  const category = EXTENSION_CATEGORIES.find(cat => cat.extensions.includes(ext));
  if (category) {
    return `${category.color} ${category.hoverColor} border-slate-900/40 ${category.labelColor}`;
  }
  return 'bg-slate-500/80 hover:bg-slate-500 border-slate-900/40 text-slate-100';
}

function getCategoryName(node: FileNode): string {
  if (node.type === 'folder') return 'Folder';
  const ext = (node.extension || '').toLowerCase().trim();
  const category = EXTENSION_CATEGORIES.find(cat => cat.extensions.includes(ext));
  return category ? category.name : 'Other';
}

/**
 * Recursive Bisection TreeMap Layout Engine.
 * Perfectly divides available width/height proportional to file sizes.
 */
function layoutBisection(
  nodes: FileNode[],
  x: number,
  y: number,
  width: number,
  height: number,
  totalSize: number,
  rects: LayoutRect[] = []
): LayoutRect[] {
  if (nodes.length === 0) return rects;

  if (nodes.length === 1) {
    rects.push({
      x,
      y,
      width,
      height,
      node: nodes[0],
      color: getFileColor(nodes[0]),
    });
    return rects;
  }

  // Find partition point that splits sizes as evenly as possible
  let minDiff = Infinity;
  let splitIdx = 1;
  let runningSum = 0;
  for (let i = 0; i < nodes.length - 1; i++) {
    runningSum += nodes[i].size;
    const diff = Math.abs(totalSize - 2 * runningSum);
    if (diff < minDiff) {
      minDiff = diff;
      splitIdx = i + 1;
    }
  }

  const leftNodes = nodes.slice(0, splitIdx);
  const rightNodes = nodes.slice(splitIdx);

  const leftSize = leftNodes.reduce((acc, n) => acc + n.size, 0);
  const rightSize = totalSize - leftSize;

  // Safeguard division by zero or empty sizes
  if (leftSize === 0 || rightSize === 0) {
    const ratio = leftNodes.length / nodes.length;
    if (width > height) {
      const leftW = width * ratio;
      layoutBisection(leftNodes, x, y, leftW, height, leftSize, rects);
      layoutBisection(rightNodes, x + leftW, y, width - leftW, height, rightSize, rects);
    } else {
      const leftH = height * ratio;
      layoutBisection(leftNodes, x, y, width, leftH, leftSize, rects);
      layoutBisection(rightNodes, x, y + leftH, width, height - leftH, rightSize, rects);
    }
    return rects;
  }

  const ratio = leftSize / totalSize;

  if (width > height) {
    const leftW = width * ratio;
    layoutBisection(leftNodes, x, y, leftW, height, leftSize, rects);
    layoutBisection(rightNodes, x + leftW, y, width - leftW, height, rightSize, rects);
  } else {
    const leftH = height * ratio;
    layoutBisection(leftNodes, x, y, width, leftH, leftSize, rects);
    layoutBisection(rightNodes, x, y + leftH, width, height - leftH, rightSize, rects);
  }

  return rects;
}

export default function StorageTreeMap({ nodes, onSelectFile }: StorageTreeMapProps) {
  // Navigation stack state
  const [navigationStack, setNavigationStack] = React.useState<FileNode[]>([]);
  
  // Hovered item state for interactive tooltip
  const [hoveredRect, setHoveredRect] = React.useState<LayoutRect | null>(null);
  const [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0 });

  // Responsive canvas sizing
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 800, height: 480 });

  React.useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: Math.max(containerRef.current.clientWidth, 320),
          height: Math.max(containerRef.current.clientHeight, 360)
        });
      }
    };

    updateSize();
    
    // Resize observer for seamless responsiveness inside changing split views
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    
    window.addEventListener('resize', updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Determine active level nodes
  const activeDirectory = navigationStack[navigationStack.length - 1] || null;
  
  const activeNodes = React.useMemo(() => {
    if (activeDirectory) {
      return activeDirectory.children || [];
    }
    // If we're at Virtual Root, we might have multiple drives (or root level items)
    return nodes;
  }, [nodes, activeDirectory]);

  // Calculate total size of the current level
  const activeLevelTotalSize = React.useMemo(() => {
    return activeNodes.reduce((acc, node) => acc + node.size, 0);
  }, [activeNodes]);

  // Compute Layout Rectangles
  const layoutRectangles = React.useMemo(() => {
    if (activeNodes.length === 0 || activeLevelTotalSize === 0) return [];
    
    // Sort descending by size to place largest boxes in the top-left for aesthetic balance
    const sortedNodes = [...activeNodes].sort((a, b) => b.size - a.size);
    
    return layoutBisection(
      sortedNodes, 
      0, 
      0, 
      dimensions.width, 
      dimensions.height, 
      activeLevelTotalSize
    );
  }, [activeNodes, activeLevelTotalSize, dimensions]);

  // Calculate category breakdowns in current directory for DaisyDisk breakdown bar
  const categoryBreakdown = React.useMemo(() => {
    const spaceMap = new Map<string, number>();
    
    // Helper recursive function to tally sizes by extension in the active directory subtree
    const tallySizes = (n: FileNode) => {
      if (n.type === 'file') {
        const cat = getCategoryName(n);
        spaceMap.set(cat, (spaceMap.get(cat) || 0) + n.size);
      } else if (n.children) {
        n.children.forEach(tallySizes);
      }
    };

    activeNodes.forEach(tallySizes);

    let total = 0;
    const breakdown = EXTENSION_CATEGORIES.map(cat => {
      const size = spaceMap.get(cat.name) || 0;
      total += size;
      return {
        ...cat,
        size
      };
    }).filter(item => item.size > 0);

    // Any leftovers or directories themselves at this level that we want to balance out
    const foldersSize = activeNodes
      .filter(n => n.type === 'folder')
      .reduce((acc, n) => acc + n.size, 0);

    if (foldersSize > 0 && breakdown.length === 0) {
      breakdown.push({
        name: 'Folders',
        extensions: [],
        color: 'bg-slate-600/35',
        hoverColor: 'hover:bg-slate-600',
        labelColor: 'text-slate-200',
        dotColor: 'bg-slate-400',
        size: foldersSize
      });
      total += foldersSize;
    }

    return {
      items: breakdown.sort((a, b) => b.size - a.size),
      total: total || activeLevelTotalSize || 1
    };
  }, [activeNodes, activeLevelTotalSize]);

  // Navigation handlers
  const handleDrillDown = (node: FileNode) => {
    if (node.type === 'folder' && node.children && node.children.length > 0) {
      setNavigationStack(prev => [...prev, node]);
      setHoveredRect(null);
    } else if (node.type === 'file') {
      onSelectFile(node.fullName);
    }
  };

  const handleNavigateUp = () => {
    setNavigationStack(prev => prev.slice(0, -1));
    setHoveredRect(null);
  };

  const handleNavigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      setNavigationStack([]);
    } else {
      setNavigationStack(prev => prev.slice(0, index + 1));
    }
    setHoveredRect(null);
  };

  // Tooltip tracking
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>, rect: LayoutRect) => {
    if (!containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - bounds.left + 16,
      y: e.clientY - bounds.top + 16
    });
    setHoveredRect(rect);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100 font-sans" id="storage-treemap-view">
      {/* 1. Header Toolbar & Breadcrumbs */}
      <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between shrink-0" id="treemap-toolbar">
        {/* Navigation Breadcrumbs trail */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs font-semibold" id="treemap-breadcrumbs">
          <button
            onClick={() => handleNavigateToBreadcrumb(-1)}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1 bg-slate-800/50 px-2 py-1 rounded"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Root Storage Map</span>
          </button>
          
          {navigationStack.map((node, idx) => (
            <React.Fragment key={idx}>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <button
                onClick={() => handleNavigateToBreadcrumb(idx)}
                className={`transition-colors cursor-pointer flex items-center gap-1 px-2 py-1 rounded ${
                  idx === navigationStack.length - 1
                    ? 'text-indigo-400 bg-indigo-500/10 font-bold'
                    : 'text-slate-400 hover:text-white bg-slate-800/50'
                }`}
              >
                {node.type === 'folder' ? <Folder className="w-3 h-3 text-amber-400 shrink-0" /> : <HardDrive className="w-3 h-3 text-indigo-400 shrink-0" />}
                <span className="truncate max-w-[140px]">{node.name}</span>
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Level Stats Summary */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          {navigationStack.length > 0 && (
            <button
              onClick={handleNavigateUp}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              id="treemap-back-btn"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back Up</span>
            </button>
          )}

          <div className="text-right text-xs">
            <p className="text-slate-400 font-medium">Viewing Directory Space</p>
            <p className="font-mono text-indigo-400 font-bold text-sm">
              {formatBytes(activeLevelTotalSize)}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Main Double Panel Work Area */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 relative" id="treemap-workspace">
        {/* LEFT PANEL: 2D Interactive Tree Map */}
        <div className="flex-1 relative min-h-[300px] lg:min-h-0 bg-slate-950 p-4 flex flex-col" id="treemap-visual-panel">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <h3 className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>WinDirStat 2D Allocation Grid</span>
            </h3>
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-indigo-500"></span> Double-Click Folders to zoom-in</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-rose-500"></span> Single-Click Files to Inspect</span>
            </div>
          </div>

          {/* Interactive Canvas Box */}
          <div 
            ref={containerRef}
            className="flex-1 relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden cursor-crosshair select-none"
            onMouseLeave={() => setHoveredRect(null)}
            id="treemap-interactive-canvas"
          >
            {layoutRectangles.map((rect, idx) => {
              const isFolder = rect.node.type === 'folder';
              const showText = rect.width > 75 && rect.height > 35;
              const isHovered = hoveredRect?.node.fullName === rect.node.fullName;

              return (
                <div
                  key={idx}
                  style={{
                    position: 'absolute',
                    left: `${rect.x}px`,
                    top: `${rect.y}px`,
                    width: `${Math.max(rect.width - 1.5, 1)}px`,
                    height: `${Math.max(rect.height - 1.5, 1)}px`,
                    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                  className={`border group cursor-pointer overflow-hidden p-1.5 rounded-xs flex flex-col justify-between ${rect.color} ${
                    isHovered 
                      ? 'ring-2 ring-white border-white scale-98 z-10 shadow-lg shadow-black/80' 
                      : 'border-black/35 hover:scale-97'
                  }`}
                  onMouseMove={(e) => handleMouseMove(e, rect)}
                  onClick={() => {
                    if (isFolder) {
                      // Prompt explore or zoom in
                      handleDrillDown(rect.node);
                    } else {
                      onSelectFile(rect.node.fullName);
                    }
                  }}
                  onDoubleClick={() => {
                    if (isFolder) {
                      handleDrillDown(rect.node);
                    }
                  }}
                >
                  {showText && (
                    <div className="flex flex-col h-full justify-between select-none pointer-events-none">
                      <div className="flex items-start justify-between">
                        <span className="text-[10px] font-bold tracking-tight truncate max-w-full drop-shadow-sm leading-tight text-white/95 uppercase">
                          {rect.node.name}
                        </span>
                        {isFolder && (
                          <FolderOpen className="w-3 h-3 text-amber-300/80 shrink-0 scale-90" />
                        )}
                      </div>
                      <span className="text-[9px] font-mono opacity-80 font-semibold drop-shadow-sm">
                        {formatBytes(rect.node.size, 1)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Float details HUD tooltip box */}
            {hoveredRect && (
              <div 
                style={{
                  position: 'absolute',
                  left: `${Math.min(tooltipPos.x, dimensions.width - 240)}px`,
                  top: `${Math.min(tooltipPos.y, dimensions.height - 130)}px`,
                  zIndex: 50
                }}
                className="bg-slate-900/95 backdrop-blur border border-slate-700/85 text-slate-100 rounded-xl p-3 shadow-xl pointer-events-none max-w-[240px] text-xs space-y-1.5 animate-in fade-in duration-100"
                id="treemap-hud-tooltip"
              >
                <div className="flex items-center gap-1.5 font-bold border-b border-slate-800 pb-1 text-indigo-300">
                  {hoveredRect.node.type === 'folder' ? (
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <File className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  )}
                  <span className="truncate">{hoveredRect.node.name}</span>
                </div>
                <div className="space-y-0.5 font-mono text-[10px] text-slate-300 leading-relaxed">
                  <p><span className="text-slate-500">Size:</span> <strong className="text-white">{formatBytes(hoveredRect.node.size)}</strong></p>
                  <p><span className="text-slate-500">Type:</span> <strong className="text-white capitalize">{hoveredRect.node.type} ({getCategoryName(hoveredRect.node)})</strong></p>
                  {hoveredRect.node.extension && (
                    <p><span className="text-slate-500">Ext:</span> <strong className="text-white">{hoveredRect.node.extension}</strong></p>
                  )}
                  <p className="truncate"><span className="text-slate-500">Path:</span> <span className="text-slate-400" title={hoveredRect.node.fullName}>{hoveredRect.node.fullName}</span></p>
                </div>
                <p className="text-[8px] text-slate-500 italic mt-1 pt-1 border-t border-slate-800 font-sans">
                  {hoveredRect.node.type === 'folder' ? 'Click folder to drill-down' : 'Click file to inspect metadata'}
                </p>
              </div>
            )}

            {/* Empty view state check */}
            {activeNodes.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center" id="treemap-empty-state">
                <Info className="w-10 h-10 text-slate-600 mb-2.5 animate-bounce" />
                <h4 className="text-sm font-bold text-slate-400">Empty visual directory</h4>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  This folder does not contain any sub-directories or files with measurable storage footprints.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Space Hog Listing & Extension Legends (DaisyDisk / WinDirStat Sidebar) */}
        <div className="w-full lg:w-85 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 p-5 flex flex-col min-h-0 overflow-y-auto shrink-0" id="treemap-sidebar-panel">
          
          {/* Section A: Category Legend breakdown bar */}
          <div className="mb-6 space-y-3 shrink-0" id="treemap-sidebar-legend">
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">Extension Allocation</h4>
            
            {/* Visual stacked legend bar */}
            <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden flex" id="treemap-stacked-bar">
              {categoryBreakdown.items.map((item, idx) => {
                const percent = (item.size / categoryBreakdown.total) * 100;
                return (
                  <div 
                    key={idx}
                    style={{ width: `${percent}%` }}
                    className={`${item.color} h-full`}
                    title={`${item.name}: ${formatBytes(item.size)} (${percent.toFixed(1)}%)`}
                  />
                );
              })}
            </div>

            {/* Legend List */}
            <div className="grid grid-cols-2 gap-2 text-[10px]" id="treemap-legend-list">
              {categoryBreakdown.items.map((item, idx) => {
                const percent = (item.size / categoryBreakdown.total) * 100;
                return (
                  <div key={idx} className="flex items-center gap-1.5 text-slate-300">
                    <span className={`w-2 h-2 rounded-full ${item.dotColor} shrink-0`} />
                    <span className="truncate max-w-[80px]" title={item.name}>{item.name}</span>
                    <span className="font-mono text-slate-500 font-medium font-semibold ml-auto">{percent.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section B: Space Hogs List */}
          <div className="flex-1 min-h-0 flex flex-col space-y-3" id="treemap-space-hogs">
            <div className="flex items-center justify-between shrink-0">
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">Directory Space Hogs</h4>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">Sorted by size</span>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[300px] lg:max-h-none" id="treemap-space-hogs-list">
              {[...activeNodes]
                .sort((a, b) => b.size - a.size)
                .map((node, idx) => {
                  const percent = activeLevelTotalSize > 0 ? (node.size / activeLevelTotalSize) * 100 : 0;
                  const isFolder = node.type === 'folder';

                  return (
                    <div 
                      key={idx}
                      onClick={() => handleDrillDown(node)}
                      className="p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-705 transition-all cursor-pointer flex flex-col gap-1.5 group select-none"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isFolder ? (
                            <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          ) : (
                            <File className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          )}
                          <span className="text-xs font-semibold text-slate-200 group-hover:text-white truncate" title={node.name}>
                            {node.name}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-slate-300 font-bold whitespace-nowrap shrink-0">
                          {formatBytes(node.size, 1)}
                        </span>
                      </div>

                      {/* Percent of parent bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[9px] text-slate-500">
                          <span>Footprint in level</span>
                          <span className="font-mono font-semibold">{percent.toFixed(1)}%</span>
                        </div>
                        <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            style={{ width: `${percent}%` }}
                            className={`h-full rounded-full ${
                              isFolder 
                                ? 'bg-amber-400/80 group-hover:bg-amber-400' 
                                : 'bg-indigo-500/80 group-hover:bg-indigo-500'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

              {activeNodes.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-500 font-mono">
                  No directory elements found
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
