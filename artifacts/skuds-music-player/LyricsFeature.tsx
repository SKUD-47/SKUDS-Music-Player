import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Captions, Loader2, X } from 'lucide-react';

type SongLike = {
  id?: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
};

type LyricLine = {
  time: number;
  text: string;
};

type LyricsData = {
  plainLyrics?: string;
  syncedLyrics?: LyricLine[];
  source: 'lrclib';
  fetchedAt: number;
};

type Props = {
  song: SongLike | null;
  currentTime: number;
  onSeek?: (time: number) => void;
};

type LrclibResult = {
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
  instrumental?: boolean;
};

const LRCLIB_API = 'https://lrclib.net/api';

function normalize(value = '') {
  return value
    .toLowerCase()
    .trim()
    .replace(/\.(mp3|m4a|wav|flac|ogg|aac)$/i, '')
    .replace(/[\[\](){}]/g, '')
    .replace(/\s+/g, ' ');
}

function useful(value = '') {
  const normalized = normalize(value);

  return (
    normalized.length > 0 &&
    normalized !== 'unknown artist' &&
    normalized !== 'local file' &&
    normalized !== 'unknown album' &&
    normalized !== 'untitled'
  );
}

function cacheKey(song: SongLike) {
  return [
    normalize(song.artist),
    normalize(song.title),
    normalize(song.album),
    Math.round(song.duration),
  ].join('|');
}

function readCache(song: SongLike): LyricsData | null {
  try {
    const raw = localStorage.getItem(
      `skuds-lyrics:${cacheKey(song)}`
    );

    if (!raw) return null;

    return JSON.parse(raw) as LyricsData;
  } catch {
    return null;
  }
}

function writeCache(song: SongLike, lyrics: LyricsData) {
  try {
    localStorage.setItem(
      `skuds-lyrics:${cacheKey(song)}`,
      JSON.stringify(lyrics)
    );
  } catch {
    // Caching is optional.
  }
}

