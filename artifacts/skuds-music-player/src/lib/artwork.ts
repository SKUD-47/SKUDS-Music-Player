export type ArtworkCandidate = {
  id: string;
  artworkUrl: string;
  artist: string;
  title: string;
  album: string;
  source: string;
  confidence: number;
  kind: 'song' | 'album' | 'release';
};

export type ArtworkImageInfo = {
  width: number;
  height: number;
  type: string;
  size: number;
};

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp)$/i;

function normalise(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function similarity(expected: string, actual: string) {
  const left = normalise(expected);
  const right = normalise(actual);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (right.includes(left) || left.includes(right)) return 0.82;
  const leftWords = new Set(left.split(' '));
  const rightWords = new Set(right.split(' '));
  const overlap = [...leftWords].filter((word) => rightWords.has(word)).length;
  return overlap / Math.max(leftWords.size, rightWords.size);
}

function scoreCandidate(
  title: string,
  artist: string,
  album: string,
  result: { trackName?: string; artistName?: string; collectionName?: string; kind?: string; artworkUrl100?: string },
) {
  const titleScore = similarity(title, result.trackName ?? '');
  const artistScore = artist && artist !== 'Unknown artist' ? similarity(artist, result.artistName ?? '') : 0.45;
  const albumScore = album && album !== 'Local file' ? similarity(album, result.collectionName ?? '') : 0.25;
  const squareBonus = result.artworkUrl100 ? 2 : 0;
  return Math.round(titleScore * 38 + artistScore * 44 + albumScore * 14 + (result.kind === 'song' ? 2 : 0) + squareBonus);
}

function uniqueCandidates(candidates: ArtworkCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${normalise(candidate.artist)}|${normalise(candidate.title)}|${normalise(candidate.album)}|${candidate.artworkUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => b.confidence - a.confidence);
}

async function searchAppleArtwork(title: string, artist: string, album: string) {
  const term = [artist !== 'Unknown artist' ? artist : '', title, album !== 'Local file' ? album : ''].filter(Boolean).join(' ');
  if (!term) return [] as ArtworkCandidate[];
  const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=12`);
  if (!response.ok) return [] as ArtworkCandidate[];
  const payload = await response.json() as {
    results?: Array<{
      trackId?: number;
      trackName?: string;
      artistName?: string;
      collectionName?: string;
      artworkUrl100?: string;
      kind?: string;
    }>;
  };
  return (payload.results ?? []).filter((result) => result.artworkUrl100 && result.trackName).map((result) => ({
    id: `itunes-${result.trackId ?? result.artworkUrl100}`,
    artworkUrl: result.artworkUrl100!.replace('100x100', '1000x1000'),
    artist: result.artistName ?? 'Unknown artist',
    title: result.trackName ?? title,
    album: result.collectionName ?? 'Unknown album',
    source: 'Apple Music / iTunes catalog',
    confidence: scoreCandidate(title, artist, album, result),
    kind: 'song' as const,
  }));
}

async function searchMusicBrainzArtwork(title: string, artist: string, album: string) {
  const terms = [`recording:"${title}"`];
  const artists = [artist].filter((value) => value && value !== 'Unknown artist');
  if (artists.length) terms.push(`artist:"${artists[0]}"`);
  if (album && album !== 'Local file') terms.push(`release:"${album}"`);
  const response = await fetch(`https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(terms.join(' AND '))}&fmt=json&limit=8`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return [] as ArtworkCandidate[];
  const payload = await response.json() as {
    recordings?: Array<{
      id?: string;
      title?: string;
      score?: number;
      'artist-credit'?: Array<{ name?: string }>;
      releases?: Array<{ id?: string; title?: string; date?: string }>;
    }>;
  };
  const candidates: ArtworkCandidate[] = [];
  for (const recording of payload.recordings ?? []) {
    const release = recording.releases?.find((item) => item.id);
    if (!release?.id) continue;
    const artworkUrl = `https://coverartarchive.org/release/${release.id}/front-500`;
    const titleScore = similarity(title, recording.title ?? '');
    const artistScore = similarity(artist, recording['artist-credit']?.[0]?.name ?? '');
    const albumScore = album && album !== 'Local file' ? similarity(album, release.title ?? '') : 0.3;
    try {
      const imageResponse = await fetch(artworkUrl, { headers: { Accept: 'image/*' } });
      if (!imageResponse.ok || !imageResponse.headers.get('content-type')?.startsWith('image/')) continue;
    } catch {
      continue;
    }
    candidates.push({
      id: `musicbrainz-${recording.id ?? release.id}`,
      artworkUrl,
      artist: recording['artist-credit']?.[0]?.name ?? artist,
      title: recording.title ?? title,
      album: release.title ?? album,
      source: 'MusicBrainz + Cover Art Archive',
      confidence: Math.round(titleScore * 42 + artistScore * 42 + albumScore * 14 + (recording.score ?? 0) / 100),
      kind: 'release',
    });
    if (candidates.length >= 6) break;
  }
  return candidates;
}

export async function searchArtwork(title: string, artist: string, album: string) {
  const appleCandidates = await searchAppleArtwork(title, artist, album).catch(() => []);
  const bestApple = appleCandidates[0]?.confidence ?? 0;
  if (appleCandidates.length && bestApple >= 78) return uniqueCandidates(appleCandidates).slice(0, 8);
  const fallbackCandidates = await searchMusicBrainzArtwork(title, artist, album).catch(() => []);
  return uniqueCandidates([...appleCandidates, ...fallbackCandidates]).slice(0, 8);
}

export async function fetchArtworkBlob(candidate: ArtworkCandidate) {
  const response = await fetch(candidate.artworkUrl, { mode: 'cors', credentials: 'omit' });
  if (!response.ok) throw new Error('The artwork source could not be downloaded.');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('The artwork source did not return an image.');
  return blob;
}

export function isSupportedArtwork(file: Blob & { name?: string }) {
  return file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp' || (!file.type && IMAGE_EXTENSIONS.test(file.name ?? ''));
}

export function loadArtworkInfo(blob: Blob & { name?: string }): Promise<ArtworkImageInfo> {
  return new Promise((resolve, reject) => {
    if (!isSupportedArtwork(blob)) {
      reject(new Error('Choose a JPG, PNG, or WebP image.'));
      return;
    }
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight, type: blob.type || 'image/jpeg', size: blob.size });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This image could not be read. Try another JPG, PNG, or WebP file.'));
    };
    image.src = url;
  });
}

export async function prepareArtwork(blob: Blob, focusX = 0.5, focusY = 0.5) {
  const info = await loadArtworkInfo(blob);
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('This image could not be prepared.'));
      element.src = url;
    });
    const cropSize = Math.min(info.width, info.height);
    const sourceX = Math.max(0, Math.min(info.width - cropSize, (info.width - cropSize) * focusX));
    const sourceY = Math.max(0, Math.min(info.height - cropSize, (info.height - cropSize) * focusY));
    const outputSize = Math.min(2048, cropSize);
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare this image.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, outputSize, outputSize);
    const result = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!result) throw new Error('Your browser could not save this image.');
    return result;
  } finally {
    URL.revokeObjectURL(url);
  }
}