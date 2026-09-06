-- ADIM 2: Satış çıkış hareketleri (ham veri). İadeler negatif miktar olarak düşülür.
-- {{SATIS_FILTRESI}} ve tarih aralığı config.json'dan gelir; elle çalıştırırken aşağıdaki DECLARE'ları düzenleyin.
DECLARE @bas DATE = '2020-01-01', @bit DATE = '2027-01-01';

SELECT
  h.sth_tarih                                   AS tarih,
  YEAR(h.sth_tarih)                             AS yil,
  h.sth_stok_kod                                AS stok_kod,
  s.sto_isim                                    AS stok_adi,
  RTRIM(s.sto_anagrup_kod)                      AS anagrup_kod,
  ag.san_isim                                   AS anagrup_adi,
  RTRIM(s.sto_altgrup_kod)                      AS altgrup_kod,
  alg.sta_isim                                  AS altgrup_adi,
  RTRIM(s.sto_kategori_kod)                     AS kategori_kod,
  s.sto_birim1_ad                               AS birim,
  h.sth_normal_iade                             AS iade,
  CASE WHEN h.sth_normal_iade = 1 THEN -h.sth_miktar ELSE h.sth_miktar END AS adet,
  CASE WHEN h.sth_normal_iade = 1 THEN -h.sth_tutar  ELSE h.sth_tutar  END AS tutar,
  h.sth_har_doviz_cinsi                         AS doviz_cinsi,
  h.sth_har_doviz_kuru                          AS doviz_kuru,
  h.sth_cari_kodu                               AS cari_kodu,
  h.sth_evrakno_seri                            AS evrak_seri,
  h.sth_evrakno_sira                            AS evrak_sira,
  h.sth_tip, h.sth_cins, h.sth_evraktip
FROM STOK_HAREKETLERI h
JOIN STOKLAR s ON s.sto_kod = h.sth_stok_kod
LEFT JOIN STOK_ANA_GRUPLARI ag ON ag.san_kod = s.sto_anagrup_kod
LEFT JOIN STOK_ALT_GRUPLARI alg ON alg.sta_kod = s.sto_altgrup_kod
WHERE h.sth_tarih >= @bas AND h.sth_tarih < @bit
  AND ({{SATIS_FILTRESI}})
ORDER BY h.sth_tarih, h.sth_stok_kod;
