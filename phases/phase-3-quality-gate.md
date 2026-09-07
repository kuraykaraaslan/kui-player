# Faz 3 — Kalite Kapısı

**Öncelik:** 🔴 Zorunlu · **Efor:** ~2 hafta · **Önkoşul:** Faz 2 · **Durum:** ✅ Tamamlandı

> **`0.1.0` etiketi ancak bu faz bittikten sonra atılmalı.** Şu an sıfır test ve sıfır CI
> var — hiçbir ciddi ekip test edilmemiş bir medya kütüphanesini production'a koymaz.

---

## 3.1 — Erişilebilirlik (a11y) 🔴 M

**Mevcut durum:** `react/` altında 36 `aria-*` / `role` kullanımı var — temel atılmış ama eksik.
Rakip çıtası yüksek: Vidstack **WCAG 2.1** + **FCC/CVAA** uyumu, ekran okuyucu duyuruları,
erişilebilir kontrastlar iddia ediyor. Video.js v10'un beta duyurusunda ilk satır
"accessible playback".

**Yapılacak:**

- **Klavye:** Kısayollar yalnızca konteyner odaklıyken çalışıyor
  ([useKeyboardShortcuts.ts](../react/hooks/useKeyboardShortcuts.ts)). Ek olarak
  her kontrol Tab ile gezilebilir, görünür `:focus-visible` halkası olmalı.
- **Focus trap:** Settings paneli ve About modalı açıkken odak içeride kalmalı,
  `Esc` ile kapanıp odağı tetikleyen butona döndürmeli.
- **Progress bar:** `role="slider"` + `aria-valuetext` ("2 dakika 14 saniye / 5 dakika")
  — şu an yalnızca `aria-valuenow` yüzde olarak var, ekran okuyucu için anlamsız.
  `←`/`→` ile slider üstünde ince ayar seek.
- **Ses kaydırıcısı:** aynı slider muamelesi.
- **Canlı bölge:** `aria-live="polite"` ile durum duyuruları
  ("Oynatılıyor", "Duraklatıldı", "Altyazı: Türkçe", "Kalite: 720p").
- **Kontrol görünürlüğü:** Auto-hide, klavye kullanıcısı için odak varken devre dışı
  kalmalı — görünmez butona Tab'lamak erişilebilirlik hatası.
- **Kontrast:** Tüm kontrol/metin kombinasyonları WCAG AA (4.5:1) geçmeli.
  Altyazı overlay'i özellikle kontrol edilmeli.
