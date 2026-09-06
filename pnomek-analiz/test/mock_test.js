'use strict';
// Veritabanı OLMADAN uçtan uca deneme: Db sınıfı ve TCMB fetch'i sahte veriyle değiştirilir, 5 adım sırayla çalışır.
// Kullanım: node test/mock_test.js   (config.json gerekmez; geçici config yazılır)
const fs = require('fs');
const path = require('path');
const KOK = path.resolve(__dirname, '..');
const cfgYol = path.join(KOK, 'config.json');
const cfgVardi = fs.existsSync(cfgYol);
const yedek = cfgVardi ? fs.readFileSync(cfgYol, 'utf8') : null;
const ornekKlasor = path.join(KOK, 'test', 'ornek_maliyet_calismasi');
fs.mkdirSync(ornekKlasor, { recursive: true });

const cfg = JSON.parse(fs.readFileSync(path.join(KOK, 'config.example.json'), 'utf8'));
cfg.sql.database = 'MikroDB_V16_TEST'; cfg.grupAlani = 'anagrup'; cfg.maliyetCalismasiKlasoru = ornekKlasor;
cfg.recete = { tablo: 'URUN_RECETELERI', mamulKolon: 'urc_mamul_kod', bilesenKolon: 'urc_bilesen_kod', miktarKolon: 'urc_miktar', mamulMiktarKolon: null };
fs.writeFileSync(cfgYol, JSON.stringify(cfg, null, 2));

