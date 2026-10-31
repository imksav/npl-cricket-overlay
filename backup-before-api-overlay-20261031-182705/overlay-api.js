(() => {
  const params = new URLSearchParams(location.search);
  const matchId = params.get("matchId");

  // No match ID means the original manual overlay remains active.
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

  const short = (name) =>
    String(name || "TBD")
      .split(/\s+/)
      .map((word) => word[0])
      .join("")
      .slice(0, 3)
      .toUpperCase();

  const number = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  function formatOvers(value) {
    const overs = String(value ?? "0");
    return overs.endsWith("ov") ? `(${overs})` : `(${overs} ov)`;
  }

  function getScorecard(payload) {
    const root = payload?.data ?? payload;

    if (Array.isArray(root?.scorecard)) {
      return root.scorecard;
    }

    if (Array.isArray(root?.scoreCard)) {
      return root.scoreCard;
    }

    if (Array.isArray(root?.scorecard?.innings)) {
      return root.scorecard.innings;
    }

    return [];
  }

  function getMatchStatus(payload) {
    const root = payload?.data ?? payload;

    return (
      root?.status ||
      root?.matchHeader?.status ||
      root?.matchHeader?.state ||
      root?.matchInfo?.status ||
      "Scorecard available"
    );
  }

  function getMatchName(payload, innings) {
    const root = payload?.data ?? payload;
    const header = root?.matchHeader || root?.matchInfo || {};

    return (
      header?.matchDescription ||
      header?.matchDesc ||
      header?.matchTitle ||
      header?.seriesName ||
      (innings.length
        ? `${innings[0].batteamname || innings[0].batteamsname || "Cricket"} Match`
        : "Cricket Match")
    );
  }

  function getBatters(innings) {
    return Array.isArray(innings?.batsman)
      ? innings.batsman
      : Array.isArray(innings?.batter)
        ? innings.batter
        : [];
  }

  function getBowlers(innings) {
    return Array.isArray(innings?.bowler)
      ? innings.bowler
      : Array.isArray(innings?.bowling)
        ? innings.bowling
        : [];
  }

  function getPlayerName(player) {
    return (
      player?.name ||
      player?.batName ||
      player?.bowlName ||
      player?.playerName ||
      "Unknown"
    );
  }

  function getPlayerValue(player, ...keys) {
    for (const key of keys) {
      if (player?.[key] !== undefined && player?.[key] !== null) {
        return player[key];
      }
    }
    return "—";
  }

  function getCurrentBatters(innings) {
    const batters = getBatters(innings);

    if (!batters.length) return [];

    const active = batters.filter((player) => {
      const dismissal = String(
        player?.outdec || player?.outDesc || player?.dismissal || "",
      ).toLowerCase();

      return (
        player?.isstriker === true ||
        player?.isStriker === true ||
        player?.isOnStrike === true ||
        player?.isbatting === true ||
        player?.isBatting === true ||
        dismissal === "not out" ||
        dismissal === "batting"
      );
    });

    return active.length ? active : batters;
  }

  function render(payload) {
    const inningsList = getScorecard(payload);
    const status = getMatchStatus(payload);
    const root = payload?.data ?? payload;

    if (!inningsList.length) {
      throw new Error(
        "Cricbuzz returned a response, but no innings scorecard was found.",
      );
    }

    // The last innings is normally the latest innings in the scorecard.
    const current = inningsList[inningsList.length - 1];

    const batting =
      current.batteamname ||
      current.batteamsname ||
      current.teamName ||
      "Batting Team";

    const previous =
      inningsList.length > 1 ? inningsList[inningsList.length - 2] : null;

    const bowling =
      previous?.batteamname || previous?.batteamsname || "Bowling Team";

    const runs = number(current.score);
    const wickets = number(current.wickets);
    const overs = current.overs ?? "—";

    const matchName = getMatchName(payload, inningsList);

    const completed = /won|draw|tie|no result|abandon|complete|finished/i.test(
      status,
    );

    const batters = getCurrentBatters(current);
    const bowlers = getBowlers(current);

    // Match header.
    set("headerMatchTitle", matchName);
    set(
      "headerMatchType",
      String(
        root?.matchHeader?.matchFormat || root?.matchFormat || "CRICKET",
      ).toUpperCase(),
    );

    set(
      "matchNumberLabel",
      root?.matchHeader?.matchDescription ||
        root?.matchHeader?.matchDesc ||
        "CRICKET MATCH",
    );

    set(
      "venueLabel",
      root?.matchHeader?.venueInfo?.ground ||
        root?.matchHeader?.venueInfo?.city ||
        root?.venueInfo?.ground ||
        "Venue not supplied",
    );

    set(
      "tossLabel",
      root?.matchHeader?.tossResults?.tossWinnerName
        ? `${root.matchHeader.tossResults.tossWinnerName} won the toss`
        : "Toss information not supplied",
    );

    // Team and score.
    set(
      "inningsBadge",
      current.batteamname || current.batteamsname || "CURRENT INNINGS",
    );
    set("battingTeamName", batting);
    set("battingTeamShort", short(batting));
    set("bowlingTeamName", bowling);
    set("bowlingTeamShort", short(bowling));

    set("teamScore", `${runs}-${wickets}`);
    set("teamOvers", formatOvers(overs));

    set("matchStateHeader", completed ? "FINAL" : "LIVE");
    set("targetEquationBox", status);

    set(
      "bowlingTeamSummary",
      inningsList.length > 1
        ? `${inningsList.length} innings recorded`
        : "First innings",
    );

    // Batter statistics.
    const striker = batters[0];
    const nonStriker = batters[1];

    if (striker) {
      set("strikerName", getPlayerName(striker));
      set("strikerRuns", getPlayerValue(striker, "runs", "run"));
      set("strikerBalls", getPlayerValue(striker, "balls", "ball"));
      set("striker4s", getPlayerValue(striker, "fours", "four"));
      set("striker6s", getPlayerValue(striker, "sixes", "six"));
      set("strikerSR", getPlayerValue(striker, "strkrate", "strikeRate", "sr"));
    } else {
      set("strikerName", "Batter information unavailable");
      [
        "strikerRuns",
        "strikerBalls",
        "striker4s",
        "striker6s",
        "strikerSR",
      ].forEach((id) => set(id, "—"));
    }

    if (nonStriker) {
      set("nonStrikerName", getPlayerName(nonStriker));
      set("nonStrikerRuns", getPlayerValue(nonStriker, "runs", "run"));
      set("nonStrikerBalls", getPlayerValue(nonStriker, "balls", "ball"));
      set("nonStriker4s", getPlayerValue(nonStriker, "fours", "four"));
      set("nonStriker6s", getPlayerValue(nonStriker, "sixes", "six"));
      set(
        "nonStrikerSR",
        getPlayerValue(nonStriker, "strkrate", "strikeRate", "sr"),
      );
    } else {
      set("nonStrikerName", "Second batter unavailable");
      [
        "nonStrikerRuns",
        "nonStrikerBalls",
        "nonStriker4s",
        "nonStriker6s",
        "nonStrikerSR",
      ].forEach((id) => set(id, "—"));
    }

    // Bowler statistics.
    const bowler = bowlers[0];

    if (bowler) {
      set("bowlerName", getPlayerName(bowler));
      set("bowlerWickets", getPlayerValue(bowler, "wickets", "wkts"));
      set("bowlerRunsConceded", getPlayerValue(bowler, "runs", "runsConceded"));
      set("bowlerOvers", getPlayerValue(bowler, "overs", "ov"));
      set("bowlerEcon", getPlayerValue(bowler, "economy", "econ"));
      set("bowlerDots", "—");
    } else {
      set("bowlerName", "Bowler information unavailable");
      [
        "bowlerWickets",
        "bowlerRunsConceded",
        "bowlerOvers",
        "bowlerDots",
        "bowlerEcon",
      ].forEach((id) => set(id, "—"));
    }

    // Current-over and ball-by-ball data are not supplied by the scorecard endpoint.
    set("prevOverText", "Ball-by-ball feed unavailable");
    set("lastWicketText", current.fow?.fow || "Not supplied by scorecard");
    set("currentOverNumLabel", "—");
    set("currentOverRunsTotal", "—");
    set("extrasTotalCount", current.extras?.total ?? "—");

    const balls = $("currentOverBallsContainer");

    if (balls) {
      balls.textContent =
        "Ball-by-ball information is not included in this scorecard response.";
    }

    set("liveCommentaryFeedBox", status);

    // Update the notice.
    if (notice) {
      notice.textContent = `CRICBUZZ SCORECARD • ${new Date(payload.fetchedAt || Date.now()).toLocaleTimeString()} • ${status}`;
    }

    document.title = `${matchName} | Broadcast Overlay`;
  }

  let requestInProgress = false;

  async function update() {
    if (requestInProgress) return;

    requestInProgress = true;

    try {
      const response = await fetch(
        `/api/scorecard?matchId=${encodeURIComponent(matchId)}`,
        { cache: "no-store" },
      );

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Cricbuzz scorecard API unavailable");
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
