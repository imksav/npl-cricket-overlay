(() => {
  const params = new URLSearchParams(location.search);
  const matchId = params.get("matchId");

  // Without a match ID, the original manual overlay remains active.
  if (!matchId) return;

  document.body.classList.add("api-mode");

  const notice = document.getElementById("apiOverlayNotice");
  const consoleBox = document.getElementById("manualScoringConsole");

  if (notice) notice.style.display = "block";
  if (consoleBox) consoleBox.style.display = "none";

  const headerControls = document.querySelector("header > div:last-child");
  if (headerControls) headerControls.style.display = "none";

  const refreshMs = Math.max(
    60000,
    Math.min(3600000, Number(params.get("refresh") || 900) * 1000),
  );

  const $ = (id) => document.getElementById(id);

  const set = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value ?? "—";
  };

  const number = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const short = (name) =>
    String(name || "TBD")
      .split(/\s+/)
      .map((word) => word[0] || "")
      .join("")
      .slice(0, 3)
      .toUpperCase();

  const display = (value, fallback = "—") =>
    value !== undefined && value !== null && value !== ""
      ? String(value)
      : fallback;

  function formatOvers(value) {
    const overs = display(value, "0");
    return overs.endsWith("ov") ? `(${overs})` : `(${overs} ov)`;
  }

  function getInnings(payload) {
    return payload?.data?.scorecard?.scorecard || [];
  }

  function getMiniScore(payload) {
    return (
      payload?.data?.commentary?.miniscore ||
      payload?.data?.overs?.miniscore ||
      null
    );
  }

  function getHeaders(payload) {
    return (
      payload?.data?.commentary?.matchheaders ||
      payload?.data?.overs?.matchheaders ||
      {}
    );
  }

  function getCurrentInnings(inningsList, miniScore) {
    const inningsId = miniScore?.inningsid;

    return (
      inningsList.find(
        (innings) => String(innings.inningsid) === String(inningsId),
      ) ||
      inningsList[inningsList.length - 1] ||
      null
    );
  }

  function getCurrentScore(miniScore, innings) {
    const scores = miniScore?.inningsscores?.inningsscore || [];

    const current = scores.find(
      (item) => String(item.inningsid) === String(miniScore?.inningsid),
    );

    return current || null;
  }

  function getTeamName(details, innings, headers, teamNumber) {
    const team =
      details?.[`team${teamNumber}`] || headers?.[`team${teamNumber}`];

    return team?.teamname || team?.teamName || team?.teamsname || "";
  }

  function getBowlingTeam(details, current, previous, headers) {
    const battingName = String(
      current?.batteamname || current?.batteamsname || "",
    ).toLowerCase();

    const team1 = getTeamName(details, current, headers, 1);
    const team2 = getTeamName(details, current, headers, 2);

    if (team1 && battingName && team1.toLowerCase() === battingName) {
      return team2 || previous?.batteamname || "Bowling Team";
    }

    if (team2 && battingName && team2.toLowerCase() === battingName) {
      return team1 || previous?.batteamname || "Bowling Team";
    }

    return previous?.batteamname || previous?.batteamsname || "Bowling Team";
  }

  function playerValue(player, ...keys) {
    for (const key of keys) {
      if (
        player?.[key] !== undefined &&
        player?.[key] !== null &&
        player?.[key] !== ""
      ) {
        return player[key];
      }
    }

    return "—";
  }

  function getCommentaryEntries(payload) {
    return (payload?.data?.commentary?.comwrapper || [])
      .map((item) => item?.commentary)
      .filter((item) => item?.commtxt);
  }

  function renderCommentary(payload, status) {
    const container = $("liveCommentaryFeedBox");
    if (!container) return;

    const entries = getCommentaryEntries(payload).slice(0, 8);

    container.replaceChildren();

    if (!entries.length) {
      container.textContent = status || "Commentary unavailable";
      return;
    }

    entries.forEach((entry) => {
      const item = document.createElement("div");

      const over = document.createElement("strong");
      over.textContent =
        entry.overnum !== undefined ? `Over ${entry.overnum} ` : "";

      const message = document.createElement("span");
      message.textContent = display(entry.commtxt, "");

      item.append(over, message);
      container.appendChild(item);
    });
  }

  function getOverEntries(payload, inningsId) {
    return (payload?.data?.overs?.overseplist?.oversep || [])
      .filter((entry) => String(entry.inningsid) === String(inningsId))
      .sort((a, b) => number(b.timestamp) - number(a.timestamp));
  }

  function renderOverInformation(payload, miniScore, current, status) {
    const entries = getOverEntries(payload, miniScore?.inningsid);

    const latest = entries[0] || null;

    if (!latest) {
      set("prevOverText", "Over information unavailable");
      set("currentOverNumLabel", "—");
      set("currentOverRunsTotal", "—");
      set("currentOverBallsContainer", "Ball-by-ball information unavailable");
      return;
    }

    const summary = display(latest.oversummary, "");
    const overNumber = display(latest.overnum);

    set("currentOverNumLabel", overNumber);
    set("currentOverRunsTotal", latest.runs ?? "—");

    const balls = $("currentOverBallsContainer");

    if (balls) {
      // Use textContent: provider data is never inserted as HTML.
      balls.textContent = summary || "Ball-by-ball details unavailable";
    }

    const previous = entries.find(
      (entry) => number(entry.overnum) < number(latest.overnum),
    );

    set(
      "prevOverText",
      previous
        ? `Over ${previous.overnum}: ${display(previous.oversummary, "—")}`
        : "Previous over unavailable",
    );

    if (/won|draw|tie|no result|abandon|complete|finished/i.test(status)) {
      set("currentOverNumLabel", "FINAL");
    }
  }

  function renderScorecardSummary(current) {
    if (!current) return;

    const fowList = current.fow?.fow || [];

    if (fowList.length) {
      const latestWicket = fowList[fowList.length - 1];

      set(
        "lastWicketText",
        `${latestWicket.batsmanname || "Wicket"} — ${latestWicket.runs}/${fowList.length} (${latestWicket.overnbr} ov)`,
      );
    } else {
      set("lastWicketText", "No wickets recorded");
    }

    set("extrasTotalCount", current.extras?.total ?? "—");
  }

  function render(payload) {
    const data = payload?.data || {};

    const details = data.details || {};
    const headers = getHeaders(payload);
    const miniScore = getMiniScore(payload);
    const inningsList = getInnings(payload);
    const scorecardStatus = data.scorecard?.status || "";
    const status =
      headers.status ||
      headers.state ||
      details.status ||
      details.state ||
      scorecardStatus ||
      "Scorecard available";

    if (!inningsList.length) {
      throw new Error("No innings scorecard was returned by Cricbuzz.");
    }

    const current = getCurrentInnings(inningsList, miniScore);

    if (!current) {
      throw new Error("Unable to identify the current innings.");
    }

    const currentIndex = inningsList.indexOf(current);
    const previous = currentIndex > 0 ? inningsList[currentIndex - 1] : null;

    const currentScore = getCurrentScore(miniScore, current);

    const batting =
      current.batteamname || current.batteamsname || "Batting Team";

    const bowling = getBowlingTeam(details, current, previous, headers);

    const runs = number(currentScore?.runs ?? current.score);
    const wickets = number(currentScore?.wickets ?? current.wickets);
    const overs = currentScore?.overs ?? current.overs;

    const completed =
      data.scorecard?.ismatchcomplete === true ||
      /won|draw|tie|no result|abandon|complete|finished/i.test(status);

    const matchName =
      details.matchdesc || details.seriesname || "Cricket Match";

    const format = details.matchformat || headers.matchformat || "CRICKET";

    const venue = details.venueinfo || {};

    // Match header.
    set("headerMatchTitle", matchName);
    set("headerMatchType", String(format).toUpperCase());

    set(
      "matchNumberLabel",
      `${details.seriesname || "Cricket"} • ${details.matchdesc || ""}`,
    );

    set(
      "venueLabel",
      [venue.ground, venue.city, venue.country].filter(Boolean).join(", ") ||
        "Venue not supplied",
    );

    const toss = headers.tossresults;

    set(
      "tossLabel",
      toss?.tosswinnername
        ? `${toss.tosswinnername} won the toss and chose to ${String(
            toss.decision || "—",
          ).toLowerCase()}`
        : "Toss information unavailable",
    );

    // Teams and score.
    set("inningsBadge", batting);
    set("battingTeamName", batting);
    set("battingTeamShort", short(batting));
    set("bowlingTeamName", bowling);
    set("bowlingTeamShort", short(bowling));

    set("teamScore", `${runs}-${wickets}`);
    set("teamOvers", formatOvers(overs));

    set("matchStateHeader", completed ? "FINAL" : "LIVE");
    set("targetEquationBox", status);

    set("bowlingTeamSummary", `${inningsList.length} innings recorded`);

    // Current batters: use miniscore, not scorecard ordering.
    const striker = miniScore?.batsmanstriker;
    const nonStriker = miniScore?.batsmannonstriker;

    const batterFields = [
      ["striker", striker],
      ["nonStriker", nonStriker],
    ];

    batterFields.forEach(([prefix, player]) => {
      if (!player) {
        set(`${prefix}Name`, "Batter information unavailable");

        ["Runs", "Balls", "4s", "6s", "SR"].forEach((field) =>
          set(`${prefix}${field}`, "—"),
        );

        return;
      }

      set(`${prefix}Name`, player.name);
      set(`${prefix}Runs`, player.runs);
      set(`${prefix}Balls`, player.balls);
      set(`${prefix}4s`, player.fours);
      set(`${prefix}6s`, player.sixes);
      set(`${prefix}SR`, player.strkrate);
    });

    // Current bowler: use miniscore.
    const bowler = miniScore?.bowlerstriker;

    if (bowler) {
      set("bowlerName", bowler.name);
      set("bowlerWickets", bowler.wickets);
      set("bowlerRunsConceded", bowler.runs);
      set("bowlerOvers", bowler.overs);
      set("bowlerEcon", bowler.economy);
      set("bowlerDots", "—");
    } else {
      set("bowlerName", "Bowler information unavailable");

      [
        "bowlerWickets",
        "bowlerRunsConceded",
        "bowlerOvers",
        "bowlerEcon",
        "bowlerDots",
      ].forEach((id) => set(id, "—"));
    }

    // Target and required run rate.
    const target = number(miniScore?.target, 0);
    const required = target > 0 ? Math.max(0, target - runs) : null;

    set(
      "targetEquationBox",
      target > 0
        ? `${required} runs required • RRR ${display(miniScore?.rrr)}`
        : status,
    );

    // Wickets, extras and over information.
    set("lastWicketText", miniScore?.lastwkt || "No wicket information");
    renderScorecardSummary(current);

    // Prefer the live mini-score's last-wicket information.
    if (miniScore?.lastwkt) {
      set("lastWicketText", miniScore.lastwkt);
    }

    renderOverInformation(payload, miniScore, current, status);
    renderCommentary(payload, status);

    // Match officials.
    const officials = [
      details.umpire1?.name,
      details.umpire2?.name,
      details.umpire3?.name,
      details.referee?.name,
    ].filter(Boolean);

    if (officials.length) {
      const currentVenue = [venue.ground, venue.city, venue.country]
        .filter(Boolean)
        .join(", ");

      set(
        "venueLabel",
        `${currentVenue || "Venue unavailable"} • Officials: ${officials.join(", ")}`,
      );
    }

    // API notice.
    if (notice) {
      notice.textContent = `CRICBUZZ API • ${new Date(
        payload.fetchedAt || Date.now(),
      ).toLocaleTimeString()} • ${status}`;
    }

    document.title = `${matchName} | Broadcast Overlay`;
  }

  let requestInProgress = false;

  async function update() {
    if (requestInProgress) return;

    requestInProgress = true;

    try {
      const response = await fetch(
        `/api/match-data?matchId=${encodeURIComponent(matchId)}`,
        { cache: "no-store" },
      );

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Cricbuzz match data unavailable");
      }

      render(payload);
    } catch (error) {
      console.error("Cricbuzz overlay error:", error);

      if (notice) {
        notice.textContent = `CRICBUZZ FEED ISSUE • ${error.message}`;
      }

      set("matchStateHeader", "FEED ISSUE");
      set("liveCommentaryFeedBox", error.message);
    } finally {
      requestInProgress = false;
    }
  }

  update();
  setInterval(update, refreshMs);
})();