// ---- Sahte veri ----
const d = (s) => new Date(s + 'T00:00:00');
const STOKLAR = [
  { sto_kod: '0901001', sto_isim: 'DS3 FAC PİSTONLU', sto_anagrup_kod: 'DS', sto_altgrup_kod: 'DS3', sto_kategori_kod: 'M', sto_birim1_ad: 'AD' },
  { sto_kod: '0901002', sto_isim: 'DS3 DAC DİYAFRAMLI', sto_anagrup_kod: 'DS', sto_altgrup_kod: 'DS3', sto_kategori_kod: 'M', sto_birim1_ad: 'AD' },
  { sto_kod: '0902001', sto_isim: 'RECETESIZ MAMUL', sto_anagrup_kod: 'VL', sto_altgrup_kod: '', sto_kategori_kod: '', sto_birim1_ad: 'AD' },
  { sto_kod: '0501001', sto_isim: 'YARI MAMUL GÖVDE', sto_anagrup_kod: 'YM', sto_altgrup_kod: 'GV', sto_kategori_kod: '', sto_birim1_ad: 'AD' },
  { sto_kod: '0101001', sto_isim: 'PİRİNÇ ÇUBUK', sto_anagrup_kod: 'HM', sto_altgrup_kod: 'PR', sto_kategori_kod: '', sto_birim1_ad: 'KG' },
  { sto_kod: '0102001', sto_isim: 'ORING', sto_anagrup_kod: 'HM', sto_altgrup_kod: 'OR', sto_kategori_kod: '', sto_birim1_ad: 'AD' },
  { sto_kod: '0103001', sto_isim: 'FİYATSIZ BİLEŞEN', sto_anagrup_kod: '', sto_altgrup_kod: '', sto_kategori_kod: '', sto_birim1_ad: 'AD' },
];
const RECETE = [
  { urc_mamul_kod: '0901001', urc_bilesen_kod: '0501001', urc_miktar: 1 }, { urc_mamul_kod: '0901001', urc_bilesen_kod: '0102001', urc_miktar: 4 },
  { urc_mamul_kod: '0901002', urc_bilesen_kod: '0501001', urc_miktar: 1 }, { urc_mamul_kod: '0901002', urc_bilesen_kod: '0103001', urc_miktar: 2 },
  { urc_mamul_kod: '0501001', urc_bilesen_kod: '0101001', urc_miktar: 0.35 },
];
const dagilim = [
  { sth_tip: 1, sth_cins: 0, sth_evraktip: 1, sth_normal_iade: 0, kayit: 5000, toplam_miktar: 12000, toplam_tutar: 9e6, ilk_tarih: d('2020-01-03'), son_tarih: d('2026-08-29'), cari_120_alici: 4900, cari_320_satici: 0, faturaya_bagli: 5000, dovizli_kayit: 800, evrak_serileri: 'A,E' },
  { sth_tip: 1, sth_cins: 0, sth_evraktip: 1, sth_normal_iade: 1, kayit: 40, toplam_miktar: 90, toplam_tutar: 5e4, ilk_tarih: d('2020-05-03'), son_tarih: d('2026-02-01'), cari_120_alici: 40, cari_320_satici: 0, faturaya_bagli: 40, dovizli_kayit: 2, evrak_serileri: 'A' },
  { sth_tip: 0, sth_cins: 0, sth_evraktip: 1, sth_normal_iade: 0, kayit: 3000, toplam_miktar: 50000, toplam_tutar: 4e6, ilk_tarih: d('2020-01-02'), son_tarih: d('2026-08-30'), cari_120_alici: 0, cari_320_satici: 2950, faturaya_bagli: 3000, dovizli_kayit: 600, evrak_serileri: 'AL' },
  { sth_tip: 0, sth_cins: 6, sth_evraktip: 1, sth_normal_iade: 0, kayit: 200, toplam_miktar: 9000, toplam_tutar: 2e6, ilk_tarih: d('2020-03-02'), son_tarih: d('2026-06-30'), cari_120_alici: 0, cari_320_satici: 200, faturaya_bagli: 200, dovizli_kayit: 200, evrak_serileri: 'IT' },
  { sth_tip: 1, sth_cins: 0, sth_evraktip: 8, sth_normal_iade: 0, kayit: 9000, toplam_miktar: 70000, toplam_tutar: 0, ilk_tarih: d('2020-01-02'), son_tarih: d('2026-08-30'), cari_120_alici: 0, cari_320_satici: 0, faturaya_bagli: 0, dovizli_kayit: 0, evrak_serileri: 'UR' },
];
const yillar = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const grupYil = []; const ham = [];
for (const g of [['DS - DS SERİSİ', 900], ['VL - VALFLER', 400], ['(BOŞ) - ', 20]]) for (const y of yillar) {
  const adet = Math.round(g[1] * (1 + (y - 2020) * 0.12) * (y === 2026 ? 0.6 : 1));
  grupYil.push({ grup: g[0], yil: y, adet, tutar: adet * 250, farkli_urun: 3 });
  ham.push({ tarih: d(`${y}-03-15`), yil: y, stok_kod: '0901001', stok_adi: 'DS3 FAC PİSTONLU', anagrup_kod: g[0].split(' - ')[0], anagrup_adi: g[0].split(' - ')[1], altgrup_kod: 'DS3', altgrup_adi: 'DS3', kategori_kod: 'M', birim: 'AD', iade: 0, adet, tutar: adet * 250, doviz_cinsi: 0, doviz_kuru: 0, cari_kodu: '120.01.001', evrak_seri: 'A', evrak_sira: 1, sth_tip: 1, sth_cins: 0, sth_evraktip: 1 });
}
const alislar = [];
let sira = 1;
for (const y of yillar) for (const ay of [2, 7, 11]) {
  if (y === 2026 && ay > 8) continue;
  const t = d(`${y}-${String(ay).padStart(2, '0')}-10`);
  alislar.push({ tarih: t, stok_kod: '0101001', stok_adi: 'PİRİNÇ ÇUBUK', birim: 'KG', miktar: 100, brut_tutar: 8 * 100 * (1 + (y - 2020) * 0.05), iskonto: 0, net_tutar: 8 * 100 * (1 + (y - 2020) * 0.05), doviz_cinsi: 2, belge_kuru: 0, iade: 0, cari_kodu: '320.01.001', evrak_seri: 'AL', evrak_sira: sira++, sth_tip: 0, sth_cins: 0, sth_evraktip: 1 });
  alislar.push({ tarih: t, stok_kod: '0102001', stok_adi: 'ORING', birim: 'AD', miktar: 1000, brut_tutar: 3000 * (1 + (y - 2020) * 0.5), iskonto: 100, net_tutar: 2900 * (1 + (y - 2020) * 0.5), doviz_cinsi: 0, belge_kuru: 0, iade: 0, cari_kodu: '320.01.002', evrak_seri: 'AL', evrak_sira: sira++, sth_tip: 0, sth_cins: 0, sth_evraktip: 1 });
}
const kurlar = []; // Mikro kur tablosu: 2020-2024 dolu, 2025+ eksik (TCMB'ye düşsün)
for (let t = d('2019-12-01'); t < d('2025-01-01'); t.setDate(t.getDate() + 1)) {
  if (t.getDay() === 0 || t.getDay() === 6) continue;
  const yilk = t.getFullYear() - 2019;
  kurlar.push({ dk_tarih: new Date(t), dk_cins: 1, kur: 6 + yilk * 5 }, { dk_tarih: new Date(t), dk_cins: 2, kur: 6.7 + yilk * 5.5 });
}

