const db = require("./_db");
// POST /api/book { date, hour, name, phone, note } -> закрепляет свободную ячейку за клиентом (статус «pending»: ждёт подтверждения админом)
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const b = req.body || {};
    const ip = String((req.headers["x-forwarded-for"] || "").split(",")[0] || "x").trim();
    // защита от спама: не больше 6 заявок с одного адреса в час
    const rk = "rb:" + ip;
    const n = await db(["INCR", rk]);
    if (n === 1) await db(["EXPIRE", rk, "3600"]);
    if (n > 6) return res.status(429).json({ error: "limit" });
    const d = String(b.date || ""), h = Number(b.hour);
    const name = String(b.name || "").trim().slice(0, 60);
    const phone = String(b.phone || "").trim().slice(0, 30);
    let ok = /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= db.day(0) && d <= db.day(14);
    ok = ok && Number.isInteger(h) && h >= 10 && h <= 20 && name.length >= 2 && phone.replace(/\D/g, "").length >= 6;
    if (!ok) return res.status(400).json({ error: "bad" });
    const rec = JSON.stringify({ name, phone, note: String(b.note || "").slice(0, 800), status: "pending", at: Date.now() });
    const set = await db(["HSETNX", "bk:" + d, String(h), rec]); // 1 — записали, 0 — уже занято
    if (!set) return res.status(409).json({ error: "taken" });
    await db(["EXPIRE", "bk:" + d, "2000000"]);
    // Уведомление в Telegram (необязательно): задайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в Vercel
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      try {
        await fetch("https://api.telegram.org/bot" + process.env.TELEGRAM_BOT_TOKEN + "/sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: "Новая заявка в Барберхан (ждёт подтверждения)\n" + d + ", " + h + ":00\n" + name + ", " + phone + "\n\n" + String(b.note || "").slice(0, 800) }),
        });
      } catch (e) {}
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "server" });
  }
};
