export type StoredSong = {
  id: string;
  fileKey: string;
  name: string;
  title: string;
  artist: string;
  album: string;
  albumArtist?: string;
  genre?: string;
  year?: number;
  trackNumber?: number;
  discNumber?: number;
  duration: number;
  size: number;
  lastModified: number;
  type: string;
  addedAt: number;
  lastPlayedAt?: number;
  favorite: boolean;
  blob: Blob;
  artwork?: Blob;
  artworkLocked?: boolean;
};

export type StoredPlaylist = {
  id: string;
  name: string;
  songIds: string[];
  createdAt: number;
  updatedAt: number;
};

type Setting = { key: string; value: unknown };
const DB_NAME = 'skuds-music-player';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Browser storage is not available in this browser.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Could not open local library.'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('songs')) db.createObjectStore('songs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('playlists')) db.createObjectStore('playlists', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function requestToPromise<T = undefined>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Local storage request failed.'));
  });
}

export async function getSongs(): Promise<StoredSong[]> {
  const db = await openDb();
  const result = await requestToPromise<StoredSong[]>(db.transaction('songs', 'readonly').objectStore('songs').getAll());
  db.close();
  return result.sort((a, b) => b.addedAt - a.addedAt);
}

export async function saveSong(song: StoredSong): Promise<void> {
  const db = await openDb();
  await requestToPromise(db.transaction('songs', 'readwrite').objectStore('songs').put(song));
  db.close();
}

export async function deleteSong(id: string): Promise<void> {
  const db = await openDb();
  await requestToPromise(db.transaction('songs', 'readwrite').objectStore('songs').delete(id));
  db.close();
}

export async function clearSongs(): Promise<void> {
  const db = await openDb();
  await requestToPromise(db.transaction('songs', 'readwrite').objectStore('songs').clear());
  db.close();
}

export async function getPlaylists(): Promise<StoredPlaylist[]> {
  const db = await openDb();
  const result = await requestToPromise<StoredPlaylist[]>(db.transaction('playlists', 'readonly').objectStore('playlists').getAll());
  db.close();
  return result.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function savePlaylist(playlist: StoredPlaylist): Promise<void> {
  const db = await openDb();
  await requestToPromise(db.transaction('playlists', 'readwrite').objectStore('playlists').put(playlist));
  db.close();
}

export async function deletePlaylist(id: string): Promise<void> {
  const db = await openDb();
  await requestToPromise(db.transaction('playlists', 'readwrite').objectStore('playlists').delete(id));
  db.close();
}

export async function clearPlaylists(): Promise<void> {
  const db = await openDb();
  await requestToPromise(db.transaction('playlists', 'readwrite').objectStore('playlists').clear());
  db.close();
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = await openDb();
    const result = await requestToPromise<Setting | undefined>(db.transaction('settings', 'readonly').objectStore('settings').get(key));
    db.close();
    return (result?.value as T | undefined) ?? fallback;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  await requestToPromise(db.transaction('settings', 'readwrite').objectStore('settings').put({ key, value }));
  db.close();
}

export async function clearSettings(): Promise<void> {
  const db = await openDb();
  await requestToPromise(db.transaction('settings', 'readwrite').objectStore('settings').clear());
  db.close();
}

export async function clearAllLocalData(): Promise<void> {
  const db = await openDb();
  const transaction = db.transaction(['songs', 'playlists', 'settings'], 'readwrite');
  transaction.objectStore('songs').clear();
  transaction.objectStore('playlists').clear();
  transaction.objectStore('settings').clear();
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not clear local data.'));
  });
  db.close();
}