// ---- Sahte Db ----
class Db {
  constructor(c) { this.cfg = c; }
  async ac(db) { this.database = db || 'master'; return this; }
  async kapat() {}
  async tabloVar(ad) { return ['STOKLAR', 'STOK_HAREKETLERI', 'STOK_ANA_GRUPLARI', 'STOK_ALT_GRUPLARI', 'STOK_KATEGORILERI', 'DOVIZ_KURLARI', 'DOVIZLER', 'URUN_RECETELERI'].includes(ad); }
  async kolonlar() { return []; }
  async sor(q) {
    if (/FROM DOVIZLER/.test(q)) return [{ dvz_no: 1, dvz_adi: 'USD AMERİKAN DOLARI' }, { dvz_no: 2, dvz_adi: 'EUR AVRO' }];
    if (/FROM DOVIZ_KURLARI/.test(q)) return kurlar;
    if (/SELECT TOP 5 \* FROM (\w+)/.test(q)) { const t = q.match(/FROM (\w+)/)[1]; return t === 'STOKLAR' ? STOKLAR.slice(0, 5) : t === 'URUN_RECETELERI' ? RECETE.slice(0, 5) : t === 'DOVIZ_KURLARI' ? kurlar.slice(-5) : [{ ornek: 1, tablo: t }]; }
    if (/AS brut_tutar/.test(q)) return alislar;
    if (/AS grup,/.test(q)) return grupYil;
    if (/AS iade,/.test(q)) return ham;
    throw new Error('Sahte Db: tanınmayan sorgu: ' + q.slice(0, 120));
  }
  async sorCoklu(q) {
    if (/sys\.databases/.test(q)) return [[{ sunucu: 'TEST\\MIKRO', surum: 'Microsoft SQL Server 2019' }], [{ name: 'MikroDB_V16_TEST', create_date: d('2019-01-01'), state_desc: 'ONLINE' }]];
    if (/INFORMATION_SCHEMA\.TABLES[\s\S]*INFORMATION_SCHEMA\.COLUMNS/.test(q)) {
      const tab = ['STOKLAR', 'STOK_HAREKETLERI', 'STOK_ANA_GRUPLARI', 'STOK_ALT_GRUPLARI', 'STOK_KATEGORILERI', 'DOVIZ_KURLARI', 'DOVIZLER', 'URUN_RECETELERI'].map((n) => ({ TABLE_SCHEMA: 'dbo', TABLE_NAME: n, TABLE_TYPE: 'BASE TABLE' }));
      const kol = [['STOKLAR', STOKLAR[0]], ['URUN_RECETELERI', RECETE[0]], ['STOK_HAREKETLERI', { sth_tarih: 1, sth_stok_kod: 1, sth_miktar: 1, sth_tutar: 1, sth_tip: 1, sth_cins: 1, sth_evraktip: 1, sth_normal_iade: 1, sth_har_doviz_cinsi: 1 }]]
        .flatMap(([t, o]) => Object.keys(o).map((k, i) => ({ TABLE_NAME: t, ORDINAL_POSITION: i + 1, COLUMN_NAME: k, DATA_TYPE: 'varchar' })));
      const kritik = [{ tablo: 'STOKLAR', kolon: 'sto_kod', durum: 'VAR', DATA_TYPE: 'varchar' }, { tablo: 'STOK_HAREKETLERI', kolon: 'sth_fat_uid', durum: 'YOK', DATA_TYPE: null }];
      return [tab, kol, kritik];
    }
    if (/sth_normal_iade[\s\S]*evrak_serileri/.test(q)) return [dagilim, dagilim.map((r) => ({ yil: 2024, ...r })), [{ sth_tarih: d('2025-03-01'), sth_stok_kod: '0101001', sth_miktar: 100, sth_tutar: 800, sth_har_doviz_cinsi: 2, sth_har_doviz_kuru: 37.5, sth_alt_doviz_kuru: 0, tutar_x_kur: 30000, sth_cari_kodu: '320.01.001', sth_evrakno_seri: 'AL', sth_evrakno_sira: 5 }]];
    if (/Ana grubu boş/.test(q)) return [
      [{ anagrup_kod: 'DS', anagrup_adi: 'DS SERİSİ', stok_karti: 2, satis_adedi_2020_2026: 9000 }, { anagrup_kod: 'VL', anagrup_adi: 'VALFLER', stok_karti: 1, satis_adedi_2020_2026: 4000 }, { anagrup_kod: '(BOŞ)', anagrup_adi: '(tanımsız)', stok_karti: 1, satis_adedi_2020_2026: 20 }],
      [{ altgrup_kod: 'DS3', altgrup_adi: 'DS3', stok_karti: 2, satis_adedi_2020_2026: 9000 }, { altgrup_kod: '(BOŞ)', altgrup_adi: '(tanımsız)', stok_karti: 2, satis_adedi_2020_2026: 4020 }],
      [{ anagrup_kod: 'DS', anagrup_adi: 'DS SERİSİ', altgrup_kod: 'DS3', altgrup_adi: 'DS3', stok_karti: 2, satis_adedi_2020_2026: 9000 }],
      [{ durum: 'Ana grubu boş', stok_karti: 1, satis_adedi: 20 }, { durum: 'Alt grubu boş', stok_karti: 2, satis_adedi: 4020 }]];
    if (/FROM DOVIZLER[\s\S]*DOVIZ_KURLARI/.test(q)) return [[{ dvz_no: 1, dvz_adi: 'USD' }, { dvz_no: 2, dvz_adi: 'EUR' }], [{ dk_cins: 2, yil: 2024, gun_sayisi: 250, ilk: d('2024-01-02'), son: d('2024-12-31') }]];
    if (/WITH acilim/.test(q)) {
      // basit 2 seviyeli açılım
      const rows = [];
      for (const r of RECETE.filter((x) => x.urc_mamul_kod.startsWith('09'))) {
        const ym = RECETE.some((x) => x.urc_mamul_kod === r.urc_bilesen_kod);
        const st = (k) => STOKLAR.find((s) => s.sto_kod === k) || {};
        rows.push({ mamul_kod: r.urc_mamul_kod, mamul_adi: st(r.urc_mamul_kod).sto_isim, ust_kod: r.urc_mamul_kod, bilesen_kod: r.urc_bilesen_kod, bilesen_adi: st(r.urc_bilesen_kod).sto_isim, bilesen_birim: st(r.urc_bilesen_kod).sto_birim1_ad, seviye: 1, birim_miktar: r.urc_miktar, kumule_miktar: r.urc_miktar, yari_mamul_mi: ym ? 1 : 0, yol: r.urc_mamul_kod + ' > ' + r.urc_bilesen_kod });
        if (ym) for (const a of RECETE.filter((x) => x.urc_mamul_kod === r.urc_bilesen_kod)) rows.push({ mamul_kod: r.urc_mamul_kod, mamul_adi: st(r.urc_mamul_kod).sto_isim, ust_kod: a.urc_mamul_kod, bilesen_kod: a.urc_bilesen_kod, bilesen_adi: st(a.urc_bilesen_kod).sto_isim, bilesen_birim: st(a.urc_bilesen_kod).sto_birim1_ad, seviye: 2, birim_miktar: a.urc_miktar, kumule_miktar: r.urc_miktar * a.urc_miktar, yari_mamul_mi: 0, yol: r.urc_mamul_kod + ' > ' + r.urc_bilesen_kod + ' > ' + a.urc_bilesen_kod });
      }
      return [rows, [{ sto_kod: '0902001', sto_isim: 'RECETESIZ MAMUL' }]];
    }
    throw new Error('Sahte Db: tanınmayan çoklu sorgu: ' + q.slice(0, 120));
  }
}
require.cache[require.resolve('../src/db.js')] = { id: 'db', filename: 'db', loaded: true, exports: { Db } };

