# Faz 3 — Kalite Kapısı

**Öncelik:** 🔴 Zorunlu · **Efor:** ~2 hafta · **Önkoşul:** Faz 2 · **Durum:** ⬜

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

- [ ] axe-core ihlalsiz, ekran okuyucuyla tam kullanılabilir
- [ ] `modules/` test kapsamı ≥ %80, E2E kritik yolları kapsıyor
- [ ] CI yeşil, bundle bütçesi eşikli
- [ ] `publint` + `arethetypeswrong` temiz
- [ ] README gerçeği yansıtıyor
- [ ] **API dondurulup `0.1.0` etiketlenebilir**
