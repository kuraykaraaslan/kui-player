# Faz 5 — Niş Farklılaşma

**Öncelik:** 🟣 Stratejik · **Efor:** ~3 hafta · **Durum:** ⬜

> **Bu, projenin kazanma fazı.** Faz 0–4 bizi "kabul edilebilir" yapıyor; kimseyi
> Vidstack'ten veya Video.js v10'dan kopartmıyor. Bu faz kopartıyor.
>
> Faz 3 (kalite kapısı) bittikten sonra **Faz 4 ile paralel yürütülebilir** —
> hatta 5.1 ve 5.5 önce yapılmalı, çünkü konumlandırma mesajını belirliyorlar.

---

## Stratejik gerekçe

Mart 2026'da Video.js, Plyr, Vidstack ve Media Chrome birleşti; v10 beta React
bundle'ı 18 KB gzip, genel kullanıma açılma hedefi 2026 ortası, migration guide'larıyla.
Dört projenin toplam ~75.000 GitHub yıldızı tek çatı altında.

**Sonuç:** "Genel amaçlı iyi bir video player" olma yarışı bitti. kui-player bu yarışa
girerse kaybeder. Ama v10 beta'sında **settings menüsü henüz yok** ve **reklam desteği
2026 sonuna kaldı**; ayrıca hiçbiri "sayfadaki mevcut `<video>`'yu ele geçirip
giydirme"yi birinci sınıf ürün olarak sunmuyor.

Elimizdeki iki koz **zaten kodda var, sadece anlatılmamış:**
`embed/mountSkin.tsx` ve Cast'in remote-player mirroring'i.

---

## 5.1 — "Skin mode"un ürünleştirilmesi 🟣 M — **en yüksek öncelik**

**Neden:** [embed/mountSkin.tsx](../embed/mountSkin.tsx) sayfadaki mevcut `<video>`
elemanını benimseyip üstüne şeffaf bir chrome katmanı bindiriyor —
"site'nin media pipeline'ına (progressive / hls.js / MSE / blob) dokunmadan".

Bunun rakiplerde **doğrudan karşılığı yok.** Media Chrome headless kontroller sunuyor
ama sen kendi `<video>`'nu ona vermek zorundasın; kui-player sayfada zaten olanı alıyor.

**Ürünleştirme:**
- İsimlendir ve pazarla: "**Bring your own `<video>`**" / "video'nuza deri geçirin".
- Otomatik keşif modu: `kui.skinAll('video')` — sayfadaki tüm videoları giydir.
- Host video'nun kendi `controls` özniteliğini devral/gizle, geri alınabilir olsun.
- Shadow DOM ile host CSS'inden tam izolasyon (Faz 2.2'nin doğal devamı).
- `MutationObserver` ile sonradan DOM'a eklenen videoları yakala (SPA'lar için).
- hls.js/Video.js/Plyr ile **sarılmış** videoların üstünde de çalıştığını göster ve test et.
- README'nin en üstüne bu senaryoyu koy, canlı demo yaz.

**Hedef kitle:** CMS/WordPress siteleri, mevcut oynatıcısını değiştiremeyen ama
arayüzünü yenilemek isteyen ekipler, tarayıcı eklentisi geliştiricileri.

---

## 5.2 — Tek `<script>` embed / no-build kullanım 🟣 S

**Neden:** Rakiplerin hepsi bundler varsayıyor. CMS, WordPress, statik site,
landing page pazarı büyük ve karşılanmamış.

**Yapılacak:**
- `dist/embed.js` zaten var ama ~97 KB — Faz 2 sonrası ≤ 35 KB olacak.
- CDN dağıtımı (unpkg/jsDelivr), sürümlü URL'ler.
- Sıfır yapılandırmalı otomatik başlatma:
  `<script src="…/kui.js" data-auto="video.kui"></script>`
