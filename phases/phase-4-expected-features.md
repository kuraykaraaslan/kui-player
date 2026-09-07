# Faz 4 — Beklenen Özellikler

**Öncelik:** 🟡 Olsa iyi olur · **Efor:** ~4 hafta · **Önkoşul:** Faz 3 · **Durum:** ⬜

> Bunlar rakiplerde var olan ve karşılaştırma tablolarında sorulan özellikler.
> Hiçbiri tek başına kütüphaneyi kazandırmaz ama yokluğu eleme sebebi olur.
> **Sıra önemli** — aşağıdaki numaralandırma etki/efor oranına göre.

---

## 4.1 — Media Session API 🟡 S

OS/kilit ekranı medya kontrolleri. Ucuz ve görünürlüğü yüksek.

- `navigator.mediaSession.metadata` — başlık, sanatçı, artwork (poster'dan).
- Action handler'lar: `play`, `pause`, `seekbackward`, `seekforward`, `seekto`,
  `previoustrack`/`nexttrack` (playlist varsa).
- `setPositionState()` ile scrub çubuğu OS'ta doğru görünsün.
- Chapters geldiğinde (4.4) `chapterInfo` da doldurulsun.

---

## 4.2 — AirPlay 🟡 XS

Cast var, AirPlay yok — **Apple ekosistemi komple açık.** Cast'in yanına doğal eş.

- `video.webkitShowPlaybackTargetPicker()`
- `webkitplaybacktargetavailabilitychanged` ile buton görünürlüğü
- `webkitcurrentplaybacktargetiswirelesschanged` ile durum
- `x-webkit-airplay="allow"` özniteliği

---

## 4.3 — Kaldığın yerden devam + tercih kalıcılığı 🟡 S

- `localStorage`'da pozisyon: anahtar = `src` hash'i, TTL'li, video sonuna yakınsa sıfırla.
- Tercihler: ses, hız, altyazı dili, altyazı boyutu, kalite — **kaynak bağımsız**.
- "Kaldığınız yerden devam et? 12:34" şeklinde kapatılabilir bir bildirim.
- Depolamayı **opsiyonel ve enjekte edilebilir** yap (`storage` prop'u) — gizlilik
  konumlanmasıyla (Faz 5.4) tutarlı olması için varsayılan davranış belgelenmeli.

---

## 4.4 — Chapters 🟡 M

- WebVTT chapter track'i (`kind="chapters"`) parse et.
- Progress bar'ı bölüm sınırlarında segmentle.
- Hover'da bölüm adını göster.
- Settings menüsüne bölüm listesi, tıklayınca seek.
- Media Session'a chapter metadata'sı ver.

---

## 4.5 — Seek hover thumbnail / storyboard 🟡 M

**Yarısı hazır:** `seekHoverX` state'i store'da zaten var, şu an sadece zaman gösteriyor.

- WebVTT storyboard formatı (`#xywh=` sprite koordinatları) parse et.
- Sprite sheet'ten CSS `background-position` ile karo göster.
- Ayrı JPEG dizisi formatını da destekle.
- Mobilde scrub sırasında büyük önizleme.
- Prop: `thumbnails="/path/storyboard.vtt"`.

---

## 4.6 — Event / analytics API 🟡 S

QoE pipeline'ına bağlanabilmek kurumsal benimseme için şart.

```ts
engine.on('play' | 'pause' | 'seeking' | 'seeked' | 'ratechange' | 'volumechange'
        | 'qualitychange' | 'error' | 'stall' | 'quartile' | 'complete', handler)
```

- `quartile` (%25/50/75/100) reklam ve analitik standardı.
- `stall` — rebuffer sayısı ve süresi (QoE'nin ana metriği).
- `timeToFirstFrame`, `startupTime` ölçümü.
- **Hiçbir yere veri göndermeyen** salt-yerel API — Faz 5.4 ile uyumlu.
- Opsiyonel CMCD (Common Media Client Data) başlık enjeksiyonu — dash.js'in
  standartlaştırdığı, CDN tarafında QoE görünürlüğü sağlayan modern beklenti.

---

## 4.7 — Tema / skin sistemi 🟡 M

Faz 2.2'de açılan CSS custom property yüzeyinin üstüne:

- Hazır temalar: `default`, `minimal`, `youtube-like`, `netflix-like`.
- Slot tabanlı kompozisyon: kontrol çubuğuna özel buton eklenebilsin.
- `<VideoPlayer>` alt bileşenlerinin dışa açılması (headless kullanım) —
  Video.js v10'un "unstyled UI primitives" yaklaşımının hafif versiyonu.

---

## 4.8 — i18n + RTL 🟡 M

**Şu an tüm string'ler hardcoded İngilizce** (`react/` altında 2 locale referansı — pratikte sıfır).

- `locale` prop'u + sözlük enjeksiyonu, varsayılan `en`.
- Hazır: `en`, `tr`, `de`, `es`, `fr`, `ar`.
- RTL düzen desteği (`dir="rtl"` — kontrol çubuğu, progress yönü, menü hizası).
- `aria-label`'lar da çevrilebilir olmalı.
- Süre biçimlendirmesi `Intl` ile yerelleştirilsin.

> **Not:** Türkçe/Arapça pazarı için bu, rakiplerin zayıf olduğu gerçek bir farklılaştırıcı.
> Vidstack ve Plyr'ın i18n desteği sınırlı.

---

## 4.9 — SRT + ASS/SSA altyazı 🟡 M

Vidstack VTT + SRT + SSA destekliyor, ayrıca libass'ı jassub ile çalıştırıyor.

- SRT parser (çok basit, ~50 satır).
- ASS/SSA temel stil desteği (konumlandırma, renk).
- Karmaşık ASS için `jassub`'ı opsiyonel adaptör olarak bağla.
- Altyazı stil paneli: font, boyut, renk, arka plan opaklığı, kenar/gölge — CVAA beklentisi.

---

## 4.10 — Canlı yayın + DVR 🟡 M

- Canlı tespiti (`duration === Infinity` veya HLS manifest tipi).
- "CANLI" göstergesi, kenardaysa kırmızı; DVR penceresindeyse gri.
- "CANLI'ya dön" butonu.
- DVR penceresi içinde seek edilebilir progress bar.
- LL-HLS / LL-DASH düşük gecikme modunu adaptöre devret.

---

## 4.11 — Playlist / sıradaki video 🟡 M

- `playlist` prop'u, otomatik geçiş.
- Video bitiminde "sıradaki" kartı + geri sayım + iptal.
- Önceki/sonraki butonları ve Media Session track action'ları.

---

## 4.12 — Zustand'ı runtime bağımlılıktan çıkar 🟡 M

Rakiplerin çoğu sıfır runtime bağımlılığa sahip. Store'un kullandığı yüzey
(`createStore`, `getState`, `setState`, `subscribe`) ~40 satırda yazılabilir.

- Kendi minimal store'unu yaz, `useSyncExternalStore` ile bağla.
- Public API (`engine.store`) aynı şekilde kalsın — kırıcı olmasın.
- `zustand`'ı `dependencies`'ten çıkar.

---

## 4.13 — Framework wrapper'ları 🟡 L

- **Web Component** (`<kui-player>`) — `embed/mountSkin.tsx` zaten buna çok yakın,
  Shadow DOM ile stil izolasyonu bedava gelir.
- Vue 3 ve Svelte 5 sarmalayıcıları — çekirdek zaten framework-agnostik.
- Angular: Web Component yeterli.

---

## Faz 4 çıkış kriterleri

- [ ] Rakip karşılaştırma tablosunda "yok" kutusu kalmadı (DRM ve reklam hariç)
- [ ] i18n + RTL çalışıyor
- [ ] Analytics event API'si belgelenmiş
- [ ] Sıfır runtime bağımlılık
