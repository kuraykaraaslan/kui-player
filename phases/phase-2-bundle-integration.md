# Faz 2 — Bundle ve Entegrasyon

**Öncelik:** 🔴 Zorunlu · **Efor:** ~2 hafta · **Önkoşul:** Faz 1 · **Durum:** ✅ Tamamlandı

> Player artık çalışıyor. Bu faz onu **benimsenebilir** yapıyor. Mevcut boyut ve
> Tailwind kuplajı, ciddi projelerin kütüphaneyi elemesine yol açan iki gerekçe.

---

## Referans: rakip bundle boyutları (gzip)

| Player | Boyut |
|---|---|
| Video.js v10 minimal React hello-world | < 5 KB |
| **Video.js v10 [React]** | **18.0 KB** |
| Video.js v10 [HTML] | 25.1 KB |
| Video.js v10 + SPF (HLS dahil) | 38.7 KB |
| Vidstack (tüm çekirdek, tree-shakeable) | 54 KB |
| Video.js v8 çekirdek | 75.2 KB |
| **kui-player `dist/embed.js` (Faz 2 öncesi)** | **~106 KB** |
| **kui-player `dist/embed.js` (Faz 2 sonrası)** | **28.3 KB** |
| **kui-player React subpath (Faz 2 sonrası)** | **19.7 KB** |

Şu an pazarın **en büyük** oynatıcısıyız ve en az özelliğe sahibiz. Bu sürdürülemez.

**Hedef:** embed bundle ≤ 35 KB gzip, React subpath ≤ 20 KB gzip.

---

## 2.1 — FontAwesome → inline SVG 🔴 S

**Sorun:** Dört FontAwesome paketi runtime bağımlılığı olarak yükleniyor
(`fontawesome-svg-core`, `free-solid-svg-icons`, `free-brands-svg-icons`,
`react-fontawesome`). Kullanılan ikon sayısı ~15. Bu, boyutun en büyük tekil kalemi.

**Yapılacak:**
- Kullanılan ikonları tespit et, her birini elle optimize edilmiş inline SVG bileşenine çevir.
- `react/icons/` altında tek dosya, ~1 KB toplam.
- Dört FontAwesome paketini `dependencies`'ten çıkar.
- İkonların prop ile override edilebilmesini sağla (`icons={{ play: <MyIcon/> }}`) —
  hem tema esnekliği hem "kendi ikon setini getir" desteği.

**Kabul kriteri:** `package.json` içinde FontAwesome yok, tüm ikonlar aynı görünüyor,
bundle en az 40 KB gzip küçülmüş.

---

## 2.2 — Tailwind bağımlılığının izolasyonu 🔴 M

**Sorun:** Kütüphane tüketiciden `styles.css`'i global olarak import etmesini istiyor —
derlenmiş Tailwind v4 token'ları. Bunun üç maliyeti var:

1. Host uygulamanın kendi Tailwind kurulumuyla **çakışma / spesifiklik savaşı**.
2. Tailwind kullanmayan projeler için gereksiz global CSS.
3. Stil override etmek isteyen kullanıcı, üretilmiş utility sınıflarıyla boğuşuyor.

**Yapılacak:**
- Tailwind'i **build-time aracı** olarak tut ama çıktıyı izole et: tüm sınıfları
  `kui-` öneki + tek bir kök scope (`.kui-player { ... }`) altında üret.
- Tema yüzeyi olarak **CSS custom properties** aç:
  `--kui-accent`, `--kui-bg`, `--kui-radius`, `--kui-control-size`, `--kui-font` …
- Alternatif olarak Shadow DOM'lu bir varyant değerlendir (embed modu için ideal —
  host CSS'inden tamamen izole).
- `styles.css` import'u opsiyonel hâle gelsin: kritik stiller bileşene gömülü olsun.

**Kabul kriteri:** Tailwind kullanmayan bir Vite + React projesinde player doğru
görünüyor. Tailwind kullanan bir projede host stilleriyle çakışma yok.
`--kui-accent` değiştirilince tema değişiyor.

---

## 2.3 — Kod bölme ve tree-shaking 🔴 S

