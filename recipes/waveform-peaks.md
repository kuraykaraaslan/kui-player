# Waveform peaks

`scripts/peaks.mjs` decodes the audio of a file with ffmpeg and writes
audiowaveform-compatible JSON that the `waveform` prop reads. Requires `ffmpeg`
on PATH; no npm dependencies. Generating the file ahead of time avoids the
`'decode'` mode, which downloads and decodes the whole media in the browser.

```sh
node scripts/peaks.mjs episode.mp3 --out public/episode.peaks.json
```

```tsx
<VideoPlayer src="/episode.mp3" audioOnly waveform="/episode.peaks.json" />
```

| Flag | Default | Meaning |
|---|---|---|
| `--out` | `peaks.json` | output file |
| `--samples-per-pixel` | `256` | audio samples folded into each min/max pair |
| `--sample-rate` | `8000` | rate the audio is resampled to before folding |
| `--bits` | `8` | `8` or `16`: resolution of the stored values |

The output follows the BBC `audiowaveform` JSON layout (`version`, `channels`,
`sample_rate`, `samples_per_pixel`, `bits`, `length`, interleaved `data` min/max),
so a file made by `audiowaveform` itself works the same way. Audio is mixed down
to mono. The player draws about 160 bars whatever the file holds, so long
recordings need no tuning; a larger `--samples-per-pixel` just makes a smaller file.
