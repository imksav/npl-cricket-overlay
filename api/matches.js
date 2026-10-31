const BASE = (
  process.env.CRICKET_API_BASE_URL || "https://api.cricapi.com/v1"
).replace(/\/$/, "");

const ENDPOINT = process.env.CRICKET_API_MATCHES_ENDPOINT || "currentMatches";

function send(res, status, body) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=45, stale-while-revalidate=120");
  return res.status(status).json(body);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET")
    return send(res, 405, { ok: false, error: "Method not allowed" });
  const key = process.env.CRICKET_API_KEY;
  if (!key)
    return send(res, 503, {
      ok: false,
      code: "MISSING_API_KEY",
      error:
        "CRICKET_API_KEY is not configured. Add it in Vercel Environment Variables.",
    });
  const url = new URL(`${BASE}/${encodeURIComponent(ENDPOINT)}`);
  url.searchParams.set("apikey", key);
  url.searchParams.set("offset", "0");
  try {
    const upstream = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    const raw = await upstream.json();
    if (!upstream.ok || raw.status === "failure" || raw.status === "error") {
      return send(res, upstream.status >= 400 ? upstream.status : 502, {
        ok: false,
        error: raw.reason || raw.message || "CricketData API returned an error",
        provider: "CricketData.org",
      });
    }
    const matches = Array.isArray(raw.data) ? raw.data : [];
    return send(res, 200, {
      ok: true,
      provider: "CricketData.org",
      fetchedAt: new Date().toISOString(),
      hitsUsed: raw.info?.hitsUsed ?? raw.hitsUsed ?? null,
      hitsLimit: raw.info?.hitsLimit ?? raw.hitsLimit ?? 100,
      count: matches.length,
      matches,
    });
  } catch (error) {
    return send(res, 502, {
      ok: false,
      error:
        error.name === "TimeoutError"
          ? "CricketData API timed out"
          : "Could not reach CricketData API",
    });
  }
};
