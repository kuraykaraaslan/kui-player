# Faz 9 — Kullanıcı Deneyimi ve Erişilebilirlik

**Öncelik:** 🟡 Olsa iyi · **Efor:** ~3–4 hafta · **Durum:** 📋 Planlandı

> Görünür, kullanıcıya dönük özellikler. Faz 7–8'e bağlı değildir, onlarla **paralel**
> yürütülebilir. 9.1 en küçüğü ve en görünürü, önce o.

**Sıra:** 9.1 → 9.2 → 9.3 → 9.4 → 9.5. Hepsi birbirinden bağımsız; 9.5 [Faz 6.2](./06-verticals.md#62--altyazı-senkron-kaydırma-ve-düzenleyici--m)
ile kapsam paylaşır.

---

## 9.1 — Zaman damgalı paylaşım linki 🟡 S

- [x] Açılışta `?t=90`, `?t=1m30s` ve `#t=90` okuma; geçersiz değer sessizce yok sayılır
- [x] "Buradan paylaş" butonu: geçerli saniyeyi içeren URL'i panoya kopyalar
      (`navigator.clipboard`, yoksa seçim + `execCommand` yedeği), "Kopyalandı" duyurusu (canlı bölge)
- [x] Seçenekler: `shareParam` (varsayılan `t`), `onShare` callback'i (kendi paylaşım UI'ın için)
- [x] Kalıcılık ([4.3](./04-expected-features.md)) ile çakışma: URL zamanı **kaydedilmiş konumu ezer**
- [x] i18n: 6 dilde metinler (React bileşeni). Skin / web component bağlaması henüz yok
- [x] Test: parse birimleri, kopyalama (mock), URL zamanı vs kaydedilmiş konum önceliği

## 9.2 — Mini oynatıcı 🟡 S

