export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  const matchId = req.query.matchId;

  if (!matchId || !/^\d+$/.test(String(matchId))) {
    return res.status(400).json({
      ok: false,
      error: "A valid matchId is required",
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

  const url = `https://prod.api.market/api/v1/api-provider/cricbuzz-cricket/mcenter/v1/${matchId}/scard`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-api-market-key": apiKey,
      },
      signal: AbortSignal.timeout(15000),
    });

    const responseText = await response.text();

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      return res.status(502).json({
        ok: false,
        error: "The cricket provider returned an invalid JSON response",
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: "Cricbuzz API request failed",
        providerStatus: response.status,
        details: data,
      });
    }

    return res.status(200).json({
      ok: true,
      provider: "Cricbuzz via API.market",
      matchId: String(matchId),
      fetchedAt: new Date().toISOString(),
      data,
    });
  } catch (error) {
    console.error("Scorecard API error:", error);

    return res.status(error.name === "TimeoutError" ? 504 : 502).json({
      ok: false,
      error:
        error.name === "TimeoutError"
          ? "Cricket provider request timed out"
          : "Unable to retrieve scorecard",
    });
  }
}
