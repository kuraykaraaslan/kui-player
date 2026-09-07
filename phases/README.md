# kui-player — Yol Haritası

Rakip araştırması (Eylül 2026) ve kod denetimi sonucu çıkan özelliklerin önem sırasına
göre gruplanmış hâli.

## Bağlam: neden bu sıralama

Mart 2026'da **Video.js, Plyr, Vidstack ve Media Chrome ekipleri birleşti**. Video.js v10
beta çıktı (React bundle'ı 18 KB gzip, minimal hello-world < 5 KB), genel kullanıma açılma
hedefi 2026 ortası, dört projeye de migration guide ile. Toplamda ~75.000 GitHub yıldızı.

Yani **"genel amaçlı iyi bir video player" pazarı kapanıyor.** kui-player özellik
yarışına girerse kaybeder. Strateji:

1. Önce **sağlamlaştır** (Faz 0–3) — bugün production'da kullanılamaz durumda.
2. Sonra **dar bir nişte kazan** (Faz 5) — `mountSkin` (sayfadaki mevcut `<video>`'yu
   ele geçirip chrome giydirme) ve Cast-first konumlanması. İkisi de kodda **zaten var**,
   sadece ürünleştirilmemiş. Rakiplerde doğrudan karşılığı yok.

## Fazlar

| Faz | Başlık | Öncelik | Efor | Durum |
|---|---|---|---|---|
| [0](./phase-0-stabilization.md) | Stabilizasyon | 🔴 Blocker | ~1 hafta | ✅ |
| [1](./phase-1-playback-compat.md) | Oynatma uyumluluğu | 🔴 Zorunlu | ~2 hafta | ✅ |
| [2](./phase-2-bundle-integration.md) | Bundle & entegrasyon | 🔴 Zorunlu | ~2 hafta | ✅ |
| [3](./phase-3-quality-gate.md) | Kalite kapısı | 🔴 Zorunlu | ~2 hafta | ✅ |
| [4](./phase-4-expected-features.md) | Beklenen özellikler | 🟡 Olsa iyi | ~4 hafta | ⬜ |
| [5](./phase-5-differentiation.md) | Niş farklılaşma | 🟣 Stratejik | ~3 hafta | ⬜ |
| [6](./phase-6-verticals.md) | Dikey nişler | 🟣 Keşif | opsiyonel | ⬜ |

**Faz 0–3 "gereken"dir** — bunlar bitmeden `0.1.0` etiketi atılmamalı.
**Faz 0–3 tamamlandı: `0.1.0` kapısı açık.**
Faz 4 rekabette kalmak, Faz 5 kazanmak için. Faz 6 bir yol haritası değil, opsiyon havuzu.

**Sıra:** 0 → 1 → 2 → 3 kesin sıralı. Faz 3 bittikten sonra 4 ve 5 **paralel** yürütülebilir;
5.1 ve 5.5 mümkünse önce, çünkü konumlandırma mesajını belirliyorlar.

---

## Öncelik sırasına göre tam liste

### 🔴 Olması gereken — Faz 0–3

| Faz | # | Madde | Efor |
|---|---|---|---|
| 0 | 0.1 | `error` event'i + hata UI'ı / retry — *bugün bozuk kaynakta sonsuz spinner* | XS |
| 0 | 0.2 | Eksik native event'ler (`volumechange`, `ratechange`, `seeking/seeked`, `loadedmetadata`) | XS |
| 0 | 0.3 | Kalite değişiminde pozisyon koruma | S |
| 0 | 0.4 | `playsInline` eksik — *iOS'ta oynatma zorla native tam ekrana geçiyor* | XS |
| 0 | 0.5 | Ölü kodun temizlenmesi — *4 kullanılmayan hook, ~224 satır* | XS |
| 0 | 0.6 | README'deki "HLS/DASH-ready" beyanının düzeltilmesi | XS |
| 0 | 0.7 | SSR güvenliği + `"use client"` dokümantasyonu | XS |
| 1 | 1.1 | **hls.js / dash.js adaptörü** (opsiyonel peer dep) + ABR "Otomatik" seçeneği | M |
| 1 | 1.2 | Gerçek ses-izi değiştirme | S |
| 1 | 1.3 | Picture-in-Picture | XS |
| 1 | 1.4 | Mobil dokunma jestleri | S |
| 1 | 1.5 | Fullscreen fallback'i (iOS) | S |
| 2 | 2.1 | **FontAwesome → inline SVG** — *~97 KB gzip'in en büyük kalemi* | S |
| 2 | 2.2 | Tailwind bağımlılığının izolasyonu + CSS custom property teması | M |
| 2 | 2.3 | Kod bölme, tree-shaking, `size-limit` bütçesi | S |
| 2 | 2.4 | Peer dependency temizliği (`clsx`, `tailwind-merge`) | XS |
| 3 | 3.1 | A11y tamamlama (focus trap, `aria-valuetext`, canlı bölge, kontrast) | M |
| 3 | 3.2 | Test altyapısı (Vitest + Testing Library + Playwright) — *bugün sıfır test* | M |
| 3 | 3.3 | CI — *bugün `.github` dizini yok* | S |
| 3 | 3.4 | Dokümantasyon ve demo | S |

### 🟡 Olsa iyi olur — Faz 4

| # | Madde | Efor |
|---|---|---|
| 4.1 | Media Session API | S |
| 4.2 | AirPlay — *Cast var, Apple tarafı komple açık* | XS |
| 4.3 | Kaldığın yerden devam + tercih kalıcılığı | S |
| 4.4 | Chapters | M |
| 4.5 | Seek hover thumbnail / storyboard — *`seekHoverX` state'i zaten var* | M |
| 4.6 | Event / analytics API + CMCD | S |
| 4.7 | Tema / skin sistemi, slot kompozisyonu | M |
| 4.8 | i18n + RTL — *TR/AR pazarı için gerçek farklılaştırıcı* | M |
| 4.9 | SRT + ASS/SSA altyazı, altyazı stil paneli | M |
| 4.10 | Canlı yayın + DVR modu | M |
| 4.11 | Playlist / sıradaki video | M |
| 4.12 | Zustand'ı runtime bağımlılıktan çıkar → sıfır bağımlılık | M |
| 4.13 | Framework wrapper'ları (Web Component, Vue, Svelte) | L |

### 🟣 Niş — Faz 5 (farklılaştırıcı)

| # | Madde | Efor |
|---|---|---|
| 5.1 | **"Skin mode"un ürünleştirilmesi** — *en yüksek öncelik* | M |
| 5.2 | Tek `<script>` embed / no-build kullanım + WordPress eklentisi | S |
| 5.3 | Cast-first konumlanma (queue, custom receiver, çoklu cihaz) | M |
| 5.4 | Gizlilik-öncelikli / sıfır telemetri — *CI testiyle kanıtlanmış* | S |
| 5.5 | `llms.txt` + AI agent dokümantasyonu | XS |

### 🟣 Niş — Faz 6 (opsiyon havuzu, en fazla biri seçilecek)

| # | Madde | Efor |
|---|---|---|
| 6.1 | Reklam desteği (VAST/VMAP, IMA SDK'sız) — *v10'da 2026 sonuna kadar yok* | L |
| 6.2 | Altyazı senkron kaydırma / düzenleyici | M |
| 6.3 | Frame-by-frame + SMPTE timecode — *en iyi efor/etki oranı* | S |
| 6.4 | A-B loop & bölüm tekrarı | S |
| 6.5 | Eğitim modu (transkript, zaman damgalı not) | L |
| 6.6 | Ses dalga formu / audio-only mod | M |

---

## Efor ölçeği

`XS` < yarım gün · `S` 1–2 gün · `M` 3–5 gün · `L` 1–2 hafta

## Kaynaklar

- [Video.js v10 Beta: Hello, World (again)](https://videojs.org/blog/videojs-v10-beta-hello-world-again)
- [Video.js v10 Delivers 81% Smaller Bundles as Four Major Player Projects Converge](https://www.einnews.com/pr_news/898419365/video-js-v10-delivers-81-smaller-bundles-as-four-major-player-projects-converge)
- [Vidstack Player — Getting Started](https://vidstack.io/docs/player/)
- [The best React video player libraries of 2026 — Croct](https://blog.croct.com/post/best-react-video-libraries)
- [Ultimate HTML5 Video-Player Showdown — Cloudinary](https://cloudinary.com/blog/html5_video_player)
- [Shaka Player in Depth — Fora Soft](https://www.forasoft.com/learn/video-streaming/articles-streaming/shaka-player-deep-dive)
- [dash.js in Depth — Fora Soft](https://www.forasoft.com/learn/video-streaming/articles-streaming/dash-js-deep-dive)
- [CSAI ve VAST/VPAID/SIMID — Fora Soft](https://www.forasoft.com/learn/video-streaming/articles-streaming/csai-vast-vpaid-simid)
- [OpenPlayerJS](https://github.com/openplayerjs/openplayerjs)
- [Media Session API — web.dev](https://web.dev/articles/media-session)
