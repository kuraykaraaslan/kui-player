# Faz 8 — Yayın Kalitesi ve Operasyon

**Öncelik:** 🟡 Olsa iyi · **Efor:** ~3–4 hafta · **Durum:** 📋 Planlandı

> [Faz 7](./07-drm-streaming.md) hattı (Cloudflare Stream + AWS, hls.js, DRM) kurulduktan
> sonra gelir. Amaç oynatmanın **ölçülebilir, düşük gecikmeli ve izlenebilir** olması.
> 8.1 ve 8.2 Faz 7'nin öğrenme çıktısını koda döker; 8.5 DRM'e bağlıdır.

**Sıra:** 8.1 → 8.2 → 8.3 → 8.4 → 8.5. 8.1 ve 8.2 birbirinden bağımsız, paralel gidebilir.

---

## 8.1 — QoE metrikleri 🟡 M

Event API'si (`engine.on()`) ve CMCD var; ölçülen kalite verisi yok.

- [ ] Başlangıç süresi (play → ilk kare), yeniden yükleme (rebuffer) sayısı ve süresi
- [ ] Ortalama / anlık bitrate, kalite geçiş sayısı, düşen kare (`getVideoPlaybackQuality`)
- [ ] Yeni event: `qoe` (periyodik özet) ve `qoe:stall`; mevcut `docs/` ve
      `recipes/analytics.md` ile tutarlı
- [ ] hls.js / dash.js adapter'larından rendition + bant genişliği bilgisini `MediaAdapterHost` üzerinden al
- [ ] **Telemetri varsayılan kapalı:** metrik yalnızca dışarıya event olarak verilir,
      kütüphane hiçbir yere göndermez (Faz 5.4 gizlilik kuralı, CI testiyle korunuyor)
- [ ] Unit test: sahte zaman çizelgesiyle stall/başlangıç süresi hesabı

**Çıkış:** Cloudflare ve AWS aynı video için karşılaştırılabilir sayılar veriyor (Faz 7.6'ya girdi).

## 8.2 — Düşük gecikmeli HLS (LL-HLS) 🟡 S

Canlı + DVR var; gecikme düşürme ve yakalama yok.

- [x] `createHlsAdapter` için `lowLatency` seçeneği → hls.js `lowLatencyMode`,
      `liveSyncDuration` ayarları
- [x] Canlı kenara yetişme (catch-up): hls.js'in `maxLiveSyncPlaybackRate`'i ile (`catchUpRate`, varsayılan 1.1×); native Safari kendi gecikmesini yönetir. Gerçek LL-HLS kaynağıyla doğrulanmadı, yalnızca ayar geçişi test edildi
- [x] "Canlıya dön" göstergesi gecikmeyi saniye cinsinden gösterir
- [x] `recipes/hls-and-dash.md` içine LL-HLS bölümü; kaynak tarafı gereksinimleri (parçalı segment, `EXT-X-PART`)

**Not:** Canlı kaynak gerektirir; MediaConvert canlı yapmaz (AWS tarafında MediaLive gerekir).
Kaynak yoksa yalnızca ayar geçişi ve test sahte stream ile yapılır.

## 8.3 — Sunucu tarafı reklam (SSAI) işaretleri 🟡 M

Reklam göstermek değil, **stream içindeki işaretleri olay olarak vermek**. Faz 6.1'den (VAST/VMAP) bağımsız ve çok daha hafif.

- [ ] HLS `EXT-X-DATERANGE`, `EXT-X-CUE-OUT/IN` ve ID3 timed metadata okuma
- [ ] Event: `adbreak:start` / `adbreak:end` (başlangıç, süre, kimlik)
- [ ] Zaman çizelgesinde reklam aralıklarını işaretle, reklam sırasında atlamayı kapatma seçeneği
- [ ] Unit test: örnek manifest + metadata ile doğru event'ler

## 8.4 — Görünür filigran 🟡 S

DRM'in tamamlayıcısı: sızıntıyı kullanıcıya bağlayabilmek için.

- [x] `watermark` seçeneği: metin (kullanıcı ID/e-posta) + opaklık + konum
- [x] Konum **periyodik olarak** değişir (kenarlara sabitlenmiş filigran kırpılabilir)
- [x] Tam ekranda görünür kalır (mark oynatıcı container'ının içinde). Mini oynatıcı ([9.2](./09-ux-accessibility.md)) henüz yok; gelince doğrulanacak
- [x] DOM'dan kaldırılırsa/gizlenirse oynatmayı duraklatma seçeneği (MutationObserver)
- [x] Dürüst not: ekran kaydını engellemez, caydırıcıdır

## 8.5 — Çevrimdışı izleme 🔴 L · opsiyonel

En büyük ve riskli madde; yalnızca gerçek ihtiyaç varsa.

- [ ] Service worker + IndexedDB ile segment önbellekleme, indirme ilerlemesi
- [ ] Depolama kotası, silme, "indirildi" durumu UI'ı
- [ ] **DRM'li içerik:** kalıcı lisans (persistent-license) gerekir, sağlayıcı ve cihaz desteği
      ayrı doğrulanmalı; çoğu durumda mümkün değil
- [ ] Önce DRM'siz içerikle prototip

**Karar noktası:** Faz 7.4 bittikten sonra, DRM'li çevrimdışı mümkün değilse kapsamı DRM'siz içerikle sınırla ya da maddeyi bırak.
