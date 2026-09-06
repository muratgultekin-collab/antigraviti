'use strict';
// ADIM 1 — KEŞİF: Mikro veritabanını bul, tabloları/kolonları doğrula, örnek kayıtları ve hareket tip dağılımını çıkar,
// ürün grubu karar tablolarını üret. Sadece SELECT.
const { Db } = require('./db');
const { KESIF, VERI, configYukle, jsonYaz, metinYaz, sqlOku, mdTablo, tarihStr, log } = require('./util');

// Bilinen Mikro kolonlarının anlamları (rapora eklenir; veriyle doğrulanır)
const KOLON_SOZLUGU = {
  sto_kod: 'Stok kodu (birincil anahtar)', sto_isim: 'Stok adı', sto_anagrup_kod: 'Ana grup kodu → STOK_ANA_GRUPLARI.san_kod',
  sto_altgrup_kod: 'Alt grup kodu → STOK_ALT_GRUPLARI.sta_kod', sto_kategori_kod: 'Kategori kodu → STOK_KATEGORILERI.ktg_kod',
  sto_birim1_ad: 'Ana birim adı (AD, KG, MT...)', sto_cins: 'Stok cinsi (0 ticari mal, 1 karma koli, 2 sabit kıymet, 3 hammadde, 4 yarı mamul, 5 mamul, 6 hizmet...)',
  sth_tarih: 'Hareket tarihi', sth_stok_kod: 'Stok kodu', sth_miktar: 'Miktar (ana birim)', sth_tutar: 'Tutar (brüt, iskonto hariç; dövizli hareketlerde hareket dövizinde — ADIM 1 örnekleriyle doğrulanır)',
  sth_tip: '0 = Giriş, 1 = Çıkış', sth_cins: 'Hareket cinsi (0 toptan, 1 perakende, 2 ... 6 ithalat, 7 ihracat vb. — veriyle doğrulanır)',
  sth_evraktip: 'Evrak tipi (fatura / irsaliye / üretim / sayım vb. — veriyle doğrulanır)', sth_normal_iade: '0 = Normal, 1 = İade',
  sth_har_doviz_cinsi: 'Hareket döviz no (0 = TL, diğerleri DOVIZLER.dvz_no)', sth_har_doviz_kuru: 'Belge üzerindeki kur (hareket dövizi → TL)',
  sth_iskonto1: 'İskonto tutarı 1 (…6)', sth_fat_uid: 'Bağlı fatura GUID (boş GUID = faturasız)', sth_cari_kodu: 'Cari kodu (120… alıcı, 320… satıcı)',
  sth_evrakno_seri: 'Evrak seri', sth_evrakno_sira: 'Evrak sıra no',
  dk_tarih: 'Kur tarihi', dk_cins: 'Döviz no', dk_kur_1: 'Kur 1 (genelde TCMB döviz alış)', dk_kur_2: 'Kur 2 (döviz satış)', dk_kur_3: 'Kur 3 (efektif alış)', dk_kur_4: 'Kur 4 (efektif satış)',
};

function receteEslestir(tablolar, kolonlar) {
  // %RECETE% tablolarından mamul / bileşen / miktar kolonlarını tahmin et
  const adaylar = [];
  for (const t of tablolar.filter((x) => /RECETE/i.test(x.TABLE_NAME) && x.TABLE_TYPE === 'BASE TABLE')) {
    const ks = kolonlar.filter((k) => k.TABLE_NAME === t.TABLE_NAME).map((k) => k.COLUMN_NAME);
    const bul = (rx) => ks.find((k) => rx.test(k)) || null;
    const mamul = bul(/mamul|ana_?stok|urun_?kod|ustkod|parent|_uretilen/i) || bul(/(^|_)stok_?kod/i);
    const bilesen = ks.find((k) => k !== mamul && /bilesen|hammadde|malzeme|child|alt_?stok|_stok_?kod|stok_kod/i.test(k)) || null;
    const miktar = bul(/miktar|adet|qty/i);
    const mamulMiktar = ks.find((k) => k !== miktar && /(mamul|urun|uretim|ana).*miktar|miktar.*(mamul|urun)/i.test(k)) || null;
    adaylar.push({ tablo: t.TABLE_NAME, kolonlar: ks, tahmin: { mamulKolon: mamul, bilesenKolon: bilesen, miktarKolon: miktar, mamulMiktarKolon: mamulMiktar } });
  }
  return adaylar;
}

