const db = require("./_db");
// GET /api/slots?date=YYYY-MM-DD -> { taken: [10, 12] }
module.exports = async (req, res) => {
  try {
    const d = String(req.query.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return res.status(400).json({ error: "date" });
    const hours = await db(["HKEYS", "bk:" + d]);
    res.setHeader("Cache-Control", "no-store");
    res.json({ taken: (hours || []).map(Number) });
  } catch (e) {
    res.status(500).json({ error: "server" });
  }
};
