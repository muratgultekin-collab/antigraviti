'use strict';
const fs = require('fs');
const path = require('path');

const KOK = path.resolve(__dirname, '..');
const CIKTI = path.join(KOK, 'cikti');
const VERI = path.join(CIKTI, 'veri');
const KESIF = path.join(CIKTI, 'kesif');
const SQL = path.join(KOK, 'sql');

function configYukle() {
  const p = path.join(KOK, 'config.json');
  if (!fs.existsSync(p)) {
    throw new Error('config.json bulunamadı. config.example.json dosyasını config.json olarak kopyalayıp bağlantı bilgilerini girin.');
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function jsonYaz(dizin, ad, veri) {
  fs.mkdirSync(dizin, { recursive: true });
  const p = path.join(dizin, ad);
  fs.writeFileSync(p, JSON.stringify(veri, null, 2), 'utf8');
  return p;
}
function jsonOku(dizin, ad, varsayilan) {
  const p = path.join(dizin, ad);
  if (!fs.existsSync(p)) {
    if (varsayilan !== undefined) return varsayilan;
    throw new Error(`${p} yok. Önceki adımı (kesif/satis/maliyet) çalıştırın.`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function metinYaz(dizin, ad, metin) {
  fs.mkdirSync(dizin, { recursive: true });
  const p = path.join(dizin, ad);
  fs.writeFileSync(p, metin, 'utf8');
  return p;
}

// sql/ altındaki dosyayı okur, {{PARAMETRE}} yerlerini doldurur, çalışan halini cikti/sql_calisan/ altına kaydeder.
function sqlOku(ad, degisimler = {}) {
  let s = fs.readFileSync(path.join(SQL, ad), 'utf8');
  for (const [k, v] of Object.entries(degisimler)) s = s.split(`{{${k}}}`).join(v);
  const kalan = s.match(/\{\{[A-Z_]+\}\}/g);
  if (kalan) throw new Error(`${ad} içinde doldurulmamış parametre: ${[...new Set(kalan)].join(', ')}`);
  metinYaz(path.join(CIKTI, 'sql_calisan'), ad, s);
  return s;
}

function sayi(v, ondalik) {
  if (v === null || v === undefined || Number.isNaN(v)) return '';
  if (typeof v !== 'number') return String(v);
  const d = ondalik !== undefined ? ondalik : (Number.isInteger(v) ? 0 : 2);
  return v.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
}
// Markdown tablo
function mdTablo(satirlar, kolonlar) {
  if (!satirlar || !satirlar.length) return '_(kayıt yok)_\n';
  const ks = kolonlar || Object.keys(satirlar[0]);
  const f = (v) => {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return tarihStr(v);
    if (typeof v === 'number') return sayi(v);
    return String(v).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  };
  const out = ['| ' + ks.join(' | ') + ' |', '| ' + ks.map(() => '---').join(' | ') + ' |'];
  for (const r of satirlar) out.push('| ' + ks.map((k) => f(r[k])).join(' | ') + ' |');
  return out.join('\n') + '\n';
}
function tarihStr(d) {
  if (!d) return '';
  const t = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(t.getTime())) return String(d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}
function yilEtiketi(cfg, yil) {
  const k = (cfg.donem && cfg.donem.kismiYil) || {};
  return k[String(yil)] || String(yil);
}
function yilListesi(cfg) {
  const b = new Date(cfg.donem.baslangic).getFullYear();
  const s = new Date(cfg.donem.bitis).getFullYear() - 1; // bitis hariç
  const y = [];
  for (let i = b; i <= s; i++) y.push(i);
  return y;
}
function yuzde(a, b) {
  if (!b) return null;
  return Math.round(((a - b) / Math.abs(b)) * 10000) / 100;
}
function log(...a) { console.log(new Date().toISOString().slice(11, 19), ...a); }

module.exports = { KOK, CIKTI, VERI, KESIF, SQL, configYukle, jsonYaz, jsonOku, metinYaz, sqlOku, mdTablo, sayi, tarihStr, yilEtiketi, yilListesi, yuzde, log };
