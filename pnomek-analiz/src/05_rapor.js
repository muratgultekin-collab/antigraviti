'use strict';
// ADIM 5 — RAPOR: Excel (ham veri, grup×yıl, maliyet, karşılaştırma) + tek dosya HTML dashboard (Chart.js CDN)
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { CIKTI, VERI, KESIF, configYukle, jsonOku, metinYaz, log } = require('./util');

function sayfa(wb, ad, satirlar, kolonlar) {
  const ws = wb.addWorksheet(ad.slice(0, 31));
  if (!satirlar || !satirlar.length) { ws.addRow(['(veri yok)']); return ws; }
  const ks = kolonlar || Object.keys(satirlar[0]);
  ws.columns = ks.map((k) => ({ header: k, key: k, width: Math.min(40, Math.max(10, String(k).length + 2)) }));
  for (const r of satirlar) ws.addRow(ks.map((k) => (r[k] === undefined || (typeof r[k] === 'object' && r[k] !== null && !(r[k] instanceof Date))) ? (r[k] == null ? null : JSON.stringify(r[k])) : r[k]));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ks.length } };
  return ws;
}

async function excel(cfg, m, maliyet, kars, grup) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'pnomek-analiz';
  const y = m ? m.yillar : [];
  sayfa(wb, 'Parametreler', [
    { parametre: 'Dönem', deger: `${cfg.donem.baslangic} – ${cfg.donem.bitis} (2026 kısmi: Eylül\'e kadar)` },
    { parametre: 'Rapor para birimi', deger: cfg.raporParaBirimi },
    { parametre: 'Grup alanı', deger: cfg.grupAlani },
    { parametre: 'Satış filtresi', deger: m?.satisFiltresi },
    { parametre: 'Alış filtresi', deger: maliyet?.alisFiltresi },
    { parametre: 'Reçete', deger: maliyet ? JSON.stringify(maliyet.receteAyar) : '' },
    { parametre: 'Kur kaynağı', deger: maliyet ? `Mikro DOVIZ_KURLARI (${maliyet.kurOzet.mikro} kullanım), TCMB (${maliyet.kurOzet.tcmb} kullanım), bulunamadı ${maliyet.kurOzet.bulunamadi}` : '' },
    { parametre: 'Üretim', deger: new Date().toLocaleString('tr-TR') },
  ]);
  if (m) {
    sayfa(wb, 'Grup_x_Yil', [...m.gruplar.map((g) => ({ grup: g.grup, ...Object.fromEntries(y.map((k) => [m.yilEtiketleri[k], g.yil[k] || 0])), toplam: g.toplam, en_cok_satilan_yil: g.enCokSatilanYil, en_cok_adet: g.enCokSatilanAdet, ...Object.fromEntries(y.slice(1).map((k) => [`degisim_${k}_%`, g.degisim[k]])) })),
      { grup: 'TOPLAM', ...Object.fromEntries(y.map((k) => [m.yilEtiketleri[k], m.yilToplam[k]])), toplam: m.genelToplam, en_cok_satilan_yil: m.enCokSatilanYil, en_cok_adet: m.yilToplam[m.enCokSatilanYil], ...Object.fromEntries(y.slice(1).map((k) => [`degisim_${k}_%`, m.yilDegisim[k]])) }]);
    sayfa(wb, 'Grup_Yil_Tutar', jsonOku(VERI, 'satis_grup_yil.json', []));
    sayfa(wb, 'Ham_Satis', jsonOku(VERI, 'satis_ham.json', []));
  }
  if (grup) { sayfa(wb, 'Grup_AnaGrup', grup.anagrup); sayfa(wb, 'Grup_AltGrup', grup.altgrup); sayfa(wb, 'Grup_Capraz', grup.capraz); sayfa(wb, 'Grup_Bos', grup.bos); }
  if (maliyet) {
    const yl = maliyet.yillar;
    sayfa(wb, 'Maliyet_09', maliyet.mamuller.map((r) => ({ kod: r.kod, ad: r.ad, seviye: r.seviye, bilesen: r.bilesenSayisi, kapsam_yuzde: r.sonAlisKapsam, son_alis_TL: r.sonAlisTL, son_alis_EUR: r.sonAlisEUR,
      ...Object.fromEntries(yl.map((k) => [`${k}_TL`, r.yillik[k]?.TL ?? null])), ...Object.fromEntries(yl.map((k) => [`${k}_EUR`, r.yillik[k]?.EUR ?? null])), eksik_bilesenler: r.eksikBilesenler.join(', ') })));
    sayfa(wb, 'Maliyet_Bilesen_Detay', maliyet.mamuller.flatMap((r) => r.bilesenler.map((b) => ({ mamul: r.kod, mamul_adi: r.ad, ...b }))));
    sayfa(wb, 'Bilesen_Fiyatlari', maliyet.bilesenFiyatlari.map((f) => ({ kod: f.kod, ad: f.ad, birim: f.birim, alis_sayisi: f.alisSayisi, son_alis_tarihi: f.sonAlis?.tarih, son_birim_TL: f.sonAlis?.birimTL, son_birim_EUR: f.sonAlis?.birimEUR, son_doviz: f.sonAlis?.doviz, kur_kaynak: f.sonAlis?.kurKaynak,
      ...Object.fromEntries(yl.map((k) => [`${k}_TL`, f.yillik[k]?.birimTL ?? null])), ...Object.fromEntries(yl.map((k) => [`${k}_EUR`, f.yillik[k]?.birimEUR ?? null])) })));
    sayfa(wb, 'Alis_Hareketleri_Kurlu', jsonOku(VERI, 'alis_hareketleri_kurlu.json', []));
    sayfa(wb, 'Eksik_Recetesiz', maliyet.recetesizMamuller);
    sayfa(wb, 'Eksik_Fiyatsiz_Bilesen', maliyet.fiyatsizBilesenler.map((b) => ({ kod: b.kod, ad: b.ad, birim: b.birim, mamul_sayisi: b.mamuller.length, mamuller: b.mamuller.join(', ') })));
  }
  if (kars) { sayfa(wb, 'Karsilastirma', kars.satirlar); sayfa(wb, 'Sadece_Mevcut_Calismada', kars.sadeceMevcutta); }
  const p = path.join(CIKTI, 'pnomek_analiz.xlsx');
  await wb.xlsx.writeFile(p);
  return p;
}

