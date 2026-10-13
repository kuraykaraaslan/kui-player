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
- [x] Köşe seçimi (`corner`); **sürükleme yapılmadı** (isteğe bağlıydı), `miniPlayer` seçeneği ile aç/kapa (varsayılan kapalı)
- [x] `<video>` DOM'da taşınmaz (oynatma kesilir); aynı öğe CSS ile konumlanır
- [x] Mobilde varsayılan kapalı; kontrol sadeleşir (oynat/duraklat + kapat)
- [x] a11y: `aria-label`'lı gerçek butonlar, `prefers-reduced-motion` saygısı; "videoya dön" odağı oynatıcıya taşır. Ekran okuyucuyla elle denenmedi
- [x] Test: component testi + Playwright (scroll ile mini moda geçiş) — Chromium'da geçti

## 9.3 — Document Picture-in-Picture 🟡 M

Bugün PiP yalnızca video ([`videoplayer.engine.ts`](../../modules/videoplayer/videoplayer.engine.ts));
kontroller pencerede yok.

- [ ] `documentPictureInPicture.requestWindow()` ile kontrolleri de taşıyan pencere
- [ ] Stil taşıma: `player.css` + tema değişkenleri yeni belgeye kopyalanır
- [ ] Olay/odak/klavye kısayolları yeni pencerede de çalışır
- [ ] **Özellik tespiti:** API yoksa (Safari, Firefox) mevcut video PiP'e düşer
- [ ] Pencere kapanınca oynatıcı sayfaya geri döner, durum (oynatma/zaman) korunur
- [ ] Mini oynatıcıyla ([9.2](#92--mini-oynatıcı--s)) çakışma kuralı: biri açıkken diğeri kapalı
- [ ] Test: API mock'u ile akış; gerçek davranış Chrome'da elle doğrulanır

## 9.4 — Sesli betimleme ve işaret dili izi 🟡 M

Mevcut ses-izi seçimi ([1.2](./01-playback-compat.md)) bir liste sunuyor; tür ayrımı yok.

- [ ] `AudioTrackOption`'a `kind` (`main` | `description` | `commentary`) ekle; HLS `CHARACTERISTICS="public.accessibility.describes-video"` ve DASH `Role=description` değerlerinden türet
- [ ] Ayarlar menüsünde "Sesli betimleme" ayrı satır/anahtar; tercih kalıcı
- [ ] Sistem tercihine saygı: betimleme açıksa varsayılan olarak seç
- [ ] **İşaret dili:** ikinci bir video kaynağı (`signLanguage: { src }`), ana videonun
      köşesinde küçük pencere; ana video ile **zaman senkronu** (sürüklenme eşiğinde düzeltme)
- [ ] Odak, `aria-label` ve duyurular; her iki ek parça için i18n metinleri
- [ ] Test: tür çıkarımı için manifest örnekleri; senkron mantığı için sahte zaman çizelgesi

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
