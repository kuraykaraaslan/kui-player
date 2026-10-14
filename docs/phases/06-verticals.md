# Faz 6 — Dikey Nişler

**Öncelik:** 🟣 Keşif · **Efor:** opsiyonel · **Durum:** ⏸️ Bilinçli olarak başlatılmadı

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
  ölçüm + standart orana yuvarlama. *Yapılmadı:* kare numarası için ayrı bir görünüm
  (zaman kodunun yanında `#N` olarak gösteriliyor).
- **6.4** — `a` tuşu veya düğme ile A / B / temizle, seek bar'da vurgulu aralık, sonsuz ya da
  1/2/3/5/10 tekrar, aralık başına hız hafızası.
- **Doğrulanmadı:** gerçek `requestVideoFrameCallback` yolu tarayıcıda denenmedi (testler
  `timeupdate` yedeğini sürüyor); kare hızı ölçümü gerçek bir videoyla doğrulanmadı.
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
  doğrulandı (bir CSS özgüllük hatası böyle yakalandı). *Yapılmadı:* RTL'de dalga formunun aynalanması,
  ayrı bir "audio-only skin" paketi (skin modu sürümü), peaks üretim betiği. `'decode'` yolu gerçek bir
  ses dosyasıyla denenmedi (testler Web Audio'yu taklit ediyor).
- **6.5 (kısmen yapıldı):** `learning` prop'u — transkript paneli (6.6'da, tıklayınca seek +
  geçerli satır işaretli; altyazı **araması** 6.2'de), zaman damgalı notlar (yazmaya başlanan
  an damgalanır; Markdown/JSON dışa aktarma, `persist` ile kalıcı), gerçekten izlenen
  bölümlerin haritası ve `onProgress` kancası, hız ve tercih devamlılığı (`persist`, mevcut).
  *Yapılmadı:* xAPI/SCORM (ayrı ürün kararı), izlenen haritasının seek çubuğunda gösterimi
  (yalnızca panelde), LMS'e gönderim.
- **6.1 (kısmen yapıldı, ayrı pakette):** `@kuraykaraaslan/kui-player/ads` — VAST 3/4 ayrıştırma
  (wrapper'lar, pod'lar), VMAP zamanlama (pre/mid/post), reklam arayüzü (atla, geri sayım,
  "Reklam 1/2", tıkla-geç), izleme pikselleri ve makrolar, hata durumunda içeriğe dönüş.
  Faz belgesinin şartları korundu: IMA SDK yok, **ayrı opsiyonel paket** (~5 kB), çekirdek ve
  React girişinde reklam kodu yok (`check:artifacts` bunu denetler), varsayılan gizlilik
  testi etkilenmez. *Yapılmadı / doğrulanmadı:* non-linear reklamlar, VPAID/SIMID, OMID, tüketici
  onayı (TCF/GPP). Gerçek bir reklam sunucusuyla denenmedi, yalnızca sentetik VAST/VMAP ve sahte
  video ile. Not: "gerçek talep" kriteri yine sağlanmadı, talimatla yapıldı. 6.1 (reklam) hâlâ konumlanmayla çelişiyor; 6.5/6.6 büyük
  ürün kararları.

