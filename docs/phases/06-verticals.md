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
