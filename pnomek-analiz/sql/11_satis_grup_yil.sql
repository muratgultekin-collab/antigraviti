-- ADIM 2: Ürün grubu × yıl matrisi (adet). {{GRUP_KOLON}} = anagrup / altgrup / anagrup+altgrup (config.grupAlani)
DECLARE @bas DATE = '2020-01-01', @bit DATE = '2027-01-01';

SELECT
  {{GRUP_KOLON}}                                AS grup,
  YEAR(h.sth_tarih)                             AS yil,
  SUM(CASE WHEN h.sth_normal_iade = 1 THEN -h.sth_miktar ELSE h.sth_miktar END) AS adet,
  SUM(CASE WHEN h.sth_normal_iade = 1 THEN -h.sth_tutar  ELSE h.sth_tutar  END) AS tutar,
  COUNT(DISTINCT h.sth_stok_kod)                AS farkli_urun
FROM STOK_HAREKETLERI h
JOIN STOKLAR s ON s.sto_kod = h.sth_stok_kod
LEFT JOIN STOK_ANA_GRUPLARI ag ON ag.san_kod = s.sto_anagrup_kod
LEFT JOIN STOK_ALT_GRUPLARI alg ON alg.sta_kod = s.sto_altgrup_kod
WHERE h.sth_tarih >= @bas AND h.sth_tarih < @bit
  AND ({{SATIS_FILTRESI}})
GROUP BY {{GRUP_KOLON}}, YEAR(h.sth_tarih)
ORDER BY grup, yil;
