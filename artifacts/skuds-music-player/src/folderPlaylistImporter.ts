export type FolderImportResult = {
  files: File[];
  playlistName: string;
};

export function openFolderPlaylistImporter(): Promise<FolderImportResult | null> {
  console.log('🔥 FOLDER IMPORTER CALLED');

  return new Promise((resolve) => {
    const input = document.createElement('input');

    input.type = 'file';
    input.multiple = true;
    input.accept = 'audio/*';

    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');

    input.style.display = 'none';

    document.body.appendChild(input);

    input.addEventListener(
      'change',
      () => {
        const files = Array.from(input.files ?? []);

        input.remove();

        if (!files.length) {
          resolve(null);
          return;
        }

        const firstFile = files[0] as File & {
          webkitRelativePath?: string;
        };

        const folderName =
          firstFile.webkitRelativePath?.split('/')[0] ||
          'My Music';

        const playlistName = window.prompt(
          'What would you like to name this playlist?',
          folderName,
        );

        if (!playlistName?.trim()) {
          resolve(null);
          return;
        }

        resolve({
          files,
          playlistName: playlistName.trim(),
        });
      },
      { once: true },
    );

    input.click();
  });
}


// NEW: handles normal imports of 4+ songs
export function askForPlaylistForFiles(
  files: FileList | File[],
): { files: File[]; playlistName: string } | null {
  const fileArray = Array.from(files);

  // 1–3 songs: import normally, no playlist prompt.
  if (fileArray.length <= 3) {
    return {
      files: fileArray,
      playlistName: '',
    };
  }

  // 4+ songs: ask for a playlist name.
  const playlistName = window.prompt(
    'You imported 4 or more songs. What would you like to name this playlist?',
    'My Playlist',
  );

  // Cancel = don't import.
  if (!playlistName?.trim()) {
    return null;
  }

  return {
    files: fileArray,
    playlistName: playlistName.trim(),
  };
}
