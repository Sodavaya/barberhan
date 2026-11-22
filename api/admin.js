const crypto = require("crypto");
const db = require("./_db");
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
// POST /api/admin { password, action, date, hour }
// action: list | confirm | block | free | blockday | freeday
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const b = req.body || {};
    const ip = String((req.headers["x-forwarded-for"] || "").split(",")[0] || "x").trim();
    const fk = "fail:" + ip;
    if ((Number(await db(["GET", fk])) || 0) >= 10) return res.status(429).json({ error: "locked" }); // 10 неверных паролей -> блок на 15 минут
    if (!process.env.ADMIN_PASSWORD || !same(b.password || "", process.env.ADMIN_PASSWORD)) {
      await db(["INCR", fk]); await db(["EXPIRE", fk, "900"]);
      return res.status(401).json({ error: "auth" });
    }
    if (b.action === "list") {
      const days = {};
      await Promise.all(Array.from({ length: 15 }, async (_, i) => {
        const k = db.day(i), a = (await db(["HGETALL", "bk:" + k])) || [], o = {};
        for (let j = 0; j < a.length; j += 2) { try { o[a[j]] = JSON.parse(a[j + 1]); } catch (e) {} }
        days[k] = o;
      }));
      return res.json({ days: Object.fromEntries(Object.entries(days).sort()) });
    }
    const d = String(b.date || ""), h = Number(b.hour), key = "bk:" + d;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return res.status(400).json({ error: "bad" });
    const needHour = ["confirm", "block", "free"].includes(b.action);
    if (needHour && !(Number.isInteger(h) && h >= 10 && h <= 20)) return res.status(400).json({ error: "bad" });
    if (b.action === "confirm") {
      const raw = await db(["HGET", key, String(h)]);
      if (!raw) return res.status(404).json({ error: "none" });
      const r = JSON.parse(raw); r.status = "confirmed"; r.confirmedAt = Date.now();
      await db(["HSET", key, String(h), JSON.stringify(r)]);
    } else if (b.action === "block") {
      await db(["HSETNX", key, String(h), JSON.stringify({ status: "blocked" })]);
      await db(["EXPIRE", key, "2000000"]);
    } else if (b.action === "free") {
      await db(["HDEL", key, String(h)]);
    } else if (b.action === "blockday") {
      for (let x = 10; x <= 20; x++) await db(["HSETNX", key, String(x), JSON.stringify({ status: "blocked" })]);
      await db(["EXPIRE", key, "2000000"]);
    } else if (b.action === "freeday") { // снимает только ручные блокировки, записи клиентов остаются
      const a = (await db(["HGETALL", key])) || [];
      for (let j = 0; j < a.length; j += 2) { try { if (JSON.parse(a[j + 1]).status === "blocked") await db(["HDEL", key, a[j]]); } catch (e) {} }
    } else return res.status(400).json({ error: "action" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "server" });
  }
};