function html(cfg, m, maliyet, kars) {
  const veri = { m, maliyet: maliyet ? { yillar: maliyet.yillar, mamuller: maliyet.mamuller.map((r) => ({ kod: r.kod, ad: r.ad, sonAlisTL: r.sonAlisTL, sonAlisEUR: r.sonAlisEUR, kapsam: r.sonAlisKapsam, yillik: r.yillik })), kurOzet: maliyet.kurOzet } : null,
    kars: kars ? kars.satirlar.map((s) => ({ kod: s.kod, ad: s.ad, mevcutEUR: s.mevcutEUR, sqlSonAlisEUR: s.sqlSonAlisEUR, sqlYilEUR: s[`sql${kars.sonYil}EUR`], sonYil: kars.sonYil, mevcutTL: s.mevcutTL, sqlSonAlisTL: s.sqlSonAlisTL })) : null,
    cfg: { donem: cfg.donem, grupAlani: cfg.grupAlani, uretim: new Date().toLocaleString('tr-TR') } };
  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PNOMEK Satış ve Maliyet Analizi</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
:root{--bg:#f6f7f9;--kart:#fff;--yazi:#1f2933;--sol:#5b6b7b;--cizgi:#e1e5ea;--vurgu:#0b5fff}
body{margin:0;font-family:Segoe UI,Roboto,Arial,sans-serif;background:var(--bg);color:var(--yazi)}
header{background:#12263a;color:#fff;padding:18px 28px}header h1{margin:0;font-size:22px}header p{margin:4px 0 0;opacity:.8;font-size:13px}
main{max-width:1400px;margin:0 auto;padding:20px 24px;display:grid;grid-template-columns:repeat(12,1fr);gap:18px}
.kart{background:var(--kart);border:1px solid var(--cizgi);border-radius:10px;padding:16px;grid-column:span 12}
.kart h2{margin:0 0 10px;font-size:16px}.yarim{grid-column:span 6}.kpi{display:flex;gap:18px;flex-wrap:wrap}
.kpi div{flex:1;min-width:160px;background:#eef3ff;border-radius:8px;padding:12px}.kpi b{display:block;font-size:22px}.kpi span{font-size:12px;color:var(--sol)}
canvas{max-height:420px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border-bottom:1px solid var(--cizgi);padding:5px 8px;text-align:right;white-space:nowrap}th:first-child,td:first-child{text-align:left}th{background:#f0f2f5;position:sticky;top:0}
.tablo{overflow:auto;max-height:520px}.not{font-size:12px;color:var(--sol)}.eksik{color:#b42318}
@media(max-width:900px){.yarim{grid-column:span 12}}
</style></head><body>
<header><h1>PNOMEK — Satış ve Maliyet Analizi</h1><p id="altbaslik"></p></header>
<main>
<section class="kart"><h2>Özet</h2><div class="kpi" id="kpi"></div></section>
<section class="kart"><h2>Ürün grubu bazında yıllık satış (adet)</h2><canvas id="grupBar"></canvas></section>
<section class="kart yarim"><h2>Yıllara göre toplam satış (adet)</h2><canvas id="toplamCizgi"></canvas></section>
<section class="kart yarim"><h2>Grupların toplam satıştaki payı (2020–2026)</h2><canvas id="pay"></canvas></section>
<section class="kart"><h2>Grup × yıl tablosu ve yıllık değişim %</h2><div class="tablo" id="grupTablo"></div></section>
<section class="kart"><h2>09'lu mamuller — maliyet karşılaştırması (EUR)</h2><canvas id="maliyetBar"></canvas><p class="not">Mevcut çalışma (2025 Maliyet Çalışması) · SQL son alış fiyatı · SQL yıllık ağırlıklı ortalama. Kapsamı %100 altındaki mamullerde bazı bileşenlerin alış fiyatı bulunamamıştır.</p></section>
<section class="kart"><h2>09'lu mamuller — maliyet tablosu</h2><div class="tablo" id="maliyetTablo"></div></section>
</main>
<script>
const V=${JSON.stringify(veri)};
const f=(v,d)=>v==null||isNaN(v)?'':Number(v).toLocaleString('tr-TR',{minimumFractionDigits:d??0,maximumFractionDigits:d??0});
const P=['#0b5fff','#ff7a00','#12b76a','#f04438','#7a5af8','#0ba5ec','#eaaa08','#ee46bc','#667085','#2e90fa','#039855','#b54708'];
document.getElementById('altbaslik').textContent='Dönem '+V.cfg.donem.baslangic+' – '+V.cfg.donem.bitis+' (2026 Eylül\\'e kadar) · Grup alanı: '+(V.cfg.grupAlani||'-')+' · Üretim: '+V.cfg.uretim;
const m=V.m;
if(m){const y=m.yillar,e=m.yilEtiketleri,g=m.gruplar;
document.getElementById('kpi').innerHTML=['<div><b>'+f(m.genelToplam)+'</b><span>Toplam satış (adet)</span></div>','<div><b>'+g.length+'</b><span>Ürün grubu</span></div>','<div><b>'+m.enCokSatilanYil+'</b><span>En çok satılan yıl ('+f(m.yilToplam[m.enCokSatilanYil])+' adet)</span></div>','<div><b>'+(g[0]?g[0].grup:'-')+'</b><span>En büyük grup ('+f(g[0]?g[0].toplam:0)+' adet)</span></div>'].join('');
const ilk=g.slice(0,12);
new Chart(grupBar,{type:'bar',data:{labels:ilk.map(x=>x.grup),datasets:y.map((k,i)=>({label:e[k],data:ilk.map(x=>x.yil[k]||0),backgroundColor:P[i%P.length]}))},options:{responsive:true,plugins:{legend:{position:'bottom'}},scales:{x:{ticks:{autoSkip:false,maxRotation:45}}}}});
new Chart(toplamCizgi,{type:'line',data:{labels:y.map(k=>e[k]),datasets:[{label:'Toplam satış (adet)',data:y.map(k=>m.yilToplam[k]),borderColor:P[0],backgroundColor:P[0]+'33',fill:true,tension:.25}]},options:{plugins:{legend:{display:false}}}});
new Chart(pay,{type:'pie',data:{labels:ilk.map(x=>x.grup).concat(g.length>12?['Diğer']:[]),datasets:[{data:ilk.map(x=>x.toplam).concat(g.length>12?[g.slice(12).reduce((a,x)=>a+x.toplam,0)]:[]),backgroundColor:P}]},options:{plugins:{legend:{position:'right'}}}});
let t='<table><thead><tr><th>Grup</th>'+y.map(k=>'<th>'+e[k]+'</th>').join('')+'<th>Toplam</th><th>En iyi yıl</th>'+y.slice(1).map(k=>'<th>Δ'+k+' %</th>').join('')+'</tr></thead><tbody>';
for(const x of g)t+='<tr><td>'+x.grup+'</td>'+y.map(k=>'<td>'+f(x.yil[k]||0)+'</td>').join('')+'<td><b>'+f(x.toplam)+'</b></td><td>'+(x.enCokSatilanYil||'')+'</td>'+y.slice(1).map(k=>'<td>'+(x.degisim[k]==null?'':f(x.degisim[k],1)+'%')+'</td>').join('')+'</tr>';
t+='<tr><td><b>TOPLAM</b></td>'+y.map(k=>'<td><b>'+f(m.yilToplam[k])+'</b></td>').join('')+'<td><b>'+f(m.genelToplam)+'</b></td><td>'+m.enCokSatilanYil+'</td>'+y.slice(1).map(k=>'<td>'+(m.yilDegisim[k]==null?'':f(m.yilDegisim[k],1)+'%')+'</td>').join('')+'</tr></tbody></table>';
document.getElementById('grupTablo').innerHTML=t;}else{document.getElementById('kpi').innerHTML='<div><b>—</b><span>Satış analizi henüz çalıştırılmadı (ADIM 2)</span></div>';}
const ml=V.maliyet;
if(ml){const y=ml.yillar,sy=V.kars?V.kars[0]?.sonYil||2025:2025;const mm=ml.mamuller.slice(0,40);const k=Object.fromEntries((V.kars||[]).map(x=>[x.kod,x]));
new Chart(maliyetBar,{type:'bar',data:{labels:mm.map(x=>x.kod),datasets:[{label:'Mevcut çalışma (EUR)',data:mm.map(x=>k[x.kod]?.mevcutEUR??null),backgroundColor:P[8]},{label:'SQL son alış (EUR)',data:mm.map(x=>x.sonAlisEUR),backgroundColor:P[0]},{label:'SQL '+sy+' ağırlıklı ort. (EUR)',data:mm.map(x=>x.yillik[sy]?.EUR??null),backgroundColor:P[2]}]},options:{plugins:{legend:{position:'bottom'}},scales:{x:{ticks:{autoSkip:false,maxRotation:60}}}}});
let t='<table><thead><tr><th>Kod</th><th>Ad</th><th>Kapsam %</th><th>Son alış TL</th><th>Son alış EUR</th>'+y.map(k=>'<th>'+k+' EUR</th>').join('')+'<th>Mevcut EUR</th><th>Fark %</th></tr></thead><tbody>';
for(const x of ml.mamuller){const mv=k[x.kod]?.mevcutEUR;const fark=mv&&x.sonAlisEUR?((x.sonAlisEUR-mv)/mv*100):null;t+='<tr><td>'+x.kod+'</td><td style="text-align:left">'+(x.ad||'')+'</td><td class="'+(x.kapsam<100?'eksik':'')+'">'+x.kapsam+'</td><td>'+f(x.sonAlisTL,2)+'</td><td>'+f(x.sonAlisEUR,2)+'</td>'+y.map(k=>'<td>'+f(x.yillik[k]?.EUR,2)+'</td>').join('')+'<td>'+f(mv,2)+'</td><td>'+(fark==null?'':f(fark,1)+'%')+'</td></tr>';}
document.getElementById('maliyetTablo').innerHTML=t+'</tbody></table>';}else{document.getElementById('maliyetTablo').innerHTML='<p class="not">Maliyet analizi henüz çalıştırılmadı (ADIM 3).</p>';}
</script></body></html>`;
}

async function rapor() {
  const cfg = configYukle();
  const m = jsonOku(VERI, 'satis_matris.json', null);
  const maliyet = jsonOku(VERI, 'maliyet_09.json', null);
  const kars = jsonOku(VERI, 'karsilastirma.json', null);
  const grup = jsonOku(KESIF, 'grup_tablolari.json', null);
  if (!m && !maliyet) throw new Error('Rapor için veri yok: önce satis ve/veya maliyet adımlarını çalıştırın.');
  const px = await excel(cfg, m, maliyet, kars, grup);
  const ph = metinYaz(CIKTI, 'pnomek_dashboard.html', html(cfg, m, maliyet, kars));
  log('Excel:', px); log('Dashboard:', ph);
}

module.exports = { rapor };
if (require.main === module) rapor().catch((e) => { console.error(e); process.exit(1); });
