# Faz 6 — Dikey Nişler

**Öncelik:** 🟣 Keşif · **Efor:** opsiyonel · **Durum:** ⬜

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
