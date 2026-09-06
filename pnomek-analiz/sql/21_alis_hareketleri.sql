-- ADIM 3: Bileşenlerin alış faturası girişleri (tarih bazlı birim fiyat)
-- {{ALIS_FILTRESI}} ADIM 1'de doğrulanır (varsayılan: sth_tip=0 AND sth_evraktip IN (1,4) AND sth_cins IN (0,6))
-- İskonto düşülmüş net tutar kullanılır. Dövizli alışlarda sth_tutar hareket dövizindedir (ADIM 1'de doğrulanır).
DECLARE @bas DATE = '2019-01-01', @bit DATE = '2027-01-01';

SELECT
  h.sth_tarih                        AS tarih,
  h.sth_stok_kod                     AS stok_kod,
  s.sto_isim                         AS stok_adi,
  s.sto_birim1_ad                    AS birim,
  h.sth_miktar                       AS miktar,
  h.sth_tutar                        AS brut_tutar,
  (h.sth_iskonto1 + h.sth_iskonto2 + h.sth_iskonto3 + h.sth_iskonto4 + h.sth_iskonto5 + h.sth_iskonto6) AS iskonto,
  h.sth_tutar - (h.sth_iskonto1 + h.sth_iskonto2 + h.sth_iskonto3 + h.sth_iskonto4 + h.sth_iskonto5 + h.sth_iskonto6) AS net_tutar,
  h.sth_har_doviz_cinsi              AS doviz_cinsi,
  h.sth_har_doviz_kuru               AS belge_kuru,
  h.sth_normal_iade                  AS iade,
  h.sth_cari_kodu                    AS cari_kodu,
  h.sth_evrakno_seri                 AS evrak_seri,
  h.sth_evrakno_sira                 AS evrak_sira,
  h.sth_tip, h.sth_cins, h.sth_evraktip
FROM STOK_HAREKETLERI h
JOIN STOKLAR s ON s.sto_kod = h.sth_stok_kod
WHERE h.sth_tarih >= @bas AND h.sth_tarih < @bit
  AND ({{ALIS_FILTRESI}})
  AND h.sth_stok_kod IN ({{BILESEN_LISTESI}})
ORDER BY h.sth_stok_kod, h.sth_tarih;
