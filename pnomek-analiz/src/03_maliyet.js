'use strict';
// ADIM 3 — 09'LU MAMULLERİN MALİYETİ: çok seviyeli reçete açılımı + bileşen alış fiyatları (tarih bazlı, kur dönüşümlü)
const { Db } = require('./db');
const { KurServisi } = require('./kur');
const { VERI, configYukle, jsonYaz, jsonOku, metinYaz, sqlOku, mdTablo, sayi, tarihStr, yilListesi, log } = require('./util');

function receteAyar(cfg, kesif) {
  const r = { ...(kesif.recete || {}), ...Object.fromEntries(Object.entries(cfg.recete || {}).filter(([, v]) => v)) };
  for (const k of ['tablo', 'mamulKolon', 'bilesenKolon', 'miktarKolon']) {
    if (!r[k]) throw new Error(`Reçete ayarı eksik: recete.${k}. cikti/kesif/kesif_raporu.md → "Reçete tablosu adayları" bölümüne bakıp config.json → recete alanını doldurun.`);
  }
  return r;
}

async function maliyet() {
  const cfg = configYukle();
  const kesif = jsonOku(VERI, 'kesif_ozet.json', {});
  const alisFiltresi = cfg.alisFiltresi || kesif.alisFiltresi;
  if (!alisFiltresi) throw new Error('Alış filtresi yok: config.alisFiltresi girin veya önce kesif çalıştırın.');
  const rc = receteAyar(cfg, kesif);
  const db = await new Db(cfg).ac(cfg.sql.database || kesif.database);

  // 1) Reçete açılımı
  log('Reçete açılımı (09*)...');
  const [acilim, recetesiz] = await db.sorCoklu(sqlOku('20_recete_09_acilim.sql', {
    RECETE_TABLO: rc.tablo, RECETE_MAMUL: rc.mamulKolon, RECETE_BILESEN: rc.bilesenKolon, RECETE_MIKTAR: rc.miktarKolon,
    RECETE_MAMUL_MIKTAR: rc.mamulMiktarKolon ? `r.${rc.mamulMiktarKolon}` : '1',
  }));
  log(`${acilim.length} reçete satırı, ${recetesiz.length} reçetesiz 09'lu mamul.`);
  const mamuller = {};
  for (const r of acilim) {
    const m = (mamuller[r.mamul_kod] ||= { kod: r.mamul_kod, ad: r.mamul_adi, maxSeviye: 0, bilesenler: {} });
    m.maxSeviye = Math.max(m.maxSeviye, r.seviye);
    if (r.yari_mamul_mi) continue; // yarı mamul kendisi açıldı; yaprak bileşenler maliyetlenir
    const b = (m.bilesenler[r.bilesen_kod] ||= { kod: r.bilesen_kod, ad: r.bilesen_adi, birim: r.bilesen_birim, miktar: 0, yollar: [] });
    b.miktar += Number(r.kumule_miktar || 0);
    b.yollar.push(r.yol);
  }
  const bilesenKodlari = [...new Set(acilim.filter((r) => !r.yari_mamul_mi).map((r) => r.bilesen_kod))];

  // 2) Alış hareketleri (parça parça IN listesi)
  log(`${bilesenKodlari.length} yaprak bileşen için alış hareketleri çekiliyor...`);
  const alislar = [];
  for (let i = 0; i < bilesenKodlari.length; i += 400) {
    const liste = bilesenKodlari.slice(i, i + 400).map((k) => `'${String(k).replace(/'/g, "''")}'`).join(',');
    alislar.push(...await db.sor(sqlOku('21_alis_hareketleri.sql', { ALIS_FILTRESI: alisFiltresi, BILESEN_LISTESI: liste })));
  }
  log(`${alislar.length} alış satırı.`);

  // 3) Kur dönüşümü
  const kur = new KurServisi(cfg);
  await kur.mikroYukle(db);
  await db.kapat();
  const hareketDovizinde = cfg.dovizliTutarHareketDovizinde !== false;
  const fiyatlar = {}; // bilesen -> { alislar:[], sonAlis, yillik:{} }
  for (const a of alislar) {
    if (a.iade === 1 || !(Number(a.miktar) > 0)) continue;
    const doviz = kur.dovizKodu(a.doviz_cinsi);
    let netTL = Number(a.net_tutar), tlKur = { kur: 1, kaynak: 'TL' };
    if (doviz !== 'TL' && hareketDovizinde) {
      tlKur = await kur.kur(a.tarih, doviz);
      netTL = tlKur.kur ? Number(a.net_tutar) * tlKur.kur : null;
    }
    const eurKur = await kur.kur(a.tarih, 'EUR');
    const netEUR = netTL != null && eurKur.kur ? netTL / eurKur.kur : null;
    const f = (fiyatlar[a.stok_kod] ||= { kod: a.stok_kod, ad: a.stok_adi, birim: a.birim, alislar: [], yillik: {} });
    f.alislar.push({ tarih: tarihStr(a.tarih), miktar: Number(a.miktar), doviz, netTutarDoviz: Number(a.net_tutar), belgeKuru: Number(a.belge_kuru || 0),
      tlKur: tlKur.kur, tlKurKaynak: tlKur.kaynak, netTL, birimTL: netTL != null ? netTL / Number(a.miktar) : null,
      eurKur: eurKur.kur, eurKurKaynak: eurKur.kaynak, netEUR, birimEUR: netEUR != null ? netEUR / Number(a.miktar) : null,
      cari: a.cari_kodu, evrak: `${a.evrak_seri || ''}${a.evrak_sira || ''}` });
  }
  const yillar = yilListesi(cfg);
  for (const f of Object.values(fiyatlar)) {
    f.alislar.sort((x, y) => x.tarih.localeCompare(y.tarih));
    const gecerli = f.alislar.filter((x) => x.birimTL != null);
    const son = gecerli[gecerli.length - 1];
    f.sonAlis = son ? { tarih: son.tarih, birimTL: son.birimTL, birimEUR: son.birimEUR, doviz: son.doviz, kurKaynak: son.tlKurKaynak + ' / EUR: ' + son.eurKurKaynak } : null;
    for (const y of yillar) {
      const yil = gecerli.filter((x) => x.tarih.startsWith(String(y)));
      const mik = yil.reduce((a, x) => a + x.miktar, 0);
      if (mik > 0) f.yillik[y] = { birimTL: yil.reduce((a, x) => a + x.netTL, 0) / mik, birimEUR: yil.every((x) => x.netEUR != null) ? yil.reduce((a, x) => a + x.netEUR, 0) / mik : null, alisSayisi: yil.length, miktar: mik };
    }
  }

  // 4) Mamul maliyeti
  const sonuc = [];
  const fiyatsizBilesenler = {};
  for (const m of Object.values(mamuller)) {
    const r = { kod: m.kod, ad: m.ad, seviye: m.maxSeviye, bilesenSayisi: Object.keys(m.bilesenler).length, sonAlisTL: 0, sonAlisEUR: 0, sonAlisKapsam: 0, eksikBilesenler: [], yillik: {} };
    let eurTam = true;
    for (const b of Object.values(m.bilesenler)) {
      const f = fiyatlar[b.kod];
      if (!f || !f.sonAlis) { r.eksikBilesenler.push(b.kod); (fiyatsizBilesenler[b.kod] ||= { kod: b.kod, ad: b.ad, birim: b.birim, mamuller: [] }).mamuller.push(m.kod); continue; }
      r.sonAlisTL += b.miktar * f.sonAlis.birimTL;
      if (f.sonAlis.birimEUR != null) r.sonAlisEUR += b.miktar * f.sonAlis.birimEUR; else eurTam = false;
      r.sonAlisKapsam++;
    }
    if (!eurTam) r.sonAlisEUR = null;
    r.sonAlisKapsam = r.bilesenSayisi ? Math.round((r.sonAlisKapsam / r.bilesenSayisi) * 100) : 0;
    r.bilesenler = Object.values(m.bilesenler).map((b) => ({ kod: b.kod, ad: b.ad, birim: b.birim, miktar: b.miktar, sonBirimTL: fiyatlar[b.kod]?.sonAlis?.birimTL ?? null, sonBirimEUR: fiyatlar[b.kod]?.sonAlis?.birimEUR ?? null, sonAlisTarihi: fiyatlar[b.kod]?.sonAlis?.tarih ?? null, tutarTL: fiyatlar[b.kod]?.sonAlis ? b.miktar * fiyatlar[b.kod].sonAlis.birimTL : null }));
    for (const y of yillar) {
      let tl = 0, eur = 0, kapsam = 0, geri = 0, eurTamY = true;
      for (const b of Object.values(m.bilesenler)) {
        const f = fiyatlar[b.kod]; if (!f) continue;
        let fy = f.yillik[y];
        if (!fy) { // o yıl alış yoksa en yakın önceki yılın ortalaması
          const onceki = yillar.filter((k) => k < y && f.yillik[k]).pop();
          if (onceki === undefined) continue;
          fy = f.yillik[onceki]; geri++;
        }
        tl += b.miktar * fy.birimTL; kapsam++;
        if (fy.birimEUR != null) eur += b.miktar * fy.birimEUR; else eurTamY = false;
      }
      r.yillik[y] = kapsam ? { TL: tl, EUR: eurTamY ? eur : null, kapsamYuzde: Math.round((kapsam / r.bilesenSayisi) * 100), oncekiYildanAlinan: geri } : null;
    }
    sonuc.push(r);
  }
  sonuc.sort((a, b) => a.kod.localeCompare(b.kod));
  const cikti = { receteAyar: rc, alisFiltresi, dovizliTutarHareketDovizinde: hareketDovizinde, yillar, mamuller: sonuc, recetesizMamuller: recetesiz,
    fiyatsizBilesenler: Object.values(fiyatsizBilesenler), bilesenFiyatlari: Object.values(fiyatlar).map((f) => ({ kod: f.kod, ad: f.ad, birim: f.birim, sonAlis: f.sonAlis, yillik: f.yillik, alisSayisi: f.alislar.length })),
    kurOzet: kur.ozet(), uretim: new Date().toISOString() };
  jsonYaz(VERI, 'maliyet_09.json', cikti);
  jsonYaz(VERI, 'alis_hareketleri_kurlu.json', Object.values(fiyatlar).flatMap((f) => f.alislar.map((a) => ({ stok_kod: f.kod, ...a }))));

  const out = [`# ADIM 3 — 09'LU MAMUL MALİYETLERİ\n\nReçete: \`${rc.tablo}\` (${rc.mamulKolon} → ${rc.bilesenKolon} × ${rc.miktarKolon}) · Alış filtresi: \`${alisFiltresi}\`\n`];
  out.push(`Kur kullanımı: Mikro ${cikti.kurOzet.mikro} · TCMB ${cikti.kurOzet.tcmb} · bulunamadı ${cikti.kurOzet.bulunamadi}\n`);
  out.push('\n## Mamul başına maliyet (son alış fiyatıyla) ve yıllık ağırlıklı ortalama\n');
  out.push(mdTablo(sonuc.map((r) => ({ kod: r.kod, ad: r.ad, 'bileşen': r.bilesenSayisi, 'kapsam %': r.sonAlisKapsam, 'son alış TL': r.sonAlisTL, 'son alış EUR': r.sonAlisEUR,
    ...Object.fromEntries(yillar.map((y) => [`${y} TL`, r.yillik[y]?.TL ?? ''])), ...Object.fromEntries(yillar.map((y) => [`${y} EUR`, r.yillik[y]?.EUR ?? ''])), 'eksik bileşen': r.eksikBilesenler.join(', ') }))));
  out.push('\n## Reçetesi olmayan 09\'lu mamuller\n'); out.push(mdTablo(recetesiz));
  out.push('\n## Fiyatı bulunamayan bileşenler (alış faturası girişi yok)\n');
  out.push(mdTablo(Object.values(fiyatsizBilesenler).map((b) => ({ kod: b.kod, ad: b.ad, birim: b.birim, 'kullanan mamul sayısı': b.mamuller.length, mamuller: b.mamuller.slice(0, 8).join(', ') }))));
  out.push('\n> Yıllık ortalama: o yıl alışı olmayan bileşen için en yakın önceki yılın ortalaması kullanıldı (oncekiYildanAlinan sayacı JSON\'da). Kapsam %: fiyatı bulunan bileşen oranı; %100 altı maliyetler eksiktir.\n');
  const p = metinYaz(VERI, 'maliyet_ozet.md', out.join('\n'));
  log('Maliyet özeti:', p);
  console.log(`\nÖZET: ${sonuc.length} mamul maliyetlendi, ${recetesiz.length} reçetesiz, ${Object.keys(fiyatsizBilesenler).length} fiyatsız bileşen. Kur: ${JSON.stringify(cikti.kurOzet)}`);
}

module.exports = { maliyet };
if (require.main === module) maliyet().catch((e) => { console.error(e); process.exit(1); });
