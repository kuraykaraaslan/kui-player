# Storyboard (seek-preview thumbnails)

`scripts/storyboard.mjs` turns a video into one sprite sheet and a `thumbs.vtt`
that the seek preview reads. Requires `ffmpeg` and `ffprobe` on PATH.

```sh
node scripts/storyboard.mjs movie.mp4 --out public/sb --interval 5 --width 160 --columns 10
```

| Flag | Default | Meaning |
|---|---|---|
| `--out` | `storyboard` | output directory (`sprite.jpg`, `thumbs.vtt`) |
| `--interval` | `5` | seconds between thumbnails |
| `--width` | `160` | tile width in px; height keeps the aspect ratio |
| `--columns` | `10` | tiles per sprite row |

Pass the VTT to the player as the storyboard source; cues use `sprite.jpg#xywh=x,y,w,h`,
the format `parseStoryboard` reads (covered by a round-trip test).

## Alternatives

- **Cloudflare Stream** produces its own thumbnails; use those when you host there.
- **AWS MediaConvert** can emit frame captures; combine them into a sprite and
  write the same `#xywh` VTT.
