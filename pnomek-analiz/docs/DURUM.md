# Durum ve bekleyen kararlar (2026-09-06)

## Neden ADIM 1 henüz gerçek veriyle çalışmadı
Bu çalışma bulut ortamında hazırlandı; Mikro SQL Server yerel ağda olduğu için buradan erişilemiyor,
depoda config.json / kesif.js yoktu ve OneDrive'daki "2025 MALİYET ÇALIŞMASI" klasörü de erişilebilir değil.
Araç seti tamamlandı ve sahte veriyle uçtan uca test edildi (`node test/mock_test.js`).

## Sizden beklenen
1. Mikro'ya erişen bilgisayarda: `npm install`, `config.json` doldur, `node src/run.js kesif`.
2. `cikti/kesif/kesif_raporu.md` ve `cikti/kesif/grup_tablolari.md` dosyalarını paylaşın (veya depoya commit edin).
3. Karar: `grupAlani` = anagrup / altgrup / hiyerarsik.
4. Satış/alış filtresi önerisini ve reçete kolon eşleştirmesini onaylayın (config.json'a yazın).
Sonraki adımlar (satis, maliyet, karsilastir, rapor) bu kararlarla çalışır.