function filtreOner(dagilim) {
  // Satış faturası çıkışı: sth_tip=1, çoğunluk 120 cari, faturaya bağlı. Alış faturası girişi: sth_tip=0, 320 cari, faturaya bağlı.
  const satis = [], alis = [];
  for (const r of dagilim) {
    const n = r.kayit || 0;
    const fatOran = n ? (r.faturaya_bagli || 0) / n : 0;
    const aliciOran = n ? (r.cari_120_alici || 0) / n : 0;
    const saticiOran = n ? (r.cari_320_satici || 0) / n : 0;
    if (r.sth_tip === 1 && fatOran > 0.5 && aliciOran > 0.5) satis.push(r);
    if (r.sth_tip === 0 && fatOran > 0.5 && saticiOran > 0.5) alis.push(r);
  }
  const ifade = (rows) => {
    if (!rows.length) return null;
    const ev = [...new Set(rows.map((r) => r.sth_evraktip))].join(',');
    const ci = [...new Set(rows.map((r) => r.sth_cins))].join(',');
    return `h.sth_tip = ${rows[0].sth_tip} AND h.sth_evraktip IN (${ev}) AND h.sth_cins IN (${ci})`;
  };
  return { satisKombinasyonlari: satis, alisKombinasyonlari: alis, satisFiltresi: ifade(satis), alisFiltresi: ifade(alis) };
}

