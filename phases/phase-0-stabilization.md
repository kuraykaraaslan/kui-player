# Faz 0 — Stabilizasyon

**Öncelik:** 🔴 Blocker · **Efor:** ~1 hafta · **Durum:** ✅ Tamamlandı

> Bu fazdaki maddeler "özellik" değil, **düzeltme**. Hepsi bugün production kullanımını
> engelleyen davranışlar. Faz 1'e geçmeden önce tamamlanmalı.

---

## 0.1 — `error` event'i ve hata UI'ı 🔴 XS

**Sorun:** [videoplayer.engine.ts:44-52](../modules/videoplayer/videoplayer.engine.ts#L44-L52)
`attach()` içinde `error` event'i dinlenmiyor. Video kaynağı 404 dönerse, codec
desteklenmiyorsa veya ağ koparsa `waiting` → `setLoading(true)` tetiklenir ama `canplay`
hiç gelmez. Sonuç: **sonsuz spinner**, kullanıcıya hiçbir geri bildirim yok.

**Yapılacak:**
- Engine'de `error` ve `stalled` dinle; store'a `error: MediaError | null` alanı ekle.
- `Overlays.tsx` içine `ErrorOverlay` ekle: hata mesajı + "Tekrar dene" butonu.
- Retry: `video.load()` + son `currentTime`'a geri seek.
- Ağ hataları için üstel geri çekilmeli (exponential backoff) otomatik retry — en fazla 3 deneme.
- `MediaError.code`'u okunabilir mesaja çevir (`MEDIA_ERR_SRC_NOT_SUPPORTED` vb.).

**Kabul kriteri:** Geçersiz `src` verildiğinde 2 saniye içinde hata overlay'i görünüyor,
"Tekrar dene" çalışıyor, spinner kalıcı olarak takılmıyor.

---

## 0.2 — Eksik native event'ler 🔴 XS

**Sorun:** Engine yalnızca `timeupdate`, `durationchange`, `progress`, `waiting`, `canplay`,
`play`, `pause`, `ended`, `fullscreenchange` dinliyor. Şunlar eksik:

| Event | Eksikliğinin sonucu |
|---|---|
| `volumechange` | Tüketici `video.volume`'u doğrudan değiştirirse store senkron dışı kalır |
| `ratechange` | Aynı sorun, hız için |
| `seeking` / `seeked` | Seek sırasında loading göstergesi yok |
| `loadedmetadata` | `duration` yalnızca `durationchange` ile geliyor; ilk metadata kaçabiliyor |
| `loadstart` / `emptied` | Kaynak değişiminde state sıfırlanmıyor |

**Yapılacak:** Bu event'leri `attach()` içine ekle, `detach()` içinde temizle. Store'u
tek yönlü kaynak olarak değil, **`<video>` elemanının aynası** olarak kur — DOM her
zaman doğru kaynak, store onu takip etsin.

**Kabul kriteri:** Konsoldan `document.querySelector('video').volume = 0.3` çalıştırıldığında
ses kaydırıcısı güncelleniyor.

---

## 0.3 — Kalite değişiminde pozisyon koruma 🔴 S

**Sorun:** `applyQuality` yalnızca `setSelectedQuality` + `onQualityChange` callback'ini
çağırıyor ([VideoPlayerChrome.tsx](../react/VideoPlayerChrome.tsx)). Tüketici `src`'yi
değiştirince video **baştan başlıyor** ve oynatma duruyor.

**Yapılacak:** Engine'e `switchSource(url)` metodu ekle:
1. `currentTime` ve `paused` durumunu sakla,
2. `src`'yi değiştir + `load()`,
3. `loadedmetadata` beklenip `currentTime` geri yükle,
4. önceden oynuyorduysa `play()`.

`playbackRate`, `muted`, `volume` ve seçili altyazı da korunmalı.

**Kabul kriteri:** 1080p → 720p geçişinde video aynı saniyeden, aynı oynatma durumunda devam ediyor.

---

## 0.4 — `playsInline` eksik 🔴 XS

**Sorun:** [VideoPlayer.tsx](../react/VideoPlayer.tsx) içindeki `<video>` elemanında
`playsInline` yok. iOS Safari'de oynatma **zorla native tam ekran oynatıcıya** geçiyor —
yani mobil Safari'de kui-player'ın kendi arayüzü hiç görünmüyor.

**Yapılacak:** `<video playsInline>` ekle (`webkit-playsinline` de eski cihazlar için).
Prop olarak override edilebilir olsun.

**Kabul kriteri:** iOS Safari'de oynatma sayfa içinde, kui-player kontrolleriyle başlıyor.

---

## 0.5 — Ölü kodun temizlenmesi 🔴 XS

**Sorun:** Şu dört hook **hiçbir yerde kullanılmıyor ve export da edilmiyor** — engine'e
taşınmış mantığın eski kopyaları:

- [react/hooks/useVideoEvents.ts](../react/hooks/useVideoEvents.ts) (69 satır)
- [react/hooks/usePlayerActions.ts](../react/hooks/usePlayerActions.ts) (76 satır)
- [react/hooks/useControlsVisibility.ts](../react/hooks/useControlsVisibility.ts) (67 satır)
- [react/hooks/useFullscreen.ts](../react/hooks/useFullscreen.ts) (12 satır)

Toplam ~224 satır ölü kod, engine ile **davranışsal olarak sapmış** durumda — sonraki
düzeltmelerde hangisinin gerçek olduğu karışacak.

**Yapılacak:** Sil. (Ya da bilinçli bir "headless hook" API'si olarak konumlandırılacaksa
engine'i saracak şekilde yeniden yaz ve `react/index.ts`'ten export et — ama ikisi bir arada olmaz.)

**Kabul kriteri:** `pnpm typecheck` + `pnpm build` temiz geçiyor, ölü hook kalmadı.

---

## 0.6 — README'deki "HLS/DASH-ready" beyanının düzeltilmesi 🔴 XS

**Sorun:** README ve `package.json` açıklaması "HLS/DASH-ready" diyor. Kodda **hiçbir
HLS/DASH entegrasyonu yok** — yalnızca tarayıcının native oynatabildiği kadarı çalışıyor.
Safari HLS'i native oynatır; **Chrome ve Firefox oynatmaz.** Yani kullanıcıların çoğunda
HLS kaynağı hiç çalışmıyor.

**Yapılacak:** Faz 1'deki adaptör gelene kadar dürüst ifade:
> "Safari'de native HLS. Chrome/Firefox için `hls.js`'i `<video>` elemanına kendiniz
> bağlayın — engine mevcut media pipeline'ına dokunmaz."

`package.json` `description` alanı da güncellensin.

**Kabul kriteri:** README'de çalışmayan hiçbir özellik iddiası kalmadı.

---

## 0.7 — SSR güvenliği ve `"use client"` dokümantasyonu 🔴 XS

**Sorun:** En büyük dağıtım kanalı Next.js App Router. `document`/`window` erişimleri
modül seviyesinde değil ama React bileşenleri client-only ve bu belgelenmemiş.

**Yapılacak:**
- `react/index.ts` ve `VideoPlayer.tsx` başına `"use client"` direktifi.
- Engine'de `document` erişimlerinin `attach()` dışında çağrılmadığını doğrula.
- README'ye Next.js App Router bölümü ekle.

**Kabul kriteri:** Temiz bir Next.js 15 App Router projesinde `<VideoPlayer>` server
component ağacı içinde ek sarmalayıcı olmadan çalışıyor.

---

## Faz 0 çıkış kriterleri

- [x] Bozuk kaynakta hata UI'ı görünüyor, sonsuz spinner yok — `ErrorOverlay` + `engine.retry()`
- [x] Store `<video>` elemanıyla her koşulda senkron — `volumechange`, `ratechange`,
      `seeking`/`seeked`, `loadedmetadata`, `loadstart`, `emptied`, `stalled`, `playing`, `error`
- [x] Kalite değişimi pozisyon ve oynatma durumunu koruyor — `switchSource()` /
      `captureRestorePoint()`, `applyQuality` içinde bağlandı
- [x] iOS Safari'de sayfa içi oynatma çalışıyor — `playsInline` (varsayılan `true`) + `webkit-playsinline`
- [x] Ölü kod silindi — 4 hook, ~224 satır
- [x] README'de yanlış beyan yok — "Streaming formats" bölümü tarayıcı matrisiyle
- [x] Next.js App Router'da sorunsuz — `"use client"` kaynakta ve `dist/react/index.js` banner'ında
