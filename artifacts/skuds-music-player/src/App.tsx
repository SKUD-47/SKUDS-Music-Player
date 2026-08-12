import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, Archive, ArrowLeft, ArrowRight, Check, ChevronRight, ChevronUp, CircleHelp, Disc3, Download, FileAudio, FolderOpen, Heart, Home as HomeIcon,
  Library, ListMusic, Menu, MoreHorizontal, Pause, Pencil, Play, Plus, Repeat, Repeat1, Search,
  Settings as SettingsIcon, Shuffle, SkipBack, SkipForward, Trash2, Upload, Volume2, VolumeX, X, Music2,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, useRoute } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  clearAllLocalData, clearPlaylists, clearSettings, clearSongs, deletePlaylist, deleteSong, getPlaylists,
  getSetting, getSongs, savePlaylist, saveSong, setSetting, type StoredPlaylist, type StoredSong,
} from '@/lib/local-library';

const queryClient = new QueryClient();
const ACCEPTED = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/x-flac', 'audio/webm'];
const EXTENSIONS = /\.(mp3|wav|m4a|aac|ogg|flac|webm)$/i;

type RepeatMode = 'off' | 'all' | 'one';
type Toast = { id: number; message: string; tone?: 'error' | 'success' };

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

function getFilenameMetadata(filename: string) {
  const clean = filename.replace(/\.[^/.]+$/, '').replace(/[_]+/g, ' ').trim();
  const parts = clean.split(/\s+-\s+/);
  return { title: parts.length > 1 ? parts.slice(1).join(' - ') : clean || 'Untitled track', artist: parts.length > 1 ? parts[0] : 'Unknown artist' };
}

function Artwork({ song, size = 'md' }: { song?: StoredSong; size?: 'sm' | 'md' | 'lg' | 'hero' }) {
  const initials = (song?.title ?? 'SKUDS').slice(0, 5).toUpperCase();
  return <div className={`artwork artwork-${size} rounded-xl shrink-0`} aria-label={`${song?.title ?? 'Skuds Music Player'} artwork`}><span>{initials}</span></div>;
}

function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-3">
    <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_8px_26px_hsl(var(--primary)/.18)]">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M6 17V5.5L17 3v11.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="5.5" cy="17" r="2.2" fill="currentColor"/><circle cx="16.5" cy="14.5" r="2.2" fill="currentColor"/>
        <path d="M6 8.5 17 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      </svg>
    </div>
    {!compact && <div><div className="font-display text-[15px] font-semibold leading-none tracking-tight">Skuds</div><div className="mt-1 text-[10px] uppercase tracking-[.22em] text-muted-foreground">Music Player</div></div>}
  </div>;
}

function IconButton({ label, children, onClick, active = false, className = '', disabled = false }: { label: string; children: ReactNode; onClick: () => void; active?: boolean; className?: string; disabled?: boolean }) {
  return <button type="button" aria-label={label} title={label} data-testid={`button-${label.toLowerCase().replaceAll(' ', '-')}`} onClick={onClick} disabled={disabled} className={`button-icon h-9 w-9 ${active ? 'bg-primary/15 text-primary' : ''} ${className}`}>{children}</button>;
}

function EmptyState({ title, description, onImport, icon: Icon = Music2 }: { title: string; description: string; onImport?: () => void; icon?: typeof Music2 }) {
  return <div className="surface-soft flex min-h-[330px] flex-col items-center justify-center rounded-2xl px-6 py-14 text-center">
    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><Icon size={28} strokeWidth={1.5}/></div>
    <h2 className="font-display text-xl font-semibold">{title}</h2>
    <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
    {onImport && <button type="button" data-testid="button-empty-import" onClick={onImport} className="button-primary mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"><Upload size={16}/> Import Music</button>}
  </div>;
}

function Dialog({ title, children, onClose, footer }: { title: string; children: ReactNode; onClose: () => void; footer: ReactNode }) {
  return <div className="dialog-backdrop fixed inset-0 z-[60] flex items-center justify-center p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="surface w-full max-w-md rounded-2xl p-5 sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex items-start justify-between gap-4"><div><div className="font-display text-lg font-semibold">{title}</div><div className="mt-1 h-px w-10 bg-primary"/></div><IconButton label="Close dialog" onClick={onClose}><X size={18}/></IconButton></div>
      <div className="py-5">{children}</div>
      <div className="flex justify-end gap-2">{footer}</div>
    </div>
  </div>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><div className="dark app-noise min-h-[100dvh]"><Router/><Toaster/></div></TooltipProvider></QueryClientProvider>;
}

