# Faz 7 — DRM ve Yayın Altyapısı (öğrenme planı)

**Öncelik:** 🟣 Keşif · **Efor:** ~3–4 hafta · **Durum:** 📋 Planlandı

> Amaç iki yönlü: **(a)** Cloudflare Stream ve AWS (MediaConvert + CloudFront)
> üzerinde uçtan uca yayın hattını öğrenmek, **(b)** kui-player'a DRM oynatma
> desteğini, öğrenilenin üstüne eklemek.
>
> Kütüphane bugün DRM oynatmıyor ([Faz 4 çıkış kriterleri](./04-expected-features.md):
> "DRM ve reklam hariç"). Adapter'lara `config` / `settings` geçirilebiliyor ama
> bu desteklenen bir yol değil, test de yok.

## Kararlar

- **Tek biçim:** CMAF (fMP4) + `cbcs` şifreleme + **HLS manifesti**. `cbcs` Widevine
  ve PlayReady'de çalışır, yani tek paketleme çıktısı yeter. (Safari'yi sonradan
  eklemek gerekirse aynı çıktı FairPlay ile de kullanılabilir.)
- **Safari/iOS hedeflenmiyor.** FairPlay (Apple hesabı, sertifika, `encrypted`
  olayları) kapsam dışı; Widevine + PlayReady yeter. Tarayıcı hedefi Chrome,
  Firefox, Edge.
- **Tek paket:** `hls.js`. `dash.js` yalnızca `.mpd` oynatılacaksa gerekir; bu fazda
  **eklenmez**.
- **Lisans sunucusu yazılmaz.** MediaConvert yalnızca şifreler (SPEKE); lisansı bir
  DRM sağlayıcı (EZDRM, BuyDRM, Axinom, PallyCon vb.) verir. Deneme hesabı yeterli.
- **Cloudflare Stream'in yerleşik DRM'i doğrulanmadı.** Faz 7.1'in ilk işi
  Cloudflare'in güncel dokümanından bunu kontrol etmek. Yoksa Stream bu planda
  yalnızca "DRM'siz + imzalı URL" ucu olarak kalır.

---

## 7.1 — Cloudflare Stream, DRM'siz 🟣 S

Mevcut oynatıcıyla gerçek bir adaptif akış denemek. Kod değişikliği gerekmez.

- [ ] Hesap + Stream etkinleştir, bir test videosu yükle
- [ ] `.m3u8` (ve varsa `.mpd`) URL'lerini al, `createHlsAdapter({ Hls })` ile oynat
- [ ] Kalite menüsü / ABR / ses izi gerçekten dolu mu kontrol et
- [ ] **İmzalı URL** (signed tokens): token'ı backend'den üret, süresini kısa tut
- [ ] Cloudflare'in DRM durumunu dokümandan doğrula, bu dosyaya not düş

**Öğrenilecek:** manifest yapısı, ABR, token imzalama. **Çıkış:** korumalı bir Stream
videosu kui-player'da oynuyor.

## 7.2 — AWS hattı, DRM'siz 🟣 M

DRM eklemeden önce hattın kendisini kurmak.