- **`prefers-reduced-motion`:** Animasyonlar bu ayarda kapansın.
- **Altyazı boyutu:** Dört boyut var; ayrıca arka plan opaklığı ve font seçimi
  CVAA beklentisi (Faz 4'te tam kapsam).

**Kabul kriteri:** axe-core taraması ihlalsiz. NVDA veya VoiceOver ile tüm oynatıcı
mouse'suz kullanılabiliyor.

---

## 3.2 — Test altyapısı 🔴 M

**Mevcut durum:** Sıfır test dosyası, `package.json`'da `test` script'i yok.

**Yapılacak:**

**Birim testleri (Vitest + jsdom)** — `modules/` çekirdeği:
- `VideoPlayerEngine.attach/detach` — listener sızıntısı yok
- `seek`, `seekBy`, `seekByRatio` sınır değerleri (0, duration, negatif, NaN duration)
- `setVolume` clamp'i ve `muted` senkronu
- `scheduleHide` / `forceShow` zamanlayıcı mantığı, controlled vs uncontrolled
- Cast bağlıyken tüm aksiyonların remote'a yönlenmesi
- Store başlangıç değerleri ve her action
- `formatTime` — saatli/saatsiz, 0, NaN, Infinity

**Bileşen testleri (Vitest + Testing Library)** — `react/`:
- Kontrollerin doğru state'i yansıtması
- Settings panelinin nested navigasyonu ve `Esc`/dış tıklama ile kapanması
- Klavye kısayolları
- Altyazı overlay'inin cue'ları göstermesi

**E2E (Playwright)** — gerçek tarayıcıda:
- Chrome + Safari + Firefox'ta oynatma, seek, tam ekran, PiP
- Mobil emülasyonda dokunma jestleri
- Faz 1 sonrası HLS oynatma
- Görsel regresyon anlık görüntüleri (temel skin)

**Kabul kriteri:** `pnpm test` çalışıyor, `modules/` kapsamı ≥ %80,
kritik yollar E2E ile kapsanmış.

---

## 3.3 — CI 🔴 S

**Mevcut durum:** `.github/` dizini yok.

**Yapılacak — `.github/workflows/ci.yml`:**
- `pnpm typecheck` + lint (ESLint kurulmalı — şu an yok)
- `pnpm test` (birim + bileşen)
- Playwright E2E (Chromium + WebKit)
- `pnpm build` — çıktının varlığını ve `.d.ts` üretimini doğrula
- `size-limit` bundle bütçesi (Faz 2.3)
- `publint` + `arethetypeswrong` — paket exports/types haritasının doğruluğu
- PR'larda bundle boyutu farkını yorum olarak bırak

**Ayrıca — `.github/workflows/release.yml`:**
- Changesets ile sürümleme, npm provenance ile yayınlama

**Kabul kriteri:** Yeşil CI olmadan main'e merge edilemiyor.

---

## 3.4 — Dokümantasyon ve demo 🔴 S

**Yapılacak:**
- README'yi Faz 0–2 sonrası gerçeğe göre yeniden yaz.
- Her prop için çalışan bir örnek (`src/DemoShell.tsx` zaten iyi bir başlangıç).
- Migration/upgrade notları — `0.0.x` → `0.1.0` kırıcı değişiklikler.
- `CONTRIBUTING.md`, issue şablonları.
- Vercel'de yayınlanan canlı demo'ya HLS, altyazı, Cast, skin-mode senaryoları eklensin.

---

## Faz 3 çıkış kriterleri — `0.1.0` yayın kapısı

- [x] **axe-core ihlalsiz** — dört durumda taranıyor (boşta, ayarlar açık, About açık,
      hata durumunda). Klavyeyle tam kullanım: focus trap + geri dönüş, progress bar
      gerçek slider (`←/→`, `PageUp/Down`, `Home/End`), `aria-valuetext` ("2:14 of 4:20"),
      `aria-live="polite"` duyuruları, odak içerideyken auto-hide kapalı, AA kontrast,
      `prefers-reduced-motion`.
- [x] **`modules/` kapsamı %96.5 satır / %80.7 dal** (eşik %80) — 58 birim testi.
      E2E kritik yolları kapsıyor: oynatma, seek (tık/sürükle/klavye), ses, altyazı,
      hata + retry, tam ekran, PiP, adaptör yönlendirmesi ve ABR menüsü, mobil jestler.
- [x] **CI** — `.github/workflows/ci.yml`: typecheck, lint, testler + kapsam, build ve
      çıktı doğrulaması (`"use client"` banner'ı dahil), `publint` + `attw`, boyut
      bütçesi, PR'a boyut yorumu, dört tarayıcı projesinde E2E.
      `release.yml`: Changesets + npm provenance.
- [x] **`publint` + `arethetypeswrong` temiz** — node10/node16/bundler hepsi yeşil.
      Bunun için üretilen `.d.ts`'lerin ESM'de çözülmesi gerekiyordu: tüm göreli
      import'lara `.js` uzantısı eklendi, alt yol tipleri için `typesVersions`.
- [x] **README gerçeği yansıtıyor** — erişilebilirlik, boyut tablosu, tema değişkenleri,
      `0.0.x → 0.1.0` göç notları. Ayrıca `CONTRIBUTING.md` ve issue şablonları.
      Demo'ya altyazı ve **skin mode** senaryoları eklendi (HLS ve Cast zaten vardı).
- [x] **API dondurulup `0.1.0` etiketlenebilir** — `.changeset/` ile sürüm hazır.

## Bu fazda E2E'nin bulduğu iki gerçek hata

1. **`<source>` çocuğu 404 verince hata UI'ı hiç görünmüyordu.** Tarayıcılar bu hatayı
   `<video>` üzerinde değil `<source>` elemanında tetikler ve `video.error` `null` kalır —
   yani Faz 0'ın "sonsuz spinner yok" kriteri, oynatıcının **varsayılan** render yolunda
   aslında sağlanmıyordu. Capture fazında dinleyip `networkState === NETWORK_NO_SOURCE`
   kontrolüyle düzeltildi (birim testi eklendi).
2. **Adaptörün bildirdiği ses izleri siliniyordu.** `loadedmetadata` sonrası native iz
   senkronizasyonu, `getAudioTracks` metodu olmayan bir adaptörün `host.updateAudioTracks`
   ile yayınladığı listeyi temizliyordu. Artık adaptör bağlıyken eleman listesi okunmuyor.

## Doğrulama durumu

| Kontrol | Sonuç |
|---|---|
| `pnpm typecheck` (lib + tam) | ✅ |
| `pnpm lint` | ✅ |
| `pnpm test` | ✅ 85 test (58 birim, 27 bileşen/a11y) |
| `pnpm test:coverage` | ✅ `modules/` %96.5 satır, %80.7 dal |
| `pnpm build` (beş çıktı) | ✅ |
| `pnpm size` | ✅ 5/5 bütçe |
| `pnpm check:package` | ✅ publint + attw temiz |
| E2E — chromium | ✅ 16/16 |
| E2E — firefox | ✅ 15/15 |
| E2E — mobil (Pixel 5 emülasyonu) | ✅ 5/5 jest |
| E2E — webkit | ⚠️ bu makinede çalıştırılamadı |

WebKit yerel olarak başlatılamıyor: Playwright'ın WebKit build'i `libevent`,
`gstreamer` vb. sistem kütüphanelerini istiyor ve bunlar `sudo` gerektiriyor.
CI `npx playwright install --with-deps webkit` ile kuruyor, dolayısıyla WebKit
kapsamı CI'da çalışıyor. Spec'lerin kendisi tarayıcıdan bağımsız; yalnızca
tam ekran testi WebKit'te headless kısıtı nedeniyle `test.skip` ile atlanıyor.

## Boyut notu

Erişilebilirlik katmanı (~2 KB gzip) React subpath'i 20 KB bütçesinin üstüne çıkardı.
Bütçeyi yükseltmek yerine **dokunma jestleri lazy chunk'a taşındı** (yalnızca coarse
pointer cihazlarda indiriliyor) ve About'a özel ikonlar ana chunk'tan çıkarıldı:
subpath 19.56 KB'de kaldı, masaüstü kullanıcı jest motorunu hiç indirmiyor.
