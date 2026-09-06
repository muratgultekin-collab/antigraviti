-- ADIM 1 / KEŞİF: Sunucu bilgisi ve Mikro veritabanlarını bul
-- Sadece SELECT. master üzerinde çalıştırılır.
SELECT @@SERVERNAME AS sunucu, @@VERSION AS surum;

SELECT name, database_id, create_date, state_desc
FROM sys.databases
WHERE name LIKE 'Mikro%' OR name LIKE 'MikroDB%' OR name LIKE '%MIKRO%'
ORDER BY name;
