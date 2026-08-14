import {
  fetchArtworkBlob,
  prepareArtwork,
  searchArtwork,
  type ArtworkCandidate,
} from './artwork';

type AutoArtworkSong = {
  title: string;
  artist: string;
  album: string;
};

export async function autoFindArtwork(
  song: AutoArtworkSong,
): Promise<{
  artwork: Blob;
  candidate: ArtworkCandidate;
} | null> {
  try {
    const candidates = await searchArtwork(
      song.title,
      song.artist,
      song.album,
    );

    if (!candidates.length) return null;

    const highestConfidence = Math.max(
      ...candidates.map((candidate) => candidate.confidence),
    );

    const tied = candidates.filter(
      (candidate) => candidate.confidence === highestConfidence,
    );

    const winner =
      tied.length === 1
        ? tied[0]
        : tied[Math.floor(Math.random() * tied.length)];

    const blob = await fetchArtworkBlob(winner);
    const artwork = await prepareArtwork(blob);

    return {
      artwork,
      candidate: winner,
    };
  } catch (error) {
    console.warn(
      `[artwork-auto] Failed for "${song.title}"`,
      error,
    );

    return null;
  }
}
