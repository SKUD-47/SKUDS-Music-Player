import React, { useEffect, useState } from "react";

type Playlist = {
  id: string;
  name: string;
};

const playlists: Playlist[] = [
  {
    id: "d34fa5b3-98ae-4eff-902c-aef2cf36049d",
    name: "My Playlist",
  },
  {
    id: "test-playlist-2",
    name: "Chill",
  },
  {
    id: "test-playlist-3",
    name: "Favorites",
  },
];

export default function PlaylistSidebarTest() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Read the playlist from the URL when the page loads.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSelectedId(params.get("playlist"));
  }, []);

  const openPlaylist = (playlist: Playlist) => {
    const url = `/playlists?playlist=${encodeURIComponent(playlist.id)}`;

    // Update the URL.
    window.history.pushState({}, "", url);

    // Immediately show the playlist.
    setSelectedId(playlist.id);
  };

  const selectedPlaylist = playlists.find(
    (playlist) => playlist.id === selectedId
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "#0b0f0c",
        color: "#fff",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* SIDEBAR */}
      <aside
        style={{
          width: 260,
          padding: 24,
          borderRight: "1px solid #26332a",
          boxSizing: "border-box",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Playlists</h2>

        {playlists.map((playlist) => {
          const isSelected = selectedId === playlist.id;

          return (
            <button
              key={playlist.id}
              type="button"
              onClick={() => openPlaylist(playlist)}
              style={{
                display: "block",
                width: "100%",
                marginBottom: 8,
                padding: "12px 14px",
                border: "none",
                borderRadius: 8,
                textAlign: "left",
                cursor: "pointer",
                color: "#fff",
                background: isSelected ? "#285c38" : "#151c17",
              }}
            >
              {playlist.name}
            </button>
          );
        })}
      </aside>

      {/* PLAYLIST PAGE */}
      <main
        style={{
          flex: 1,
          padding: 40,
        }}
      >
        {selectedPlaylist ? (
          <>
            <div style={{ color: "#55d879", marginBottom: 8 }}>
              PLAYLIST
            </div>

            <h1 style={{ marginTop: 0 }}>
              {selectedPlaylist.name}
            </h1>

            <p style={{ color: "#999" }}>
              Playlist ID: {selectedPlaylist.id}
            </p>

            <div
              style={{
                marginTop: 30,
                padding: 20,
                borderRadius: 12,
                background: "#151c17",
              }}
            >
              ✅ Correct playlist opened.
            </div>
          </>
        ) : (
          <>
            <h1>Playlist homepage</h1>

            <p style={{ color: "#999" }}>
              Click a playlist in the sidebar.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
