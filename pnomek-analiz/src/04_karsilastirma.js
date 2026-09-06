'use strict';
// ADIM 4 — MEVCUT MALİYET ÇALIŞMASI: klasördeki Excel dosyalarını oku, 09'lu kodların maliyetlerini bul, SQL hesabıyla karşılaştır
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { VERI, configYukle, jsonYaz, jsonOku, metinYaz, mdTablo, sayi, yuzde, log } = require('./util');

function dosyalariBul(kok) {
  const out = [];
  if (!fs.existsSync(kok)) return out;
  for (const e of fs.readdirSync(kok, { withFileTypes: true })) {
    const p = path.join(kok, e.name);
    if (e.isDirectory()) out.push(...dosyalariBul(p));
    else if (/\.(xlsx|xlsm)$/i.test(e.name) && !e.name.startsWith('~$')) out.push(p);
    else if (/\.xls$/i.test(e.name)) out.push({ atlandi: p, neden: '.xls (eski format) okunamıyor; Excel ile .xlsx olarak kaydedin' });
  }
  return out;
}
const hucreDeger = (c) => {
  const v = c && c.value;
  if (v == null) return null;
  if (typeof v === 'object') { if (v.result !== undefined) return v.result; if (v.richText) return v.richText.map((t) => t.text).join(''); if (v instanceof Date) return v; return v.text ?? null; }
  return v;
};

async function excelOku(dosya) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(dosya);
  const sayfalar = [];
  wb.eachSheet((ws) => {
    const satirlar = [];
    ws.eachRow({ includeEmpty: false }, (row, no) => {
      const h = {};
      row.eachCell({ includeEmpty: false }, (c, col) => { const v = hucreDeger(c); if (v !== null && v !== '') h[col] = v; });
      if (Object.keys(h).length) satirlar.push({ no, h });
    });
    sayfalar.push({ ad: ws.name, satirlar });
  });
  return sayfalar;
}