async function kesif() {
  const cfg = configYukle();
  const rapor = [];
  const H = (s) => rapor.push('\n## ' + s + '\n');
  rapor.push('# ADIM 1 — KEŞİF RAPORU\n\nOluşturma: ' + new Date().toLocaleString('tr-TR') + '\n');

  // 1) Sunucu ve veritabanları
  let db = await new Db(cfg).ac(cfg.sql.database || undefined);
  const [sunucu, dbler] = await db.sorCoklu(sqlOku('01_kesif_sunucu_ve_veritabanlari.sql'));
  H('Sunucu ve Mikro veritabanları');
  rapor.push(mdTablo(sunucu.map((r) => ({ sunucu: r.sunucu, surum: String(r.surum).split('\n')[0] }))));
  rapor.push(mdTablo(dbler.map((r) => ({ name: r.name, create_date: tarihStr(r.create_date), state: r.state_desc }))));
  let database = cfg.sql.database;
  if (!database) {
    const aday = dbler.find((r) => /^MikroDB_V\d+/i.test(r.name)) || dbler[0];
    if (!aday) throw new Error('Mikro veritabanı bulunamadı; config.json → sql.database alanını elle girin.');
    database = aday.name;
    rapor.push(`\n> config.json'da database boş; otomatik seçildi: **${database}** (birden fazla Mikro DB varsa config'e yazın).\n`);
    await db.kapat();
    db = await new Db(cfg).ac(database);
  }
  log('Veritabanı:', database);

  // 2) Tablolar ve kolonlar
  const [tablolar, kolonlar, kritik] = await db.sorCoklu(sqlOku('02_kesif_tablo_ve_kolonlar.sql'));
  jsonYaz(KESIF, 'tablolar.json', tablolar); jsonYaz(KESIF, 'kolonlar.json', kolonlar); jsonYaz(KESIF, 'kritik_kolonlar.json', kritik);
  H('Aday tablolar');
  rapor.push(mdTablo(tablolar, ['TABLE_NAME', 'TABLE_TYPE']));
  H('Kritik kolon kontrolü');
  rapor.push(mdTablo(kritik, ['tablo', 'kolon', 'durum', 'DATA_TYPE']));
  const eksik = kritik.filter((k) => k.durum === 'YOK');
  if (eksik.length) rapor.push(`\n> **DİKKAT:** ${eksik.length} beklenen kolon yok: ${eksik.map((e) => e.tablo + '.' + e.kolon).join(', ')}. SQL dosyalarında ad düzeltmesi gerekebilir.\n`);
  H('Kolon anlamları (Mikro standart sözlüğü; veriyle doğrulayın)');
  rapor.push(mdTablo(Object.entries(KOLON_SOZLUGU).map(([kolon, anlam]) => ({ kolon, anlam }))));

  // Reçete tabloları
  const recete = receteEslestir(tablolar, kolonlar);
  jsonYaz(KESIF, 'recete_adaylari.json', recete);
  H('Reçete tablosu adayları (kolon eşleştirme tahmini → config.json → recete)');
  for (const r of recete) {
    rapor.push(`- **${r.tablo}**: tahmin = \`${JSON.stringify(r.tahmin)}\`\n  - kolonlar: ${r.kolonlar.join(', ')}\n`);
  }
  if (!recete.length) rapor.push('_%RECETE% adlı tablo bulunamadı; reçete başka bir adla tutuluyor olabilir (ör. URETIM_*). config.recete elle doldurulmalı._\n');

  // 3) Örnek kayıtlar (TOP 5) — var olan tablolardan
  H('Örnek kayıtlar (TOP 5)');
  const ornekler = {};
  const ornekTablolar = ['STOKLAR', 'STOK_HAREKETLERI', 'STOK_ANA_GRUPLARI', 'STOK_ALT_GRUPLARI', 'STOK_KATEGORILERI', 'DOVIZ_KURLARI', 'DOVIZLER', ...recete.map((r) => r.tablo)];
  for (const t of ornekTablolar) {
    if (!(await db.tabloVar(t))) { rapor.push(`- ${t}: **YOK**\n`); continue; }
    const sira = t === 'STOK_HAREKETLERI' ? " WHERE sth_tarih >= '2020-01-01' ORDER BY sth_tarih DESC" : t === 'DOVIZ_KURLARI' ? ' ORDER BY dk_tarih DESC' : '';
    const rows = await db.sor(`SELECT TOP 5 * FROM ${t}${sira}`);
    ornekler[t] = rows;
    // Rapora sadece dolu kolonları yaz (Mikro tablolarında 100+ kolon var)
    const dolu = rows.length ? Object.keys(rows[0]).filter((k) => rows.some((r) => r[k] !== null && r[k] !== '' && r[k] !== 0 && !(r[k] instanceof Date && r[k].getFullYear() < 1901))) : [];
    rapor.push(`\n### ${t} (${rows.length} kayıt, dolu ${dolu.length} kolon gösteriliyor)\n`);
    rapor.push(mdTablo(rows, dolu.slice(0, 40)));
  }
  jsonYaz(KESIF, 'ornekler.json', ornekler);

  // 4) Hareket tip dağılımı → satış/alış filtresi önerisi
  const [dagilim, yillik, dovizli] = await db.sorCoklu(sqlOku('04_kesif_hareket_tip_dagilimi.sql'));
  jsonYaz(KESIF, 'hareket_tip_dagilimi.json', { dagilim, yillik, dovizli });
  const oneri = filtreOner(dagilim);
  jsonYaz(KESIF, 'filtre_onerisi.json', oneri);
  H('sth_tip / sth_cins / sth_evraktip / sth_normal_iade dağılımı (2020–2026)');
  rapor.push(mdTablo(dagilim, ['sth_tip', 'sth_cins', 'sth_evraktip', 'sth_normal_iade', 'kayit', 'toplam_miktar', 'toplam_tutar', 'cari_120_alici', 'cari_320_satici', 'faturaya_bagli', 'dovizli_kayit', 'evrak_serileri', 'ilk_tarih', 'son_tarih']));
  rapor.push(`\n**Satış faturası çıkışı (öneri):** \`${oneri.satisFiltresi || 'OTOMATİK BULUNAMADI — tabloyu inceleyip config.satisFiltresi girin'}\`\n`);
  rapor.push(`**Alış faturası girişi (öneri):** \`${oneri.alisFiltresi || 'OTOMATİK BULUNAMADI — config.alisFiltresi girin'}\`\n`);
  rapor.push('\n> Öneri kuralı: sth_tip=1 (çıkış) + kayıtların >%50\'si faturaya bağlı + >%50\'si 120 (alıcı) carisi ⇒ satış. sth_tip=0 + fatura + 320 (satıcı) ⇒ alış. İadeler sth_normal_iade=1 ile ayrı satırdadır ve analizde negatif düşülür.\n');
  H('Yıl bazında dağılım');
  rapor.push(mdTablo(yillik));
  H('Dövizli hareket örnekleri (sth_tutar TL mi, döviz mi?)');
  rapor.push(mdTablo(dovizli));
  rapor.push('\n> Eğer `tutar_x_kur` makul TL tutarı veriyorsa sth_tutar hareket dövizindedir → config.dovizliTutarHareketDovizinde = true. Eğer sth_tutar zaten TL büyüklüğündeyse false yapın.\n');

  // 5) Grup tabloları (önerilen satış filtresiyle)
  const satisFiltresi = cfg.satisFiltresi || oneri.satisFiltresi || 'h.sth_tip = 1 AND h.sth_evraktip IN (1,4)';
  let sql05 = sqlOku('05_grup_tablolari.sql');
  sql05 = sql05.split('h.sth_tip = 1 AND h.sth_evraktip IN (1,4)').join(satisFiltresi);
  metinYaz(require('path').join(KESIF, '..', 'sql_calisan'), '05_grup_tablolari.sql', sql05);
  const [anagrup, altgrup, capraz, bos] = await db.sorCoklu(sql05);
  jsonYaz(KESIF, 'grup_tablolari.json', { satisFiltresi, anagrup, altgrup, capraz, bos });
  const g = [];
  g.push('# ÜRÜN GRUBU KARAR TABLOLARI\n\nSatış filtresi: `' + satisFiltresi + '`  (iadeler negatif düşüldü, dönem 2020-01-01 … 2026-12-31)\n');
  g.push('\n## 1) Ana grup bazında\n'); g.push(mdTablo(anagrup));
  g.push('\n## 2) Alt grup bazında\n'); g.push(mdTablo(altgrup));
  g.push('\n## 3) Ana grup × alt grup çapraz\n'); g.push(mdTablo(capraz));
  g.push('\n## 4) Boş grup özetleri\n'); g.push(mdTablo(bos));
  g.push('\n---\n**KARAR BEKLİYOR:** config.json → `grupAlani` = `"anagrup"` | `"altgrup"` | `"hiyerarsik"` (ana grup > alt grup). Bu karar verilmeden ADIM 2 çalışmaz.\n');
  metinYaz(KESIF, 'grup_tablolari.md', g.join('\n'));

  // 6) Kur tablosu
  if (await db.tabloVar('DOVIZ_KURLARI')) {
    const [dovizler, kapsama] = await db.sorCoklu(sqlOku('06_kur_tablosu.sql').replace(/-- Tüm günlük kurlar[\s\S]*$/, ''));
    jsonYaz(KESIF, 'kur_kapsama.json', { dovizler, kapsama });
    H('Döviz tanımları (DOVIZLER)'); rapor.push(mdTablo(dovizler));
    H('Kur tablosu kapsama (DOVIZ_KURLARI, gün sayısı / yıl)'); rapor.push(mdTablo(kapsama));
    rapor.push('\n> Eksik günler TCMB\'den (tcmb.gov.tr günlük XML; EVDS anahtarı varsa EVDS) tamamlanır; her kur satırında kaynak raporlanır.\n');
  } else {
    H('Kur tablosu'); rapor.push('DOVIZ_KURLARI tablosu yok; tüm kurlar TCMB\'den alınacak.\n');
  }

  await db.kapat();
  jsonYaz(VERI, 'kesif_ozet.json', { database, satisFiltresi, alisFiltresi: cfg.alisFiltresi || oneri.alisFiltresi, recete: recete[0] ? { tablo: recete[0].tablo, ...recete[0].tahmin } : null, tarih: new Date().toISOString() });
  const p = metinYaz(KESIF, 'kesif_raporu.md', rapor.join('\n'));
  log('Keşif raporu:', p);
  log('Grup karar tabloları:', require('path').join(KESIF, 'grup_tablolari.md'));
  console.log('\nÖZET: DB=' + database + ' | satış filtresi önerisi: ' + (oneri.satisFiltresi || '-') + ' | alış: ' + (oneri.alisFiltresi || '-') + ' | reçete tablosu: ' + (recete[0] ? recete[0].tablo : '-'));
}

module.exports = { kesif };
if (require.main === module) kesif().catch((e) => { console.error(e); process.exit(1); });
