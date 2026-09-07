# Next.js App Router

The React subpath is published with a `"use client"` banner, so it can be rendered
straight from a server component.

```bash
pnpm add @kuraykaraaslan/kui-player
```

```tsx
// app/watch/[id]/page.tsx — a server component
import { VideoPlayer } from "@kuraykaraaslan/kui-player/react";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const video = await getVideo(id);

  return (
    <main className="mx-auto max-w-4xl p-6">
      <VideoPlayer
        src={video.mp4}
        poster={video.poster}
        title={video.title}
        subtitles={video.captions}
      />
    </main>
  );
}
```

The player injects its stylesheet on the client. To avoid one unstyled frame on a
server-rendered page, link it in the root layout and turn injection off:

```tsx
// app/layout.tsx
import "@kuraykaraaslan/kui-player/styles.css";
```

```tsx
<VideoPlayer src={video.mp4} injectStyles={false} />
```

The vanilla core is SSR-safe on its own — constructing a `VideoPlayerEngine` touches no
browser global — so it can be imported in shared code without a dynamic import.