**Yapılacak:**
- Google Cast kodu (`useGoogleCast`, 148 satır + SDK tipleri) **ayrı bir chunk**
  olsun, yalnızca `enableCast` ile dinamik import edilsin.
- `AboutModal` ve `SettingsPanel` lazy yüklensin.
- `sideEffects` alanını doğrula, `dist` çıktısında `/*#__PURE__*/` anotasyonlarının
  korunduğunu kontrol et.
- Bundle boyutunu CI'da **eşikli** ölç (`size-limit`), regresyon build'i kırsın.

**Kabul kriteri:** `enableCast={false}` ile Cast kodu bundle'a hiç girmiyor.
`size-limit` CI'da çalışıyor.

---

## 2.4 — Peer dependency temizliği 🔴 XS

**Yapılacak:**
- `clsx` + `tailwind-merge`: `cn()` yalnızca 5 satırlık bir yardımcı
  ([libs/utils/cn.ts](../libs/utils/cn.ts)) — Tailwind izolasyonu sonrası
  `tailwind-merge` gereksiz kalacak, ikisi de çıkarılabilir.
- `zustand`: şu an hard dependency. Faz 4'te kendi ~40 satırlık store'umuzla
  değiştirilmesi planlanıyor (madde 26) — bu fazda en azından tekil sürüm
  garanti edilsin, çift-kopya riski dokümante edilsin.

**Hedef:** Sıfır runtime bağımlılık. Rakiplerin çoğu bunu sağlıyor.

**Sonuç:** `clsx` + `tailwind-merge` kaldırıldı (`cn()` artık 10 satırlık bir birleştirici),
dört FontAwesome paketi kaldırıldı. Geriye tek runtime bağımlılığı olarak `zustand` kaldı:
bundle'a dahil edildiği için runtime'da sürüm pazarlığı yok, `dependencies`'te kalmasının
sebebi üretilen `.d.ts`'lerin `StoreApi` tipine referans vermesi. Çift kopya riski
README'de dokümante edildi.

---

## Faz 2 çıkış kriterleri

- [x] React subpath **19.68 KB** gzip (bütçe 20), embed **28.31 KB** gzip (bütçe 35).
      Çekirdek 8.21 KB, stylesheet 3.26 KB.
- [x] FontAwesome bağımlılığı yok — `react/icons/` altında ~25 inline SVG, `Icon`
      bileşeni + `icons={{ play: <MyIcon/> }}` override'ı
- [x] Tailwind'siz projede çalışıyor — kütüphanede tek bir `player.css`, tüm sınıflar
      `kui-` önekli ve `.kui-player` altında; tema `--kui-accent` vb. custom property'lerle.
      `styles.css` import'u artık opsiyonel (bileşen kendi stilini enjekte ediyor,
      `injectStyles={false}` ile kapatılabilir).
- [x] Cast kodu opsiyonel chunk — `CastController` lazy; `SettingsPanel` ve `AboutModal` de
      ayrı chunk. `enableCast={false}` ile Cast kodu hiç indirilmiyor.
- [x] Boyut bütçeleri eşikli ölçülüyor — `pnpm size` (`scripts/check-size.mjs`),
      bütçeler `package.json` içindeki `size-limit` alanında. CI bağlanması Faz 3.3'te.

**Not — `size-limit` yerine kendi betiğimiz:** gzip ölçüp eşikle karşılaştırmak 60 satır;
sıfır bağımlılık iddiasındaki bir kütüphanenin boyut kapısının kendi bağımlılık ağacını
getirmesi tutarsız olurdu. Bütçe formatı `size-limit` ile aynı, ileride araca geçmek
konfigürasyon değişikliği.

**Not — embed'de Preact:** `dist/embed.js` `preact/compat` ile derleniyor; react-dom tek
başına ~40 KB gzip, yani bütçenin tamamından büyük. Yalnızca embed build'ine ait bir alias,
React subpath'i etkilemiyor, Preact devDependency.

**Doğrulama:** `tsc` (lib + tam), beş build, `pnpm size` (5 bütçenin hepsi geçiyor),
derlenmiş engine üzerinde 62 davranış kontrolü ve React ağacının sunucuda render edildiği
12 kontrol (Tailwind sınıfı sızmıyor, ikonlar inline SVG, adaptör kaynakları `<source>`
üretmiyor).
