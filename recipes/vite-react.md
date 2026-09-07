# Vite + React

```bash
pnpm add @kuraykaraaslan/kui-player
```

```tsx
import { VideoPlayer } from "@kuraykaraaslan/kui-player/react";

export function Watch() {
  return (
    <div style={{ maxWidth: 900 }}>
      <VideoPlayer
        src="https://example.com/video.mp4"
        poster="https://example.com/poster.jpg"
        title="Big Buck Bunny"
        subtitles={[{ label: "English", srclang: "en", src: "/subs/en.vtt" }]}
      />
    </div>
  );
}
```

No stylesheet import and no Tailwind setup: the player carries its own scoped CSS.
Theme it by overriding custom properties on any ancestor:

```css
.watch-page { --kui-accent: #e11d48; --kui-radius: 4px; }
```
