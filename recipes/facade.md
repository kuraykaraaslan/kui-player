# Click-to-load cover (facade)

For pages where the video is below the fold or optional: render a poster and a play
button, and download the player only when the viewer clicks.

```tsx
import { VideoPlayerFacade } from "@kuraykaraaslan/kui-player/facade";

<VideoPlayerFacade
  src="/movie.mp4"
  poster="/movie.jpg"
  title="Big Buck Bunny"
  aspectRatio="16 / 9"
/>
```

- **Cost before the click:** `facade` is about 1 kB gzip. The player, its stylesheet and
  any adapter you pass load on demand through a dynamic `import()` of
  `@kuraykaraaslan/kui-player/react`, which your bundler turns into a separate chunk.
- **No layout shift:** the cover and the player share `aspectRatio`, so the box does not
  change size when the player mounts.
- **Starts playing on the click:** the player mounts with `autoPlay`; the browser allows it
  because the viewer just interacted with the page.
- **Prefetch:** on hover or focus the chunk starts downloading (`prefetch={false}` turns it off).
- **Accessible:** the cover is a real `<button>` named `Play <title>` (`playLabel` to translate it),
  reachable and activated with the keyboard.
- Every other `VideoPlayer` prop (`adapters`, `persist`, `locale`, …) is passed through.

> **Note:** the facade is a React component; there is no vanilla / `mountSkin` counterpart yet.
