-- Mikro kur tablosu: hangi döviz numarası USD / EUR, hangi kolon TCMB alış
SELECT * FROM DOVIZLER ORDER BY 1;

-- Günlük kur kapsama: 2020–2026 arasında USD ve EUR için kaç gün kayıt var
SELECT dk_cins, YEAR(dk_tarih) AS yil, COUNT(*) AS gun_sayisi, MIN(dk_tarih) AS ilk, MAX(dk_tarih) AS son
FROM DOVIZ_KURLARI
WHERE dk_tarih >= '2020-01-01' AND dk_tarih < '2027-01-01'
GROUP BY dk_cins, YEAR(dk_tarih)
ORDER BY dk_cins, yil;

-- Tüm günlük kurlar (script bunu çekip eksik günleri TCMB'den tamamlar)
SELECT dk_tarih, dk_cins, dk_kur_1, dk_kur_2, dk_kur_3, dk_kur_4
FROM DOVIZ_KURLARI
WHERE dk_tarih >= '2019-12-01' AND dk_tarih < '2027-01-01'
ORDER BY dk_tarih, dk_cins;
