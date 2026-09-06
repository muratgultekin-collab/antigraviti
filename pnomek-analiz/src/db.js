'use strict';
// Mikro (MS SQL Server) bağlantısı. SADECE SELECT çalıştırılır; yazma/DDL içeren SQL reddedilir.
const sql = require('mssql');

const YASAK = /^\s*(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|GRANT|REVOKE|BULK|BACKUP|RESTORE|SP_|XP_)\b/i;

class Db {
  constructor(cfg) { this.cfg = cfg; this.pool = null; this.database = null; }
  async ac(database) {
    const c = { ...this.cfg.sql };
    if (database) c.database = database;
    if (!c.database) delete c.database; // master
    c.options = { ...(c.options || {}), readOnlyIntent: true };
    if (!c.requestTimeout) c.requestTimeout = 600000;
    this.pool = await new sql.ConnectionPool(c).connect();
    this.database = c.database || 'master';
    return this;
  }
  async kapat() { if (this.pool) { await this.pool.close(); this.pool = null; } }
  _kontrol(metin) {
    const temiz = metin.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const ifade of temiz.split(/;|\n(?=\s*(?:SELECT|WITH|DECLARE))/i)) {
      if (YASAK.test(ifade)) throw new Error('Yazma/DDL içeren SQL reddedildi: ' + ifade.trim().slice(0, 80));
    }
  }
  // Tek sonuç kümesi
  async sor(metin) {
    this._kontrol(metin);
    const r = await this.pool.request().query(metin);
    return r.recordset || [];
  }
  // Çoklu sonuç kümesi (dosyada birden fazla SELECT varsa)
  async sorCoklu(metin) {
    this._kontrol(metin);
    const r = await this.pool.request().query(metin);
    return r.recordsets || [];
  }
  async tabloVar(ad) {
    const r = await this.sor(`SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '${ad.replace(/'/g, "''")}'`);
    return r[0].n > 0;
  }
  async kolonlar(ad) {
    return this.sor(`SELECT COLUMN_NAME AS ad, DATA_TYPE AS tip FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${ad.replace(/'/g, "''")}' ORDER BY ORDINAL_POSITION`);
  }
}
module.exports = { Db };
