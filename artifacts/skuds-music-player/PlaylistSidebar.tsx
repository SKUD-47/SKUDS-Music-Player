import React from "react";

export type Playlist = {
  id: string;
  name: string;
};

type PlaylistSidebarProps = {
  playlists: Playlist[];
};

export default function PlaylistSidebar({
  playlists,
}: PlaylistSidebarProps) {
  const openPlaylist = (playlistId: string) => {
    window.location.href = `/playlists?playlist=${encodeURIComponent(
      playlistId
    )}`;
  };

  return (
    <aside className="w-64 p-4">
      <h2 className="mb-3 text-sm font-semibold">
        Playlists
      </h2>

      <div className="flex flex-col gap-1">
        {playlists.map((playlist) => (
          <button
            key={playlist.id}
            type="button"
            onClick={() => openPlaylist(playlist.id)}
            className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-100"
          >
            {playlist.name}
          </button>
        ))}
      </div>
    </aside>
  );
}
