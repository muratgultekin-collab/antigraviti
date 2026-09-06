# PNOMEK Satış ve Maliyet Analizi (Mikro ERP / MS SQL Server)

Mikro veritabanından **sadece SELECT** ile satış (2020–2026) ve 09'lu mamul maliyet analizi üreten araç seti.
Bu klasördeki her şey PNOMEK'in Mikro sunucusuna erişebilen bir Windows makinede (Node.js 18+) çalıştırılır.

## Kurulum

```bat
cd pnomek-analiz
npm install
copy config.example.json config.json
```

`config.json` içinde doldurulacaklar:

| Alan | Açıklama |
| --- | --- |
| `sql.server`, `sql.port`, `sql.user`, `sql.password` | Mikro SQL Server bağlantısı (sunucu adını bulmak için `sqlcmd -L`; Mikro'nun `Mikro.ini` / kayıt defteri girdisine bakılabilir). Windows kimlik doğrulaması için `mssql` paketinin `msnodesqlv8` sürücüsü gerekir; en pratik yol SQL kullanıcısıdır. |
| `sql.database` | Boş bırakılırsa ADIM 1 `sys.databases` içinden `MikroDB_V16_*` desenli ilk veritabanını seçer ve raporda belirtir. |
| `grupAlani` | **ADIM 2 öncesi karar**: `anagrup` / `altgrup` / `hiyerarsik`. Karar tabloları ADIM 1'de üretilir. |
| `satisFiltresi`, `alisFiltresi` | Boş bırakılırsa ADIM 1 veriden önerir (`cikti/kesif/filtre_onerisi.json`). Öneriyi kontrol edip config'e yazın. |
| `recete.*` | Reçete tablosu ve kolon adları; ADIM 1 `%RECETE%` tablolarını bulup tahmin eder. |
| `dovizliTutarHareketDovizinde` | `sth_tutar` dövizli hareketlerde hareket dövizinde mi (true) yoksa TL mi (false); ADIM 1 örnekleriyle doğrulanır. |
| `kur.*` | Kur kolon adı (`dk_kur_1` = TCMB döviz alış varsayımı), TCMB kur tipi, isteğe bağlı EVDS anahtarı. |
| `maliyetCalismasiKlasoru` | 2025 Maliyet Çalışması Excel klasörü (ADIM 4). |

Şifre içeren `config.json` `.gitignore`'dadır; depoya girmez.

## Adımlar

```bat
node src/run.js kesif        REM ADIM 1 — keşif + ürün grubu karar tabloları (DUR, karar bekle)
node src/run.js satis        REM ADIM 2 — grup × yıl satış matrisi (config.grupAlani gerekir)
node src/run.js maliyet      REM ADIM 3 — 09'lu mamullerin reçete maliyeti (TL + EUR)
node src/run.js karsilastir  REM ADIM 4 — 2025 Maliyet Çalışması ile karşılaştırma
node src/run.js rapor        REM ADIM 5 — Excel + HTML dashboard
node src/run.js hepsi        REM tümü sırayla (karar alanları dolu olmalı)
```

### ADIM 1 çıktıları (`cikti/kesif/`)

- `kesif_raporu.md` — sunucu/DB, tablo ve kolon doğrulaması, kolon sözlüğü, her tablodan TOP 5 örnek, `sth_tip / sth_cins / sth_evraktip / sth_normal_iade` dağılımı ve **satış/alış filtresi önerisi**, dövizli tutar örnekleri, kur tablosu kapsama.
- `grup_tablolari.md` — ana grup / alt grup / çapraz / boş grup tabloları (stok kartı sayısı + 2020–2026 satış adedi). **Bu tabloya göre `grupAlani` kararı verilmeden ADIM 2 çalışmaz.**
- `filtre_onerisi.json`, `recete_adaylari.json`, `hareket_tip_dagilimi.json`, `ornekler.json` (ham TOP 5'ler; git'e girmez).

Satış filtresi öneri kuralı: `sth_tip = 1` (çıkış) **ve** kayıtların çoğunluğu faturaya bağlı (`sth_fat_uid` dolu) **ve** çoğunluğu 120'li (alıcı) cari. Alış için `sth_tip = 0` + fatura + 320'li (satıcı) cari. İadeler `sth_normal_iade = 1` satırlarıdır ve tüm hesaplarda negatif düşülür; üretim/sayım/irsaliye çıkışları dışarıda kalır.

### ADIM 2 (`cikti/veri/satis_*.json`, `satis_ozet.md`)

Grup × yıl adet matrisi, grup toplamları, yıl toplamları, en çok satılan yıl ve adedi, yıllık değişim %. 2026 "2026 (Eylül'e kadar)" olarak etiketlenir.

### ADIM 3 (`cikti/veri/maliyet_09.json`, `maliyet_ozet.md`)

1. `sql/20_recete_09_acilim.sql` — recursive CTE ile çok seviyeli açılım; yarı mamuller yaprak bileşenlere kadar açılır, kümüle miktar hesaplanır.
2. `sql/21_alis_hareketleri.sql` — bileşenlerin alış faturası girişleri (iskonto düşülmüş net tutar, döviz cinsi, belge kuru).
3. Kur dönüşümü (`src/kur.js`): sırayla **Mikro `DOVIZ_KURLARI`** (aynı gün) → **TCMB** (`tcmb.gov.tr/kurlar/YYYYMM/GGAAYYYY.xml`, tatilde önceki iş günü; EVDS anahtarı verilirse EVDS). Her alış satırında kullanılan kur ve kaynağı yazılır (`alis_hareketleri_kurlu.json`, Excel `Alis_Hareketleri_Kurlu`).
   - USD alış → o günkü USD kuru ile TL → o günkü EUR kuru ile EUR.
   - TL alış → o günkü EUR kuru ile EUR.
4. Mamul başına: **son alış fiyatıyla maliyet** (her bileşenin en son alış birim fiyatı × kümüle miktar) ve **yıllık ağırlıklı ortalama** (yıl içindeki alışların miktar ağırlıklı ortalaması; o yıl alışı olmayan bileşende en yakın önceki yıl). TL ve EUR.
5. Reçetesi olmayan 09'lu mamuller ve fiyatı bulunamayan bileşenler ayrı listelenir; kapsam % (fiyatı bulunan bileşen oranı) her mamulde gösterilir.

### ADIM 4 (`cikti/veri/karsilastirma.json`, `karsilastirma_ozet.md`)

Klasördeki tüm `.xlsx` dosyaları okunur (`.xls` eski format okunamaz; listelenir). "09…" kodlu satırlardaki sayısal hücreler başlıklarıyla toplanır; başlığı TL/EUR ve MALİYET/TOPLAM içerenler mevcut maliyet olarak seçilir. SQL son alış ve 2025 ağırlıklı maliyetle fark (tutar ve %) ve olası sebepler (eksik bileşen fiyatı, işçilik/genel gider farkı, reçete/kur farkı) raporlanır. Otomatik eşleşme şüpheliyse `mevcut_maliyet_bulgular.json` içindeki tüm adaylar incelenir.

### ADIM 5 (`cikti/`)

- `pnomek_analiz.xlsx` — Parametreler, Grup_x_Yil, Grup_Yil_Tutar, Ham_Satis, Grup_* (karar tabloları), Maliyet_09, Maliyet_Bilesen_Detay, Bilesen_Fiyatlari, Alis_Hareketleri_Kurlu, Eksik_*, Karsilastirma.
- `pnomek_dashboard.html` — tek dosya, Chart.js CDN (internet gerekir), çift tıkla açılır: grup bazında yıllık satış çubuk, yıllara göre toplam satış çizgi, grup payı pasta, 09'lu mamul maliyet karşılaştırma çubuk grafiği + tablolar. Türkçe etiketler.

## SQL dosyaları (`sql/`)

Tekrar çalıştırılabilir, sadece SELECT. `{{PARAMETRE}}` içerenler script tarafından doldurulur; doldurulmuş halleri her çalıştırmada `cikti/sql_calisan/` altına yazılır (SSMS'te doğrudan açılabilir).

| Dosya | İçerik |
| --- | --- |
| `01_kesif_sunucu_ve_veritabanlari.sql` | `@@SERVERNAME`, `sys.databases` |
| `02_kesif_tablo_ve_kolonlar.sql` | INFORMATION_SCHEMA ile tablo/kolon doğrulama |
| `03_kesif_ornek_kayitlar.sql` | TOP 5 örnekler |
| `04_kesif_hareket_tip_dagilimi.sql` | tip/cins/evraktip/iade dağılımı, yıl bazında, dövizli örnekler |
| `05_grup_tablolari.sql` | ana grup / alt grup / çapraz / boş grup karar tabloları |
| `06_kur_tablosu.sql` | DOVIZLER, kur kapsama, günlük kurlar |
| `10_satis_ham.sql`, `11_satis_grup_yil.sql` | satış ham veri ve grup × yıl |
| `20_recete_09_acilim.sql` | recursive reçete açılımı + reçetesiz mamuller |
| `21_alis_hareketleri.sql` | bileşen alış girişleri |
| `22_maliyet_hesabi_aciklama.sql` | maliyet hesabı mantığının açıklaması |

## Güvenlik

`src/db.js` bağlantıyı `readOnlyIntent` ile açar ve INSERT/UPDATE/DELETE/DDL/EXEC içeren her SQL'i çalıştırmadan reddeder.

## Test (veritabanı olmadan)

```bat
node test/mock_test.js
```

Sahte Mikro verisi ve sahte TCMB ile 5 adımı uçtan uca çalıştırır, maliyet hesabını bilinen değerle doğrular, `cikti/` altına örnek çıktı üretir.