- [x] Oynatıcı ekrandan çıkınca (IntersectionObserver) köşede sabit küçük pencereye geçer
- [x] Yalnızca **oynatılıyorken** devreye girer; kapatma ve "yerine dön" butonları
- [x] Köşe seçimi (`corner`), `miniPlayer` seçeneği ile aç/kapa (varsayılan kapalı)
- [x] **Sürükleme:** üstteki tutamaç düğmesiyle (fare/dokunma/kalem, `setPointerCapture`); sürüklerken yalnızca `transform` değişir (yerleşim/yeniden çizim yok), görüntü alanıyla sınırlanır, bırakınca en yakın **mantıksal** köşeye oturur (RTL'de fiziksel sol = `right`), `prefers-reduced-motion` açıkken kayma animasyonu yok, pencere yeniden boyutlanınca sınırlama güncellenir, Esc sürüklemeyi iptal eder, mini moddan çıkınca konum sıfırlanır. Yalnızca tutamaçtan sürüklenir (videonun kendisinden değil): düğmelerin tıklaması çalınmaz. Kod: `useMiniDrag` + saf yardımcılar `videoplayer.mini.ts`
- [x] Klavye alternatifi: tutamaç odaklanabilir bir düğme; ok tuşları bitişik köşeye geçirir (serbest piksel taşıma yok, bilerek: yerleşim öngörülebilir kalsın). Köşe seçeneği yedek olarak durur. Taşıma sonrası yeni köşe canlı bölgeyle duyurulur ("… taşındı"), tutamaçta `aria-keyshortcuts` var; ekran okuyucuyla elle denenmedi. Tutamaç 24px (dokunmatikte 44px), forced-colors'ta kenarlık/grip görünür
- [x] `<video>` DOM'da taşınmaz (oynatma kesilir); aynı öğe CSS ile konumlanır
- [x] Mobilde varsayılan kapalı; kontrol sadeleşir (oynat/duraklat + kapat)
- [x] a11y: `aria-label`'lı gerçek butonlar, `prefers-reduced-motion` saygısı; "videoya dön" odağı oynatıcıya taşır. Ekran okuyucuyla elle denenmedi
- [x] Test: component testi + Playwright (scroll ile mini moda geçiş) — Chromium'da geçti. Sürükleme: saf yardımcı birim testleri, sahte işaretçi dizileriyle bileşen testleri (sınırlama, köşeye oturma, RTL, klavye, düğmeler), Playwright'ta gerçek fare sürüklemesi (yalnızca headless Chromium; Firefox/WebKit ve gerçek dokunmatik cihazda denenmedi), Esc ortası sürükleme, reduced-motion ve CDP dokunma sürüklemesi. Kayma animasyonunun gerçek tarayıcıda görsel doğruluğu otomatik testle doğrulanmaz (yalnızca animate çağrısı sayılır); gerçek forced-colors denenmedi
- [x] Boyut bütçeleri: sürükleme kodu tembel parça (`MiniDragHandle`); `react subpath` 38→38.2 kB, `every lazy chunk` 46→47.3 kB (yeni parça), `embed` 52.2→53.8 kB (embed tek betik olduğundan tutamaç + 5 dil metni içeri girer; özellik varsayılan kapalı olsa da), stylesheet 7→7.2 kB (tutamaç CSS'i). Çekirdek (core) bütçesi değişmedi

## 9.3 — Document Picture-in-Picture 🟡 M

Bugün PiP yalnızca video ([`videoplayer.engine.ts`](../../modules/videoplayer/videoplayer.engine.ts));
kontroller pencerede yok.

- [x] `documentPictureInPicture.requestWindow()` ile kontrolleri de taşıyan pencere
- [x] Stil taşıma: sayfadaki tüm stil sayfaları (kural kopyası, olmuyorsa `<link>`) ve `--kui-*` tema değişkenleri yeni belgeye kopyalanır
- [x] Olay/odak/klavye kısayolları yeni pencerede de çalışır. Mimari: oyuncu her zaman sahibi olduğumuz bir portal kapsayıcısında (`host`) çizilir, PiP'te bu kapsayıcı taşınır; boş bir portal veya elle taşınan düğüm React olaylarını çalıştırmıyordu (testle yakalandı). SSR: bu seçenek açıkken oyuncu yalnızca istemcide çizilir. Tam ekran düğmesi PiP penceresinde denenmedi
- [x] **Özellik tespiti:** API yoksa (Safari, Firefox) mevcut video PiP'e düşer
- [x] Pencere kapanınca oynatıcı sayfaya geri döner, durum (oynatma/zaman) korunur
- [x] Mini oynatıcıyla ([9.2](#92--mini-oynatıcı--s)) çakışma kuralı: biri açıkken diğeri kapalı
- [x] Test: API mock'u ile bileşen testleri + gerçek (headless) Chromium'da Playwright: pencere açılır, aynı `<video>` oynamaya devam eder, PiP penceresindeki Duraklat çalışır, pencere kapanınca oyuncu sayfaya döner. Headed Chrome'da elle bakılmadı

## 9.4 — Sesli betimleme ve işaret dili izi 🟡 M

Mevcut ses-izi seçimi ([1.2](./01-playback-compat.md)) bir liste sunuyor; tür ayrımı yok.

- [x] `AudioTrackOption`'a `kind` (`main` | `description` | `commentary`) ekle; HLS `CHARACTERISTICS="public.accessibility.describes-video"` ve DASH `Role=description` değerlerinden türet
- [x] Ayarlar menüsünde "Sesli betimleme" ayrı satır/anahtar; tercih kalıcı
- [x] Tercihe saygı: `audioDescription` prop'u ve `persist` ile hatırlanan seçim, betimleme izi geldiğinde otomatik uygulanır. (Web'de betimleme için standart bir işletim sistemi tercihi yok; ondan okunmuyor)
- [x] **İşaret dili:** ikinci bir video kaynağı (`signLanguage: { src }`), ana videonun
      köşesinde küçük pencere; ana video ile **zaman senkronu** (sürüklenme eşiğinde düzeltme)
- [x] `aria-label`, anahtar için `menuitemcheckbox` + `aria-checked`, ses izi değişimi mevcut canlı bölgeden duyurulur; 6 dilde metin. Ekran okuyucuyla elle denenmedi
- [x] Test: tür çıkarımı (HLS/DASH/Safari biçimleri) ve senkron mantığı için sahte zaman çizelgesi. Gerçek bir betimleme/işaret dili içeriğiyle denenmedi

**Not:** Betimleme içeriği üretmek bu kütüphanenin işi değil; bu madde yalnızca seçimi ve oynatmayı sağlar.

## 9.5 — Çift dil altyazı 🟡 M

[Faz 6.2](./06-verticals.md) listesindeki "çift altyazı"nın somut hâli; senkron kaydırma
(offset) ve düzenleyici bu fazın dışında, 6.2'de kalır.

- [x] İki altyazı izi aynı anda seçilebilir (birincil + ikincil), ikincil üstte küçük/farklı renk
- [x] Stil: ikincil satır birincinin bir boyut küçüğü, `--kui-subtitle-secondary` ile renklendirilir (varsayılan sarımsı); arka plan/kenar/yazı tipi ortak. **İki iz için tam ayrı stil paneli yapılmadı**
- [x] Konum: iki satır çakışmaz, kontrol çubuğu açılınca birlikte yukarı kayar
- [x] SRT/ASS/WebVTT hepsiyle çalışır; zaman uyuşmazlığı varsa iki iz bağımsız ilerler
- [x] Cast'te yalnızca birincil iz etkin (alıcıya `activeTrackIds` olarak yalnızca o gider); ikincil yalnızca yerel oynatmada görünür
- [x] Test: iki cue kümesi ile render, bağımsız zamanlama, seçim kuralı, kalıcılık