- [ ] S3 bucket (kaynak) + ikinci bucket (çıktı)
- [ ] MediaConvert job: **CMAF, HLS çıktısı, 3 kalite basamağı**
- [ ] CloudFront + **OAC** (bucket'a doğrudan erişim kapalı)
- [ ] CORS ve `Range` başlıkları (hls.js için gerekir)
- [ ] Erişim kontrolü: CloudFront **signed cookies / signed URL**
- [ ] kui-player'da oynat; 7.1 ile aynı videoyu karşılaştır (gecikme, kalite geçişi)

**Öğrenilecek:** kodlama ayarları, paketleme, CDN önbelleği, maliyet kalemleri.
**Çıkış:** MediaConvert çıktısı CloudFront'tan oynuyor. Maliyet bütçesi/alarmı kuruldu.

## 7.3 — Oynatıcıda DRM desteği 🔴 M

Kod fazı. Hizmetlerden bağımsız yazılır, mock'la test edilir.

- [x] Ortak `DrmOptions` tipi (`modules/videoplayer/adapters/drm.ts`, tipler çekirdekten dışa aktarılır):
      `widevine` / `playready` için `licenseUrl`, `headers: () => Promise<Record<string,string>>`
      (token kısa ömürlü olduğu için callback)
- [x] `hls.adapter.ts`: `drm` → hls.js `emeEnabled` + `drmSystems` eşlemesi
- [x] Hata eşleme: "tarayıcı DRM desteklemiyor", "lisans reddedildi", "ağ hatası"
      ayrı `PlayerError` kodları (bugün hepsi jenerik)
- [x] **Safari/iOS'ta `drm` verilmişse net hata ver:** native yol (`video.src = src`) DRM'li
      içerikte sessizce takılır. `drm` seçeneği varken native yola düşülecekse oynatma
      denenmez, "bu tarayıcı desteklenmiyor" hatası (ayrı `PlayerError` kodu) gösterilir
- [x] `canPlay` / başlangıçta `requestMediaKeySystemAccess` ile desteği yokla,
      kullanıcıya anlaşılır mesaj göster
- [x] Unit test: doğru `drmSystems` kuruluyor, header callback'i her lisansta çağrılıyor
- [x] `recipes/drm.md`; `llms.txt` / `llms-full.txt` güncelle
- [x] Bundle: DRM kodu ayrı bir chunk (~1,3 kB gzip), yalnızca `drm` verilince yüklenir; kullanılmadığında çekirdeğe ~0,2 kB (dinamik import) ekliyor — 'hiçbir şey' değil. Chunk adı hash'li olduğu için `size-limit` satırı yok

**Not:** EME yalnızca HTTPS veya `localhost`'ta çalışır. Headless Chromium'da CDM
yoktur; gerçek oynatma e2e'ye girmez, elle doğrulanır.


**Durum (Ekim 2026):** kod ve mock testleri tamam. **Gerçek lisans sunucusu / CDM ile oynatma denenmedi** (hesap yok, headless Chromium'da CDM yok); Chrome (Widevine) ve Edge (PlayReady) üzerinde elle doğrulanmalı. `licenseXhrSetup`'ın asenkron kullanımı hls.js ≥1.5 davranışına dayanıyor; sürümünüzde farklıysa gerçek denemede ilk bakılacak yer burası.

## 7.4 — AWS + DRM (Widevine / PlayReady) 🔴 M

7.2 hattına şifreleme ekle, 7.3 kodunu gerçek lisansla dene.

- [ ] DRM sağlayıcıda deneme hesabı aç (SPEKE v2 destekleyen)
- [ ] MediaConvert job'a **CMAF + `cbcs` + SPEKE** ekle (Widevine + PlayReady)
- [ ] Backend: izleme hakkını doğrula → kısa ömürlü **lisans token'ı** üret
- [ ] Oynatıcıya `drm.headers` ile token'ı geçir
- [ ] **Örnek backend:** küçük bir Node ya da Cloudflare Worker örneği; izleme hakkını doğrulayıp
      kısa ömürlü lisans token'ı üretir (ve 7.1/7.2 için Cloudflare imzalı token /
      CloudFront signed cookie). `examples/` altında, kütüphane bundle'ına girmez
- [ ] Chrome (Widevine) ve Edge (PlayReady) üzerinde elle test
- [ ] Negatif testler: token yok / süresi dolmuş / başka içerik → lisans reddi UI'a doğru düşüyor
- [ ] Şifreli dosyanın VLC / token'sız oynatmada açılmadığını doğrula

**Çıkış:** Şifreli akış yalnızca geçerli token'la oynuyor.

## 7.5 — Karşılaştırma ve karar 🟣 XS

- [ ] Cloudflare Stream vs AWS: kurulum süresi, maliyet, DRM kapsamı, kontrol
- [ ] Sonucu `recipes/` altına kısa bir "hangisi ne zaman" notu olarak yaz
- [ ] Gerekirse Cast tarafında DRM'li içerik davranışını kontrol et (alıcı da DRM desteklemeli)

---

## Sıra ve bağımlılık

`7.1` ve `7.2` birbirinden bağımsız, paralel yapılabilir. `7.3` kod fazıdır ve
hizmetlere bağlı değildir; ikisiyle beraber ilerleyebilir. `7.4`, `7.2` + `7.3`'ü
bekler. `7.5` en sona kalır.

## Dürüst notlar

- DRM korsan indirmeyi **zorlaştırır, engellemez**: düşük güvenlik seviyeli (L3)
  cihazlardan ekran yakalama mümkündür.
- Bu faz bir öğrenme projesi. Lisans sunucusu, sözleşmeler ve cihaz sertifikasyonu
  (özellikle Widevine L1) üretim için ayrıca değerlendirilmelidir.
- AWS'de MediaConvert ve CloudFront kullanıma göre faturalanır. 7.2'ye başlamadan
  **bütçe alarmı** kur ve test dosyalarını kısa tut.
