'use strict';
// Kullanım: node src/run.js kesif | satis | maliyet | karsilastir | rapor | hepsi
const adimlar = {
  kesif: () => require('./01_kesif').kesif(),
  satis: () => require('./02_satis').satis(),
  maliyet: () => require('./03_maliyet').maliyet(),
  karsilastir: () => require('./04_karsilastirma').karsilastir(),
  rapor: () => require('./05_rapor').rapor(),
};
async function main() {
  const a = process.argv[2];
  if (a === 'hepsi') { for (const k of Object.keys(adimlar)) { console.log(`\n===== ${k.toUpperCase()} =====`); await adimlar[k](); } return; }
  if (!adimlar[a]) { console.error('Kullanım: node src/run.js ' + Object.keys(adimlar).join(' | ') + ' | hepsi'); process.exit(2); }
  await adimlar[a]();
}
main().catch((e) => { console.error('\nHATA:', e.message); if (process.env.DEBUG) console.error(e); process.exit(1); });
