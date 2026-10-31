const BASE = "https://prod.api.market/api/v1/api-provider/cricbuzz-cricket";

const ALLOWED_TYPES = ["live", "recent", "upcoming"];

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  const apiKey = process.env.API_MARKET_KEY;

  if (!apiKey) {
    return res.status(503).json({
      ok: false,
      code: "MISSING_API_KEY",
      error: "API_MARKET_KEY is not configured",
    });
  }

  const type = String(req.query.type || "live").toLowerCase();

  if (!ALLOWED_TYPES.includes(type)) {
    return res.status(400).json({
      ok: false,
      error: "Type must be live, recent or upcoming",
    });
  }

  const url = `${BASE}/matches/v1/${type}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-api-market-key": apiKey,
      },
      signal: AbortSignal.timeout(15000),
    });

    const raw = await response.text();

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      return res.status(502).json({
        ok: false,
        error: "Cricbuzz returned an invalid JSON response",
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: "Cricbuzz match-list request failed",
        providerStatus: response.status,
        details: data,
      });
    }

    return res.status(200).json({
      ok: true,
      provider: "Cricbuzz via API.market",
      type,
      fetchedAt: new Date().toISOString(),
      data,
    });
  } catch (error) {
    console.error("Cricbuzz match-list error:", error);

    return res.status(error.name === "TimeoutError" ? 504 : 502).json({
      ok: false,
      error:
        error.name === "TimeoutError"
          ? "Cricbuzz request timed out"
          : "Unable to retrieve Cricbuzz matches",
    });
  }
}