// Sahte TCMB: her tarih için sabit kur (hafta sonu 404)
global.fetch = async (url) => {
  const m = url.match(/(\d{2})(\d{2})(\d{4})\.xml$/);
  const t = m ? new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`) : new Date();
  if (t.getDay() === 0 || t.getDay() === 6) return { status: 404, ok: false };
  const y = t.getFullYear() - 2019;
  return { status: 200, ok: true, text: async () => `<Tarih_Date Tarih="${m ? m[1] + '.' + m[2] + '.' + m[3] : ''}"><Currency CrossOrder="0" Kod="USD" CurrencyCode="USD"><Unit>1</Unit><ForexBuying>${6 + y * 5}</ForexBuying></Currency><Currency CrossOrder="1" Kod="EUR" CurrencyCode="EUR"><Unit>1</Unit><ForexBuying>${6.7 + y * 5.5}</ForexBuying></Currency></Tarih_Date>` };
};

(async () => {
  // Örnek "mevcut maliyet çalışması" Excel'i
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('2025 MALİYET');
  ws.addRow(['STOK KODU', 'ÜRÜN', 'MALZEME TL', 'İŞÇİLİK TL', 'TOPLAM MALİYET TL', 'TOPLAM MALİYET EUR']);
  ws.addRow(['0901001', 'DS3 FAC PİSTONLU', 900, 300, 1200, 32.5]);
  ws.addRow(['0901002', 'DS3 DAC DİYAFRAMLI', 700, 300, 1000, 27]);
  ws.addRow(['0903001', 'SADECE EXCELDE', 500, 100, 600, 16]);
  await wb.xlsx.writeFile(path.join(ornekKlasor, 'ornek_2025_maliyet.xlsx'));

  const { VERI } = require('../src/util');
  fs.rmSync(path.join(VERI, 'tcmb_kur_cache.json'), { force: true });
  await require('../src/01_kesif').kesif();
  await require('../src/02_satis').satis();
  await require('../src/03_maliyet').maliyet();
  await require('../src/04_karsilastirma').karsilastir();
  await require('../src/05_rapor').rapor();
  // Doğrulamalar
  const m = JSON.parse(fs.readFileSync(path.join(VERI, 'maliyet_09.json')));
  const m1 = m.mamuller.find((x) => x.kod === '0901001');
  const beklenenTL = 0.35 * (8 * 1.3 /* 2026 EUR fiyat */) * (6.7 + 7 * 5.5) + 4 * (2.9 * 4);
  console.log('\nDOĞRULAMA 0901001 son alış TL:', m1.sonAlisTL.toFixed(2), 'beklenen:', beklenenTL.toFixed(2), Math.abs(m1.sonAlisTL - beklenenTL) < 0.01 ? 'OK' : 'HATA');
  const m2 = m.mamuller.find((x) => x.kod === '0901002');
  console.log('DOĞRULAMA 0901002 eksik bileşen:', m2.eksikBilesenler, m2.eksikBilesenler.includes('0103001') ? 'OK' : 'HATA', 'kapsam', m2.sonAlisKapsam);
  console.log('Kur özeti:', JSON.stringify(m.kurOzet));
  const k = JSON.parse(fs.readFileSync(path.join(VERI, 'karsilastirma.json')));
  console.log('DOĞRULAMA karşılaştırma mevcut EUR 0901001:', k.satirlar[0].mevcutEUR, k.satirlar[0].mevcutEUR === 32.5 ? 'OK' : 'HATA', '| sadece excelde:', k.sadeceMevcutta.map((x) => x.kod));
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => {
  if (cfgVardi) fs.writeFileSync(cfgYol, yedek); else fs.rmSync(cfgYol, { force: true });
});
