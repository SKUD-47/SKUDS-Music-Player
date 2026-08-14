import {
  fetchArtworkBlob,
  prepareArtwork,
  searchArtwork,
  type ArtworkCandidate,
} from './artwork';

export interface AutoArtworkInput {
  title: string;
  artist: string;
  album?: string;
}

export interface AutoArtworkResult {
  candidate: ArtworkCandidate;
  artwork: Awaited<ReturnType<typeof prepareArtwork>>;
}

/**
 * Automatically finds the best artwork for a song.
 *
 * Behavior:
 * 1. Uses the existing artwork search system.
 * 2. Looks at every returned candidate.
 * 3. Chooses the candidate with the highest confidence.
 * 4. If multiple candidates have the exact same confidence,
 *    randomly chooses one of them.
 * 5. Downloads and prepares the selected artwork.
 */
export async function autoFindArtwork(
  input: AutoArtworkInput,
): Promise<AutoArtworkResult | null> {
  try {
    const candidates = await searchArtwork(
      input.title,
      input.artist,
      input.album ?? '',
    );

    if (!candidates.length) {
      return null;
    }

    const winner = chooseHighestConfidence(candidates);

    if (!winner) {
      return null;
    }

    const blob = await fetchArtworkBlob(winner);
    const artwork = await prepareArtwork(blob);

    return {
      candidate: winner,
      artwork,
    };
  } catch (error) {
    console.warn(
      `[artwork-auto] Failed to find artwork for "${input.title}"`,
      error,
    );

    return null;
  }
}

/**
 * Finds the highest-confidence candidate.
 *
 * Exact confidence ties are resolved randomly.
 */
function chooseHighestConfidence(
  candidates: ArtworkCandidate[],
): ArtworkCandidate | null {
  if (!candidates.length) {
    return null;
  }

  const highestConfidence = Math.max(
    ...candidates.map((candidate) => candidate.confidence),
  );

  const tiedCandidates = candidates.filter(
    (candidate) => candidate.confidence === highestConfidence,
  );

  if (!tiedCandidates.length) {
    return null;
  }

  // Only one candidate has the highest score.
  if (tiedCandidates.length === 1) {
    return tiedCandidates[0];
  }

  // Exact tie: randomly select one.
  const randomIndex = Math.floor(
    Math.random() * tiedCandidates.length,
  );

  return tiedCandidates[randomIndex];
}