- `data-*` öznitelikleriyle yapılandırma (`data-cast`, `data-subtitles`, `data-theme`).
- WordPress eklentisi (küçük bir sarmalayıcı, büyük dağıtım kanalı).
- Kopyala-yapıştır çalışan tek dosyalık HTML örneği.

---

## 5.3 — Cast-first konumlanma 🟣 M

**Neden:** Google Cast desteğini remote-player mirroring ile **birinci sınıf** yapan
tek hafif oynatıcı biziz. `useGoogleCast.ts` (148 satır) + engine'in tüm aksiyonlarının
Cast'e yönlenmesi zaten yazılmış. Rakiplerde Cast genelde eklenti seviyesinde.

**Derinleştirme:**
- **Kuyruk (queue) desteği** — çoklu medya, sonraki/önceki, kuyruk düzenleme.
- Custom receiver app ID desteği + dokümantasyonu (marka özelleştirmesi).
- Cast sırasında altyazı ve ses izi seçiminin receiver'a iletilmesi.
- Bağlantı kesildiğinde yerel oynatmaya **pozisyon koruyarak** dönüş.
- Cihaz keşif durumları için düzgün UI (arıyor / bulunamadı / bağlanıyor / hata).
- AirPlay ile birlikte (Faz 4.2) "tek API'de tüm cast hedefleri" hikayesi.

---

## 5.4 — Gizlilik-öncelikli / sıfır telemetri 🟣 S

**Neden:** GDPR/KVKK duyarlı kurumsal alıcı için gerçek bir satın alma kriteri.
Ticari oynatıcıların (JW, Mux, Bitmovin) hepsi telemetri gönderiyor.
Bu, **ölçülebilir ve denetlenebilir** bir iddia — pazarlama sloganı değil.

**Yapılacak:**
- "Sıfır dış istek" garantisi: player, kullanıcının verdiği medya URL'leri dışında
  hiçbir ağ isteği yapmaz.
- Cast SDK'sı tek istisna — açıkça opt-in (`enableCast`) ve belgelenmiş.
- Bunu **testle kanıtla:** Playwright'ta ağ isteklerini yakalayan, izinli liste
  dışında istek görürse kırılan bir test. CI'da koşsun.
- `localStorage` kullanımı (Faz 4.3) opt-out edilebilir ve belgelenmiş olsun.
- README'de "Privacy" bölümü + rozet.
- Bağımlılık sayısının sıfır olması (Faz 4.12) bu hikayenin parçası — tedarik
  zinciri yüzeyi yok.

---

## 5.5 — `llms.txt` + AI agent dokümantasyonu 🟣 XS

**Neden:** Video.js v10 kod tabanını bilinçli olarak "agent experience" için
tasarladığını duyurdu: azaltılmış soyutlama, `llms.txt`, markdown sayfa sunumu,
büyüyen bir AI skill kütüphanesi. Bu artık bir rekabet ekseni.

Küçük bir kütüphane için **orantısız getirisi olan, çok ucuz** bir hamle:
geliştiriciler oynatıcı seçimini artık asistanlarına soruyor.

**Yapılacak:**
- Kök dizine `llms.txt` ve `llms-full.txt` — tam API yüzeyi, tipler, örnekler.
- Docs sayfalarını `.md` uzantısıyla da sun.
- Yaygın entegrasyonlar için kopyalanabilir tarif dosyaları
  (Next.js, Vite, WordPress, skin-mode, hls.js).
- JSDoc kapsamını tamamla — tip tanımları asistanların ana bilgi kaynağı.

---

## Faz 5 çıkış kriterleri

- [ ] README'nin ilk paragrafı "yeni bir genel amaçlı player" değil,
      **"herhangi bir `<video>` etiketine tek script ile giydirilen, Cast-öncelikli,
      sıfır-telemetri chrome katmanı"** diyor
- [ ] Skin mode'un kendi demo sayfası ve WordPress eklentisi var
- [ ] Sıfır-dış-istek iddiası CI testiyle kanıtlanıyor
- [ ] `llms.txt` yayında
