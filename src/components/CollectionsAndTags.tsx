import React from 'react';
import { Drive, FileItem, Tag, VirtualCollection, FileTagRelation } from '../types';
import { formatBytes } from '../utils/treeBuilder';
import { 
  FolderHeart, 
  Tags, 
  Plus, 
  Trash2, 
  FolderPlus, 
  ChevronRight, 
  Info, 
  File, 
  Server, 
  Tag as TagIcon,
  Sparkles,
  Calendar,
  Layers,
  X,
  FileText,
  Video,
  Music,
  Image as ImageIcon,
  FileArchive,
  Code2,
  ListFilter
} from 'lucide-react';

interface CollectionsAndTagsProps {
  drives: Drive[];
  collections: VirtualCollection[];
  setCollections: React.Dispatch<React.SetStateAction<VirtualCollection[]>>;
  tags: Tag[];
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>;
  fileTags: FileTagRelation[];
  setFileTags: React.Dispatch<React.SetStateAction<FileTagRelation[]>>;
  onSelectFile: (fullName: string) => void;
}

const COLOR_PRESETS = [
  { name: 'Red', class: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100', dot: 'bg-rose-500' },
  { name: 'Orange', class: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100', dot: 'bg-orange-500' },
  { name: 'Amber', class: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100', dot: 'bg-amber-500' },
  { name: 'Green', class: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100', dot: 'bg-emerald-500' },
  { name: 'Blue', class: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100', dot: 'bg-sky-500' },
  { name: 'Indigo', class: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100', dot: 'bg-indigo-500' },
  { name: 'Purple', class: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100', dot: 'bg-purple-500' },
  { name: 'Pink', class: 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100', dot: 'bg-pink-500' },
];

const getFileIconAndColor = (extension?: string) => {
  if (!extension) return { Icon: File, color: 'text-slate-400' };
  const ext = extension.toLowerCase();
  if (['.mp4', '.mkv', '.mov', '.avi', '.wmv'].includes(ext)) return { Icon: Video, color: 'text-rose-600' };
  if (['.mp3', '.flac', '.wav', '.m4a', '.ogg'].includes(ext)) return { Icon: Music, color: 'text-emerald-600' };
  if (['.jpg', '.jpeg', '.png', '.gif', '.psd'].includes(ext)) return { Icon: ImageIcon, color: 'text-violet-600' };
  if (['.pdf', '.docx', '.xlsx', '.txt', '.csv'].includes(ext)) return { Icon: FileText, color: 'text-amber-600' };
  if (['.zip', '.rar', '.7z'].includes(ext)) return { Icon: FileArchive, color: 'text-blue-600' };
  if (['.js', '.ts', '.tsx', '.json', '.py', '.html'].includes(ext)) return { Icon: Code2, color: 'text-cyan-600' };
  return { Icon: File, color: 'text-slate-400' };
};

export default function CollectionsAndTags({
  drives,
  collections,
  setCollections,
  tags,
  setTags,
  fileTags,
  setFileTags,
  onSelectFile
}: CollectionsAndTagsProps) {
  
  // Tab navigation inside Collections page: 'collections' | 'tags'
  const [activeSubTab, setActiveSubTab] = React.useState<'collections' | 'tags'>('collections');
  
  // Selection pointers
  const [selectedCollectionId, setSelectedCollectionId] = React.useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = React.useState<string | null>(null);

  // New Collection Form state
  const [newCollName, setNewCollName] = React.useState('');
  const [newCollDesc, setNewCollDesc] = React.useState('');
  const [isCreatingColl, setIsCreatingColl] = React.useState(false);

  // New Tag Form state
  const [newTagName, setNewTagName] = React.useState('');
  const [newTagColor, setNewTagColor] = React.useState('bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100');
  const [isCreatingTag, setIsCreatingTag] = React.useState(false);

  // Non-blocking Deletion and Alert states
  const [deletingCollectionId, setDeletingCollectionId] = React.useState<string | null>(null);
  const [deletingTagId, setDeletingTagId] = React.useState<string | null>(null);
  const [tagError, setTagError] = React.useState<string | null>(null);

  // Filter drives map helper to resolve file details
  const resolveFileDetail = React.useCallback((driveId: string, fullName: string): FileItem & { found: boolean } => {
    const drive = drives.find(d => d.id === driveId);
    if (drive) {
      const foundItem = drive.items.find(f => f.FullName === fullName);
      if (foundItem) {
        return { ...foundItem, DriveId: driveId, found: true };
      }
    }
    // Safe placeholder fallback
    const name = fullName.split('\\').pop() || fullName;
    const extension = fullName.includes('.') ? '.' + fullName.split('.').pop() : '';
    return {
      Name: name,
      FullName: fullName,
      Extension: extension,
      Length: 0,
      DriveId: driveId,
      found: false
    };
  }, [drives]);

  // Handle creating new virtual collection
  const handleCreateCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollName.trim()) return;

    const newColl: VirtualCollection = {
      id: `coll_${Date.now()}`,
      name: newCollName.trim(),
      description: newCollDesc.trim() || undefined,
      createdAt: new Date().toLocaleDateString(),
      files: []
    };

    setCollections(prev => [...prev, newColl]);
    setSelectedCollectionId(newColl.id);
    setNewCollName('');
    setNewCollDesc('');
    setIsCreatingColl(false);
  };

  // Handle deleting a collection
  const handleDeleteCollection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingCollectionId(id);
  };

  // Handle removing a file from a collection
  const handleRemoveFileFromCollection = (collId: string, driveId: string, fullName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollections(prev => prev.map(c => {
      if (c.id === collId) {
        return {
          ...c,
          files: c.files.filter(f => !(f.driveId === driveId && f.fullName === fullName))
        };
      }
      return c;
    }));
  };

  // Handle creating new tag label
  const handleCreateTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    // Check duplicate
    if (tags.some(t => t.name.toLowerCase() === newTagName.trim().toLowerCase())) {
      setTagError('A tag with this name already exists.');
      return;
    }

    const newTag: Tag = {
      id: `tag_${Date.now()}`,
      name: newTagName.trim(),
      color: newTagColor
    };

    setTags(prev => [...prev, newTag]);
    setSelectedTagId(newTag.id);
    setNewTagName('');
    setIsCreatingTag(false);
    setTagError(null);
  };

  // Handle deleting a tag
  const handleDeleteTag = (tagId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingTagId(tagId);
  };

  // Handle un-tagging a specific file
  const handleRemoveTagFromFile = (driveId: string, fullName: string, tagId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFileTags(prev => prev.filter(ft => !(ft.driveId === driveId && ft.fullName === fullName && ft.tagId === tagId)));
  };

  // Resolve selected Collection object & its file list
  const selectedCollection = React.useMemo(() => {
    return collections.find(c => c.id === selectedCollectionId) || null;
  }, [collections, selectedCollectionId]);

  const collectionFilesResolved = React.useMemo(() => {
    if (!selectedCollection) return [];
    return selectedCollection.files.map(f => ({
      resolved: resolveFileDetail(f.driveId, f.fullName),
      raw: f
    }));
  }, [selectedCollection, resolveFileDetail]);

  // Resolve selected Tag object & list of tagged files
  const selectedTag = React.useMemo(() => {
    return tags.find(t => t.id === selectedTagId) || null;
  }, [tags, selectedTagId]);

  const taggedFilesResolved = React.useMemo(() => {
    if (!selectedTagId) return [];
    const relations = fileTags.filter(ft => ft.tagId === selectedTagId);
    return relations.map(r => ({
      resolved: resolveFileDetail(r.driveId, r.fullName),
      raw: r
    }));
  }, [selectedTagId, fileTags, resolveFileDetail]);

  // Default selection if none is picked
  React.useEffect(() => {
    if (activeSubTab === 'collections' && collections.length > 0 && !selectedCollectionId) {
      setSelectedCollectionId(collections[0].id);
    }
    if (activeSubTab === 'tags' && tags.length > 0 && !selectedTagId) {
      setSelectedTagId(tags[0].id);
    }
  }, [activeSubTab, collections, tags, selectedCollectionId, selectedTagId]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden" id="collections-tags-viewport">
      
      {/* Dynamic Tab Selector header */}
      <div className="px-6 py-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4" id="collections-tags-header">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
            <FolderHeart className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Virtual Storage Spaces</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Organize files across 8 hard drives in logical custom groups and color-coded labels.
            </p>
          </div>
        </div>

        {/* Tab slider */}
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200/40 dark:border-slate-800">
          <button
            onClick={() => setActiveSubTab('collections')}
            className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'collections'
                ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-sm border border-slate-200/50 dark:border-slate-800'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Virtual Collections ({collections.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('tags')}
            className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'tags'
                ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-sm border border-slate-200/50 dark:border-slate-800'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Tags className="w-3.5 h-3.5" />
            <span>Custom Label Tags ({tags.length})</span>
          </button>
        </div>
      </div>

      {/* Main Grid split */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 min-h-0" id="collections-tags-body">
        
        {/* Left Side Sidebar listing of categories */}
        <div className="md:col-span-1 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col min-h-0">
          
          {/* Header Action inside Left Column */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 shrink-0 flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              {activeSubTab === 'collections' ? 'My Collections' : 'My Color Labels'}
            </span>
            <button
              onClick={() => {
                if (activeSubTab === 'collections') {
                  setIsCreatingColl(true);
                } else {
                  setIsCreatingTag(true);
                }
              }}
              className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-150 dark:border-indigo-900/50 transition-colors flex items-center gap-1 cursor-pointer text-xs font-bold font-sans"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>

          {/* List Scroller */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {activeSubTab === 'collections' ? (
              /* ========================================================
                 COLLECTIONS SIDEBAR LIST
                 ======================================================== */
              <>
                {isCreatingColl && (
                  <form onSubmit={handleCreateCollection} className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-150 dark:border-indigo-900/50 rounded-xl space-y-2.5 animate-in slide-in-from-top duration-200">
                    <div>
                      <label className="text-[9px] font-bold text-indigo-700 dark:text-indigo-400 uppercase block mb-1">Collection Name</label>
                      <input
                        type="text"
                        placeholder="e.g., Summer Shoots"
                        value={newCollName}
                        onChange={(e) => setNewCollName(e.target.value)}
                        required
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-sans text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-indigo-700 dark:text-indigo-400 uppercase block mb-1">Short Description</label>
                      <textarea
                        placeholder="Purpose of this group..."
                        value={newCollDesc}
                        onChange={(e) => setNewCollDesc(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-sans text-slate-700 dark:text-slate-300 h-14 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsCreatingColl(false)}
                        className="px-2.5 py-1 text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] rounded-md font-bold cursor-pointer"
                      >
                        Create
                      </button>
                    </div>
                  </form>
                )}

                {collections.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 dark:text-slate-550 text-xs">
                    <FolderPlus className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <span>No collections created yet.</span>
                  </div>
                ) : (
                  collections.map(c => {
                    const isActive = selectedCollectionId === c.id;
                    
                    if (deletingCollectionId === c.id) {
                      return (
                        <div
                          key={c.id}
                          className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 flex flex-col gap-2 animate-in fade-in duration-150"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 font-sans leading-tight">Delete collection "{c.name}"?</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCollections(prev => prev.filter(item => item.id !== c.id));
                                if (selectedCollectionId === c.id) {
                                  setSelectedCollectionId(null);
                                }
                                setDeletingCollectionId(null);
                              }}
                              className="px-2.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded cursor-pointer transition-all shadow-xs"
                            >
                              Delete
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingCollectionId(null);
                              }}
                              className="px-2.5 py-0.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded border border-slate-200 dark:border-slate-800 cursor-pointer transition-all shadow-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCollectionId(c.id)}
                        className={`group p-3 rounded-xl border transition-all duration-150 flex items-center justify-between cursor-pointer ${
                          isActive
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/50 text-indigo-900 dark:text-indigo-200 shadow-xs'
                            : 'bg-transparent border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-950/60 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`p-1.5 rounded-lg ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-950 text-slate-400 dark:text-slate-500'}`}>
                            <FolderHeart className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold block truncate">{c.name}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{c.files.length} items</span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => handleDeleteCollection(c.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-450 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </>
            ) : (
              /* ========================================================
                 TAGS SIDEBAR LIST
                 ======================================================== */
              <>
                {isCreatingTag && (
                  <form onSubmit={handleCreateTag} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5 animate-in slide-in-from-top duration-200">
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Tag Label Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Tax-2025"
                        value={newTagName}
                        onChange={(e) => {
                          setNewTagName(e.target.value);
                          if (tagError) setTagError(null);
                        }}
                        required
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-sans text-slate-700 dark:text-slate-200 focus:outline-none"
                      />
                      {tagError && (
                        <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold mt-1 font-sans">{tagError}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1.5">Color Chip Profile</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {COLOR_PRESETS.map((color, cIdx) => (
                          <button
                            key={cIdx}
                            type="button"
                            onClick={() => setNewTagColor(color.class)}
                            className={`p-1.5 rounded border flex items-center justify-center text-[10px] transition-all cursor-pointer ${
                              newTagColor === color.class
                                ? 'border-slate-800 dark:border-slate-300 scale-105 shadow-xs'
                                : 'border-transparent'
                            } ${color.class}`}
                          >
                            <span className={`w-2 h-2 rounded-full ${color.dot}`}></span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsCreatingTag(false)}
                        className="px-2.5 py-1 text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] rounded-md font-bold cursor-pointer"
                      >
                        Add Tag
                      </button>
                    </div>
                  </form>
                )}

                {tags.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 dark:text-slate-550 text-xs">
                    <Tags className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <span>No tags created yet.</span>
                  </div>
                ) : (
                  tags.map(t => {
                    const isActive = selectedTagId === t.id;
                    const tagCount = fileTags.filter(ft => ft.tagId === t.id).length;

                    if (deletingTagId === t.id) {
                      return (
                        <div
                          key={t.id}
                          className="p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 flex flex-col gap-2 animate-in fade-in duration-150"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[11px] font-bold text-rose-600 dark:text-rose-450 font-sans leading-tight">Delete tag "{t.name}"?</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setTags(prev => prev.filter(item => item.id !== t.id));
                                setFileTags(prev => prev.filter(ft => ft.tagId !== t.id));
                                if (selectedTagId === t.id) {
                                  setSelectedTagId(null);
                                }
                                setDeletingTagId(null);
                              }}
                              className="px-2.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded cursor-pointer transition-all shadow-xs"
                            >
                              Delete
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingTagId(null);
                              }}
                              className="px-2.5 py-0.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded border border-slate-200 dark:border-slate-800 cursor-pointer transition-all shadow-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTagId(t.id)}
                        className={`group p-2.5 rounded-xl border transition-all duration-150 flex items-center justify-between cursor-pointer ${
                          isActive
                            ? 'bg-slate-150 dark:bg-slate-800/80 border-slate-250 dark:border-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                            : 'bg-transparent border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-950/40 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`px-2 py-0.5 rounded text-[10px] font-bold border dark:brightness-90 ${t.color}`}>
                            {t.name}
                          </div>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-medium">({tagCount})</span>
                        </div>

                        <button
                          onClick={(e) => handleDeleteTag(t.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-450 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Side Main Details Panel */}
        <div className="md:col-span-3 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950">
          {activeSubTab === 'collections' ? (
            /* ========================================================
               COLLECTION FILE DETAILS VIEWER
               ======================================================== */
            selectedCollection ? (
              <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950">
                {/* Title Card banner */}
                <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <FolderHeart className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{selectedCollection.name}</h3>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-sans">
                        {selectedCollection.description || 'No custom description provided.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 font-mono font-medium">
                      <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 px-2.5 py-1 rounded border border-slate-200/40 dark:border-slate-800">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        <span>Created: {selectedCollection.createdAt}</span>
                      </span>
                      <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 px-2.5 py-1 rounded border border-slate-200/40 dark:border-slate-800">
                        <Layers className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        <span>{selectedCollection.files.length} indices grouped</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Scroller list of files inside selected collection */}
                <div className="flex-1 overflow-y-auto p-6 min-h-0">
                  {collectionFilesResolved.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
                      <Info className="w-10 h-10 text-indigo-300 dark:text-indigo-800 mx-auto mb-3" />
                      <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">This Collection is empty</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                        Search for file items globally or inside a physical drive, click on the file's **"Inspect (Info)"** details icon, and select this collection to assign it here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {collectionFilesResolved.map(({ resolved, raw }, fIdx) => {
                        const { Icon, color } = getFileIconAndColor(resolved.Extension);
                        const associatedDrive = drives.find(d => d.id === raw.driveId);
                        
                        return (
                          <div 
                            key={fIdx}
                            onClick={() => onSelectFile(resolved.FullName)}
                            className="bg-white dark:bg-slate-900 hover:bg-slate-50/60 dark:hover:bg-slate-950/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-xs cursor-pointer flex items-center justify-between gap-4 transition-all hover:border-slate-300 dark:hover:border-slate-700"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shrink-0 mt-0.5 animate-pulse">
                                <Icon className={`w-5 h-5 ${color}`} />
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 break-all leading-snug hover:text-indigo-600 dark:hover:text-indigo-400">{resolved.Name}</span>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  {/* Partition tag */}
                                  {associatedDrive && (
                                    <span className="flex items-center gap-1 text-[9px] font-bold font-mono bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 px-1.5 py-0.2 rounded">
                                      <Server className="w-2.5 h-2.5 text-indigo-400 dark:text-indigo-500" />
                                      <span>{associatedDrive.letter}: ({associatedDrive.name})</span>
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-medium truncate max-w-xs sm:max-w-md">{resolved.FullName}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-950 border border-slate-200/30 dark:border-slate-800 px-2.5 py-1 rounded">
                                {resolved.Length > 0 ? formatBytes(resolved.Length) : 'Cached'}
                              </span>

                              <button
                                onClick={(e) => handleRemoveFileFromCollection(selectedCollection.id, raw.driveId, raw.fullName, e)}
                                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors cursor-pointer"
                                title="Remove file from virtual collection"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-slate-500">
                <FolderHeart className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-2" />
                <span className="font-semibold text-slate-600 dark:text-slate-300">Select a Collection</span>
                <p className="text-xs text-slate-400 dark:text-slate-400 mt-1 max-w-xs">Pick a collection from the left panel to browse its aggregated multi-drive file mapping.</p>
              </div>
            )
          ) : (
            /* ========================================================
               TAGS FILE DETAILS VIEWER
               ======================================================== */
            selectedTag ? (
              <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950">
                {/* Title Card banner */}
                <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <TagIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 text-xs font-bold border rounded-lg dark:brightness-90 ${selectedTag.color}`}>
                          {selectedTag.name}
                        </span>
                        <h3 className="text-sm font-semibold font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider">Active Label Filter</h3>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-sans">
                        Browse files from all drives containing the color label metadata tag.
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 px-3 py-1 rounded text-slate-600 dark:text-slate-400">
                    {taggedFilesResolved.length} labeled paths found
                  </span>
                </div>

                {/* Scroller list of files matching selected Tag */}
                <div className="flex-1 overflow-y-auto p-6 min-h-0">
                  {taggedFilesResolved.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
                      <Tags className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                      <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No files tagged as "{selectedTag.name}"</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                        To label files, select an external hard drive, inspect any file using the **"Inspect (Info)"** details icon, and assign the tag from the sidebar.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {taggedFilesResolved.map(({ resolved, raw }, fIdx) => {
                        const { Icon, color } = getFileIconAndColor(resolved.Extension);
                        const associatedDrive = drives.find(d => d.id === raw.driveId);
                        
                        return (
                          <div 
                            key={fIdx}
                            onClick={() => onSelectFile(resolved.FullName)}
                            className="bg-white dark:bg-slate-900 hover:bg-slate-50/60 dark:hover:bg-slate-950/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-xs cursor-pointer flex items-center justify-between gap-4 transition-all hover:border-slate-300 dark:hover:border-slate-700"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shrink-0 mt-0.5 animate-pulse">
                                <Icon className={`w-5 h-5 ${color}`} />
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 break-all leading-snug hover:text-indigo-600 dark:hover:text-indigo-400">{resolved.Name}</span>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  {/* Partition tag */}
                                  {associatedDrive && (
                                    <span className="flex items-center gap-1 text-[9px] font-bold font-mono bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 px-1.5 py-0.2 rounded">
                                      <Server className="w-2.5 h-2.5 text-indigo-400 dark:text-indigo-500" />
                                      <span>{associatedDrive.letter}: ({associatedDrive.name})</span>
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-medium truncate max-w-xs sm:max-w-md">{resolved.FullName}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-950 border border-slate-200/30 dark:border-slate-800 px-2.5 py-1 rounded">
                                {resolved.Length > 0 ? formatBytes(resolved.Length) : 'Cached'}
                              </span>

                              <button
                                onClick={(e) => handleRemoveTagFromFile(raw.driveId, raw.fullName, selectedTag.id, e)}
                                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-450 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors cursor-pointer"
                                title="Remove tag from file"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-slate-500">
                <TagIcon className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-2" />
                <span className="font-semibold text-slate-600 dark:text-slate-300">Select a Tag Filter</span>
                <p className="text-xs text-slate-400 dark:text-slate-450 mt-1 max-w-xs">Pick an active color tag from the left panel to display files across all backup arrays.</p>
              </div>
            )
          )}
        </div>

      </div>

    </div>
  );
}
