# Faz 6 — Dikey Nişler

**Öncelik:** 🟣 Keşif · **Efor:** opsiyonel · **Durum:** 🟡 Kısmen yapıldı (Ekim 2026, talep olmadan, Kuray'ın talimatıyla); ayrıntı aşağıdaki "Uygulama notu"nda. Açık: xAPI/SCORM, VPAID/SIMID/OMID/TCF, ayrı audio-only skin paketi

> Bunlar **yol haritası değil, opsiyon havuzu.** Hiçbiri "eninde sonunda yapılacak"
> değil. Faz 5'ten gelen kullanıcı geri bildirimi hangi dikeyin gerçekten talep
> ettiğini gösterdikten sonra, **en fazla bir tanesi** seçilip yapılmalı.
>
> Sıralama, tahmini pazar büyüklüğü × rakip boşluğu.

---

## 6.1 — Reklam desteği (VAST/VMAP) 🟣 L

**Boşluk:** Video.js v10'un reklam desteği **2026 sonuna** ertelendi. Bu, somut ve
tarihli bir pencere.

**Yaklaşım:** OpenPlayerJS deseni — Google IMA SDK'ya bağımlı olmadan.
IMA SDK ~100 KB ve Google'a telemetri gönderiyor; bu Faz 5.4'teki gizlilik
konumlanmasıyla doğrudan çelişir. Alternatif: `rmp-vast` gibi hafif bir
client-side ad insertion (CSAI) katmanı.

- VAST 4.x parse, preroll / midroll / postroll / non-linear
- VMAP zamanlama
- Reklam UI'ı: atla butonu, geri sayım, "reklam 1/2"
- Quartile event'leri (Faz 4.6 ile zaten var)

**Uyarı:** En yüksek eforlu madde ve gizlilik konumlanmasıyla gerilimli.
Yalnızca gerçek talep varsa ve **ayrı bir opsiyonel paket** olarak yapılmalı.

---

## 6.2 — Altyazı senkron kaydırma ve düzenleyici 🟣 M

Sürekli talep edilen, **hiçbir oynatıcıda standart olmayan** özellik.

- `[` / `]` ile altyazıyı ±0.1s kaydır, ekranda offset göstergesi
- Offset'i kaynak bazında kaydet
- Harici altyazı dosyası sürükle-bırak
- Altyazı arama + o cue'ya seek
- Çift altyazı (öğrenme modu: iki dil aynı anda)

**Kitle:** Fansub toplulukları, dil öğrenme platformları, eğitim siteleri.

---

## 6.3 — Frame-by-frame + SMPTE timecode 🟣 S

Efor/etki oranı en iyi madde. Küçük ama sadık bir kitle.

- `,` / `.` ile kare atlama (`requestVideoFrameCallback`)
- SMPTE timecode gösterimi, fps prop'u
- Kare numarasına göre seek
- Zaman damgası kopyalama

**Kitle:** Video review/onay araçları, post-prodüksiyon, spor analizi.

---

## 6.4 — A-B loop ve bölüm tekrarı 🟣 S

- İşaretleyicilerle A-B aralığı seçimi, progress bar'da görsel
- Sonsuz tekrar, tekrar sayısı ayarı
- Aralık başına hız hafızası

**Kitle:** Dil öğrenme, müzik dersi, dans/spor analizi.

---

## 6.5 — Eğitim modu 🟣 L

- Transkript paneli — tıklayınca seek, oynatmayla senkron kaydırma, arama
- Zaman damgalı not alma, dışa aktarma
- İlerleme takibi (izlenen segmentler haritası)
- Hız hafızası ve dersler arası tercih devamlılığı
- Not: LMS entegrasyonu (xAPI/SCORM event'leri) ayrı bir ürün kararı

**Kitle:** LMS/kurs platformları. Büyük pazar ama entegrasyon yükü ağır.

---

## 6.6 — Ses dalga formu / audio-only mod 🟣 M

- Web Audio API ile dalga formu veya önceden üretilmiş peak dosyası
- Podcast düzeni: büyük artwork, bölüm işaretleri, transkript
- Audio-only skin varyantı

**Kitle:** Podcast platformları, ses arşivleri.

---

## Karar kriteri

Bir madde ancak şu üçünü birden sağlıyorsa yapılmalı:

1. Faz 5 sonrası kullanıcılardan **gerçek talep** geldi (issue, e-posta, kullanım verisi)
2. Faz 5'teki konumlanmayla **çelişmiyor** (özellikle 6.1 gizlilik açısından şüpheli)
3. **Opsiyonel paket** olarak paketlenebiliyor — çekirdek bundle'ı büyütmüyor

---

## Durum: neden hiçbiri yapılmadı

**Birinci kriter bugün hiçbir madde için sağlanamıyor.** Faz 0–5 tamamlandı ama
`0.1.0` henüz yayınlanmadı; ortada kullanıcı, issue veya kullanım verisi yok.
Bu fazın kendi kuralı, hangi dikeyin seçileceğine **talebin** karar vermesi.
Şimdi bir madde seçmek, bu belgenin var oluş sebebini — "tahmine göre değil,
talebe göre" — ihlal etmek olurdu.

İkinci ve üçüncü kriterlere göre bugünkü değerlendirme:

| # | Konumlanmayla uyum | Opsiyonel paketlenebilir mi | Not |
|---|---|---|---|
| 6.3 Frame-by-frame + SMPTE | ✅ | ✅ ayrı chunk, birkaç yüz bayt | Efor/etki oranı en iyi aday |
| 6.4 A-B loop | ✅ | ✅ | 6.3 ile aynı yerden besleniyor |
| 6.2 Altyazı senkron/düzenleyici | ✅ | ✅ parser altyapısı Faz 4.9'da hazır | Talep gelirse ikinci aday |
| 6.6 Dalga formu / audio-only | ✅ | ✅ Web Audio ayrı chunk | Ayrı bir skin gerektirir |
| 6.5 Eğitim modu | ✅ | ⚠️ LMS entegrasyonu ürün kararı | Büyük ama ağır |
| 6.1 Reklam (VAST/VMAP) | ❌ **çelişiyor** | ⚠️ ayrı paket şart | Gizlilik konumlanmasıyla doğrudan gerilimli |

**Öneri:** Talep geldiğinde ilk bakılacak madde **6.3**; hem en ucuz, hem
`requestVideoFrameCallback` dışında yeni bir yüzey gerektirmiyor, hem de Faz 5'in
"gizlilik ve hafiflik" hikayesini hiç zorlamıyor. **6.1 varsayılan olarak reddedilmeli**:
IMA SDK ~100 KB ve Google'a telemetri gönderiyor; ayrı bir paket olmadan Faz 5.4'teki
"sıfır dış istek" testini kıracaktır.

**Bir sonraki adım Kuray'ın:** `0.1.0` yayınlansın, geri bildirim toplansın, sonra
buradan **en fazla bir** madde seçilsin.

---

## Uygulama notu (Ekim 2026): 6.3 ve 6.4 yapıldı — talep olmadan

Yukarıdaki karar kriterinin **birincisi (gerçek talep) sağlanmadı**; bu iki madde Kuray'ın
açık talimatıyla ("fazları kapat, tam izinlisin") yapıldı, kural bilerek esnetildi. Üçüncü
kriter korunmaya çalışıldı: iki özellik de `frameTools` prop'u arkasında, ayrı bir lazy chunk'ta
(`FrameTools`) ve varsayılan **kapalı**; kapalıyken yalnızca ~1 kB'lık `timecode` yardımcısı
çekirdekte kalıyor (kare adımı artık gerçek kare hızını kullanıyor).

- **6.3** — `,` / `.` kare adımı (kare ortasına iner), SMPTE timecode (drop-frame dahil, 29.97
  için birim testle doğrulandı), kareye/timecode'a git, timecode kopyala, fps prop'u veya
  ölçüm + standart orana yuvarlama. Kare numarası artık zaman kodunun yanında ayrı bir kutu (`#N`, "kareye git"): yazıp Enter ile o kareye atlar, ana zaman kodu kutusu ise hâlâ hem kare hem timecode kabul eder. Kutunun erişilebilir adı mevcut "Kare" çevirisidir (yeni anahtar eklenmedi, gömülü paket bütçesi için). Aynı `frameTools` lazy chunk'ı içinde; yeni bağımlılık yok.
- **6.4** — `a` tuşu veya düğme ile A / B / temizle, seek bar'da vurgulu aralık, sonsuz ya da
  1/2/3/5/10 tekrar, aralık başına hız hafızası.
- **Verified in real Chromium (headless 1248, a generated 25 fps VP9 WebM with the frame number painted on it; `tests/e2e/review.spec.ts`):** the real `requestVideoFrameCallback` path runs, the frame rate is measured from presented frames and snapped to 25 (timecode reads `00:00:04:00` at frame 100, not the 30 fps default), `,` / `.` move exactly one presented frame, and the frame-number box and the timecode box jump to the right frame. Layout of the timecode box, frame-number box and buttons was checked in LTR and RTL (inside the player, no overlaps). **Bug found and fixed this way:** pausing left `currentTime` a few ms short of the frame already on screen, so `.` could land on the frame being shown and appear to do nothing (about 5 of 6 runs under load); the engine now steps from the presented frame (it watches `requestVideoFrameCallback` while playing and once after each seek) and falls back to `currentTime` when the callback is missing or stale (unit tests added).
- **Still unverified (6.3):** Firefox and Safari (the specs run in Chromium only; the `timeupdate` fallback is only exercised in jsdom), non-integer rates such as 29.97 against a real file, and drop-frame against real media.
- **6.2 (yapıldı):** `g` / `h` ile ±0,1 sn altyazı kaydırma (gösterge, menüden sıfırlama,
  `persist` ile kaynak başına hatırlama), altyazı arama + cue'ya seek (gecikme dahil), harici altyazı
  dosyası sürükle-bırak (SRT/VTT/ASS, bellekte; yüklenmez, `persist` ile hatırlanmaz) ve çift dil
  (9.5). **Düzenleyici de yapıldı** (satır metni ve başlangıç/bitiş zamanı, satır ekle/sil, hemen kullan ya da SRT/VTT indir; uzun dosyalarda sanallaştırma yok). Not: maddedeki
  `[` / `]` tuşları bölüm gezinmesine ayrılmıştı (10.2), bu yüzden `g` / `h` kullanıldı. Dosya boyutu
  sınırı 5 MB; sürükle-bırak yalnızca Chromium/Firefox masaüstünde denenmedi — testler jsdom'da.
- **6.6 (yapıldı, kısmen):** `audioOnly` podcast düzeni (büyük kapak, hep görünür kontroller, video
  çizilmez ama oynar), `waveform` ile dalga formu seek çubuğunda (peaks dizisi, wavesurfer /
  `audiowaveform` JSON'u ya da `'decode'` ile Web Audio'dan hesaplama; 60 MB sınırı), bölüm
  işaretleri mevcut chapters çubuğundan, transkript paneli (altyazı izinden, geçerli satır
  işaretli, tıklayınca seek). Gerçek Chromium'da ekran görüntüsüyle ve Playwright ile görülüp
  doğrulandı (bir CSS özgüllük hatası böyle yakalandı). **Sonradan yapıldı:** RTL'de dalga formu aynalanıyor (`[dir="rtl"] .kui-wave { scaleX(-1) }`; çalma konumu kırpması ve çubuk sırası birlikte döner) ve `scripts/peaks.mjs` (ffmpeg ile, audiowaveform uyumlu JSON, bağımlılık yok; saf kısmı `PeakAccumulator` birim testli; [recipes/waveform-peaks.md](../../recipes/waveform-peaks.md)). *Yapılmadı:* ayrı bir "audio-only skin" paketi (skin modu sürümü; ürün kararı). The mirroring is now also checked in real Chromium by screenshot pixels (`tests/e2e/audio.spec.ts`): with `locale=ar` the played part fills from the right edge, its width matches the playhead, and the bars are drawn back to front; the test fails when the CSS rule is removed. Firefox and Safari were not checked. `peaks.mjs` bu makinede ffmpeg olmadığı için uçtan uca çalıştırılmadı; yalnızca PCM → JSON kısmı test edildi. `'decode'` yolu gerçek bir
  ses dosyasıyla denenmedi (testler Web Audio'yu taklit ediyor).
- **6.5 (kısmen yapıldı):** `learning` prop'u — transkript paneli (6.6'da, tıklayınca seek +
  geçerli satır işaretli; altyazı **araması** 6.2'de), zaman damgalı notlar (yazmaya başlanan
  an damgalanır; Markdown/JSON dışa aktarma, `persist` ile kalıcı), gerçekten izlenen
  bölümlerin haritası ve `onProgress` kancası, hız ve tercih devamlılığı (`persist`, mevcut).
  *Yapılmadı:* xAPI/SCORM (ayrı ürün kararı), LMS'e gönderim. **Sonradan yapıldı:** izlenen haritası `learning` açıkken seek çubuğunun altında ince bir şerit olarak da çiziliyor (panelin yayımladığı `watchedRuns` store alanından; panel kapanınca temizlenir; yalnızca bir yüzde dilimi tamamlandığında güncellenir; ekran okuyucuya gizli, erişilebilir bilgi panelde ve düğmede kalıyor). Verified in real Chromium with a real video (`tests/e2e/review.spec.ts`, plus screenshots): the strip is a 2 px hairline under the seek track with the same horizontal extent, starts at the leading edge (left in LTR, right in RTL), matches the played share, grows while playing, and a seek leaves a gap. Firefox and Safari were not checked.
- **6.1 (kısmen yapıldı, ayrı pakette):** `@kuraykaraaslan/kui-player/ads` — VAST 3/4 ayrıştırma
  (wrapper'lar, pod'lar), VMAP zamanlama (pre/mid/post), reklam arayüzü (atla, geri sayım,
  "Reklam 1/2", tıkla-geç), izleme pikselleri ve makrolar, hata durumunda içeriğe dönüş.
  Faz belgesinin şartları korundu: IMA SDK yok, **ayrı opsiyonel paket** (~5 kB), çekirdek ve
  React girişinde reklam kodu yok (`check:artifacts` bunu denetler), varsayılan gizlilik
  testi etkilenmez. *Yapıldı (sonradan):* VAST 3/4 non-linear reklamlar: yalnızca `StaticResource` görseli `<img>` olarak,
  videonun alt kısmında, oynatmayı durdurmadan; kapatma düğmesi, `minSuggestedDuration` (varsayılan 10 sn)
  sonunda otomatik gizlenme, VMAP zaman ofsetiyle planlama, tıklama (`noopener noreferrer`, yalnızca http/https),
  Impression/creativeView/ClickTracking. `IFrameResource`/`HTMLResource` güvenlik gereği bilerek yok sayılır.
  *Yapılmadı / doğrulanmadı:* VPAID/SIMID, OMID, tüketici onayı (TCF/GPP), companion reklamlar.
  Gerçek bir reklam sunucusuyla denenmedi, yalnızca sentetik VAST/VMAP ve sahte
  video ile; non-linear kısım da yalnızca elle yazılmış sentetik VAST ile test edildi. **Real Chromium over a real video (`tests/e2e/review.spec.ts`):** the banner is the declared 300x50, centred in the lower half of the player, clear of the seek bar, does not pause playback, closes on dismiss and playback continues. **Bug found and fixed:** the overlays (banner and linear ad) were laid out inside the `top` slot, a 24 px strip inside the auto-hiding controls, so the banner rendered above the picture and vanished with the controls (linear ads would have been confined to that strip); `AdsOverlay` now portals into the player root (falling back to in-place when there is none), and the banner sits 6rem above the bottom edge so it clears the seek bar. Still unverified: any real ad server, other browsers, and fullscreen/Document PiP placement. Not: "gerçek talep" kriteri yine sağlanmadı, talimatla yapıldı. 6.1 (reklam) hâlâ konumlanmayla çelişiyor; 6.5/6.6 büyük
  ürün kararları.
- **Bütçe:** bu dört ek gömülü `embed` paketini 51,96 → 52,07 kB gzip yaptı; sınır 52 → 52,2 kB'a çıkarıldı (diğer paketler mevcut sınırların içinde).
- **Budget (real-browser fixes):** the frame-step fix in the engine and the ads portal added about 0.2 kB gzip each to `react subpath` (38.2 to 38.4 kB), `every lazy chunk` (47.3 to 47.5 kB) and `embed` (53.8 to 54 kB); the other bundles are unchanged. Raised only by what the two fixes cost.
