-- ADIM 1 / KEŞİF: sth_tip / sth_cins / sth_evraktip / sth_normal_iade kombinasyonlarının veriden doğrulanması
-- Hangi kombinasyonun "satış faturası çıkışı", hangisinin "alış faturası girişi" olduğunu
-- kayıt sayısı, miktar, tutar, cari kodu ön eki (120=alıcı, 320=satıcı) ve evrak serisi ile yorumlarız.
SELECT
  h.sth_tip, h.sth_cins, h.sth_evraktip, h.sth_normal_iade,
  COUNT(*)                                   AS kayit,
  SUM(h.sth_miktar)                          AS toplam_miktar,
  SUM(h.sth_tutar)                           AS toplam_tutar,
  MIN(h.sth_tarih)                           AS ilk_tarih,
  MAX(h.sth_tarih)                           AS son_tarih,
  SUM(CASE WHEN h.sth_cari_kodu LIKE '120%' THEN 1 ELSE 0 END) AS cari_120_alici,
  SUM(CASE WHEN h.sth_cari_kodu LIKE '320%' THEN 1 ELSE 0 END) AS cari_320_satici,
  SUM(CASE WHEN h.sth_fat_uid <> '00000000-0000-0000-0000-000000000000' THEN 1 ELSE 0 END) AS faturaya_bagli,
  SUM(CASE WHEN h.sth_har_doviz_cinsi <> 0 THEN 1 ELSE 0 END) AS dovizli_kayit,
  STUFF((SELECT DISTINCT ',' + RTRIM(x.sth_evrakno_seri)
         FROM STOK_HAREKETLERI x
         WHERE x.sth_tip = h.sth_tip AND x.sth_cins = h.sth_cins AND x.sth_evraktip = h.sth_evraktip
           AND x.sth_normal_iade = h.sth_normal_iade AND x.sth_tarih >= '2020-01-01'
         FOR XML PATH('')), 1, 1, '') AS evrak_serileri
FROM STOK_HAREKETLERI h
WHERE h.sth_tarih >= '2020-01-01' AND h.sth_tarih < '2027-01-01'
GROUP BY h.sth_tip, h.sth_cins, h.sth_evraktip, h.sth_normal_iade
ORDER BY h.sth_tip, h.sth_evraktip, h.sth_cins, h.sth_normal_iade;

-- Yıl bazında aynı dağılım (satış kombinasyonunun her yıl var olduğunu görmek için)
SELECT YEAR(sth_tarih) AS yil, sth_tip, sth_cins, sth_evraktip, sth_normal_iade,
       COUNT(*) AS kayit, SUM(sth_miktar) AS miktar, SUM(sth_tutar) AS tutar
FROM STOK_HAREKETLERI
WHERE sth_tarih >= '2020-01-01' AND sth_tarih < '2027-01-01'
GROUP BY YEAR(sth_tarih), sth_tip, sth_cins, sth_evraktip, sth_normal_iade
ORDER BY yil, sth_tip, sth_evraktip, sth_cins, sth_normal_iade;

-- Dövizli hareketlerde sth_tutar'ın TL mi döviz mi olduğunu anlamak için örnek
SELECT TOP 20 sth_tarih, sth_stok_kod, sth_miktar, sth_tutar, sth_har_doviz_cinsi, sth_har_doviz_kuru,
       sth_alt_doviz_kuru, sth_tutar * sth_har_doviz_kuru AS tutar_x_kur, sth_cari_kodu, sth_evrakno_seri, sth_evrakno_sira
FROM STOK_HAREKETLERI
WHERE sth_har_doviz_cinsi <> 0 AND sth_tarih >= '2020-01-01'
ORDER BY sth_tarih DESC;
