const $ = (id) => document.getElementById(id);

let matches = [];
let selectedId = localStorage.getItem("nplCricbuzzMatchId") || "";
let lastPayload = null;

const nplPattern =
  /nepal premier league|\bnpl\b|janakpur bolts|kathmandu gorkhas|chitwan rhinos|pokhara avengers|biratnagar kings|lumbini lions|sudurpaschim royals|sudurpaschim|karnali yaks/i;

function safe(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}

// Convert Cricbuzz's nested response into a flat match list.
function flattenMatches(payload) {
  const root = payload?.data ?? payload;
  const typeMatches = root?.typeMatches || [];
  const result = [];

  for (const typeGroup of typeMatches) {
    for (const seriesGroup of typeGroup.seriesMatches || []) {
      const wrapper = seriesGroup.seriesAdWrapper;
      if (!wrapper) continue;

      const seriesName = wrapper.seriesName || "";

      for (const match of wrapper.matches || []) {
        const info = match.matchInfo;
        if (!info || info.matchId == null) continue;

        result.push({
          id: String(info.matchId),
          matchId: String(info.matchId),
          name: `${info.team1?.teamName || "Team 1"} vs ${info.team2?.teamName || "Team 2"}`,
          matchDesc: info.matchDesc || "",
          matchFormat: info.matchFormat || "",
          series: seriesName,
          seriesName,
          matchType: typeGroup.matchType || "",
          state: info.state || "",
          stateTitle: info.stateTitle || "",
          status: info.status || info.stateTitle || info.state || "",
          venue: [info.venueInfo?.ground, info.venueInfo?.city]
            .filter(Boolean)
            .join(", "),
          startDate: info.startDate || "",
          date: info.startDate
            ? new Date(Number(info.startDate)).toLocaleString()
            : "",
          team1: info.team1?.teamName || "Team 1",
          team2: info.team2?.teamName || "Team 2",
          teams: [info.team1?.teamName, info.team2?.teamName].filter(Boolean),
          team1Score: match.matchScore?.team1Score || {},
          team2Score: match.matchScore?.team2Score || {},
          matchScore: match.matchScore || {},
          currBatTeamId: info.currBatTeamId ?? null,
        });
      }
    }
  }

  // Remove duplicates if a provider response repeats a match.
  return [...new Map(result.map((m) => [m.id, m])).values()];
}

function matchId(match) {
  return String(match.id || match.matchId || "");
}

function matchText(match) {
  return [
    match.name,
    match.seriesName,
    match.series,
    match.matchFormat,
    match.matchType,
    ...match.teams,
  ]
    .filter(Boolean)
    .join(" ");
}

function isNpl(match) {
  return nplPattern.test(matchText(match));
}

function statusKind(match) {
  const state =
    `${match.state || ""} ${match.stateTitle || ""} ${match.status || ""}`.toLowerCase();

  if (/complete|won|draw|tie|abandon|no result|finished/.test(state)) {
    return "finished";
  }

  if (/live|in progress|innings|stumps|break|drinks|lunch|tea/.test(state)) {
    return "live";
  }

  return "upcoming";
}

function inningsScore(score) {
  if (!score) return null;

  const runs = score.runs ?? 0;
  const wickets = score.wickets ?? 0;
  const overs = score.overs ?? "?";

  return `${runs}/${wickets} (${overs} ov)`;
}

function scoreLine(match) {
  const parts = [];

  for (const [teamName, teamScore] of [
    [match.team1, match.team1Score],
    [match.team2, match.team2Score],
  ]) {
    if (!teamScore) continue;

    for (const innings of Object.values(teamScore)) {
      const score = inningsScore(innings);
      if (score) parts.push(`${teamName}: ${score}`);
    }
  }

  return parts.length
    ? parts.join(" · ")
    : match.status || "Score not supplied";
}

function render() {
  const query = $("search").value.trim().toLowerCase();
  const filter = $("filter").value;

  const shown = matches.filter((match) => {
    const searchable = `${matchText(match)} ${match.status}`.toLowerCase();

    return (
      (!query || searchable.includes(query)) &&
      (filter === "all" ||
        (filter === "npl" ? isNpl(match) : statusKind(match) === filter))
    );
  });

  $("matches").innerHTML = shown.length
    ? shown
        .map((match) => {
          const id = matchId(match);
          const kind = statusKind(match);
          const selected = id === selectedId;

          return `
          <button
            class="match w-full text-left ${selected ? "selected" : ""}"
            data-id="${safe(id)}"
          >
            <div class="flex justify-between gap-2 items-start">
              <strong class="text-white text-sm">
                ${safe(match.name)}
              </strong>
              <span class="tag">${kind.toUpperCase()}</span>
            </div>

            <div class="text-amber-300 text-xs font-semibold mt-1">
              ${safe(match.seriesName)}
            </div>

            <div class="text-amber-200 text-sm font-semibold mt-2">
              ${safe(scoreLine(match))}
            </div>

            <div class="muted text-xs mt-2">
              ${safe(match.matchDesc)} · ${safe(match.matchFormat)}
              · ${safe(match.venue)}
            </div>

            <div class="muted text-xs mt-1">
              ${safe(match.status)}
            </div>
          </button>
        `;
        })
        .join("")
    : `
      <div class="muted text-sm p-4">
        No matching Cricbuzz matches found. Try another filter or search.
      </div>
    `;

  document.querySelectorAll("[data-id]").forEach((element) => {
    element.addEventListener("click", () => {
      selectMatch(element.dataset.id);
    });
  });

  updateSelected();
}