// 09'lu kod içeren satırlarda sayısal hücreleri başlıklarıyla topla
function maliyetleriCikar(dosya, sayfalar) {
  const bulgular = [];
  for (const s of sayfalar) {
    const baslikBul = (satirIdx, col) => {
      for (let i = satirIdx - 1; i >= Math.max(0, satirIdx - 15); i--) {
        const v = s.satirlar[i].h[col];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
      return '';
    };
    s.satirlar.forEach((r, idx) => {
      for (const [col, v] of Object.entries(r.h)) {
        const kod = typeof v === 'string' ? v.trim() : null;
        if (!kod || !/^09[\w.\-\/ ]{2,}$/.test(kod)) continue;
        const sayilar = Object.entries(r.h).filter(([c2, v2]) => c2 !== col && typeof v2 === 'number' && v2 > 0)
          .map(([c2, v2]) => { const b = baslikBul(idx, c2); return { kolon: Number(c2), baslik: b, deger: v2,
            tur: /EUR|€|AVRO/i.test(b) ? 'EUR' : /TL|₺|TRY/i.test(b) ? 'TL' : /USD|\$/i.test(b) ? 'USD' : '?', maliyetMi: /MAL[İI]YET|COST|TOPLAM|BR[İI]M/i.test(b) }; });
        if (sayilar.length) bulgular.push({ dosya: path.basename(dosya), sayfa: s.ad, satir: r.no, kod: kod.split(' ')[0], sayilar });
      }
    });
  }
  return bulgular;
}
function secim(sayilar, tur) {
  const aday = sayilar.filter((x) => x.tur === tur);
  return (aday.find((x) => x.maliyetMi) || aday[aday.length - 1] || null);
}

async function karsilastir() {
  const cfg = configYukle();
  const klasor = cfg.maliyetCalismasiKlasoru;
  const hesap = jsonOku(VERI, 'maliyet_09.json');
  const bulunan = dosyalariBul(klasor);
  const dosyalar = bulunan.filter((x) => typeof x === 'string');
  const atlanan = bulunan.filter((x) => typeof x !== 'string');
  if (!dosyalar.length) log(`UYARI: ${klasor} altında .xlsx bulunamadı (klasör var mı: ${fs.existsSync(klasor)}).`);
  const ham = {}, bulgular = [];
  for (const d of dosyalar) {
    log('Okunuyor:', d);
    try { const s = await excelOku(d); ham[path.relative(klasor, d)] = s; bulgular.push(...maliyetleriCikar(d, s)); }
    catch (e) { atlanan.push({ atlandi: d, neden: e.message }); }
  }
  jsonYaz(VERI, 'mevcut_maliyet_ham.json', { klasor, dosyalar, atlanan, sayfalar: ham });
  jsonYaz(VERI, 'mevcut_maliyet_bulgular.json', bulgular);

  // Kod bazında mevcut maliyet (ilk anlamlı bulgu; aynı kod birden çok dosyada varsa hepsi listelenir)
  const mevcut = {};
  for (const b of bulgular) {
    const tl = secim(b.sayilar, 'TL'), eur = secim(b.sayilar, 'EUR');
    if (!tl && !eur) continue;
    (mevcut[b.kod] ||= []).push({ kaynak: `${b.dosya} / ${b.sayfa} / satır ${b.satir}`, TL: tl?.deger ?? null, TLbaslik: tl?.baslik, EUR: eur?.deger ?? null, EURbaslik: eur?.baslik });
  }
  const yillar = hesap.yillar; const sonYil = yillar.includes(2025) ? 2025 : yillar[yillar.length - 1];
  const satirlar = [];
  for (const m of hesap.mamuller) {
    const mv = mevcut[m.kod]?.[0] || null;
    const y = m.yillik[sonYil] || null;
    const sebep = [];
    if (!mv) sebep.push('mevcut çalışmada bulunamadı');
    if (m.eksikBilesenler.length) sebep.push(`${m.eksikBilesenler.length} bileşenin alış fiyatı yok (SQL maliyeti eksik)`);
    if (mv && mv.EUR != null && m.sonAlisEUR != null) {
      const f = yuzde(m.sonAlisEUR, mv.EUR);
      if (f != null && Math.abs(f) > 25) sebep.push(`fark %${sayi(f, 1)}: olası sebepler — işçilik/genel gider/fire mevcut çalışmada dahil, reçete farklı, kur tarihi farklı, fiyat teklif bazlı (fatura değil)`);
    }
    satirlar.push({ kod: m.kod, ad: m.ad, mevcutTL: mv?.TL ?? null, mevcutEUR: mv?.EUR ?? null, mevcutKaynak: mv?.kaynak ?? null, digerBulgular: (mevcut[m.kod] || []).length - (mv ? 1 : 0),
      sqlSonAlisTL: m.sonAlisTL, sqlSonAlisEUR: m.sonAlisEUR, [`sql${sonYil}TL`]: y?.TL ?? null, [`sql${sonYil}EUR`]: y?.EUR ?? null,
      farkTL: mv?.TL != null ? m.sonAlisTL - mv.TL : null, farkTLyuzde: mv?.TL != null ? yuzde(m.sonAlisTL, mv.TL) : null,
      farkEUR: mv?.EUR != null && m.sonAlisEUR != null ? m.sonAlisEUR - mv.EUR : null, farkEURyuzde: mv?.EUR != null && m.sonAlisEUR != null ? yuzde(m.sonAlisEUR, mv.EUR) : null,
      kapsamYuzde: m.sonAlisKapsam, sebepler: sebep.join('; ') });
  }
  const sadeceMevcutta = Object.keys(mevcut).filter((k) => !hesap.mamuller.some((m) => m.kod === k));
  const cikti = { klasor, dosyalar: dosyalar.map((d) => path.relative(klasor, d)), atlanan, sonYil, satirlar, sadeceMevcutta: sadeceMevcutta.map((k) => ({ kod: k, ...mevcut[k][0] })), uretim: new Date().toISOString() };
  jsonYaz(VERI, 'karsilastirma.json', cikti);

  const out = [`# ADIM 4 — MEVCUT MALİYET ÇALIŞMASI İLE KARŞILAŞTIRMA\n\nKlasör: \`${klasor}\`\nOkunan dosya: ${dosyalar.length} · Atlanan: ${atlanan.length} · 09'lu kod bulgusu: ${bulgular.length}\n`];
  if (atlanan.length) { out.push('\n## Atlanan dosyalar\n'); out.push(mdTablo(atlanan)); }
  out.push('\n## Ürün bazında karşılaştırma (SQL son alış vs mevcut çalışma)\n');
  out.push(mdTablo(satirlar, ['kod', 'ad', 'mevcutTL', 'sqlSonAlisTL', 'farkTLyuzde', 'mevcutEUR', 'sqlSonAlisEUR', 'farkEURyuzde', `sql${sonYil}EUR`, 'kapsamYuzde', 'mevcutKaynak', 'sebepler']));
  out.push('\n## Sadece mevcut çalışmada olan 09\'lu kodlar (SQL reçetesi yok / hesaplanamadı)\n');
  out.push(mdTablo(cikti.sadeceMevcutta));
  out.push('\n> Mevcut çalışma değerleri, dosyalardaki "09…" kodlu satırlardan başlığı TL/EUR ve MALİYET içeren sayısal hücreler seçilerek otomatik çıkarıldı. Yanlış eşleşme için `cikti/veri/mevcut_maliyet_bulgular.json` içindeki tüm adayları kontrol edin.\n');
  const p = metinYaz(VERI, 'karsilastirma_ozet.md', out.join('\n'));
  log('Karşılaştırma:', p);
}

module.exports = { karsilastir };
if (require.main === module) karsilastir().catch((e) => { console.error(e); process.exit(1); });