function parseLrc(lrc: string): LyricLine[] {
  const result: LyricLine[] = [];

  for (const rawLine of lrc.split(/\r?\n/)) {
    const timestamps = [
      ...rawLine.matchAll(
        /\[(\d+):(\d{2}(?:\.\d+)?)\]/g
      ),
    ];

    if (!timestamps.length) continue;

    const text = rawLine
      .replace(/\[\d+:\d{2}(?:\.\d+)?\]/g, '')
      .trim();

    if (!text) continue;

    for (const timestamp of timestamps) {
      const minutes = Number(timestamp[1]);
      const seconds = Number(timestamp[2]);

      result.push({
        time: minutes * 60 + seconds,
        text,
      });
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

function scoreResult(
  song: SongLike,
  result: LrclibResult
) {
  let score = 0;

  const title = normalize(song.title);
  const resultTitle = normalize(result.trackName);

  if (title === resultTitle) {
    score += 60;
  } else if (
    title.includes(resultTitle) ||
    resultTitle.includes(title)
  ) {
    score += 35;
  }

  if (useful(song.artist)) {
    const artist = normalize(song.artist);
    const resultArtist = normalize(result.artistName);

    if (artist === resultArtist) {
      score += 30;
    } else if (
      artist.includes(resultArtist) ||
      resultArtist.includes(artist)
    ) {
      score += 15;
    }
  }

  if (song.duration > 0 && result.duration > 0) {
    const difference = Math.abs(
      song.duration - result.duration
    );

    if (difference <= 2) score += 25;
    else if (difference <= 5) score += 15;
    else if (difference <= 10) score += 5;
  }

  if (useful(song.album)) {
    const album = normalize(song.album);
    const resultAlbum = normalize(result.albumName);

    if (album === resultAlbum) {
      score += 15;
    }
  }

  return score;
}

async function lrclibGet(song: SongLike) {
  const params = new URLSearchParams();

  params.set('track_name', song.title);

  if (useful(song.artist)) {
    params.set('artist_name', song.artist);
  }

  if (useful(song.album)) {
    params.set('album_name', song.album);
  }

  if (song.duration > 0) {
    params.set(
      'duration',
      String(Math.round(song.duration))
    );
  }

  const response = await fetch(
    `${LRCLIB_API}/get?${params.toString()}`,
    {
      headers: {
        'X-User-Agent':
          'SKUDS-Music-Player/1.0',
      },
    }
  );

  if (!response.ok) {
    throw new Error('not-found');
  }

  return response.json() as Promise<LrclibResult>;
}

async function lrclibSearch(song: SongLike) {
  const params = new URLSearchParams();

  params.set('track_name', song.title);

  if (useful(song.artist)) {
    params.set('artist_name', song.artist);
  }

  const response = await fetch(
    `${LRCLIB_API}/search?${params.toString()}`,
    {
      headers: {
        'X-User-Agent':
          'SKUDS-Music-Player/1.0',
      },
    }
  );

  if (!response.ok) {
    throw new Error('search-failed');
  }

  return response.json() as Promise<LrclibResult[]>;
}

async function findLyrics(song: SongLike) {
  try {
    return await lrclibGet(song);
  } catch {
    // Fall back to search.
  }

  const results = await lrclibSearch(song);

  if (!results.length) {
    throw new Error('not-found');
  }

  const ranked = results
    .map((result) => ({
      result,
      score: scoreResult(song, result),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];

  if (!best || best.score < 50) {
    throw new Error('ambiguous');
  }

  return best.result;
}

function convertResult(
  result: LrclibResult
): LyricsData {
  return {
    plainLyrics:
      result.plainLyrics ?? undefined,

    syncedLyrics:
      result.syncedLyrics
        ? parseLrc(result.syncedLyrics)
        : undefined,

    source: 'lrclib',
    fetchedAt: Date.now(),
  };
}

function getActiveLine(
  lyrics: LyricLine[],
  currentTime: number
) {
  let index = -1;

  for (let i = 0; i < lyrics.length; i++) {
    if (lyrics[i].time <= currentTime) {
      index = i;
    } else {
      break;
    }
  }

  return index;
}

export function LyricsFeature({
  song,
  currentTime,
  onSeek,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lyrics, setLyrics] =
    useState<LyricsData | null>(null);
  const [error, setError] = useState('');

  const activeLineRef =
    useRef<HTMLButtonElement | null>(null);

  const syncedLyrics =
    lyrics?.syncedLyrics ?? [];

  const activeIndex = useMemo(
    () =>
      getActiveLine(
        syncedLyrics,
        currentTime
      ),
    [syncedLyrics, currentTime]
  );

  useEffect(() => {
    if (!open || !song) return;

    const cached = readCache(song);

    if (cached) {
      setLyrics(cached);
      setError('');
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError('');
    setLyrics(null);

    findLyrics(song)
      .then((result) => {
        if (cancelled) return;

        const converted =
          convertResult(result);

        writeCache(song, converted);
        setLyrics(converted);
      })
      .catch((reason: Error) => {
        if (cancelled) return;

        if (reason.message === 'ambiguous') {
          setError(
            'I couldn’t confidently identify this song.'
          );
        } else {
          setError(
            'Lyrics could not be found for this song.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, song]);

  useEffect(() => {
    if (!open) return;

    activeLineRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [activeIndex, open]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [open]);

 const button = (
  <button
    type="button"
    disabled={!song}
    onClick={() => setOpen(true)}
    title="Lyrics"
    aria-label="Lyrics"
    className="button-icon h-9 w-9"
  >
    <Captions size={16} />
  </button>
);

  if (!open) {
    return button;
  }

  const modal = (
    <div
      className="fixed left-0 top-0 z-[2147483647] flex h-[100dvh] w-[100vw] items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          setOpen(false);
        }
      }}
    >
      <div
        className={[
          'flex',
          'h-auto',
          'max-h-[85dvh]',
          'w-[min(720px,92vw)]',
          'flex-col',
          'overflow-hidden',
          'rounded-2xl',
          'border border-white/10',
          'bg-[#0b1511]',
          'shadow-2xl',
        ].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label="Lyrics"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <div className="font-display text-lg font-semibold">
              Lyrics
            </div>

            {song && (
              <div className="mt-1 truncate text-xs text-muted-foreground">
                {song.title}
                {useful(song.artist)
                  ? ` · ${song.artist}`
                  : ''}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            aria-label="Close lyrics"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
          {loading && (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-4">
              <Loader2
                size={26}
                className="animate-spin text-primary"
              />

              <div className="text-sm text-muted-foreground">
                Finding lyrics…
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
              <Captions
                size={30}
                className="mb-4 text-muted-foreground"
              />

              <div className="font-display text-lg font-semibold">
                Lyrics unavailable
              </div>

              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                {error}
              </p>
            </div>
          )}

          {!loading &&
            !error &&
            syncedLyrics.length > 0 && (
              <div className="space-y-4 py-10">
                {syncedLyrics.map(
                  (line, index) => {
                    const active =
                      index === activeIndex;

                    return (
                      <button
                        type="button"
                        key={`${line.time}-${index}`}
                        ref={(element) => {
                          if (active) {
                            activeLineRef.current =
                              element;
                          }
                        }}
                        onClick={() =>
                          onSeek?.(line.time)
                        }
                        className={[
                          'block w-full text-left',
                          'leading-8 transition-all',
                          'duration-300',
                          active
                            ? 'scale-[1.02] text-xl font-semibold text-primary'
                            : 'text-lg text-muted-foreground hover:text-foreground',
                        ].join(' ')}
                      >
                        {line.text}
                      </button>
                    );
                  }
                )}
              </div>
            )}

          {!loading &&
            !error &&
            syncedLyrics.length === 0 &&
            lyrics?.plainLyrics && (
              <div className="whitespace-pre-wrap py-8 text-base leading-8 text-foreground/85">
                {lyrics.plainLyrics}
              </div>
            )}

          {!loading &&
            !error &&
            !lyrics?.plainLyrics &&
            syncedLyrics.length === 0 && (
              <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">
                No lyrics are available for this song.
              </div>
            )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {button}

      {typeof document !== 'undefined'
        ? createPortal(modal, document.body)
        : null}
    </>
  );
}
