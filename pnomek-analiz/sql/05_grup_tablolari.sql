-- GENEL PARAMETRELER: Ürün grubu alanı kararı için tablolar
-- Satış hareketi filtresi (ADIM 1'de doğrulanır; varsayılan: çıkış + fatura, iade negatif)
-- !!! @satis_filtresi ADIM 1 sonucuna göre güncellenir. Varsayılan: sth_tip=1 AND sth_evraktip IN (1,4) 
DECLARE @bas DATE = '2020-01-01', @bit DATE = '2027-01-01';

;WITH satis AS (
  SELECT h.sth_stok_kod,
         SUM(CASE WHEN h.sth_normal_iade = 1 THEN -h.sth_miktar ELSE h.sth_miktar END) AS adet
  FROM STOK_HAREKETLERI h
  WHERE h.sth_tarih >= @bas AND h.sth_tarih < @bit
    AND h.sth_tip = 1 AND h.sth_evraktip IN (1,4)       -- <-- ADIM 1 sonucuna göre güncelle
  GROUP BY h.sth_stok_kod
)
-- 5a) Ana grup bazında
SELECT ISNULL(NULLIF(RTRIM(s.sto_anagrup_kod),''),'(BOŞ)') AS anagrup_kod,
       ISNULL(ag.san_isim, '(tanımsız)') AS anagrup_adi,
       COUNT(*) AS stok_karti, ISNULL(SUM(sa.adet),0) AS satis_adedi_2020_2026
FROM STOKLAR s
LEFT JOIN STOK_ANA_GRUPLARI ag ON ag.san_kod = s.sto_anagrup_kod
LEFT JOIN satis sa ON sa.sth_stok_kod = s.sto_kod
GROUP BY ISNULL(NULLIF(RTRIM(s.sto_anagrup_kod),''),'(BOŞ)'), ISNULL(ag.san_isim, '(tanımsız)')
ORDER BY satis_adedi_2020_2026 DESC;

-- 5b) Alt grup bazında
;WITH satis AS (
  SELECT h.sth_stok_kod,
         SUM(CASE WHEN h.sth_normal_iade = 1 THEN -h.sth_miktar ELSE h.sth_miktar END) AS adet
  FROM STOK_HAREKETLERI h
  WHERE h.sth_tarih >= @bas AND h.sth_tarih < @bit AND h.sth_tip = 1 AND h.sth_evraktip IN (1,4)
  GROUP BY h.sth_stok_kod
)
SELECT ISNULL(NULLIF(RTRIM(s.sto_altgrup_kod),''),'(BOŞ)') AS altgrup_kod,
       ISNULL(alg.sta_isim, '(tanımsız)') AS altgrup_adi,
       COUNT(*) AS stok_karti, ISNULL(SUM(sa.adet),0) AS satis_adedi_2020_2026
FROM STOKLAR s
LEFT JOIN STOK_ALT_GRUPLARI alg ON alg.sta_kod = s.sto_altgrup_kod
LEFT JOIN satis sa ON sa.sth_stok_kod = s.sto_kod
GROUP BY ISNULL(NULLIF(RTRIM(s.sto_altgrup_kod),''),'(BOŞ)'), ISNULL(alg.sta_isim, '(tanımsız)')
ORDER BY satis_adedi_2020_2026 DESC;

-- 5c) Ana grup × alt grup çapraz
;WITH satis AS (
  SELECT h.sth_stok_kod,
         SUM(CASE WHEN h.sth_normal_iade = 1 THEN -h.sth_miktar ELSE h.sth_miktar END) AS adet
  FROM STOK_HAREKETLERI h
  WHERE h.sth_tarih >= @bas AND h.sth_tarih < @bit AND h.sth_tip = 1 AND h.sth_evraktip IN (1,4)
  GROUP BY h.sth_stok_kod
)
SELECT ISNULL(NULLIF(RTRIM(s.sto_anagrup_kod),''),'(BOŞ)') AS anagrup_kod,
       ISNULL(ag.san_isim,'(tanımsız)') AS anagrup_adi,
       ISNULL(NULLIF(RTRIM(s.sto_altgrup_kod),''),'(BOŞ)') AS altgrup_kod,
       ISNULL(alg.sta_isim,'(tanımsız)') AS altgrup_adi,
       COUNT(*) AS stok_karti, ISNULL(SUM(sa.adet),0) AS satis_adedi_2020_2026
FROM STOKLAR s
LEFT JOIN STOK_ANA_GRUPLARI ag ON ag.san_kod = s.sto_anagrup_kod
LEFT JOIN STOK_ALT_GRUPLARI alg ON alg.sta_kod = s.sto_altgrup_kod
LEFT JOIN satis sa ON sa.sth_stok_kod = s.sto_kod
GROUP BY ISNULL(NULLIF(RTRIM(s.sto_anagrup_kod),''),'(BOŞ)'), ISNULL(ag.san_isim,'(tanımsız)'),
         ISNULL(NULLIF(RTRIM(s.sto_altgrup_kod),''),'(BOŞ)'), ISNULL(alg.sta_isim,'(tanımsız)')
ORDER BY anagrup_kod, satis_adedi_2020_2026 DESC;

-- 5d) Boş grup özetleri
;WITH satis AS (
  SELECT h.sth_stok_kod,
         SUM(CASE WHEN h.sth_normal_iade = 1 THEN -h.sth_miktar ELSE h.sth_miktar END) AS adet
  FROM STOK_HAREKETLERI h
  WHERE h.sth_tarih >= @bas AND h.sth_tarih < @bit AND h.sth_tip = 1 AND h.sth_evraktip IN (1,4)
  GROUP BY h.sth_stok_kod
)
SELECT 'Ana grubu boş' AS durum, COUNT(*) AS stok_karti, ISNULL(SUM(sa.adet),0) AS satis_adedi
FROM STOKLAR s LEFT JOIN satis sa ON sa.sth_stok_kod = s.sto_kod
WHERE NULLIF(RTRIM(s.sto_anagrup_kod),'') IS NULL
UNION ALL
SELECT 'Alt grubu boş', COUNT(*), ISNULL(SUM(sa.adet),0)
FROM STOKLAR s LEFT JOIN satis sa ON sa.sth_stok_kod = s.sto_kod
WHERE NULLIF(RTRIM(s.sto_altgrup_kod),'') IS NULL
UNION ALL
SELECT 'İkisi de boş', COUNT(*), ISNULL(SUM(sa.adet),0)
FROM STOKLAR s LEFT JOIN satis sa ON sa.sth_stok_kod = s.sto_kod
WHERE NULLIF(RTRIM(s.sto_anagrup_kod),'') IS NULL AND NULLIF(RTRIM(s.sto_altgrup_kod),'') IS NULL
UNION ALL
SELECT 'Kategorisi boş', COUNT(*), ISNULL(SUM(sa.adet),0)
FROM STOKLAR s LEFT JOIN satis sa ON sa.sth_stok_kod = s.sto_kod
WHERE NULLIF(RTRIM(s.sto_kategori_kod),'') IS NULL;