function Router() {
  return <RoutedErrorBoundary><LibraryProvider><Switch>
    <Route path="/" component={HomePage}/>
    <Route path="/songs" component={SongsPage}/>
    <Route path="/favorites" component={FavoritesPage}/>
    <Route path="/playlists" component={PlaylistsPage}/>
    <Route path="/settings" component={SettingsPage}/>
    <Route path="/about" component={AboutPage}/>
    <Route component={NotFound}/>
  </Switch></LibraryProvider></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

type LibraryContextValue = {
  songs: StoredSong[]; playlists: StoredPlaylist[]; loading: boolean; storageError: string;
  currentId: string | null; isPlaying: boolean; progress: number; duration: number; volume: number;
  shuffle: boolean; repeat: RepeatMode; queue: string[]; showQueue: boolean; setShowQueue: (v: boolean) => void;
  importFiles: (files: FileList | File[]) => Promise<void>; openImport: () => void; openFolder: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>; folderInputRef: React.RefObject<HTMLInputElement | null>;
  playSong: (id: string, collection?: string[]) => void; togglePlay: () => void; next: () => void; previous: () => void;
  seek: (value: number) => void; setVolume: (value: number) => void; setShuffle: (v: boolean) => void; cycleRepeat: () => void;
  toggleFavorite: (id: string) => void; addQueue: (id: string) => void; removeQueue: (id: string) => void; clearQueue: () => void;
  updatePlaylist: (playlist: StoredPlaylist) => Promise<void>; createPlaylist: (name: string) => Promise<void>;
  removePlaylist: (id: string) => Promise<void>; removeSong: (id: string) => Promise<void>;
  toasts: Toast[]; dismissToast: (id: number) => void; toast: (message: string, tone?: Toast['tone']) => void;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

function LibraryProvider({ children }: { children: ReactNode }) {
  const [songs, setSongs] = useState<StoredSong[]>([]);
  const [playlists, setPlaylists] = useState<StoredPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState('');
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(.78);
  const [shuffle, setShuffleState] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [queue, setQueue] = useState<string[]>([]);
  const [sequence, setSequence] = useState<string[]>([]);
  const [showQueue, setShowQueue] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef('');
  const autoplayRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const current = songs.find((song) => song.id === currentId);

  const toast = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((items) => [...items, { id, message, tone }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 3600);
  }, []);

  useEffect(() => {
    document.title = 'Skuds Music Player';
    const audio = new Audio();
    audio.volume = volume;
    audioRef.current = audio;
    const onTime = () => { setProgress(audio.currentTime || 0); setDuration(Number.isFinite(audio.duration) ? audio.duration : 0); };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = () => { setIsPlaying(false); toast('This file could not be played by your browser.', 'error'); };
    const onEnded = () => nextRef.current();
    audio.addEventListener('timeupdate', onTime); audio.addEventListener('loadedmetadata', onTime);
    audio.addEventListener('play', onPlay); audio.addEventListener('pause', onPause); audio.addEventListener('error', onError); audio.addEventListener('ended', onEnded);
    Promise.all([getSongs(), getPlaylists(), getSetting('volume', .78), getSetting<string | null>('lastPlayed', null)]).then(([storedSongs, storedPlaylists, storedVolume, lastPlayed]) => {
      setSongs(storedSongs); setPlaylists(storedPlaylists); setVolumeState(storedVolume); audio.volume = storedVolume;
      if (lastPlayed && storedSongs.some((song) => song.id === lastPlayed)) { setCurrentId(lastPlayed); setSequence(storedSongs.map((song) => song.id)); }
      setLoading(false);
    }).catch(() => { setLoading(false); setStorageError('Your browser did not allow local library storage. You can still try a session import.'); });
    return () => { audio.pause(); audio.removeEventListener('timeupdate', onTime); audio.removeEventListener('loadedmetadata', onTime); audio.removeEventListener('play', onPlay); audio.removeEventListener('pause', onPause); audio.removeEventListener('error', onError); audio.removeEventListener('ended', onEnded); if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); };
  }, []);

  const nextRef = useRef<() => void>(() => undefined);
  const next = useCallback(() => {
    if (!songs.length) return;
    if (repeat === 'one' && currentId) { autoplayRef.current = true; setCurrentId(currentId); return; }
    let nextId = queue[0];
    if (nextId) setQueue((items) => items.slice(1));
    else {
      const source = sequence.length ? sequence : songs.map((song) => song.id);
      if (shuffle) {
        const options = source.filter((id) => id !== currentId);
        nextId = options[Math.floor(Math.random() * options.length)] ?? source[0];
      } else {
        const index = Math.max(0, source.indexOf(currentId ?? ''));
        nextId = source[index + 1];
        if (!nextId && repeat === 'all') nextId = source[0];
      }
    }
    if (nextId) { autoplayRef.current = true; setCurrentId(nextId); }
  }, [songs, queue, sequence, shuffle, repeat, currentId]);
  nextRef.current = next;

  const previous = useCallback(() => {
    if (audioRef.current && audioRef.current.currentTime > 4) { audioRef.current.currentTime = 0; return; }
    const source = sequence.length ? sequence : songs.map((song) => song.id);
    const index = source.indexOf(currentId ?? '');
    const previousId = source[index - 1] ?? (repeat === 'all' ? source[source.length - 1] : undefined);
    if (previousId) { autoplayRef.current = true; setCurrentId(previousId); }
    else if (audioRef.current) audioRef.current.currentTime = 0;
  }, [songs, sequence, currentId, repeat]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(current.blob);
    audio.src = objectUrlRef.current;
    audio.load();
    setProgress(0); setDuration(current.duration || 0);
    void setSetting('lastPlayed', current.id);
    if (autoplayRef.current) { void audio.play().catch(() => { toast('Playback needs a browser gesture. Press play to start.', 'error'); }); autoplayRef.current = false; }
  }, [currentId, toast]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (event.code === 'Space') { event.preventDefault(); togglePlayRef.current(); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); previousRef.current(); }
      if (event.key === 'ArrowRight') { event.preventDefault(); nextRef.current(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const togglePlayRef = useRef<() => void>(() => undefined);
  const previousRef = useRef<() => void>(() => undefined);

  const playSong = useCallback((id: string, collection?: string[]) => {
    if (currentId === id) { if (audioRef.current?.paused) void audioRef.current.play(); else audioRef.current?.pause(); return; }
    if (collection) setSequence(collection);
    else setSequence(songs.map((song) => song.id));
    autoplayRef.current = true; setCurrentId(id);
  }, [currentId, songs]);
  const togglePlay = useCallback(() => {
    if (!currentId && songs[0]) { playSong(songs[0].id, songs.map((song) => song.id)); return; }
    const audio = audioRef.current; if (!audio) return;
    if (audio.paused) void audio.play().catch(() => toast('Choose an imported track to begin playback.', 'error')); else audio.pause();
  }, [currentId, songs, playSong, toast]);
  togglePlayRef.current = togglePlay; previousRef.current = previous;
  const seek = useCallback((value: number) => { if (audioRef.current) { audioRef.current.currentTime = value; setProgress(value); } }, []);
  const setVolume = useCallback((value: number) => { setVolumeState(value); if (audioRef.current) audioRef.current.volume = value; void setSetting('volume', value); }, []);
  const setShuffle = useCallback((value: boolean) => setShuffleState(value), []);
  const cycleRepeat = useCallback(() => setRepeat((value) => value === 'off' ? 'all' : value === 'all' ? 'one' : 'off'), []);

  const importFiles = useCallback(async (input: FileList | File[]) => {
    const files = Array.from(input);
    if (!files.length) return;
    let added = 0; let duplicates = 0; let rejected = 0;
    const existingKeys = new Set(songs.map((song) => song.fileKey));
    for (const file of files) {
      if (!(ACCEPTED.includes(file.type) || EXTENSIONS.test(file.name))) { rejected++; continue; }
      const fileKey = `${file.name}|${file.size}|${file.lastModified}`;
      if (existingKeys.has(fileKey)) { duplicates++; continue; }
      const metadata = getFilenameMetadata(file.name);
      const id = `${fileKey}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
      let trackDuration = 0;
      try {
        const probeUrl = URL.createObjectURL(file);
        trackDuration = await new Promise<number>((resolve) => {
          const probe = document.createElement('audio');
          probe.preload = 'metadata'; probe.src = probeUrl;
          probe.onloadedmetadata = () => { URL.revokeObjectURL(probeUrl); resolve(Number.isFinite(probe.duration) ? probe.duration : 0); };
          probe.onerror = () => { URL.revokeObjectURL(probeUrl); resolve(0); };
        });
      } catch { /* metadata is optional */ }
      const song: StoredSong = { id, fileKey, name: file.name, title: metadata.title, artist: metadata.artist, album: 'Local file', duration: trackDuration, size: file.size, lastModified: file.lastModified, type: file.type, addedAt: Date.now() + added, favorite: false, blob: file };
      try { await saveSong(song); setSongs((items) => [song, ...items]); existingKeys.add(fileKey); added++; } catch { rejected++; }
    }
    if (added) toast(`${added} ${added === 1 ? 'track' : 'tracks'} added to your library.`);
    if (duplicates) toast(`${duplicates} duplicate ${duplicates === 1 ? 'file was' : 'files were'} skipped.`);
    if (rejected) toast(`${rejected} file${rejected === 1 ? '' : 's'} could not be imported.`, 'error');
  }, [songs, toast]);

  const toggleFavorite = useCallback((id: string) => {
    setSongs((items) => { const nextSongs = items.map((song) => song.id === id ? { ...song, favorite: !song.favorite } : song); const changed = nextSongs.find((song) => song.id === id); if (changed) void saveSong(changed); return nextSongs; });
  }, []);
  const addQueue = useCallback((id: string) => { setQueue((items) => items.includes(id) ? items : [...items, id]); toast('Added to the queue.'); }, [toast]);
  const removeQueue = useCallback((id: string) => setQueue((items) => items.filter((item) => item !== id)), []);
  const clearQueue = useCallback(() => setQueue([]), []);
  const updatePlaylist = useCallback(async (playlist: StoredPlaylist) => { await savePlaylist(playlist); setPlaylists((items) => items.map((item) => item.id === playlist.id ? playlist : item)); }, []);
  const createPlaylist = useCallback(async (name: string) => { const playlist = { id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2), name: name.trim(), songIds: [], createdAt: Date.now(), updatedAt: Date.now() }; await savePlaylist(playlist); setPlaylists((items) => [playlist, ...items]); toast(`Created “${playlist.name}”.`); }, [toast]);
  const removePlaylist = useCallback(async (id: string) => { await deletePlaylist(id); setPlaylists((items) => items.filter((item) => item.id !== id)); toast('Playlist deleted.'); }, [toast]);
  const removeSong = useCallback(async (id: string) => { await deleteSong(id); setSongs((items) => items.filter((item) => item.id !== id)); setQueue((items) => items.filter((item) => item !== id)); if (currentId === id) { audioRef.current?.pause(); setCurrentId(null); } toast('Track removed from your library.'); }, [currentId, toast]);
  const openImport = () => fileInputRef.current?.click();
  const openFolder = () => { const input = folderInputRef.current; if (!input) return; input.setAttribute('webkitdirectory', ''); input.setAttribute('directory', ''); input.click(); };

  const value: LibraryContextValue = { songs, playlists, loading, storageError, currentId, isPlaying, progress, duration, volume, shuffle, repeat, queue, showQueue, setShowQueue, importFiles, openImport, openFolder, fileInputRef, folderInputRef, playSong, togglePlay, next, previous, seek, setVolume, setShuffle, cycleRepeat, toggleFavorite, addQueue, removeQueue, clearQueue, updatePlaylist, createPlaylist, removePlaylist, removeSong, toasts, dismissToast: (id) => setToasts((items) => items.filter((item) => item.id !== id)), toast };
  return <LibraryContext.Provider value={value}>{children}<audio aria-hidden="true" className="hidden"/><AppToasts toasts={toasts} dismiss={value.dismissToast}/></LibraryContext.Provider>;
}

function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('LibraryProvider is missing.');
  return context;
}

function AppToasts({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return <div className="fixed bottom-24 right-4 z-[70] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 sm:right-6">{toasts.map((item) => <div key={item.id} className={`toast-in flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl ${item.tone === 'error' ? 'border-destructive/30 bg-destructive/10 text-red-100' : 'border-primary/25 bg-card text-foreground'}`}><div className={`flex h-6 w-6 items-center justify-center rounded-full ${item.tone === 'error' ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'}`}>{item.tone === 'error' ? <AlertCircle size={14}/> : <Check size={14}/>}</div><span className="flex-1">{item.message}</span><button type="button" onClick={() => dismiss(item.id)} aria-label="Dismiss notification"><X size={15}/></button></div>)}</div>;
}

function useLibraryContext() {
  return useLibrary();
}

function Shell({ children, title, eyebrow, onImport }: { children: ReactNode; title: string; eyebrow?: string; onImport?: () => void }) {
  const [location] = useLocation();
  const library = useLibraryContext();
  const [mobileMenu, setMobileMenu] = useState(false);
  const navItems = [{ href: '/', label: 'Home', icon: HomeIcon }, { href: '/songs', label: 'All Songs', icon: Library }, { href: '/favorites', label: 'Favorites', icon: Heart }, { href: '/playlists', label: 'Playlists', icon: ListMusic }];
  return <div className="min-h-[100dvh] bg-background text-foreground">
    <aside className="desktop-sidebar fixed inset-y-0 left-0 z-30 flex w-[248px] flex-col border-r border-sidebar-border bg-sidebar px-5 py-6">
      <Link href="/" className="mb-10 block"><Logo/></Link>
      <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.22em] text-muted-foreground">Your room</div>
      <nav className="space-y-1">{navItems.map(({ href, label, icon: NavIcon }) => <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${location === href ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><NavIcon size={18} strokeWidth={location === href ? 2.4 : 1.8}/><span>{label}</span>{label === 'Favorites' && library.songs.filter((song) => song.favorite).length > 0 && <span className="ml-auto text-xs text-muted-foreground">{library.songs.filter((song) => song.favorite).length}</span>}</Link>)}</nav>
      <div className="my-8 h-px bg-sidebar-border"/>
      <button type="button" onClick={() => onImport?.()} className="button-primary flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold"><Plus size={17}/> Import Music</button>
      <Link href="/playlists" className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><ListMusic size={17}/> New playlist</Link>
      <div className="mt-auto rounded-2xl border border-primary/15 bg-primary/[.045] p-4"><div className="flex items-center gap-2 text-xs font-semibold text-primary"><Archive size={14}/> Local-first</div><p className="mt-2 text-xs leading-5 text-muted-foreground">Your files stay in this browser. Nothing is uploaded.</p></div>
      <nav className="mt-5 flex items-center gap-1"><Link href="/settings" className="button-ghost flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-xs"><SettingsIcon size={15}/> Settings</Link><Link href="/about" className="button-ghost flex items-center rounded-lg p-2" aria-label="About"><CircleHelp size={16}/></Link></nav>
    </aside>
    <div className="md:ml-[248px]">
      <input ref={library.fileInputRef} type="file" accept={ACCEPTED.join(',')} multiple hidden onChange={(event) => { if (event.target.files) void library.importFiles(event.target.files); event.target.value = ''; }}/>
      <input ref={library.folderInputRef} type="file" accept={ACCEPTED.join(',')} multiple hidden onChange={(event) => { if (event.target.files) void library.importFiles(event.target.files); event.target.value = ''; }}/>
      <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-border/70 bg-background/90 px-4 backdrop-blur-xl sm:px-8">
        <div className="flex items-center gap-3"><button type="button" aria-label="Open navigation" className="button-icon md:hidden" onClick={() => setMobileMenu(true)}><Menu size={20}/></button><div><div className="text-[10px] font-bold uppercase tracking-[.22em] text-primary">{eyebrow ?? 'Private listening room'}</div><h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1></div></div>
        <div className="flex items-center gap-2">{onImport && <button type="button" onClick={onImport} className="button-primary hidden items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold sm:flex"><Upload size={16}/> Import Music</button>}<Link href="/settings" className="button-ghost rounded-xl p-2.5" aria-label="Settings"><SettingsIcon size={19}/></Link></div>
      </header>
      {library.storageError && <div className="mx-4 mt-4 flex items-start gap-3 rounded-xl border border-accent/20 bg-accent/10 p-3 text-sm text-accent sm:mx-8"><AlertCircle size={17} className="mt-0.5 shrink-0"/><span>{library.storageError}</span></div>}
      <main className="page-scroll px-4 py-6 sm:px-8 sm:py-8"><div className="page-enter mx-auto max-w-[1260px]">{children}</div></main>
    </div>
    <MobileNav location={location}/>
    {mobileMenu && <div className="fixed inset-0 z-50 bg-black/60 md:hidden" onClick={() => setMobileMenu(false)}><div className="h-full w-[280px] border-r border-sidebar-border bg-sidebar p-5" onClick={(event) => event.stopPropagation()}><div className="mb-10 flex items-center justify-between"><Logo/><IconButton label="Close menu" onClick={() => setMobileMenu(false)}><X size={18}/></IconButton></div>{navItems.map(({ href, label, icon: NavIcon }) => <Link key={href} href={href} onClick={() => setMobileMenu(false)} className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${location === href ? 'bg-primary/12 text-primary' : 'text-muted-foreground'}`}><NavIcon size={18}/>{label}</Link>)}<div className="my-5 h-px bg-sidebar-border"/><Link href="/settings" onClick={() => setMobileMenu(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-muted-foreground"><SettingsIcon size={18}/>Settings</Link><Link href="/about" onClick={() => setMobileMenu(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-muted-foreground"><CircleHelp size={18}/>About</Link></div></div>}
    <BottomPlayer/>
  </div>;
}

function MobileNav({ location }: { location: string }) {
  const items = [{ href: '/', label: 'Home', icon: HomeIcon }, { href: '/songs', label: 'Songs', icon: Library }, { href: '/favorites', label: 'Favorites', icon: Heart }, { href: '/playlists', label: 'Playlists', icon: ListMusic }];
  return <nav className="mobile-nav fixed bottom-0 left-0 right-0 z-30 h-[68px] items-center justify-around border-t border-border bg-sidebar/95 px-2 backdrop-blur-xl">{items.map(({ href, label, icon: NavIcon }) => <Link key={href} href={href} aria-label={label} className={`flex min-w-[62px] flex-col items-center gap-1 rounded-xl py-2 text-[10px] ${location === href ? 'text-primary' : 'text-muted-foreground'}`}><NavIcon size={18}/><span>{label}</span></Link>)}</nav>;
}

function BottomPlayer() {
  const library = useLibraryContext();
  const current = library.songs.find((song) => song.id === library.currentId);
  const [expanded, setExpanded] = useState(false);
  const max = library.duration || current?.duration || 1;
  return <><div className="fixed bottom-0 left-0 right-0 z-40 border-t border-primary/15 bg-[#0b1610]/95 shadow-[0_-12px_40px_rgba(0,0,0,.25)] backdrop-blur-xl md:left-[248px]"><div className="mx-auto max-w-[1500px] px-3 py-2 sm:px-6"><div className="flex items-center gap-3"><div className="flex min-w-0 flex-1 items-center gap-3"><Artwork song={current} size="sm"/><div className="min-w-0 player-desktop-details"><div className="truncate text-sm font-semibold">{current?.title ?? 'Choose a track to begin'}</div><div className="truncate text-xs text-muted-foreground">{current?.artist ?? 'Your private library awaits'}</div></div></div><div className="flex items-center gap-0.5 sm:gap-2"><IconButton label="Previous track" onClick={library.previous} disabled={!current}><SkipBack size={17}/></IconButton><button type="button" aria-label={library.isPlaying ? 'Pause' : 'Play'} data-testid="button-player-play" onClick={library.togglePlay} className="green-glow flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105">{library.isPlaying ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor" className="ml-0.5"/>}</button><IconButton label="Next track" onClick={library.next} disabled={!current}><SkipForward size={17}/></IconButton></div><div className="hidden min-w-[170px] flex-1 items-center justify-end gap-3 sm:flex"><IconButton label="Shuffle" onClick={() => library.setShuffle(!library.shuffle)} active={library.shuffle}><Shuffle size={16}/></IconButton><IconButton label={`Repeat ${library.repeat}`} onClick={library.cycleRepeat} active={library.repeat !== 'off'}>{library.repeat === 'one' ? <Repeat1 size={16}/> : <Repeat size={16}/>}</IconButton><IconButton label="Open queue" onClick={() => library.setShowQueue(true)} active={library.showQueue}><ListMusic size={17}/></IconButton><IconButton label="Expand player" onClick={() => setExpanded(true)}><ChevronUpSafe/></IconButton></div><button type="button" onClick={() => setExpanded(true)} className="button-icon sm:hidden" aria-label="Expand player"><ChevronUpSafe/></button></div><div className="mt-2 flex items-center gap-2"><span className="w-8 text-right font-mono text-[10px] text-muted-foreground">{formatTime(library.progress)}</span><input aria-label="Seek" data-testid="input-player-seek" type="range" className="progress-track min-w-0 flex-1" min="0" max={max} step=".1" value={Math.min(library.progress, max)} onChange={(event) => library.seek(Number(event.target.value))}/><span className="w-8 font-mono text-[10px] text-muted-foreground">{formatTime(max)}</span></div></div></div>{library.showQueue && <QueuePanel/>}{expanded && <ExpandedPlayer onClose={() => setExpanded(false)}/>}</>;
}

function ChevronUpSafe() { return <ChevronUp size={17}/>; }

function QueuePanel() {
  const library = useLibraryContext();
  const queued = library.queue.map((id) => library.songs.find((song) => song.id === id)).filter(Boolean) as StoredSong[];
  return <div className="fixed bottom-[91px] right-4 z-50 w-[min(380px,calc(100%-2rem))] rounded-2xl border border-border bg-card p-4 shadow-2xl sm:bottom-[86px] sm:right-6"><div className="flex items-center justify-between"><div><div className="font-display font-semibold">Up next</div><div className="text-xs text-muted-foreground">{queued.length} {queued.length === 1 ? 'track' : 'tracks'} queued</div></div><div className="flex items-center gap-1"><button type="button" onClick={library.clearQueue} className="button-ghost rounded-lg px-2 py-1 text-xs">Clear</button><IconButton label="Close queue" onClick={() => library.setShowQueue(false)}><X size={16}/></IconButton></div></div><div className="mt-3 max-h-64 space-y-1 overflow-y-auto">{queued.length ? queued.map((song) => <div className="flex items-center gap-2 rounded-lg p-2" key={song.id}><Artwork song={song} size="sm"/><div className="min-w-0 flex-1"><div className="truncate text-sm">{song.title}</div><div className="truncate text-xs text-muted-foreground">{song.artist}</div></div><IconButton label={`Remove ${song.title} from queue`} onClick={() => library.removeQueue(song.id)}><X size={14}/></IconButton></div>) : <div className="rounded-xl bg-muted/60 px-3 py-6 text-center text-xs text-muted-foreground">Add tracks with the options menu to build a queue.</div>}</div></div>;
}

function ExpandedPlayer({ onClose }: { onClose: () => void }) {
  const library = useLibraryContext();
  const current = library.songs.find((song) => song.id === library.currentId);
  if (!current) return null;
  return <div className="dialog-backdrop fixed inset-0 z-[55] flex items-center justify-center p-4"><div className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-10"><IconButton label="Close expanded player" onClick={onClose} className="absolute right-4 top-4"><X size={18}/></IconButton><div className="mx-auto max-w-[330px]"><Artwork song={current} size="hero"/></div><div className="mt-7 text-center"><div className="font-display text-2xl font-semibold">{current.title}</div><div className="mt-1 text-sm text-muted-foreground">{current.artist} · {current.album}</div></div><div className="mt-8 flex items-center gap-2"><span className="font-mono text-[10px] text-muted-foreground">{formatTime(library.progress)}</span><input aria-label="Expanded seek" type="range" className="progress-track min-w-0 flex-1" min="0" max={library.duration || current.duration || 1} value={library.progress} onChange={(event) => library.seek(Number(event.target.value))}/><span className="font-mono text-[10px] text-muted-foreground">{formatTime(library.duration || current.duration)}</span></div><div className="mt-7 flex items-center justify-center gap-5"><IconButton label="Shuffle" onClick={() => library.setShuffle(!library.shuffle)} active={library.shuffle}><Shuffle size={18}/></IconButton><IconButton label="Previous track" onClick={library.previous}><SkipBack size={20}/></IconButton><button type="button" onClick={library.togglePlay} aria-label="Play or pause" className="green-glow flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">{library.isPlaying ? <Pause size={23} fill="currentColor"/> : <Play size={23} fill="currentColor"/>}</button><IconButton label="Next track" onClick={library.next}><SkipForward size={20}/></IconButton><IconButton label="Repeat" onClick={library.cycleRepeat} active={library.repeat !== 'off'}>{library.repeat === 'one' ? <Repeat1 size={18}/> : <Repeat size={18}/>}</IconButton></div><div className="mx-auto mt-7 flex max-w-[180px] items-center gap-2"><VolumeX size={14} className="text-muted-foreground"/><input aria-label="Volume" type="range" className="volume-track min-w-0 flex-1" min="0" max="1" step=".01" value={library.volume} onChange={(event) => library.setVolume(Number(event.target.value))}/><Volume2 size={14} className="text-muted-foreground"/></div></div></div>;
}

function HomePage() {
  const library = useLibraryContext();
  const recent = useMemo(() => [...library.songs].sort((a, b) => (b.lastPlayedAt ?? b.addedAt) - (a.lastPlayedAt ?? a.addedAt)).slice(0, 5), [library.songs]);
  return <Shell title="Good to see you" eyebrow="Private listening room" onImport={library.openImport}><input ref={library.fileInputRef} type="file" accept={ACCEPTED.join(',')} multiple hidden onChange={(event) => { if (event.target.files) void library.importFiles(event.target.files); event.target.value = ''; }}/><input ref={library.folderInputRef} type="file" accept={ACCEPTED.join(',')} multiple hidden onChange={(event) => { if (event.target.files) void library.importFiles(event.target.files); event.target.value = ''; }}/><div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]"><section className="relative min-h-[310px] overflow-hidden rounded-3xl border border-primary/20 bg-[#12271b] p-7 sm:p-10"><div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border border-primary/10 shadow-[0_0_0_28px_rgba(108,218,132,.04),0_0_0_56px_rgba(108,218,132,.025)]"/><div className="absolute -bottom-32 -left-16 h-64 w-64 rounded-full border border-accent/20"/><div className="relative z-10 max-w-lg"><div className="mb-8 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-primary"><Disc3 size={15}/> A room for your records</div><h2 className="font-display text-4xl font-semibold leading-[1.03] tracking-[-.055em] sm:text-6xl">Your music,<br/><span className="text-primary">in your hands.</span></h2><p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">A quiet, private home for the files you already own. Plug in a USB drive, choose your tracks, and make the library feel like yours.</p><div className="mt-8 flex flex-wrap gap-3"><button type="button" onClick={library.openImport} className="button-primary inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"><Upload size={17}/> Import Music</button><button type="button" onClick={library.openFolder} className="button-ghost inline-flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm"><FolderOpen size={16}/> Import folder</button></div></div></section><section className="surface rounded-3xl p-6 sm:p-7"><div className="flex items-start justify-between"><div><div className="text-xs font-bold uppercase tracking-[.18em] text-muted-foreground">At a glance</div><h2 className="mt-2 font-display text-2xl font-semibold">Your collection</h2></div><div className="rounded-xl bg-accent/10 p-2.5 text-accent"><Library size={19}/></div></div><div className="mt-8 grid grid-cols-2 gap-3"><Stat label="Tracks" value={library.songs.length.toString()} icon={<Music2 size={16}/>} /><Stat label="Favorites" value={library.songs.filter((song) => song.favorite).length.toString()} icon={<Heart size={16}/>} /><Stat label="Playlists" value={library.playlists.length.toString()} icon={<ListMusic size={16}/>} /><Stat label="Listening room" value="Local" icon={<Archive size={16}/>} /></div><div className="mt-5 flex items-center gap-2 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground"><Check size={15} className="text-primary"/><span>Stored privately in your browser</span></div></section></div><div className="mt-10 flex items-end justify-between"><div><div className="text-xs font-bold uppercase tracking-[.18em] text-primary">The shelf</div><h2 className="mt-2 font-display text-2xl font-semibold">Recently in rotation</h2></div><Link href="/songs" className="button-ghost inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm">All songs <ChevronRight size={15}/></Link></div>{library.loading ? <SkeletonList/> : recent.length ? <TrackList songs={recent} compact/> : <div className="mt-5"><EmptyState title="Your library is empty" description="Import music from your computer or USB drive to get started. The browser will ask you to choose the files or folder." onImport={library.openImport}/></div>}<div className="mt-10 grid gap-4 sm:grid-cols-2"><div className="surface-soft rounded-2xl p-5"><div className="flex items-center gap-2 text-sm font-semibold"><KeyboardIcon/> Shortcuts</div><div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span><kbd>Space</kbd> Play / pause</span><span><kbd>← →</kbd> Skip tracks</span><span><kbd>⌘ K</kbd> Find a song</span><span><kbd>Drop</kbd> Import files</span></div></div><div className="surface-soft rounded-2xl p-5"><div className="flex items-center gap-2 text-sm font-semibold"><FolderOpen size={16} className="text-accent"/> From USB to shelf</div><p className="mt-3 text-xs leading-5 text-muted-foreground">Your browser cannot see a USB drive automatically. Choose its files or folder through Import Music when it is connected.</p></div></div><Footer/></Shell>;
}

function KeyboardIcon() { return <span className="font-mono text-[11px] text-primary">⌘</span>; }
function Stat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) { return <div className="rounded-2xl bg-muted/65 p-4"><div className="flex items-center justify-between text-muted-foreground">{icon}<span className="font-mono text-2xl text-foreground">{value}</span></div><div className="mt-4 text-xs text-muted-foreground">{label}</div></div>; }
function SkeletonList() { return <div className="mt-5 space-y-2">{[1, 2, 3].map((item) => <div key={item} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"><div className="h-11 w-11 animate-pulse rounded-lg bg-muted"/><div className="flex-1 space-y-2"><div className="h-3 w-1/3 animate-pulse rounded bg-muted"/><div className="h-2 w-1/4 animate-pulse rounded bg-muted"/></div></div>)}</div>; }
function Footer() { return <footer className="mt-14 border-t border-border/70 pb-28 pt-6 text-xs text-muted-foreground sm:pb-8"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><span>Made with AI assistance. Built and maintained by Skud.</span><span className="font-mono text-[10px]">SKUDS / 1.0.0 / LOCAL ONLY</span></div></footer>; }

function SongsPage() {
  const library = useLibraryContext();
  const [query, setQuery] = useState('');
  const [dragging, setDragging] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [playlistSong, setPlaylistSong] = useState<StoredSong | null>(null);
  useEffect(() => { const onSearch = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.getElementById('song-search')?.focus(); } }; window.addEventListener('keydown', onSearch); return () => window.removeEventListener('keydown', onSearch); }, []);
  const filtered = useMemo(() => { const term = query.trim().toLowerCase(); return library.songs.filter((song) => !term || `${song.title} ${song.artist} ${song.album}`.toLowerCase().includes(term)); }, [library.songs, query]);
  return <Shell title="All songs" eyebrow={`${library.songs.length} ${library.songs.length === 1 ? 'track' : 'tracks'} in your room`} onImport={library.openImport}><input ref={library.fileInputRef} type="file" accept={ACCEPTED.join(',')} multiple hidden onChange={(event) => { if (event.target.files) void library.importFiles(event.target.files); event.target.value = ''; }}/><input ref={library.folderInputRef} type="file" accept={ACCEPTED.join(',')} multiple hidden onChange={(event) => { if (event.target.files) void library.importFiles(event.target.files); event.target.value = ''; }}/><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="max-w-xl text-sm leading-6 text-muted-foreground">Every track you import lives here, searchable by title, artist, or album.</p></div><div className="relative sm:w-[290px]"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><input id="song-search" data-testid="input-song-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your library" className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-16 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"/><kbd className="absolute right-3 top-1/2 -translate-y-1/2">⌘ K</kbd></div></div><div onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); void library.importFiles(event.dataTransfer.files); }} className={`mt-7 rounded-2xl border border-dashed p-3 transition-colors ${dragging ? 'border-primary bg-primary/10' : 'border-border/80'}`}><div className="flex items-center justify-between px-2 py-1 text-xs text-muted-foreground"><span className="flex items-center gap-2"><Download size={14} className={dragging ? 'text-primary' : ''}/>{dragging ? 'Release to import your files' : 'Drop audio files anywhere in this area to import'}</span><button type="button" onClick={library.openFolder} className="button-ghost hidden items-center gap-1 rounded-lg px-2 py-1 sm:flex"><FolderOpen size={14}/> Choose folder</button></div></div>{library.loading ? <SkeletonList/> : filtered.length ? <TrackList songs={filtered} menuId={menuId} setMenuId={setMenuId} onAddPlaylist={setPlaylistSong}/> : library.songs.length ? <div className="mt-6"><EmptyState title="No matches found" description="Try a different title, artist, or album name." icon={Search}/></div> : <div className="mt-6"><EmptyState title="Your library is empty" description="Import music from your computer or USB drive to get started." onImport={library.openImport} icon={FileAudio}/></div>}<Footer/>{playlistSong && <AddToPlaylistDialog song={playlistSong} onClose={() => setPlaylistSong(null)}/>}</Shell>;
}

function TrackList({ songs, compact = false, menuId, setMenuId, onAddPlaylist }: { songs: StoredSong[]; compact?: boolean; menuId?: string | null; setMenuId?: (id: string | null) => void; onAddPlaylist?: (song: StoredSong) => void }) {
  const library = useLibraryContext();
  return <div className={`mt-5 overflow-visible rounded-2xl border border-border bg-card/70 ${compact ? '' : ''}`}><div className="hidden grid-cols-[42px_minmax(220px,1.5fr)_minmax(120px,1fr)_minmax(120px,1fr)_72px_84px] gap-3 border-b border-border px-4 py-3 text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground sm:grid"><span>#</span><span>Track</span><span>Artist</span><span>Album</span><span>Time</span><span/></div>{songs.map((song, index) => <div key={song.id} className="list-row group relative grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2 border-b border-border/70 px-3 py-2.5 last:border-0 sm:grid-cols-[42px_minmax(220px,1.5fr)_minmax(120px,1fr)_minmax(120px,1fr)_72px_84px] sm:gap-3 sm:px-4"><span className="text-center font-mono text-xs text-muted-foreground">{index + 1}</span><button type="button" data-testid={`button-play-song-${song.id}`} onClick={() => library.playSong(song.id, songs.map((item) => item.id))} className="flex min-w-0 items-center gap-3 text-left"><Artwork song={song} size="sm"/><span className="min-w-0"><span className="block truncate text-sm font-semibold">{song.title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground sm:hidden">{song.artist}</span></span></button><div className="hidden truncate text-sm text-muted-foreground sm:block">{song.artist}</div><div className="hidden truncate text-sm text-muted-foreground sm:block">{song.album}</div><span className="hidden font-mono text-xs text-muted-foreground sm:block">{formatTime(song.duration)}</span><div className="flex items-center justify-end gap-0.5"><IconButton label={song.favorite ? `Unfavorite ${song.title}` : `Favorite ${song.title}`} onClick={() => library.toggleFavorite(song.id)} active={song.favorite} className={song.favorite ? 'text-primary' : 'opacity-50 group-hover:opacity-100'}><Heart size={16} fill={song.favorite ? 'currentColor' : 'none'}/></IconButton><div className="relative"><IconButton label={`Options for ${song.title}`} onClick={() => setMenuId?.(menuId === song.id ? null : song.id)}><MoreHorizontal size={17}/></IconButton>{menuId === song.id && <TrackMenu song={song} onClose={() => setMenuId?.(null)} onAddPlaylist={() => onAddPlaylist?.(song)}/>}</div></div></div>)}</div>;
}

function TrackMenu({ song, onClose, onAddPlaylist }: { song: StoredSong; onClose: () => void; onAddPlaylist: () => void }) {
  const library = useLibraryContext();
  return <div className="absolute right-0 top-10 z-20 w-48 rounded-xl border border-border bg-popover p-1.5 shadow-2xl"><button type="button" onClick={() => { library.playSong(song.id); onClose(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-muted"><Play size={14}/> Play now</button><button type="button" onClick={() => { library.addQueue(song.id); onClose(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-muted"><ListMusic size={14}/> Add to queue</button><button type="button" onClick={() => { onAddPlaylist(); onClose(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-muted"><Plus size={14}/> Add to playlist</button><button type="button" onClick={() => { void library.removeSong(song.id); onClose(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-destructive hover:bg-destructive/10"><Trash2 size={14}/> Remove track</button></div>;
}

function FavoritesPage() {
  const library = useLibraryContext();
  const favoriteSongs = library.songs.filter((song) => song.favorite);
  return <Shell title="Favorites" eyebrow="The ones worth keeping close" onImport={library.openImport}><div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-[#14261c] p-7 sm:p-9"><Heart size={100} className="absolute -right-3 -top-4 text-primary/10" fill="currentColor"/><div className="relative"><div className="text-xs font-bold uppercase tracking-[.2em] text-primary">Your keepers</div><h2 className="mt-3 max-w-lg font-display text-3xl font-semibold tracking-[-.04em] sm:text-4xl">The tracks you return to.</h2><p className="mt-3 text-sm text-muted-foreground">{favoriteSongs.length ? `${favoriteSongs.length} ${favoriteSongs.length === 1 ? 'track' : 'tracks'} marked for the next listen.` : 'Tap the heart on any track to make it part of this shelf.'}</p>{favoriteSongs.length > 0 && <button type="button" onClick={() => library.playSong(favoriteSongs[0].id, favoriteSongs.map((song) => song.id))} className="button-primary mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"><Play size={16} fill="currentColor"/> Play favorites</button>}</div></div>{favoriteSongs.length ? <TrackList songs={favoriteSongs}/> : <div className="mt-6"><EmptyState title="No favorites yet" description="When a track feels right, save it with the heart button and it will appear here." icon={Heart}/></div>}<Footer/></Shell>;
}

function PlaylistsPage() {
  const library = useLibraryContext();
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<StoredPlaylist | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<StoredPlaylist | null>(null);
  const playlistSongs = selected ? selected.songIds.map((id) => library.songs.find((song) => song.id === id)).filter(Boolean) as StoredSong[] : [];
  return <Shell title="Playlists" eyebrow={`${library.playlists.length} curated shelves`} onImport={library.openImport}><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><p className="max-w-lg text-sm leading-6 text-muted-foreground">Shape the room around a mood, a season, or the songs you always play together.</p><button type="button" onClick={() => setCreateOpen(true)} className="button-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"><Plus size={17}/> New playlist</button></div>{selected ? <PlaylistDetail playlist={selected} songs={playlistSongs} onBack={() => setSelected(null)} onRename={() => setRenameOpen(true)} onDelete={() => setConfirmDelete(selected)}/> : library.playlists.length ? <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{library.playlists.map((playlist, index) => <PlaylistCard key={playlist.id} playlist={playlist} index={index} onOpen={() => setSelected(playlist)} onDelete={() => setConfirmDelete(playlist)}/>)}</div> : <div className="mt-7"><EmptyState title="Make your first shelf" description="Create a playlist to gather the songs that belong together." onImport={() => setCreateOpen(true)} icon={ListMusic}/></div>}<Footer/>{createOpen && <PlaylistDialog title="New playlist" initial="" onClose={() => setCreateOpen(false)} onSubmit={async (name) => { await library.createPlaylist(name); setCreateOpen(false); }}/>} {renameOpen && selected && <PlaylistDialog title="Rename playlist" initial={selected.name} onClose={() => setRenameOpen(false)} onSubmit={async (name) => { await library.updatePlaylist({ ...selected, name, updatedAt: Date.now() }); setSelected({ ...selected, name, updatedAt: Date.now() }); setRenameOpen(false); }}/>} {confirmDelete && <ConfirmDialog title="Delete this playlist?" description={`“${confirmDelete.name}” will be removed. The tracks in your library will stay safe.`} onClose={() => setConfirmDelete(null)} onConfirm={async () => { await library.removePlaylist(confirmDelete.id); if (selected?.id === confirmDelete.id) setSelected(null); setConfirmDelete(null); }}/>}</Shell>;
}

function PlaylistCard({ playlist, index, onOpen, onDelete }: { playlist: StoredPlaylist; index: number; onOpen: () => void; onDelete: () => void }) {
  const library = useLibraryContext();
  const first = library.songs.find((song) => playlist.songIds.includes(song.id));
  const colors = ['from-[#3d6449] to-[#b49a52]', 'from-[#3d4d63] to-[#a9734b]', 'from-[#574163] to-[#537c69]'];
  return <div className="surface group relative overflow-hidden rounded-2xl p-3 transition-transform hover:-translate-y-1"><button type="button" onClick={onOpen} className="block w-full text-left"><div className={`relative flex aspect-[1.7/1] items-end overflow-hidden rounded-xl bg-gradient-to-br ${colors[index % colors.length]} p-4`}><div className="absolute -right-5 -top-10 h-36 w-36 rounded-full border border-white/20"/><ListMusic size={30} className="absolute right-5 top-5 text-white/35"/><div className="relative"><div className="font-display text-xl font-semibold text-white">{playlist.name}</div><div className="mt-1 text-xs text-white/65">{playlist.songIds.length} {playlist.songIds.length === 1 ? 'track' : 'tracks'}</div></div></div></button><div className="flex items-center justify-between px-1 pb-1 pt-4"><div className="min-w-0"><div className="truncate text-xs text-muted-foreground">{first ? `Starts with ${first.title}` : 'A new, empty shelf'}</div></div><div className="flex items-center gap-1"><IconButton label={`Play ${playlist.name}`} onClick={() => first && library.playSong(first.id, playlist.songIds)} disabled={!first}><Play size={14} fill="currentColor"/></IconButton><IconButton label={`Delete ${playlist.name}`} onClick={onDelete}><Trash2 size={14}/></IconButton></div></div></div>;
}

function PlaylistDetail({ playlist, songs, onBack, onRename, onDelete }: { playlist: StoredPlaylist; songs: StoredSong[]; onBack: () => void; onRename: () => void; onDelete: () => void }) {
  const library = useLibraryContext();
  const [menuId, setMenuId] = useState<string | null>(null);
  const move = async (index: number, direction: -1 | 1) => { const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= songs.length) return; const ids = [...playlist.songIds]; const [item] = ids.splice(index, 1); ids.splice(nextIndex, 0, item); await library.updatePlaylist({ ...playlist, songIds: ids, updatedAt: Date.now() }); };
  return <div><button type="button" onClick={onBack} className="button-ghost mb-6 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"><ArrowLeft size={16}/> Back to playlists</button><div className="flex flex-col gap-5 rounded-3xl border border-primary/15 bg-[#13231a] p-6 sm:flex-row sm:items-end sm:p-8"><div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/60 to-accent/50 text-background shadow-lg"><ListMusic size={42}/></div><div className="min-w-0 flex-1"><div className="text-xs font-bold uppercase tracking-[.18em] text-primary">Playlist</div><h2 className="mt-2 truncate font-display text-3xl font-semibold">{playlist.name}</h2><p className="mt-2 text-sm text-muted-foreground">{songs.length} {songs.length === 1 ? 'track' : 'tracks'} in this shelf</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => songs[0] && library.playSong(songs[0].id, songs.map((song) => song.id))} disabled={!songs.length} className="button-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"><Play size={16} fill="currentColor"/> Play all</button><IconButton label="Rename playlist" onClick={onRename}><Pencil size={16}/></IconButton><IconButton label="Delete playlist" onClick={onDelete}><Trash2 size={16}/></IconButton></div></div>{songs.length ? <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card/70">{songs.map((song, index) => <div key={song.id} className="list-row flex items-center gap-3 border-b border-border/70 px-3 py-2.5 last:border-0 sm:px-4"><span className="w-5 text-center font-mono text-xs text-muted-foreground">{index + 1}</span><button type="button" onClick={() => library.playSong(song.id, songs.map((item) => item.id))} className="flex min-w-0 flex-1 items-center gap-3 text-left"><Artwork song={song} size="sm"/><span className="min-w-0"><span className="block truncate text-sm font-semibold">{song.title}</span><span className="block truncate text-xs text-muted-foreground">{song.artist}</span></span></button><span className="hidden font-mono text-xs text-muted-foreground sm:block">{formatTime(song.duration)}</span><div className="flex"><IconButton label={`Move ${song.title} up`} onClick={() => void move(index, -1)} disabled={index === 0}><ArrowLeft size={14} className="rotate-90"/></IconButton><IconButton label={`Move ${song.title} down`} onClick={() => void move(index, 1)} disabled={index === songs.length - 1}><ArrowRight size={14} className="rotate-90"/></IconButton><div className="relative"><IconButton label={`Playlist options for ${song.title}`} onClick={() => setMenuId(menuId === song.id ? null : song.id)}><MoreHorizontal size={16}/></IconButton>{menuId === song.id && <div className="absolute right-0 top-10 z-10 w-40 rounded-xl border border-border bg-popover p-1 shadow-xl"><button type="button" className="w-full rounded-lg px-3 py-2 text-left text-xs text-destructive hover:bg-muted" onClick={async () => { await library.updatePlaylist({ ...playlist, songIds: playlist.songIds.filter((id) => id !== song.id), updatedAt: Date.now() }); setMenuId(null); }}>Remove from playlist</button></div>}</div></div></div>)}</div> : <div className="mt-6"><EmptyState title="This shelf is empty" description="Add songs from the All Songs options menu to bring this playlist to life." icon={ListMusic}/></div>}</div>;
}

function PlaylistDialog({ title, initial, onClose, onSubmit }: { title: string; initial: string; onClose: () => void; onSubmit: (name: string) => Promise<void> }) {
  const [name, setName] = useState(initial);
  return <Dialog title={title} onClose={onClose} footer={<><button type="button" onClick={onClose} className="button-ghost rounded-xl px-4 py-2 text-sm">Cancel</button><button type="button" disabled={!name.trim()} onClick={() => void onSubmit(name.trim())} className="button-primary rounded-xl px-4 py-2 text-sm font-semibold">Save playlist</button></>}><label className="text-sm font-medium">Playlist name<input autoFocus data-testid="input-playlist-name" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && name.trim()) void onSubmit(name.trim()); }} placeholder="Late-night drives" className="mt-2 h-11 w-full rounded-xl border border-border bg-muted/50 px-3 text-sm outline-none focus:border-primary"/></label></Dialog>;
}

function AddToPlaylistDialog({ song, onClose }: { song: StoredSong; onClose: () => void }) {
  const library = useLibraryContext();
  const [newName, setNewName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const add = async () => { for (const id of selected) { const playlist = library.playlists.find((item) => item.id === id); if (playlist && !playlist.songIds.includes(song.id)) await library.updatePlaylist({ ...playlist, songIds: [...playlist.songIds, song.id], updatedAt: Date.now() }); } if (selected.length) library.toast(`Added “${song.title}” to ${selected.length === 1 ? 'your playlist' : 'your playlists'}.`); onClose(); };
  return <Dialog title="Add to playlist" onClose={onClose} footer={<><button type="button" onClick={onClose} className="button-ghost rounded-xl px-4 py-2 text-sm">Cancel</button><button type="button" onClick={() => void add()} disabled={!selected.length} className="button-primary rounded-xl px-4 py-2 text-sm font-semibold">Add track</button></>}><div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3"><Artwork song={song} size="sm"/><div className="min-w-0"><div className="truncate text-sm font-semibold">{song.title}</div><div className="truncate text-xs text-muted-foreground">{song.artist}</div></div></div><div className="mt-4 space-y-1">{library.playlists.length ? library.playlists.map((playlist) => <label key={playlist.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-muted"><input type="checkbox" checked={selected.includes(playlist.id)} onChange={() => setSelected((items) => items.includes(playlist.id) ? items.filter((id) => id !== playlist.id) : [...items, playlist.id])} className="accent-primary"/><span>{playlist.name}</span><span className="ml-auto text-xs text-muted-foreground">{playlist.songIds.length}</span></label>) : <p className="py-2 text-sm text-muted-foreground">No playlists yet. Create one below.</p>}</div><div className="mt-4 flex gap-2"><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="New playlist name" className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-muted/50 px-3 text-xs outline-none focus:border-primary"/><button type="button" disabled={!newName.trim()} onClick={async () => { await library.createPlaylist(newName.trim()); setNewName(''); }} className="button-ghost rounded-xl border border-border px-3 text-xs font-semibold">Create</button></div></Dialog>;
}

function SettingsPage() {
  const library = useLibraryContext();
  const [confirm, setConfirm] = useState<'songs' | 'playlists' | 'all' | null>(null);
  const clear = async () => { if (confirm === 'songs') { await clearSongs(); library.songs.splice(0); window.location.reload(); } if (confirm === 'playlists') { await clearPlaylists(); window.location.reload(); } if (confirm === 'all') { await clearAllLocalData(); await clearSettings(); window.location.reload(); } };
  return <Shell title="Settings" eyebrow="The room, your rules"><div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><div className="space-y-5"><section className="surface rounded-2xl p-6"><div className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Volume2 size={18}/></div><div className="flex-1"><h2 className="font-display text-lg font-semibold">Playback</h2><p className="mt-1 text-sm text-muted-foreground">Your volume preference is remembered on this device.</p><div className="mt-6 flex items-center gap-3"><VolumeX size={15} className="text-muted-foreground"/><input data-testid="input-settings-volume" aria-label="Default volume" type="range" min="0" max="1" step=".01" value={library.volume} onChange={(event) => library.setVolume(Number(event.target.value))} className="volume-track flex-1"/><span className="w-9 text-right font-mono text-xs text-muted-foreground">{Math.round(library.volume * 100)}%</span></div></div></div></section><section className="surface rounded-2xl p-6"><div className="flex items-start gap-3"><div className="rounded-xl bg-accent/10 p-2.5 text-accent"><Archive size={18}/></div><div><h2 className="font-display text-lg font-semibold">Local data</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Manage the library and playlists saved in this browser. Audio bytes are stored in IndexedDB, never in localStorage.</p></div></div><div className="mt-6 space-y-2"><SettingAction title="Clear music library" description={`${library.songs.length} imported ${library.songs.length === 1 ? 'track' : 'tracks'}`} tone="danger" onClick={() => setConfirm('songs')}/><SettingAction title="Clear playlists" description={`${library.playlists.length} custom ${library.playlists.length === 1 ? 'playlist' : 'playlists'}`} tone="danger" onClick={() => setConfirm('playlists')}/><SettingAction title="Clear all local data" description="Remove tracks, playlists, preferences, and playback history" tone="danger" onClick={() => setConfirm('all')}/></div></section></div><div className="space-y-5"><section className="rounded-2xl border border-primary/20 bg-primary/[.07] p-6"><div className="flex items-center gap-2 text-sm font-semibold text-primary"><Check size={17}/> Private by design</div><p className="mt-4 text-sm leading-6 text-foreground">Your music stays on your device. This app does not upload your audio files.</p><p className="mt-3 text-xs leading-5 text-muted-foreground">To import from a USB drive, plug it in and choose the files or folder through your browser's picker. The browser will always ask you to explicitly grant access.</p></section><section className="surface rounded-2xl p-6"><div className="flex items-center gap-2 text-sm font-semibold"><Music2 size={17} className="text-primary"/> About this player</div><p className="mt-3 text-sm leading-6 text-muted-foreground">Skuds Music Player is a personal browser-based music player for audio files provided by the user.</p><Link href="/about" className="button-ghost mt-5 inline-flex items-center gap-1 rounded-lg px-0 text-sm text-primary">Read the full note <ChevronRight size={15}/></Link></section></div></div><Footer/>{confirm && <ConfirmDialog title={confirm === 'all' ? 'Clear all local data?' : confirm === 'songs' ? 'Clear your music library?' : 'Clear your playlists?'} description="This cannot be undone. The selected data will be removed from this browser." onClose={() => setConfirm(null)} onConfirm={() => void clear()}/>}</Shell>;
}

function SettingAction({ title, description, onClick, tone }: { title: string; description: string; onClick: () => void; tone?: 'danger' }) { return <button type="button" onClick={onClick} className={`flex w-full items-center justify-between rounded-xl border border-border p-3 text-left transition-colors hover:bg-muted ${tone === 'danger' ? 'hover:border-destructive/30' : ''}`}><span><span className="block text-sm font-medium">{title}</span><span className="mt-1 block text-xs text-muted-foreground">{description}</span></span><ChevronRight size={16} className="text-muted-foreground"/></button>; }
function ConfirmDialog({ title, description, onClose, onConfirm }: { title: string; description: string; onClose: () => void; onConfirm: () => void }) { return <Dialog title={title} onClose={onClose} footer={<><button type="button" onClick={onClose} className="button-ghost rounded-xl px-4 py-2 text-sm">Keep it</button><button type="button" onClick={onConfirm} className="rounded-xl bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground">Delete</button></>}><p className="text-sm leading-6 text-muted-foreground">{description}</p></Dialog>; }

function AboutPage() {
  return <Shell title="About" eyebrow="A note from the maker"><div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-[#13281b] p-7 sm:p-10"><Logo/><div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full border border-primary/10 shadow-[0_0_0_22px_rgba(108,218,132,.04),0_0_0_44px_rgba(108,218,132,.025)]"/><div className="relative mt-16 max-w-xl"><div className="text-xs font-bold uppercase tracking-[.22em] text-primary">The private listening room</div><h2 className="mt-4 font-display text-4xl font-semibold tracking-[-.055em] sm:text-6xl">Your library<br/>deserves a home.</h2><p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">A personal, browser-based music player for audio files provided by the user.</p></div></section><section className="surface rounded-3xl p-7 sm:p-9"><div className="flex items-center justify-between"><div className="font-display text-xl font-semibold">Skuds Music Player</div><span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-mono text-[10px] text-primary">Version 1.0.0</span></div><div className="my-7 h-px bg-border"/><div className="space-y-5 text-sm leading-7 text-muted-foreground"><p>Skuds Music Player is a personal, browser-based music player for audio files provided by the user.</p><p>This application was developed with assistance from AI tools. The developer is responsible for the project's final implementation and maintenance.</p><p>Your music stays on your device and is not uploaded by this application.</p></div><div className="mt-8 rounded-2xl bg-muted/60 p-4 text-xs leading-5 text-muted-foreground"><div className="mb-2 flex items-center gap-2 font-semibold text-foreground"><LockIcon/> No streaming services</div>This player only plays audio files you explicitly import. There are no accounts, analytics, ads, downloads, or connections to streaming services.</div></section></div><Footer/></Shell>;
}
function LockIcon() { return <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-primary/15 text-primary"><Archive size={12}/></span>; }

export default App;