export type FolderImportResult = {
  files: File[];
  playlistName: string;
};

export function openFolderPlaylistImporter(): Promise<FolderImportResult | null> {
  console.log('🔥 FOLDER IMPORTER CALLED');  return new Promise((resolve) => {
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
