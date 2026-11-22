// Мини-клиент Upstash Redis (REST). Переменные окружения добавляет интеграция Upstash в Vercel.
const U = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const T = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
async function db(cmd) {
  const r = await fetch(U, { method: "POST", headers: { Authorization: "Bearer " + T }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
// Дата «сегодня + i дней» по времени Уфы (UTC+5), формат YYYY-MM-DD
db.day = function (i) {
  return new Date(Date.now() + 5 * 3600e3 + i * 864e5).toISOString().slice(0, 10);
};
module.exports = db;
