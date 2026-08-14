export interface FolderPlaylistImport {
  files: File[];
  playlistName: string;
}

export function askForFolderPlaylist(
  files: FileList | File[],
): FolderPlaylistImport | null {
  const fileArray = Array.from(files);

  if (fileArray.length === 0) {
    return null;
  }

  const firstFile = fileArray[0] as File & {
    webkitRelativePath?: string;
  };

  const relativePath = firstFile.webkitRelativePath ?? '';

  // Example:
  // "My Music/song.mp3"
  //                 ↓
  //              "My Music"
  const folderName =
    relativePath.split('/')[0] ||
    'My Music';

  const playlistName = window.prompt(
    'What would you like to name this playlist?',
    folderName,
  );

  if (!playlistName?.trim()) {
    return null;
  }

  return {
    files: fileArray,
    playlistName: playlistName.trim(),
  };
}