function selectMatch(id) {
  selectedId = id;
  localStorage.setItem("nplCricbuzzMatchId", id);
  render();
}

function updateSelected() {
  const match = matches.find((m) => matchId(m) === selectedId);

  $("startBtn").disabled = !match;
  $("copyBtn").disabled = !match;

  if (!match) {
    $("selectedSummary").textContent = "Select a match from the list.";
    $("overlayUrl").value = "";
    $("openBtn").href = "#";
    $("openBtn").classList.add("opacity-40", "pointer-events-none");
    return;
  }

  $("selectedSummary").innerHTML = `
    <div class="text-white font-bold">${safe(match.name)}</div>
    <div class="text-amber-300 text-xs mt-1">${safe(match.seriesName)}</div>
    <div class="text-amber-200 mt-2">${safe(scoreLine(match))}</div>
    <div class="muted text-xs mt-2">
      ${safe(match.status)} · ${safe(match.venue)}
    </div>
    <div class="muted text-xs mt-2">
      Cricbuzz Match ID: ${safe(match.id)}
    </div>
  `;

  const interval = Number($("interval").value || 900);

  const url = `${location.origin}/overlay.html?matchId=${encodeURIComponent(selectedId)}&refresh=${interval}`;

  $("overlayUrl").value = url;
  $("openBtn").href = url;
  $("openBtn").classList.remove("opacity-40", "pointer-events-none");
}

async function loadMatches() {
  $("providerStatus").textContent = "FETCHING";
  $("connectionText").textContent =
    "Requesting matches from Cricbuzz via API.market…";

  $("refreshBtn").disabled = true;

  try {
    const response = await fetch("/api/cricbuzz-matches?type=live", {
      cache: "no-store",
    });

    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Cricbuzz API request failed");
    }

    lastPayload = payload;
    matches = flattenMatches(payload);

    $("providerStatus").textContent = "CRICBUZZ CONNECTED";
    $("providerStatus").style.background = "#064e3b";
    $("providerStatus").style.color = "#a7f3d0";

    $("connectionText").textContent =
      `Connected to Cricbuzz via API.market. ${matches.length} matches returned. Last checked ${new Date(payload.fetchedAt).toLocaleTimeString()}.`;

    $("quota").textContent =
      "Match list supplied by Cricbuzz. API.market usage depends on your provider plan.";

    // Restore saved selection if it is still in the returned list.
    if (selectedId && !matches.some((m) => matchId(m) === selectedId)) {
      selectedId = "";
      localStorage.removeItem("nplCricbuzzMatchId");
    }

    // Automatically select an NPL match when no selection exists.
    if (!selectedId) {
      const npl = matches.find(isNpl);
      if (npl) {
        selectedId = matchId(npl);
        localStorage.setItem("nplCricbuzzMatchId", selectedId);
      }
    }

    render();
  } catch (error) {
    $("providerStatus").textContent = "NOT CONNECTED";
    $("connectionText").textContent = error.message;

    $("matches").innerHTML = `
      <div class="text-rose-300 text-sm p-4">
        ${safe(error.message)}
        <p class="muted mt-2">
          Check API_MARKET_KEY in your Vercel environment variables
          and confirm the Cricbuzz match-list endpoint is working.
        </p>
      </div>
    `;

    $("quota").textContent = "";
  } finally {
    $("refreshBtn").disabled = false;
  }
}

$("refreshBtn").addEventListener("click", loadMatches);
$("search").addEventListener("input", render);
$("filter").addEventListener("change", render);
$("interval").addEventListener("change", updateSelected);

$("startBtn").addEventListener("click", () => {
  if (selectedId) {
    window.open($("overlayUrl").value, "_blank", "noopener");
  }
});

$("copyBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("overlayUrl").value);
    $("copyBtn").textContent = "Copied ✓";
    setTimeout(() => {
      $("copyBtn").textContent = "Copy URL";
    }, 1600);
  } catch {
    $("overlayUrl").select();
    document.execCommand("copy");
  }
});

loadMatches();
