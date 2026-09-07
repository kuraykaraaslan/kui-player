import { useMemo, useState } from "react";
import { VideoPlayer } from "../react";
import { createHlsAdapter } from "../modules/videoplayer/adapters";
import DemoShell from "./DemoShell";

interface Clip {
  id: string;
  title: string;
  src: string;
  poster: string;
  duration: string;
}

// Public, web-playback-friendly sample clips (faststart MP4 + matching poster).
// The old gtv-videos-bucket URLs were taken offline (HTTP 403).
const W3 = "https://media.w3.org/2010/05";
const PLAYLIST: Clip[] = [
  { id: "bbb", title: "Big Buck Bunny", src: `${W3}/bunny/movie.mp4`, poster: `${W3}/bunny/poster.png`, duration: "9:56" },
  { id: "sintel", title: "Sintel", src: `${W3}/sintel/trailer.mp4`, poster: `${W3}/sintel/poster.png`, duration: "0:52" },
  { id: "oceans", title: "Oceans", src: "https://vjs.zencdn.net/v/oceans.mp4", poster: "https://vjs.zencdn.net/v/oceans.png", duration: "0:46" },
  { id: "test", title: "HD Test Pattern", src: `${W3}/video/movie_300.mp4`, poster: `${W3}/video/poster.png`, duration: "0:28" },
  { id: "bbb-trailer", title: "Big Buck Bunny — Trailer", src: `${W3}/bunny/trailer.mp4`, poster: `${W3}/bunny/poster.png`, duration: "0:33" },
  // Adaptive: hls.js drives this one (loaded from a CDN in index.html), so the
  // quality menu fills itself from the manifest and gains an "Auto" entry.
  { id: "hls", title: "Adaptive HLS (hls.js)", src: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", poster: `${W3}/bunny/poster.png`, duration: "live-ish" },
  // Deliberately broken — exercises the error overlay / retry path.
  { id: "broken", title: "Broken source (404)", src: `${W3}/does-not-exist.mp4`, poster: `${W3}/bunny/poster.png`, duration: "—" },
];

const QUALITIES = [
  { label: "1080p", value: "1080" },
  { label: "720p", value: "720" },
  { label: "480p", value: "480" },
];

const DEFAULT_CLIP = PLAYLIST[0]!;

export default function App() {
  const [activeId, setActiveId] = useState(DEFAULT_CLIP.id);
  // Registered once: it picks up `window.Hls` lazily and stays inert for
  // progressive sources, so the MP4 clips are untouched by it.
  const adapters = useMemo(() => [createHlsAdapter()], []);
  const active = PLAYLIST.find((c) => c.id === activeId) ?? DEFAULT_CLIP;

  const sidebar = (
    <div className="flex flex-col gap-1">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Playlist</div>
      {PLAYLIST.map((clip, i) => {
        const isActive = clip.id === activeId;
        return (
          <button
            key={clip.id}
            type="button"
            onClick={() => setActiveId(clip.id)}
            className={`flex items-center gap-3 rounded-lg p-2 text-left transition-colors ${
              isActive ? "bg-primary-subtle" : "hover:bg-surface-overlay"
            }`}
          >
            <span
              className="h-10 w-16 flex-shrink-0 rounded-md border border-border bg-cover bg-center"
              style={{ backgroundImage: `url(${clip.poster})` }}
            />
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-[13px] font-medium ${isActive ? "text-primary" : "text-text-primary"}`}>
                {clip.title}
              </span>
              <span className="font-mono text-[11px] text-text-secondary">
                {String(i + 1).padStart(2, "0")} · {clip.duration}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <DemoShell
      brand="KUI Player"
      version="v0.0.2"
      link={{ href: "https://kuray.dev", label: "kuray.dev" }}
      github="https://github.com/kuraykaraaslan/kui-player"
      npm="https://www.npmjs.com/package/@kuraykaraaslan/kui-player"
      sidebarTitle="Library"
      sidebarCount={`${PLAYLIST.length} clips`}
      sidebar={sidebar}
      status={{ tone: "ready", text: `Now playing — ${active.title}`, meta: active.duration }}
      stageClassName="grid place-items-center p-6"
    >
      <div className="w-full max-w-4xl">
        <VideoPlayer
          key={active.id}
          src={active.src}
          poster={active.poster}
          title={active.title}
          adapters={adapters}
          qualities={active.id === "hls" ? undefined : QUALITIES}
          defaultQuality="720"
          autoFullscreenOnLandscape
          onQualityChange={(v) => console.log("quality:", v)}
        />
      </div>
    </DemoShell>
  );
}
