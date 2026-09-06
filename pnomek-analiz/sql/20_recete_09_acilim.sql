-- ADIM 3: '09' ile başlayan mamullerin çok seviyeli reçete açılımı (recursive CTE)
-- Reçete tablo/kolon adları ADIM 1 keşfinden gelir (config.recete): 
--   {{RECETE_TABLO}}    : örn. URUN_RECETELERI
--   {{RECETE_MAMUL}}    : mamul (ana ürün) stok kodu kolonu
--   {{RECETE_BILESEN}}  : bileşen stok kodu kolonu
--   {{RECETE_MIKTAR}}   : bileşen miktarı kolonu
--   {{RECETE_MAMUL_MIKTAR}} : reçetenin kaç birim mamul için olduğu (yoksa 1)
;WITH acilim AS (
  SELECT
    CAST(r.{{RECETE_MAMUL}} AS VARCHAR(50))   AS mamul_kod,
    CAST(r.{{RECETE_MAMUL}} AS VARCHAR(50))   AS ust_kod,
    CAST(r.{{RECETE_BILESEN}} AS VARCHAR(50)) AS bilesen_kod,
    CAST(r.{{RECETE_MIKTAR}} / NULLIF({{RECETE_MAMUL_MIKTAR}},0) AS FLOAT) AS birim_miktar,
    CAST(r.{{RECETE_MIKTAR}} / NULLIF({{RECETE_MAMUL_MIKTAR}},0) AS FLOAT) AS kumule_miktar,
    1 AS seviye,
    CAST(r.{{RECETE_MAMUL}} + ' > ' + r.{{RECETE_BILESEN}} AS VARCHAR(1000)) AS yol
  FROM {{RECETE_TABLO}} r
  WHERE r.{{RECETE_MAMUL}} LIKE '09%'
  UNION ALL
  SELECT
    a.mamul_kod,
    CAST(r.{{RECETE_MAMUL}} AS VARCHAR(50)),
    CAST(r.{{RECETE_BILESEN}} AS VARCHAR(50)),
    CAST(r.{{RECETE_MIKTAR}} / NULLIF({{RECETE_MAMUL_MIKTAR}},0) AS FLOAT),
    CAST(a.kumule_miktar * r.{{RECETE_MIKTAR}} / NULLIF({{RECETE_MAMUL_MIKTAR}},0) AS FLOAT),
    a.seviye + 1,
    CAST(a.yol + ' > ' + r.{{RECETE_BILESEN}} AS VARCHAR(1000))
  FROM acilim a
  JOIN {{RECETE_TABLO}} r ON r.{{RECETE_MAMUL}} = a.bilesen_kod
  WHERE a.seviye < 10
)
SELECT a.mamul_kod, m.sto_isim AS mamul_adi, a.ust_kod, a.bilesen_kod, b.sto_isim AS bilesen_adi,
       b.sto_birim1_ad AS bilesen_birim, a.seviye, a.birim_miktar, a.kumule_miktar,
       CASE WHEN EXISTS (SELECT 1 FROM {{RECETE_TABLO}} x WHERE x.{{RECETE_MAMUL}} = a.bilesen_kod) THEN 1 ELSE 0 END AS yari_mamul_mi,
       a.yol
FROM acilim a
LEFT JOIN STOKLAR m ON m.sto_kod = a.mamul_kod
LEFT JOIN STOKLAR b ON b.sto_kod = a.bilesen_kod
ORDER BY a.mamul_kod, a.seviye, a.bilesen_kod
OPTION (MAXRECURSION 20);

-- Reçetesi olmayan 09'lu mamuller
SELECT s.sto_kod, s.sto_isim
FROM STOKLAR s
WHERE s.sto_kod LIKE '09%'
  AND NOT EXISTS (SELECT 1 FROM {{RECETE_TABLO}} r WHERE r.{{RECETE_MAMUL}} = s.sto_kod)
ORDER BY s.sto_kod;
