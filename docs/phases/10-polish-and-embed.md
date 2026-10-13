# Faz 10 — Cilalama, Bölümler ve Cihaz İçi Çeviri

**Öncelik:** 🟡 Olsa iyi · **Efor:** ~3–4 hafta · **Durum:** 📋 Planlandı

> Mevcut altyapının (chapters, playlist, storyboard, QoE) üstüne kurulan küçük ama
> görünür işler. Faz 7–9'dan bağımsızdır; 10.4 QoE ([8.1](./08-streaming-ops.md)) verisini
> kullandığı için 8.1'den sonra yapılmalı.

**Sıra:** 10.1 → 10.2 → 10.3 → 10.4 → 10.5 → 10.6. 10.3 deneysel, diğerlerini bloklamaz.

---

## 10.1 — Klavye kısayolları 🟡 S

Bugün: `Space`/`k`, `←`/`→` (±10 sn), `↑`/`↓` (ses), `m`, `f`, `i`, `Esc`
([`useKeyboardShortcuts.ts`](../../react/hooks/useKeyboardShortcuts.ts)). YouTube/Plyr
kullanıcılarının beklediği çoğu tuş yok, ve kullanıcı hangi tuşların var olduğunu göremiyor.

- [ ] Eklenecek tuşlar: `c` (altyazı aç/kapa), `0–9` (yüzdeye atla), `j`/`l` (±10 sn),
      `,`/`.` (kare kare, duraklatılmışken), `<`/`>` (hız), `Home`/`End`, `t` (sinema modu varsa)
- [ ] **Yardım katmanı:** `?` ile açılan kısayol listesi; odak tuzağı + `Esc` ile kapanma
      ([`useFocusTrap`](../../react/hooks/useFocusTrap.ts) yeniden kullanılır)
- [ ] **Özelleştirme:** `shortcuts` seçeneği ile tuş eşlemesi (ör. `{ seekForward: 'l' }`),
      `false` ile tek tek kapatma
- [ ] Çakışma kuralları: slider/metin alanında tuşlar yutulmaz (mevcut davranış korunur),
      tarayıcı/ekran okuyucu kısayollarıyla çakışan tuşlar belgelenir
- [ ] Çok oynatıcılı sayfada yalnızca **odaktaki** oynatıcı tepki verir
- [ ] i18n: yardım metinleri 6 dilde, RTL'de düzgün hizalanır
- [ ] README "Keyboard shortcuts" bölümü ve `llms-full.txt` güncellenir
- [ ] Test: tuş → engine çağrısı birim testi, yardım katmanı a11y (axe) testi

## 10.2 — Bölümler: atla ve gezin 🟡 M

Chapters ([4.4](./04-expected-features.md)) ve playlist geri sayımı (`playlistCountdown`)
zaten var. Eksik olan: bölümlere **anlam** vermek ve onlara klavye/buton ile gitmek.

- [ ] Chapter'a isteğe bağlı `kind`: `intro` | `recap` | `credits` | `content`
      (WebVTT chapters başlığından ya da açıkça verilen `Chapter[]`'den)
- [ ] **"İntroyu atla" / "Özeti atla" butonu:** ilgili bölümün içindeyken belirir,
      birkaç saniye sonra kaybolur; `autoSkip` seçeneği ile otomatik atlama (varsayılan kapalı)
- [ ] **"Jenerik" bölümünde** sıradaki öğeye hemen geç / geri sayımı başlat
      (mevcut `playlistCountdown` ile birleşir, ikinci bir sayaç yazılmaz)
- [ ] Bölümler arası gezinme: `[` / `]` ile önceki/sonraki bölüm (10.1 ile aynı eşleme sistemi)
- [ ] Bölüm listesi paneli (başlık + başlangıç zamanı), geçerli bölüm vurgulu
- [ ] a11y: buton `aria-live` ile duyurulur, odak çalmaz; kısayol: `s` ile atla
- [ ] Test: bölüm sınırında buton görünürlüğü, `autoSkip`, jenerik → playlist geçişi

## 10.3 — Cihaz içi çeviri 🟡 L · deneysel

Altyazıyı **buluta veri göndermeden** başka dile çevirmek. Faz 5.4 gizlilik taahhüdüyle uyumlu olmak zorunda.

**Önce doğrula:** Tarayıcı yerleşik çeviri/dil algılama API'leri (Chrome'daki `Translator`,
`LanguageDetector`) ve konuşma tanıma (`SpeechRecognition` ile yerel işleme) yalnızca
bazı tarayıcılarda ve model indirildiyse çalışır. Güncel desteği ve veri akışını (model
cihazda mı, istek sunucuya gidiyor mu) dokümandan teyit et; teyit edilemeyen parça yapılmaz.

