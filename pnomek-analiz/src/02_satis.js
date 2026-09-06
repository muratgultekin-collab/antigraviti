'use strict';
// ADIM 2 — SATIŞ ANALİZİ: ürün grubu × yıl matrisi (adet), toplamlar, en iyi yıl, yıllık değişim %
const { Db } = require('./db');
const { VERI, configYukle, jsonYaz, jsonOku, metinYaz, sqlOku, mdTablo, sayi, yilEtiketi, yilListesi, yuzde, log } = require('./util');

function grupKolonu(grupAlani) {
  const ana = "ISNULL(NULLIF(RTRIM(s.sto_anagrup_kod),''),'(BOŞ)') + ' - ' + ISNULL(RTRIM(ag.san_isim),'')";
  const alt = "ISNULL(NULLIF(RTRIM(s.sto_altgrup_kod),''),'(BOŞ)') + ' - ' + ISNULL(RTRIM(alg.sta_isim),'')";
  switch (grupAlani) {
    case 'anagrup': return ana;
    case 'altgrup': return alt;
    case 'hiyerarsik': return `${ana} + ' > ' + ${alt}`;
    default: throw new Error(`config.grupAlani = "${grupAlani}" geçersiz. Beklenen: anagrup | altgrup | hiyerarsik. (Karar için cikti/kesif/grup_tablolari.md)`);
  }
}

function matrisKur(cfg, satirlar) {
  const yillar = yilListesi(cfg);
  const gruplar = {};
  for (const r of satirlar) {
    const g = (gruplar[r.grup] ||= { grup: r.grup, yil: {}, tutar: {}, toplam: 0 });
    g.yil[r.yil] = (g.yil[r.yil] || 0) + Number(r.adet || 0);
    g.tutar[r.yil] = (g.tutar[r.yil] || 0) + Number(r.tutar || 0);
  }
  const liste = Object.values(gruplar).map((g) => {
    g.toplam = yillar.reduce((a, y) => a + (g.yil[y] || 0), 0);
    let enIyi = null;
    for (const y of yillar) if (g.yil[y] != null && (enIyi === null || g.yil[y] > g.yil[enIyi])) enIyi = y;
    g.enCokSatilanYil = enIyi; g.enCokSatilanAdet = enIyi === null ? null : g.yil[enIyi];
    g.degisim = {};
    for (let i = 1; i < yillar.length; i++) g.degisim[yillar[i]] = yuzde(g.yil[yillar[i]] || 0, g.yil[yillar[i - 1]] || 0);
    return g;
  }).sort((a, b) => b.toplam - a.toplam);
  const yilToplam = {};
  for (const y of yillar) yilToplam[y] = liste.reduce((a, g) => a + (g.yil[y] || 0), 0);
  const genelToplam = Object.values(yilToplam).reduce((a, b) => a + b, 0);
  let enIyiYil = null;
  for (const y of yillar) if (enIyiYil === null || yilToplam[y] > yilToplam[enIyiYil]) enIyiYil = y;
  const yilDegisim = {};
  for (let i = 1; i < yillar.length; i++) yilDegisim[yillar[i]] = yuzde(yilToplam[yillar[i]], yilToplam[yillar[i - 1]]);
  return { yillar, yilEtiketleri: Object.fromEntries(yillar.map((y) => [y, yilEtiketi(cfg, y)])), gruplar: liste, yilToplam, genelToplam, enCokSatilanYil: enIyiYil, yilDegisim };
}

async function satis() {
  const cfg = configYukle();
  const kesif = jsonOku(VERI, 'kesif_ozet.json', {});
  const satisFiltresi = cfg.satisFiltresi || kesif.satisFiltresi;
  if (!satisFiltresi) throw new Error('Satış filtresi yok: config.satisFiltresi girin veya önce kesif çalıştırın.');
  const GRUP_KOLON = grupKolonu(cfg.grupAlani);
  const db = await new Db(cfg).ac(cfg.sql.database || kesif.database);
  const tarih = (s) => s.replace("'2020-01-01'", `'${cfg.donem.baslangic}'`).replace("'2027-01-01'", `'${cfg.donem.bitis}'`);

  log('Ham satış hareketleri çekiliyor...');
  const ham = await db.sor(tarih(sqlOku('10_satis_ham.sql', { SATIS_FILTRESI: satisFiltresi })));
  log(`${ham.length} satır. Grup × yıl özeti çekiliyor...`);
  const grupYil = await db.sor(tarih(sqlOku('11_satis_grup_yil.sql', { SATIS_FILTRESI: satisFiltresi, GRUP_KOLON })));
  await db.kapat();

  const m = matrisKur(cfg, grupYil);
  m.grupAlani = cfg.grupAlani; m.satisFiltresi = satisFiltresi; m.kayitSayisi = ham.length;
  jsonYaz(VERI, 'satis_ham.json', ham);
  jsonYaz(VERI, 'satis_grup_yil.json', grupYil);
  jsonYaz(VERI, 'satis_matris.json', m);

  // Markdown özet
  const y = m.yillar;
  const out = [`# ADIM 2 — SATIŞ ANALİZİ (adet)\n\nGrup alanı: **${cfg.grupAlani}** · Filtre: \`${satisFiltresi}\` · İadeler negatif düşüldü · ${ham.length} hareket satırı\n`];
  out.push('\n## Ürün grubu × yıl\n');
  out.push(mdTablo(m.gruplar.map((g) => ({ grup: g.grup, ...Object.fromEntries(y.map((k) => [m.yilEtiketleri[k], g.yil[k] || 0])), toplam: g.toplam, 'en çok satılan yıl': g.enCokSatilanYil, 'adedi': g.enCokSatilanAdet }))));
  out.push('\n## Yıl toplamları\n');
  out.push(mdTablo([{ ...Object.fromEntries(y.map((k) => [m.yilEtiketleri[k], m.yilToplam[k]])), toplam: m.genelToplam, 'en iyi yıl': m.enCokSatilanYil }]));
  out.push('\n## Yıllık değişim % (bir önceki yıla göre)\n');
  out.push(mdTablo([...m.gruplar.map((g) => ({ grup: g.grup, ...Object.fromEntries(y.slice(1).map((k) => [m.yilEtiketleri[k], g.degisim[k] == null ? '' : sayi(g.degisim[k], 1) + '%'])) })),
    { grup: 'TOPLAM', ...Object.fromEntries(y.slice(1).map((k) => [m.yilEtiketleri[k], m.yilDegisim[k] == null ? '' : sayi(m.yilDegisim[k], 1) + '%'])) }]));
  out.push('\n> 2026 kısmi yıldır (Eylül\'e kadar); 2026 değişim yüzdesi tam yılla karşılaştırıldığı için yanıltıcı olabilir.\n');
  const p = metinYaz(VERI, 'satis_ozet.md', out.join('\n'));
  log('Satış özeti:', p);
  console.log(`\nÖZET: ${m.gruplar.length} grup, genel toplam ${sayi(m.genelToplam)} adet, en iyi yıl ${m.enCokSatilanYil} (${sayi(m.yilToplam[m.enCokSatilanYil])} adet)`);
}

module.exports = { satis, matrisKur, grupKolonu };
if (require.main === module) satis().catch((e) => { console.error(e); process.exit(1); });
