export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  const matchId = String(req.query.matchId || "");

  if (!/^\d+$/.test(matchId)) {
    return res.status(400).json({
      ok: false,
      error: "A valid Cricbuzz matchId is required",
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

  const base = "https://prod.api.market/api/v1/api-provider/cricbuzz-cricket";

  const endpoints = {
    details: `/mcenter/v1/${matchId}`,
    commentary: `/mcenter/v1/${matchId}/comm`,
    overs: `/mcenter/v1/${matchId}/overs`,
    scorecard: `/mcenter/v1/${matchId}/scard`,
  };

  async function fetchEndpoint(path) {
    const response = await fetch(`${base}${path}`, {
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
      throw new Error("Provider returned invalid JSON");
    }

    if (!response.ok) {
      throw new Error(
        `Provider returned HTTP ${response.status}: ${
          data?.message || data?.error || "Request failed"
        }`,
      );
    }

    return data;
  }

  try {
    // Retrieve all four endpoints concurrently.
    const results = await Promise.allSettled(
      Object.entries(endpoints).map(async ([key, path]) => ({
        key,
        data: await fetchEndpoint(path),
      })),
    );

    const data = {};
    const errors = {};

    results.forEach((result, index) => {
      const key = Object.keys(endpoints)[index];

      if (result.status === "fulfilled") {
        data[key] = result.value.data;
      } else {
        data[key] = null;
        errors[key] = result.reason?.message || "Request failed";
      }
    });

    // Match details and scorecard are the essential sources.
    const essentialAvailable = Boolean(data.details) || Boolean(data.scorecard);

    if (!essentialAvailable) {
      return res.status(502).json({
        ok: false,
        error: "Unable to retrieve match details or scorecard",
        errors,
      });
    }

    return res.status(200).json({
      ok: true,
      provider: "Cricbuzz via API.market",
      matchId,
      fetchedAt: new Date().toISOString(),

      data,

      errors: Object.keys(errors).length ? errors : null,
    });
  } catch (error) {
    console.error("Combined match data error:", error);

    return res.status(error.name === "TimeoutError" ? 504 : 502).json({
      ok: false,
      error:
        error.name === "TimeoutError"
          ? "Cricbuzz provider request timed out"
          : "Unable to retrieve Cricbuzz match data",
    });
  }
}
