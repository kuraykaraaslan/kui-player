# Faz 1 — Oynatma Uyumluluğu

**Öncelik:** 🔴 Zorunlu · **Efor:** ~2 hafta · **Önkoşul:** Faz 0 · **Durum:** ✅ Tamamlandı

> Faz 0 mevcut özellikleri çalışır hâle getirdi. Bu faz, 2026'da bir video player'dan
> beklenen **taban uyumluluğu** sağlıyor. Bunlar olmadan kütüphane "demo" kategorisinde kalır.

---

## 1.1 — hls.js / dash.js adaptörü 🔴 M

**Neden:** Rakiplerin tamamı adaptif akış destekliyor. Vidstack HLS + DASH + DRM,
Shaka tek API'de ikisi birden, Video.js v10 + SPF 38.7 KB gzip ile HLS dahil.
Bugün kui-player'ın Chrome'da HLS oynatamaması en büyük tekil eksik.

**Tasarım — bağımlılık eklemeden:**

```ts
// modules/videoplayer/adapters/hls.adapter.ts
export interface MediaAdapter {
  canPlay(src: string): boolean;
  attach(video: HTMLVideoElement, src: string): Promise<void>;
  getQualities(): QualityOption[];   // ABR seviyeleri
  setQuality(index: number): void;   // -1 = auto
  detach(): void;
}
```

- `hls.js` ve `dash.js` **opsiyonel peerDependency** olsun — bundle'a girmesin.
- Adaptör runtime'da varsa devreye girsin, yoksa native `<video>` davranışına düşsün.
- Safari'de `video.canPlayType('application/vnd.apple.mpegurl')` varsa native tercih edilsin.
- Kayıt API'si: `engine.use(hlsAdapter)` — kullanıcı ne yüklediğini kendi seçsin.

**Bonus:** Adaptör ABR seviyelerini otomatik doldurunca `qualities` prop'unu elle
vermeye gerek kalmaz ve **kalite menüsüne "Otomatik" seçeneği** eklenebilir.

**Kabul kriteri:** Chrome'da bir HLS manifest'i `hls.js` yüklüyken oynuyor,
kalite menüsü ABR seviyelerini otomatik listeliyor, "Otomatik" seçeneği çalışıyor.
`hls.js` yokken bundle boyutu değişmiyor.

---

## 1.2 — Gerçek ses-izi değiştirme 🔴 S

**Sorun:** `audioTracks` prop'u yalnızca menüde etiket gösteriyor; `onAudioTrackChange`
callback'i tetikleniyor ama **hiçbir şey değişmiyor** — asıl iş tüketiciye bırakılmış.

**Yapılacak:**
- Native yol: `video.audioTracks` (Safari) — `enabled` bayrağını çevir.
- HLS yolu: `hls.audioTrack = index`.
- DASH yolu: `player.setCurrentTrack(track)`.
- Adaptör mevcutsa izleri **otomatik keşfet**, `audioTracks` prop'unu opsiyonel yap.

**Kabul kriteri:** Çok sesli bir HLS akışında menüden dil seçimi gerçekten sesi değiştiriyor.

---

## 1.3 — Picture-in-Picture 🔴 XS

**Neden:** 2026'da taban beklenti. Tüm rakiplerde var.

**Yapılacak:**
- Engine'e `togglePictureInPicture()`.
- `document.pictureInPictureEnabled` ile yetenek tespiti — desteklenmiyorsa buton gizli.
- `enterpictureinpicture` / `leavepictureinpicture` dinle, store'a `isPip: boolean`.
- Kontrol çubuğuna buton, klavye kısayolu `i`.
- Cast bağlıyken buton devre dışı.

**Kabul kriteri:** Chrome ve Safari'de PiP açılıp kapanıyor, buton durumu doğru.

---

## 1.4 — Mobil dokunma jestleri 🔴 S

**Sorun:** Klavye kısayolları var ama mobilde hiçbir jest yok. Trafiğin çoğu mobil.

**Yapılacak:**
- Sol/sağ yarıya **çift dokunma** → ∓10s (YouTube deseni), dalga animasyonu ile.
- Tek dokunma → kontrolleri göster/gizle (oynat/duraklat değil — mobil beklentisi bu).
- Dikey kaydırma → sağ yarıda ses, sol yarıda parlaklık (opsiyonel, flag'li).
- Yatay kaydırma → scrub, üstte önizleme zamanı.
- Uzun basma → 2× hızlandırılmış oynatma, bırakınca eski hıza dön.
- `pointer` event'leri kullan, `touch`+`mouse` ikilisini ayrı ayrı yazma.
- Progress bar dokunma hedefi ≥ 44px olacak şekilde büyütülsün.

**Kabul kriteri:** Gerçek bir Android Chrome ve iOS Safari cihazında tüm jestler çalışıyor,
yanlışlıkla tetiklenme yok.

---

## 1.5 — Fullscreen fallback'i 🔴 S

**Sorun:** `toggleFullscreen` yalnızca standart `requestFullscreen` kullanıyor.
**iOS Safari'de `<div>` üzerinde `requestFullscreen` desteklenmez** — yalnızca
`video.webkitEnterFullscreen()` çalışır, o da native oynatıcıyı açar.

**Yapılacak:**
- Yetenek tespiti: standart API → `webkitRequestFullscreen` → `video.webkitEnterFullscreen`.
- iOS'ta son çare olarak **sahte tam ekran** (fixed pozisyonlu, viewport'u kaplayan konteyner)
  — kendi arayüzümüz korunur.
- `orientationchange` ile yatay modda otomatik tam ekran (opsiyonel prop).

**Kabul kriteri:** iOS Safari dahil tüm hedef tarayıcılarda tam ekran çalışıyor.

---

## Faz 1 çıkış kriterleri

- [x] Chrome/Firefox'ta HLS oynatılıyor — `createHlsAdapter`, `engine.use()` / `adapters` prop.
      `hls.js` bundle'a girmiyor: ctor dışarıdan veriliyor ya da `window.Hls`'ten alınıyor.
- [x] Kalite menüsü ABR seviyelerini otomatik dolduruyor + "Otomatik" seçeneği var —
      `adaptiveQualities` + `activeQualityLabel` ("Auto · 720p")
- [x] Ses izi değiştirme gerçekten çalışıyor — `engine.setAudioTrack()`; adaptör yolu,
      Safari'nin `video.audioTracks` yolu ve otomatik keşif
- [x] PiP var — `engine.togglePictureInPicture()`, `isPip`/`pipSupported`, buton + `i`,
      Cast bağlıyken devre dışı
- [x] Mobil jestler tam — `useTouchGestures`: çift dokunma seek, tek dokunma kontroller,
      uzun basma 2×, yatay scrub, dikey ses/parlaklık; progress bar 44px hedef
- [x] iOS dahil tam ekran çalışıyor — yetenek zinciri + taklit tam ekran (`fakeFullscreen`),
      `Esc` ile çıkış, opsiyonel `autoFullscreenOnLandscape`

**Doğrulama:** `tsc` (lib + tam), beş build, ve derlenmiş engine üzerinde 35 davranış
kontrolü (adaptör yaşam döngüsü, ABR/Auto, ses izi, PiP, tam ekran fallback'i, hls/dash
adaptör seçimi).