- [ ] **A. Mevcut altyazıyı çevir (gerçekçi kısım):** seçili altyazı izinin cue metinlerini
      cihaz içi `Translator` ile hedef dile çevir; çıkan sonuç ikinci altyazı olarak
      gösterilir ([9.5 çift dil](./09-ux-accessibility.md) ile birleşir)
- [ ] Özellik tespiti: API yoksa seçenek hiç görünmez; model indirilirken ilerleme göstergesi
- [ ] **Veri sızıntısı yok kuralı:** çeviri istekleri ağ üzerinden gitmez; CI testi
      (mevcut sıfır telemetri testine eklenir) ağ çağrısı olmadığını doğrular
- [ ] Cue başına çeviri önbelleği (aynı cue tekrar çevrilmez), uzun altyazıda parça parça
- [ ] **B. Canlı altyazı (opsiyonel, ayrı karar):** ses → metin için cihaz içi tanıma.
      Tarayıcı tanıması yerelde çalışmıyorsa bu madde **yapılmaz**; WASM tabanlı model
      (Whisper vb.) ayrı, isteğe bağlı bir paket olur ve ana bundle'a girmez
- [ ] Kullanıcıya açıkça söyle: çeviri otomatiktir, hata içerebilir (etiket: "Otomatik çeviri")
- [ ] Test: API mock'u ile akış; gerçek çeviri kalitesi elle değerlendirilir

## 10.4 — Teknik bilgi paneli 🟡 S

"Stats for nerds": akışı debug etmek için. Faz 7'de Cloudflare ve AWS'yi karşılaştırırken doğrudan işe yarar.

- [ ] Sağ tık menüsünden ya da `Shift+I` ile açılır; varsayılan kapalı
- [ ] Gösterilen: çözünürlük, anlık/ortalama bitrate, codec, tampon uzunluğu, düşen kare,
      gecikme (canlıda), adapter adı (`hls`/`dash`/native), DRM durumu ([7.3](./07-drm-streaming.md))
- [ ] Veri kaynağı QoE ([8.1](./08-streaming-ops.md)) ve `MediaAdapterHost`; yeni ölçüm yazılmaz
- [ ] Salt okunur, "kopyala" ile panodaki metni hata raporuna eklenebilir
- [ ] a11y: panel `role="dialog"`/`aria-label`, ekran okuyucuyu sürekli konuşturmaz (canlı bölge yok)
- [ ] Test: bileşen testi, sahte store ile değerlerin gösterimi

## 10.5 — Tıklayınca yüklenen kapak (facade) 🟡 M

Sayfa hızı için: oynatıcı, kullanıcı tıklayana kadar ağır kodu yüklemez.

- [ ] `facade` seçeneği: yalnızca poster + oynat butonu render edilir
- [ ] Tıklamada `import()` ile oynatıcı ve (gerekirse) hls.js yüklenir; tıklama yeniden
      oynatmayı **kullanıcı hareketi içinde** başlatır (autoplay kısıtlarına takılmaz)
- [ ] Yüklenirken boyut zıplamaz (poster ile aynı en-boy oranı, CLS = 0)
- [ ] Hover/odakta `preconnect` + `modulepreload` ipucu (isteğe bağlı)
- [ ] `mountSkin` ve web component ile çalışır; `size-limit` bütçesine facade girişi eklenir
- [ ] a11y: kapak gerçek `<button>`, klavyeyle açılır, doğru `aria-label`
- [ ] Test: kapakta ağ isteği yok (Playwright), tıklayınca oynatıcı yükleniyor

## 10.6 — Storyboard üretici 🟡 S

Önizleme küçük resimleri ([4.5](./04-expected-features.md)) oynatma tarafında var; **sprite ve
VTT dosyasını üreten araç yok**, pratikte en çok takılınan yer.

- [ ] `scripts/` altında `ffmpeg` tabanlı betik: videodan N saniyede bir kare, tek sprite + `thumbs.vtt`
- [ ] Parametreler: aralık, küçük resim boyutu, sütun sayısı
- [ ] Çıktı formatı mevcut storyboard okuyucusuyla bire bir uyumlu (round-trip testi)
- [ ] Cloudflare Stream'in kendi `thumbnails` çıktısıyla karşılaştırma notu
      ([Faz 7.1](./07-drm-streaming.md)); AWS tarafında MediaConvert frame capture ile alternatif
- [ ] `recipes/storyboard.md`
