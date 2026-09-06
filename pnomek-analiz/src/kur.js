'use strict';
// Kur kaynağı: 1) Mikro DOVIZ_KURLARI  2) TCMB (EVDS anahtarı varsa EVDS, yoksa tcmb.gov.tr günlük XML)
// Her kur değeri kaynağıyla birlikte döner: { kur, kaynak, kurTarihi }
const fs = require('fs');
const path = require('path');
const { VERI, tarihStr, log } = require('./util');

const CACHE_AD = 'tcmb_kur_cache.json';

class KurServisi {
  constructor(cfg) {
    this.cfg = cfg;
    this.mikro = {}; // 'YYYY-MM-DD' -> { USD: x, EUR: y }
    this.tcmb = this._cacheOku(); // 'YYYY-MM-DD' -> { USD, EUR, gercekTarih } | { yok: true }
    this.kullanim = { mikro: 0, tcmb: 0, bulunamadi: 0 };
    this.dovizNo = { ...(cfg.kur && cfg.kur.dovizNo) };
  }

  _cacheOku() {
    const p = path.join(VERI, CACHE_AD);
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
  }
  _cacheYaz() {
    fs.mkdirSync(VERI, { recursive: true });
    fs.writeFileSync(path.join(VERI, CACHE_AD), JSON.stringify(this.tcmb), 'utf8');
  }

  // DOVIZLER tablosundan USD/EUR numaralarını bul (config'de verilmişse onu kullan)
  async mikroYukle(db) {
    if (!(await db.tabloVar('DOVIZLER')) || !(await db.tabloVar('DOVIZ_KURLARI'))) {
      log('UYARI: DOVIZLER / DOVIZ_KURLARI tablosu yok; sadece TCMB kullanılacak.');
      return;
    }
    const dovizler = await db.sor('SELECT * FROM DOVIZLER');
    const noKolon = Object.keys(dovizler[0] || {}).find((k) => /^dvz_no$|_no$/i.test(k)) || 'dvz_no';
    const adKolon = Object.keys(dovizler[0] || {}).find((k) => /(adi|isim|kod)$/i.test(k));
    for (const d of dovizler) {
      const ad = String(d[adKolon] || '').toUpperCase();
      if (this.dovizNo.USD == null && /USD|DOLAR|\$/.test(ad)) this.dovizNo.USD = d[noKolon];
      if (this.dovizNo.EUR == null && /EUR|EURO|AVRO|€/.test(ad)) this.dovizNo.EUR = d[noKolon];
    }
    log('Döviz numaraları:', JSON.stringify(this.dovizNo));
    const kolon = (this.cfg.kur && this.cfg.kur.kurKolon) || 'dk_kur_1';
    const satirlar = await db.sor(`SELECT dk_tarih, dk_cins, ${kolon} AS kur FROM DOVIZ_KURLARI WHERE dk_tarih >= '2019-01-01' AND ${kolon} > 0 ORDER BY dk_tarih`);
    for (const r of satirlar) {
      const t = tarihStr(r.dk_tarih);
      if (!this.mikro[t]) this.mikro[t] = {};
      if (r.dk_cins === this.dovizNo.USD) this.mikro[t].USD = Number(r.kur);
      if (r.dk_cins === this.dovizNo.EUR) this.mikro[t].EUR = Number(r.kur);
    }
    log(`Mikro kur tablosundan ${Object.keys(this.mikro).length} gün yüklendi (kolon: ${kolon}).`);
  }

  dovizKodu(no) {
    if (no === 0 || no === null || no === undefined) return 'TL';
    if (no === this.dovizNo.USD) return 'USD';
    if (no === this.dovizNo.EUR) return 'EUR';
    return `DOVIZ_${no}`;
  }

  // Bir tarihteki kuru al. Sıra: mikro (aynı gün) -> tcmb (aynı gün, yoksa önceki iş günü)
  async kur(tarih, doviz) {
    if (doviz === 'TL') return { kur: 1, kaynak: 'TL', kurTarihi: tarihStr(tarih) };
    const t = tarihStr(tarih);
    const sira = (this.cfg.kur && this.cfg.kur.kaynakSirasi) || ['mikro', 'tcmb'];
    for (const kaynak of sira) {
      if (kaynak === 'mikro' && this.mikro[t] && this.mikro[t][doviz] > 0) {
        this.kullanim.mikro++;
        return { kur: this.mikro[t][doviz], kaynak: 'Mikro DOVIZ_KURLARI', kurTarihi: t };
      }
      if (kaynak === 'tcmb') {
        const r = await this._tcmb(t, doviz);
        if (r) { this.kullanim.tcmb++; return r; }
      }
    }
    this.kullanim.bulunamadi++;
    return { kur: null, kaynak: 'BULUNAMADI', kurTarihi: t };
  }

  async _tcmb(t, doviz) {
    // Aynı gün yoksa önceki iş gününe kadar (en fazla 10 gün) geri git
    let d = new Date(t + 'T00:00:00');
    for (let i = 0; i < 10; i++) {
      const ts = tarihStr(d);
      if (this.tcmb[ts] === undefined) {
        this.tcmb[ts] = await this._tcmbIndir(ts);
        this._cacheYaz();
      }
      const k = this.tcmb[ts];
      if (k && !k.yok && k[doviz] > 0) {
        return { kur: k[doviz], kaynak: i === 0 ? 'TCMB' : `TCMB (önceki iş günü ${ts})`, kurTarihi: ts };
      }
      d.setDate(d.getDate() - 1);
    }
    return null;
  }

  // tcmb.gov.tr/kurlar/YYYYMM/DDMMYYYY.xml — anahtar gerektirmez. Hafta sonu/tatilde dosya yoktur (404).
  async _tcmbIndir(ts) {
    const [y, m, g] = ts.split('-');
    const bugun = tarihStr(new Date());
    const url = ts === bugun ? 'https://www.tcmb.gov.tr/kurlar/today.xml' : `https://www.tcmb.gov.tr/kurlar/${y}${m}/${g}${m}${y}.xml`;
    const tip = (this.cfg.kur && this.cfg.kur.tcmbKurTipi) || 'ForexBuying';
    try {
      const res = await fetch(url);
      if (res.status === 404) return { yok: true };
      if (!res.ok) { log('TCMB HTTP', res.status, url); return { yok: true }; }
      const xml = await res.text();
      const al = (kod) => {
        const m1 = xml.match(new RegExp(`<Currency[^>]*CurrencyCode="${kod}"[^>]*>([\\s\\S]*?)</Currency>`));
        if (!m1) return null;
        const v = m1[1].match(new RegExp(`<${tip}>([^<]*)</${tip}>`));
        const birim = m1[1].match(/<Unit>(\d+)<\/Unit>/);
        if (!v || !v[1]) return null;
        return Number(v[1]) / (birim ? Number(birim[1]) : 1);
      };
      return { USD: al('USD'), EUR: al('EUR'), tcmbTarih: (xml.match(/Tarih="([^"]+)"/) || [])[1] || ts };
    } catch (e) {
      log('TCMB indirme hatası', ts, e.message);
      return undefined; // tekrar denensin
    }
  }

  ozet() {
    return { ...this.kullanim, dovizNo: this.dovizNo, mikroGunSayisi: Object.keys(this.mikro).length,
      tcmbGunSayisi: Object.values(this.tcmb).filter((x) => x && !x.yok).length };
  }
}
module.exports = { KurServisi };
