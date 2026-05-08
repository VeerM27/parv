import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabase";

const ADMIN_PIN = "27112004@";
const ADMIN_SESSION_KEY = "kpl-admin-session";

const TEAMS = {
  GG: {
    name: "Golden Gladiators",
    short: "GOLDEN GLADIATORS",
    abbr: "GG",
    primary: "#F5B800",
    glow: "rgba(245,184,0,0.45)",
    soft: "rgba(245,184,0,0.08)",
    border: "rgba(245,184,0,0.25)",
    captain: "Sabu",
    viceCaptain: "Rachit",
    players: ["Charvi", "Hiten", "Khusagra", "Manya", "Adwit"],
    logo: "/logos/gg.png",
  },
  MS: {
    name: "Mumbai Strikers",
    short: "MUMBAI STRIKERS",
    abbr: "MS",
    primary: "#3B9DFF",
    glow: "rgba(59,157,255,0.45)",
    soft: "rgba(59,157,255,0.08)",
    border: "rgba(59,157,255,0.28)",
    captain: "Sparsh",
    viceCaptain: "Parv",
    players: ["Vivaan", "Sharvin", "Kiaan", "Dhriti", "Kabir"],
    logo: "/logos/ms.png",
  },
  MC: {
    name: "Manhattan Challengers",
    short: "MANHATTAN CHALLENGERS",
    abbr: "MC",
    primary: "#A855F7",
    glow: "rgba(168,85,247,0.45)",
    soft: "rgba(168,85,247,0.08)",
    border: "rgba(168,85,247,0.28)",
    captain: "Shreesay",
    viceCaptain: "Prish",
    players: ["Sanvika", "Ajinkya", "Ovi", "Sharanya", "Udbhav"],
    logo: "/logos/mc.png",
  },
};

const SCHEDULE = [
  { id: 1, a: "GG", b: "MS" },
  { id: 2, a: "MC", b: "GG" },
  { id: 3, a: "MS", b: "MC" },
  { id: 4, a: "GG", b: "MS" },
  { id: 5, a: "MC", b: "GG" },
  { id: 6, a: "MS", b: "MC" },
];

const STORAGE_KEY = "rrk-tournament-v1";
const LIVE_KEY = "rrk-live-v2";
const blankMatch = (m) => ({
  id: m.id,
  a: m.a,
  b: m.b,
  status: "upcoming",
  result: null,
  aRuns: "",
  aWickets: "",
  aOvers: "",
  bRuns: "",
  bWickets: "",
  bOvers: "",
});

const allPlayers = (teamKey) => {
  const t = TEAMS[teamKey];
  return [t.captain, t.viceCaptain, ...t.players];
};

const initLiveScore = (matchId, battingKey, fieldingKey, totalOvers = 6) => ({
  matchId,
  battingKey,
  fieldingKey,
  totalOvers,
  innings: 1,
  firstInnings: null,
  target: null,
  matchResult: null,
  runs: 0,
  wickets: 0,
  completedOvers: 0,
  ballsInOver: 0,
  striker: null,
  nonStriker: null,
  currentBowler: null,
  batting: {},
  bowling: {},
  currentOverLog: [],
  overHistory: [],
  extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
  fallOfWickets: [],
  partnership: { runs: 0, balls: 0 },
  pendingAction: "setup",
  overEndedWithWicket: false,
  history: [],
});

const getBallSymbol = (ev) => {
  if (ev.type === "wide") return ev.extraRuns > 0 ? `Wd+${ev.extraRuns}` : "Wd";
  if (ev.type === "noball") return ev.runs > 0 ? `Nb+${ev.runs}` : "Nb";
  if (ev.type === "bye") return `B${ev.runs}`;
  if (ev.type === "legbye") return `Lb${ev.runs}`;
  if (ev.type === "wicket") return "W";
  if (ev.runs === 0) return "•";
  return String(ev.runs);
};

const processBall = (score, event) => {
  const s = JSON.parse(JSON.stringify(score));
  s.history = s.history || [];
  s.history.push(JSON.parse(JSON.stringify(score)));
  if (s.history.length > 100) s.history = s.history.slice(-100);

  const isLegal = event.type !== "wide" && event.type !== "noball";
  const batRuns =
    event.type === "bye" ||
    event.type === "legbye" ||
    event.type === "wicket" ||
    event.type === "wide" ||
    event.type === "noball"
      ? 0
      : event.runs || 0;
  const totalRunsThisBall =
    event.type === "wide"
      ? 1 + (event.extraRuns || 0)
      : event.type === "noball"
        ? 1 + (event.runs || 0)
        : event.runs || 0;

  s.runs += totalRunsThisBall;
  // 2nd innings: check if chasing team reached target immediately
  const targetReached = () =>
    s.innings === 2 && s.target !== null && s.runs >= s.target;
  if (event.type === "wide") s.extras.wides += 1 + (event.extraRuns || 0);
  if (event.type === "noball") s.extras.noBalls += 1;
  if (event.type === "bye") s.extras.byes += event.runs || 0;
  if (event.type === "legbye") s.extras.legByes += event.runs || 0;

  if (s.striker && event.type !== "wide") {
    if (!s.batting[s.striker])
      s.batting[s.striker] = { runs: 0, balls: 0, fours: 0, sixes: 0 };
    const bat = s.batting[s.striker];
    if (isLegal) bat.balls++;
    bat.runs += batRuns;
    if (batRuns === 4) bat.fours++;
    if (batRuns === 6) bat.sixes++;
  }

  if (s.currentBowler) {
    if (!s.bowling[s.currentBowler])
      s.bowling[s.currentBowler] = { overs: 0, balls: 0, runs: 0, wickets: 0 };
    const bowl = s.bowling[s.currentBowler];
    bowl.runs += totalRunsThisBall;
    if (event.type === "wicket" && event.dismissal !== "run out")
      bowl.wickets++;
    if (isLegal) {
      bowl.balls++;
      if (bowl.balls === 6) {
        bowl.overs++;
        bowl.balls = 0;
      }
    }
  }

  if (isLegal) {
    s.partnership.balls++;
    s.partnership.runs += batRuns;
  }
  s.currentOverLog.push(getBallSymbol(event));

  if (event.type === "wicket") {
    s.wickets++;
    if (!s.batting[s.striker])
      s.batting[s.striker] = { runs: 0, balls: 0, fours: 0, sixes: 0 };
    s.batting[s.striker].dismissal = event.dismissal;
    s.batting[s.striker].dismissedBy =
      event.dismissal !== "run out" ? s.currentBowler : null;
    s.batting[s.striker].fielder = event.fielder || null;
    s.fallOfWickets.push({
      wicket: s.wickets,
      runs: s.runs,
      over: `${s.completedOvers}.${s.ballsInOver + 1}`,
      batsman: s.striker,
    });
    s.partnership = { runs: 0, balls: 0 };
  }

  if (isLegal && event.type !== "wicket" && batRuns % 2 === 1) {
    [s.striker, s.nonStriker] = [s.nonStriker, s.striker];
  }

  if (isLegal) {
    s.ballsInOver++;
    if (s.ballsInOver >= 6) {
      s.completedOvers++;
      s.ballsInOver = 0;
      s.overHistory.push([...s.currentOverLog]);
      s.currentOverLog = [];
      if (event.type !== "wicket")
        [s.striker, s.nonStriker] = [s.nonStriker, s.striker];
      s.overEndedWithWicket = event.type === "wicket";
      const allOut = s.wickets >= allPlayers(s.battingKey).length - 1;
      const oversUp = s.completedOvers >= s.totalOvers;
      if (allOut || oversUp || targetReached()) {
        s.pendingAction = "complete";
        if (s.innings === 2)
          s.matchResult =
            targetReached() || s.runs >= (s.target || Infinity)
              ? "bat_wins"
              : "field_wins";
        return s;
      }
      s.pendingAction = event.type === "wicket" ? "new_batsman" : "new_bowler";
      return s;
    }
  }

  if (event.type === "wicket") {
    const allOut = s.wickets >= allPlayers(s.battingKey).length - 1;
    if (allOut || targetReached()) {
      s.pendingAction = "complete";
      if (s.innings === 2)
        s.matchResult = targetReached() ? "bat_wins" : "field_wins";
      return s;
    }
    s.pendingAction = "new_batsman";
    return s;
  }

  if (targetReached()) {
    s.pendingAction = "complete";
    s.matchResult = "bat_wins";
    return s;
  }

  s.pendingAction = "ball";
  return s;
};

function calcStandings(matches) {
  const table = {};
  Object.keys(TEAMS).forEach((k) => {
    table[k] = {
      key: k,
      M: 0,
      W: 0,
      L: 0,
      T: 0,
      PTS: 0,
      runsFor: 0,
      oversFor: 0,
      runsAgainst: 0,
      oversAgainst: 0,
    };
  });
  matches.forEach((m) => {
    if (m.status !== "completed" || !m.result) return;
    const A = table[m.a];
    const B = table[m.b];
    A.M++;
    B.M++;
    const aR = Number(m.aRuns) || 0,
      bR = Number(m.bRuns) || 0,
      aO = Number(m.aOvers) || 0,
      bO = Number(m.bOvers) || 0;
    A.runsFor += aR;
    A.oversFor += aO;
    A.runsAgainst += bR;
    A.oversAgainst += bO;
    B.runsFor += bR;
    B.oversFor += bO;
    B.runsAgainst += aR;
    B.oversAgainst += aO;
    if (m.result === "a") {
      A.W++;
      A.PTS += 2;
      B.L++;
    } else if (m.result === "b") {
      B.W++;
      B.PTS += 2;
      A.L++;
    } else {
      A.T++;
      B.T++;
      A.PTS++;
      B.PTS++;
    }
  });
  Object.values(table).forEach((t) => {
    const rrf = t.oversFor > 0 ? t.runsFor / t.oversFor : 0;
    const rra = t.oversAgainst > 0 ? t.runsAgainst / t.oversAgainst : 0;
    t.NRR = t.oversFor > 0 || t.oversAgainst > 0 ? rrf - rra : 0;
  });
  return Object.values(table).sort((x, y) =>
    y.PTS !== x.PTS ? y.PTS - x.PTS : y.NRR - x.NRR,
  );
}

function TeamBadge({ teamKey, size = 56 }) {
  const t = TEAMS[teamKey];
  const [err, setErr] = useState(false);
  if (err) {
    const r = size / 2;
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ flexShrink: 0, filter: `drop-shadow(0 0 6px ${t.glow})` }}
      >
        <circle
          cx={r}
          cy={r}
          r={r - 2}
          fill={t.primary}
          fillOpacity="0.15"
          stroke={t.primary}
          strokeWidth="1.5"
        />
        <text
          x={r}
          y={r * 1.25}
          textAnchor="middle"
          fill={t.primary}
          fontFamily="'Bebas Neue', sans-serif"
          fontSize={size * 0.32}
          fontWeight="bold"
        >
          {t.abbr}
        </text>
      </svg>
    );
  }
  return (
    <img
      src={t.logo}
      alt={t.name}
      width={size}
      height={size}
      onError={() => setErr(true)}
      style={{
        flexShrink: 0,
        objectFit: "contain",
        filter: `drop-shadow(0 0 6px ${t.glow})`,
      }}
    />
  );
}

function AdminPinModal({ onSuccess, onClose }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const attempt = () => {
    if (pin === ADMIN_PIN) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
      onSuccess();
    } else {
      setError(true);
      setPin("");
      setTimeout(() => setError(false), 1200);
    }
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">🔐 ADMIN LOGIN</div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p
            style={{
              color: "#aaa",
              fontSize: 13,
              letterSpacing: 1,
              marginBottom: 16,
            }}
          >
            Enter your admin PIN to unlock editing.
          </p>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && attempt()}
            placeholder="Enter PIN"
            autoFocus
            style={{
              width: "100%",
              background: error
                ? "rgba(220,38,38,0.12)"
                : "rgba(255,255,255,0.05)",
              border: `1px solid ${error ? "rgba(220,38,38,0.6)" : "rgba(255,255,255,0.15)"}`,
              color: "#fff",
              fontFamily: "'Rajdhani'",
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: 4,
              padding: "10px 14px",
              borderRadius: 10,
              outline: "none",
            }}
          />
          {error && (
            <div
              style={{
                color: "#ff5555",
                fontSize: 12,
                letterSpacing: 1.5,
                marginTop: 8,
                fontWeight: 700,
              }}
            >
              INCORRECT PIN
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={attempt}>
            UNLOCK
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TournamentApp() {
  const [matches, setMatches] = useState(SCHEDULE.map(blankMatch));
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [tab, setTab] = useState("standings");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [liveScore, setLiveScore] = useState(null);
  // Write-lock refs: prevent our own realtime echoes from re-applying state.
  // String comparison (old approach) fails because Supabase JSONB can reorder keys.
  const matchesLock = useRef(false);
  const matchesLockTimer = useRef(null);
  const liveLock = useRef(false);
  const liveLockTimer = useRef(null);

  // ── Load initial data from Supabase ──────────────────────────────────────
  useEffect(() => {
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "1") setIsAdmin(true);

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("app_state")
          .select("id, data")
          .in("id", ["matches", "live_score"]);

        if (error) throw error;

        data.forEach(({ id, data: val }) => {
          if (id === "matches" && Array.isArray(val) && val.length === 6) {
            setMatches(val);
          }
          if (id === "live_score") {
            setLiveScore(val);
          }
        });
      } catch (e) {
        console.error("Supabase load error:", e);
        try {
          const r = localStorage.getItem(STORAGE_KEY);
          if (r) {
            const p = JSON.parse(r);
            if (Array.isArray(p) && p.length === 6) setMatches(p);
          }
        } catch (_) {}
        try {
          const r = localStorage.getItem(LIVE_KEY);
          if (r) setLiveScore(JSON.parse(r));
        } catch (_) {}
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, []);

  // ── Realtime subscription — updates from other tabs/devices ──────────────
  useEffect(() => {
    const channel = supabase
      .channel("app_state_changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "app_state" },
        ({ new: row }) => {
          if (row.id === "matches") {
            if (matchesLock.current) return; // our own echo, skip
            if (Array.isArray(row.data) && row.data.length === 6)
              setMatches(row.data);
          }
          if (row.id === "live_score") {
            if (liveLock.current) return; // our own echo, skip
            // Viewers receive score without history (that's fine — undo is admin-only)
            setLiveScore((prev) =>
              row.data ? { ...row.data, history: prev?.history || [] } : null,
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ── Persist matches to Supabase whenever they change ────────────────────
  useEffect(() => {
    if (!loaded) return;
    // Lock for 2s so realtime echo doesn't bounce state back to us
    matchesLock.current = true;
    clearTimeout(matchesLockTimer.current);
    matchesLockTimer.current = setTimeout(() => {
      matchesLock.current = false;
    }, 2000);

    supabase
      .from("app_state")
      .update({ data: matches, updated_at: new Date().toISOString() })
      .eq("id", "matches")
      .then(({ error }) => {
        if (error) console.error("Save matches error:", error);
      });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
    } catch (_) {}
  }, [matches, loaded]);

  // ── Persist liveScore to Supabase whenever it changes ───────────────────
  useEffect(() => {
    if (!loaded) return;
    // Lock for 2s so realtime echo doesn't bounce state back to us
    liveLock.current = true;
    clearTimeout(liveLockTimer.current);
    liveLockTimer.current = setTimeout(() => {
      liveLock.current = false;
    }, 2000);

    // Strip history — it's large, local-only, and was causing JSONB key-order
    // mismatches that broke the old string-comparison echo guard.
    const { history: _h, ...scoreToSave } = liveScore || {};
    supabase
      .from("app_state")
      .update({
        data: liveScore ? scoreToSave : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "live_score")
      .then(({ error }) => {
        if (error) console.error("Save live_score error:", error);
      });

    try {
      if (liveScore) localStorage.setItem(LIVE_KEY, JSON.stringify(liveScore));
      else localStorage.removeItem(LIVE_KEY);
    } catch (_) {}
  }, [liveScore, loaded]);

  const standings = useMemo(() => calcStandings(matches), [matches]);
  const completedCount = matches.filter((m) => m.status === "completed").length;
  const liveMatch = matches.find((m) => m.status === "live");

  const updateMatch = (updated) =>
    setMatches((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  const resetAll = () => {
    setMatches(SCHEDULE.map(blankMatch));
    setLiveScore(null);
    setShowResetConfirm(false);
  };
  const logout = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setIsAdmin(false);
  };

  const showLiveTab =
    liveMatch && liveScore && liveScore.matchId === liveMatch.id;

  return (
    <div className="app-root">
      <style>{styles}</style>
      <div className="stadium-bg">
        <div className="beam beam-1" />
        <div className="beam beam-2" />
        <div className="beam beam-3" />
        <div className="beam beam-4" />
      </div>

      <header className="hero">
        <div className="lights">
          <div className="light l1">✦</div>
          <div className="light l2">✦</div>
        </div>
        <button
          className="admin-lock-btn"
          onClick={() => (isAdmin ? logout() : setShowAdminModal(true))}
        >
          {isAdmin ? "🔓" : "🔒"}
        </button>
        <div className="hero-eyebrow">3-TEAM ROUND ROBIN</div>
        <h1 className="hero-title">
          <span className="t-gold">MANHATTAN KIDS</span>
          <span className="t-white">PREMIER</span>
          <span className="t-purple">LEAGUE</span>
        </h1>
        <div className="hero-sub">ONE LEAGUE · ONE CHAMPION</div>
        <div className="hero-stat">
          <span className="stat-num">{completedCount}</span>
          <span className="stat-label">/ 6 MATCHES PLAYED</span>
        </div>
      </header>

      <nav className="tabs">
        <button
          className={tab === "standings" ? "tab active" : "tab"}
          onClick={() => setTab("standings")}
        >
          STANDINGS
        </button>
        <button
          className={tab === "matches" ? "tab active" : "tab"}
          onClick={() => setTab("matches")}
        >
          FIXTURES
        </button>
        {showLiveTab && (
          <button
            className={tab === "live" ? "tab active live-tab" : "tab live-tab"}
            onClick={() => setTab("live")}
          >
            <span className="live-dot-sm" /> LIVE
          </button>
        )}
        <button
          className={tab === "teams" ? "tab active" : "tab"}
          onClick={() => setTab("teams")}
        >
          SQUADS
        </button>
      </nav>

      <main className="content">
        {tab === "standings" && <Standings standings={standings} />}
        {tab === "matches" && (
          <Matches
            matches={matches}
            onEdit={isAdmin ? (m) => setEditing(m) : undefined}
            onUpdateMatch={isAdmin ? updateMatch : undefined}
            isAdmin={isAdmin}
            liveScore={liveScore}
            onStartLiveScore={(match) => {
              setLiveScore(initLiveScore(match.id, match.a, match.b));
              setTab("live");
            }}
          />
        )}
        {tab === "live" && liveMatch && liveScore && (
          <LiveScoreSection
            liveScore={liveScore}
            match={liveMatch}
            isAdmin={isAdmin}
            onUpdate={setLiveScore}
            onClearLive={() => {
              setLiveScore(null);
              setTab("matches");
            }}
          />
        )}
        {tab === "teams" && <Squads />}
      </main>

      <footer className="foot">
        <div className="foot-line">DIFFERENT JERSEYS · SAME PASSION</div>
        <div className="foot-tag">LET THE BATTLE BEGIN</div>
        {isAdmin && (
          <button
            className="reset-btn"
            onClick={() => setShowResetConfirm(true)}
          >
            ↺ Reset Tournament
          </button>
        )}
      </footer>

      {showAdminModal && (
        <AdminPinModal
          onSuccess={() => {
            setIsAdmin(true);
            setShowAdminModal(false);
          }}
          onClose={() => setShowAdminModal(false)}
        />
      )}
      {isAdmin && editing && (
        <ResultModal
          match={editing}
          onClose={() => setEditing(null)}
          onSave={(m) => {
            updateMatch(m);
            setEditing(null);
          }}
        />
      )}
      {isAdmin && showResetConfirm && (
        <ConfirmModal
          title="Reset entire tournament?"
          body="This wipes all match results and points. Cannot be undone."
          onConfirm={resetAll}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
    </div>
  );
}

function LiveScoreSection({
  liveScore,
  match,
  isAdmin,
  onUpdate,
  onClearLive,
}) {
  const [showWicketModal, setShowWicketModal] = useState(false);
  const [showBowlerModal, setShowBowlerModal] = useState(false);
  const [showSetup, setShowSetup] = useState(
    liveScore.pendingAction === "setup",
  );

  const bat = TEAMS[liveScore.battingKey];
  const field = TEAMS[liveScore.fieldingKey];
  const totalExtras = Object.values(liveScore.extras).reduce(
    (a, b) => a + b,
    0,
  );
  const oversDisplay = `${liveScore.completedOvers}.${liveScore.ballsInOver}`;
  const ballsBowled = liveScore.completedOvers * 6 + liveScore.ballsInOver;
  const crr =
    ballsBowled > 0 ? (liveScore.runs / (ballsBowled / 6)).toFixed(2) : "0.00";
  const ballsRemaining = liveScore.totalOvers * 6 - ballsBowled;
  const runsNeeded = liveScore.target
    ? Math.max(0, liveScore.target - liveScore.runs)
    : null;
  const rrr =
    liveScore.innings === 2 && ballsRemaining > 0 && runsNeeded !== null
      ? (runsNeeded / (ballsRemaining / 6)).toFixed(2)
      : null;

  const nextBatters = allPlayers(liveScore.battingKey).filter((p) => {
    const b = liveScore.batting[p];
    return (
      !b ||
      (!b.dismissal && p !== liveScore.striker && p !== liveScore.nonStriker)
    );
  });

  const handleBall = (event) => {
    const updated = processBall(liveScore, event);
    onUpdate(updated);
    if (updated.pendingAction === "new_bowler") setShowBowlerModal(true);
  };

  const handleUndo = () => {
    if (!liveScore.history || liveScore.history.length === 0) return;
    onUpdate(liveScore.history[liveScore.history.length - 1]);
  };

  const handleSetup = ({
    opener1,
    opener2,
    bowler,
    battingKey,
    totalOvers,
  }) => {
    onUpdate({
      ...liveScore,
      battingKey,
      fieldingKey: battingKey === match.a ? match.b : match.a,
      totalOvers,
      striker: opener1,
      nonStriker: opener2,
      currentBowler: bowler,
      batting: {
        [opener1]: { runs: 0, balls: 0, fours: 0, sixes: 0 },
        [opener2]: { runs: 0, balls: 0, fours: 0, sixes: 0 },
      },
      bowling: { [bowler]: { overs: 0, balls: 0, runs: 0, wickets: 0 } },
      pendingAction: "ball",
      setup: true,
    });
    setShowSetup(false);
  };

  const handleNewBatsman = (name) => {
    const updated = { ...liveScore, striker: name };
    if (!updated.batting[name])
      updated.batting[name] = { runs: 0, balls: 0, fours: 0, sixes: 0 };
    updated.pendingAction = updated.overEndedWithWicket ? "new_bowler" : "ball";
    updated.overEndedWithWicket = false;
    onUpdate(updated);
    if (updated.pendingAction === "new_bowler") setShowBowlerModal(true);
    setShowWicketModal(false);
  };

  const handleNewBowler = (name) => {
    const updated = { ...liveScore, currentBowler: name };
    if (!updated.bowling[name])
      updated.bowling[name] = { overs: 0, balls: 0, runs: 0, wickets: 0 };
    updated.pendingAction = "ball";
    onUpdate(updated);
    setShowBowlerModal(false);
  };

  if (showSetup && isAdmin)
    return (
      <LiveSetupPanel
        match={match}
        liveScore={liveScore}
        onSetup={handleSetup}
        onCancel={() => setShowSetup(false)}
      />
    );

  return (
    <div className="live-section">
      {/* SCORE HEADER */}
      <div className="ls-header" style={{ borderColor: bat.border }}>
        <div className="ls-teams-row">
          <div className="ls-team-info">
            <img
              src={bat.logo}
              alt={bat.name}
              style={{
                width: 48,
                height: 48,
                objectFit: "contain",
                filter: `drop-shadow(0 0 8px ${bat.glow})`,
              }}
            />
            <div>
              <div className="ls-team-name" style={{ color: bat.primary }}>
                {bat.short}
              </div>
              <div className="ls-batting-label">BATTING</div>
            </div>
          </div>
          <div className="ls-score-block">
            <div className="ls-score" style={{ color: bat.primary }}>
              {liveScore.runs}
              <span className="ls-wkts">/{liveScore.wickets}</span>
            </div>
            <div className="ls-overs">({oversDisplay} ov)</div>
          </div>
          <div className="ls-team-info right">
            <div style={{ textAlign: "right" }}>
              <div className="ls-team-name" style={{ color: field.primary }}>
                {field.short}
              </div>
              <div className="ls-batting-label">FIELDING</div>
            </div>
            <img
              src={field.logo}
              alt={field.name}
              style={{
                width: 48,
                height: 48,
                objectFit: "contain",
                filter: `drop-shadow(0 0 8px ${field.glow})`,
              }}
            />
          </div>
        </div>
        <div className="ls-meta-row">
          <div className="ls-meta-item">
            <span className="ls-meta-label">CRR</span>
            <span className="ls-meta-val">{crr}</span>
          </div>
          {liveScore.innings === 2 && liveScore.target ? (
            <>
              <div className="ls-meta-item">
                <span className="ls-meta-label">TARGET</span>
                <span className="ls-meta-val" style={{ color: "#ff5555" }}>
                  {liveScore.target}
                </span>
              </div>
              <div className="ls-meta-item">
                <span className="ls-meta-label">NEED</span>
                <span
                  className="ls-meta-val"
                  style={{ color: runsNeeded === 0 ? "#4ade80" : "#F5B800" }}
                >
                  {runsNeeded}{" "}
                  <span style={{ fontSize: 11, color: "#aaa" }}>
                    ({rrr} RRR)
                  </span>
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="ls-meta-item">
                <span className="ls-meta-label">EXTRAS</span>
                <span className="ls-meta-val">{totalExtras}</span>
              </div>
              <div className="ls-meta-item">
                <span className="ls-meta-label">OVERS</span>
                <span className="ls-meta-val">{liveScore.totalOvers}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 1ST INNINGS SUMMARY (shows during 2nd innings) */}
      {liveScore.innings === 2 && liveScore.firstInnings && (
        <div
          className="ls-card"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <div className="ls-card-title" style={{ color: "#888" }}>
            1ST INNINGS
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img
                src={TEAMS[liveScore.fieldingKey].logo}
                alt=""
                style={{
                  width: 28,
                  height: 28,
                  objectFit: "contain",
                  filter: `drop-shadow(0 0 4px ${TEAMS[liveScore.fieldingKey].glow})`,
                }}
                onError={(e) => (e.target.style.display = "none")}
              />
              <span
                style={{
                  fontFamily: "'Bebas Neue'",
                  fontSize: 15,
                  color: TEAMS[liveScore.fieldingKey].primary,
                }}
              >
                {TEAMS[liveScore.fieldingKey].short}
              </span>
            </div>
            <span
              style={{
                fontFamily: "'Bebas Neue'",
                fontSize: 24,
                color: "#fff",
              }}
            >
              {liveScore.firstInnings.runs}/{liveScore.firstInnings.wickets}
            </span>
            <span style={{ color: "#888", fontSize: 12, fontWeight: 600 }}>
              ({liveScore.firstInnings.completedOvers}.
              {liveScore.firstInnings.ballsInOver} ov)
            </span>
          </div>
        </div>
      )}

      {/* CURRENT OVER */}
      <div className="ls-card">
        <div className="ls-card-title">THIS OVER</div>
        <div className="ls-over-balls">
          {liveScore.currentOverLog.length === 0 ? (
            <span className="ls-over-empty">No balls bowled yet</span>
          ) : (
            liveScore.currentOverLog.map((sym, i) => (
              <span
                key={i}
                className={`ls-ball ${sym === "W" ? "ball-w" : sym === "4" ? "ball-4" : sym === "6" ? "ball-6" : sym.startsWith("Wd") ? "ball-wd" : sym.startsWith("Nb") ? "ball-nb" : sym === "•" ? "ball-dot" : "ball-run"}`}
              >
                {sym}
              </span>
            ))
          )}
          {Array.from({
            length: Math.max(
              0,
              6 -
                liveScore.currentOverLog.filter(
                  (s) => !s.startsWith("Wd") && !s.startsWith("Nb"),
                ).length,
            ),
          }).map((_, i) => (
            <span key={`e${i}`} className="ls-ball ball-empty" />
          ))}
        </div>
        <div className="ls-partnership">
          Partnership: <strong>{liveScore.partnership.runs}</strong>(
          {liveScore.partnership.balls})
          {liveScore.fallOfWickets.length > 0 && (
            <span className="ls-last-wkt">
              {" "}
              · Last:{" "}
              {
                liveScore.fallOfWickets[liveScore.fallOfWickets.length - 1]
                  .batsman
              }{" "}
              {liveScore.fallOfWickets[liveScore.fallOfWickets.length - 1].runs}
            </span>
          )}
        </div>
      </div>

      {/* BATTING */}
      <div className="ls-card">
        <div className="ls-card-title">
          BATTING — {bat.short}{" "}
          {liveScore.innings === 2 ? "(2nd Inn)" : "(1st Inn)"}
        </div>
        <div className="ls-scorecard-head">
          <span className="sc-name">BATTER</span>
          <span className="sc-runs">R</span>
          <span className="sc-balls">B</span>
          <span className="sc-stat">4s</span>
          <span className="sc-stat">6s</span>
          <span className="sc-sr">SR</span>
        </div>
        {allPlayers(liveScore.battingKey).map((name) => {
          const b = liveScore.batting[name];
          const isStriker = name === liveScore.striker,
            isNonStriker = name === liveScore.nonStriker;
          const active = isStriker || isNonStriker,
            dismissed = b?.dismissal;
          if (!active && !dismissed) return null;
          const sr =
            b && b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(0) : "-";
          return (
            <div
              key={name}
              className={`ls-scorecard-row ${isStriker ? "batting-striker" : ""} ${dismissed ? "batting-out" : ""}`}
              style={active ? { borderLeft: `3px solid ${bat.primary}` } : {}}
            >
              <span className="sc-name">
                {isStriker ? "★ " : isNonStriker ? "  " : ""}
                {name}
                {dismissed && (
                  <span className="sc-dismissal">{` — ${b.dismissal}${b.dismissedBy ? ` b. ${b.dismissedBy}` : ""}${b.fielder ? ` c. ${b.fielder}` : ""}`}</span>
                )}
                {active && !dismissed && (
                  <span style={{ color: "#555", fontSize: 11 }}>
                    {" "}
                    {isStriker ? "(bat)" : "(ns)"}
                  </span>
                )}
              </span>
              <span
                className="sc-runs"
                style={{ color: isStriker ? bat.primary : "#fff" }}
              >
                {b?.runs ?? 0}
              </span>
              <span className="sc-balls">{b?.balls ?? 0}</span>
              <span className="sc-stat">{b?.fours ?? 0}</span>
              <span className="sc-stat">{b?.sixes ?? 0}</span>
              <span className="sc-sr">{sr}</span>
            </div>
          );
        })}
        <div className="ls-extras-row">
          <span>Extras: {totalExtras}</span>
          <span className="ls-extras-detail">
            (Wd {liveScore.extras.wides} · Nb {liveScore.extras.noBalls} · B{" "}
            {liveScore.extras.byes} · Lb {liveScore.extras.legByes})
          </span>
        </div>
      </div>

      {/* BOWLING */}
      <div className="ls-card">
        <div className="ls-card-title">BOWLING — {field.short}</div>
        <div className="ls-scorecard-head">
          <span className="sc-name">BOWLER</span>
          <span className="sc-runs">O</span>
          <span className="sc-balls">R</span>
          <span className="sc-stat">W</span>
          <span className="sc-sr">ECO</span>
        </div>
        {Object.entries(liveScore.bowling).map(([name, bowl]) => {
          const isCurrent = name === liveScore.currentBowler;
          const oversB = `${bowl.overs}.${bowl.balls}`;
          const econ =
            bowl.overs + bowl.balls / 6 > 0
              ? (bowl.runs / (bowl.overs + bowl.balls / 6)).toFixed(1)
              : "-";
          return (
            <div
              key={name}
              className={`ls-scorecard-row ${isCurrent ? "bowling-current" : ""}`}
              style={
                isCurrent ? { borderLeft: `3px solid ${field.primary}` } : {}
              }
            >
              <span className="sc-name">
                {isCurrent ? "▶ " : ""}
                {name}
              </span>
              <span
                className="sc-runs"
                style={{ color: isCurrent ? field.primary : "#ddd" }}
              >
                {oversB}
              </span>
              <span className="sc-balls">{bowl.runs}</span>
              <span
                className="sc-stat"
                style={{ color: bowl.wickets > 0 ? "#F5B800" : "#ddd" }}
              >
                {bowl.wickets}
              </span>
              <span className="sc-sr">{econ}</span>
            </div>
          );
        })}
      </div>

      {/* FALL OF WICKETS */}
      {liveScore.fallOfWickets.length > 0 && (
        <div className="ls-card">
          <div className="ls-card-title">FALL OF WICKETS</div>
          <div className="ls-fow">
            {liveScore.fallOfWickets.map((w, i) => (
              <div key={i} className="ls-fow-item">
                <span className="fow-wkt">{w.wicket}W</span>
                <span className="fow-runs">{w.runs}</span>
                <span className="fow-detail">
                  ({w.batsman} · ov {w.over})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OVER HISTORY */}
      {liveScore.overHistory.length > 0 && (
        <div className="ls-card">
          <div className="ls-card-title">OVER HISTORY</div>
          {liveScore.overHistory.map((over, i) => (
            <div key={i} className="ls-over-hist">
              <span className="oh-label">Ov {i + 1}</span>
              <div className="oh-balls">
                {over.map((sym, j) => (
                  <span
                    key={j}
                    className={`ls-ball sm ${sym === "W" ? "ball-w" : sym === "4" ? "ball-4" : sym === "6" ? "ball-6" : sym.startsWith("Wd") ? "ball-wd" : sym.startsWith("Nb") ? "ball-nb" : sym === "•" ? "ball-dot" : "ball-run"}`}
                  >
                    {sym}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ADMIN BALL ENTRY */}
      {isAdmin && liveScore.pendingAction === "ball" && (
        <BallEntryPanel
          liveScore={liveScore}
          onBall={handleBall}
          onUndo={handleUndo}
          bat={bat}
          field={field}
          onWicket={() => setShowWicketModal(true)}
        />
      )}

      {/* NEW BATSMAN */}
      {isAdmin &&
        liveScore.pendingAction === "new_batsman" &&
        !showWicketModal && (
          <div
            className="ls-card"
            style={{ borderColor: "rgba(220,38,38,0.3)" }}
          >
            <div className="ls-card-title" style={{ color: "#ff5555" }}>
              🏏 NEW BATSMAN IN
            </div>
            <div className="setup-btns wrap" style={{ marginTop: 8 }}>
              {nextBatters.map((p) => (
                <button
                  key={p}
                  className="setup-btn"
                  style={{ borderColor: bat.primary, color: bat.primary }}
                  onClick={() => handleNewBatsman(p)}
                >
                  {p}
                </button>
              ))}
              {nextBatters.length === 0 && (
                <div style={{ color: "#888", fontSize: 13 }}>All out</div>
              )}
            </div>
          </div>
        )}

      {/* NEW BOWLER */}
      {isAdmin &&
        liveScore.pendingAction === "new_bowler" &&
        !showBowlerModal && (
          <div
            className="ls-card"
            style={{ borderColor: "rgba(168,85,247,0.3)" }}
          >
            <div className="ls-card-title" style={{ color: field.primary }}>
              🎳 NEW BOWLER
            </div>
            <div className="setup-btns wrap" style={{ marginTop: 8 }}>
              {allPlayers(liveScore.fieldingKey).map((p) => {
                const bowl = liveScore.bowling[p];
                return (
                  <button
                    key={p}
                    className="setup-btn"
                    style={
                      p !== liveScore.currentBowler
                        ? { borderColor: field.primary, color: field.primary }
                        : { opacity: 0.4 }
                    }
                    onClick={() =>
                      p !== liveScore.currentBowler && handleNewBowler(p)
                    }
                  >
                    {p}
                    {bowl ? ` (${bowl.overs}.${bowl.balls}ov)` : ""}
                  </button>
                );
              })}
            </div>
          </div>
        )}

      {/* COMPLETE */}
      {liveScore.pendingAction === "complete" && (
        <div className="ls-card" style={{ textAlign: "center", padding: 24 }}>
          {liveScore.innings === 1 ? (
            <>
              <div
                style={{
                  fontFamily: "'Bebas Neue'",
                  fontSize: 20,
                  color: "#aaa",
                  letterSpacing: 3,
                }}
              >
                1ST INNINGS COMPLETE
              </div>
              <div
                style={{
                  fontFamily: "'Bebas Neue'",
                  fontSize: 36,
                  color: bat.primary,
                  margin: "8px 0",
                }}
              >
                {bat.short}: {liveScore.runs}/{liveScore.wickets}
              </div>
              <div style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>
                in {oversDisplay} overs · Target: {liveScore.runs + 1}
              </div>
              {isAdmin && (
                <button
                  className="btn primary"
                  onClick={() => {
                    const fi = {
                      runs: liveScore.runs,
                      wickets: liveScore.wickets,
                      completedOvers: liveScore.completedOvers,
                      ballsInOver: liveScore.ballsInOver,
                    };
                    onUpdate({
                      ...liveScore,
                      innings: 2,
                      firstInnings: fi,
                      target: liveScore.runs + 1,
                      battingKey: liveScore.fieldingKey,
                      fieldingKey: liveScore.battingKey,
                      runs: 0,
                      wickets: 0,
                      completedOvers: 0,
                      ballsInOver: 0,
                      striker: null,
                      nonStriker: null,
                      currentBowler: null,
                      batting: {},
                      bowling: {},
                      currentOverLog: [],
                      overHistory: [],
                      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
                      fallOfWickets: [],
                      partnership: { runs: 0, balls: 0 },
                      pendingAction: "setup",
                      overEndedWithWicket: false,
                      matchResult: null,
                    });
                    setShowSetup(true);
                  }}
                >
                  ▶ START 2ND INNINGS
                </button>
              )}
            </>
          ) : (
            <>
              <div
                style={{
                  fontFamily: "'Bebas Neue'",
                  fontSize: 16,
                  color: "#aaa",
                  letterSpacing: 3,
                  marginBottom: 8,
                }}
              >
                MATCH COMPLETE
              </div>
              {liveScore.matchResult === "bat_wins" && (
                <div
                  style={{
                    fontFamily: "'Bebas Neue'",
                    fontSize: 32,
                    color: bat.primary,
                    marginBottom: 4,
                  }}
                >
                  {bat.short} WIN! 🏆
                </div>
              )}
              {liveScore.matchResult === "field_wins" && (
                <div
                  style={{
                    fontFamily: "'Bebas Neue'",
                    fontSize: 32,
                    color: field.primary,
                    marginBottom: 4,
                  }}
                >
                  {field.short} WIN! 🏆
                </div>
              )}
              {!liveScore.matchResult && (
                <div
                  style={{
                    fontFamily: "'Bebas Neue'",
                    fontSize: 28,
                    color: "#F5B800",
                    marginBottom: 4,
                  }}
                >
                  MATCH TIED!
                </div>
              )}
              {liveScore.firstInnings && (
                <div
                  style={{
                    color: "#888",
                    fontSize: 12,
                    marginTop: 4,
                    marginBottom: 8,
                  }}
                >
                  1st: {TEAMS[liveScore.fieldingKey].short}{" "}
                  {liveScore.firstInnings.runs}/{liveScore.firstInnings.wickets}{" "}
                  · 2nd: {bat.short} {liveScore.runs}/{liveScore.wickets}
                </div>
              )}
              {isAdmin && (
                <button
                  className="btn primary"
                  style={{ marginTop: 8 }}
                  onClick={onClearLive}
                >
                  Close Live Scoring
                </button>
              )}
            </>
          )}
        </div>
      )}

      {isAdmin && liveScore.pendingAction === "ball" && (
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            marginTop: 4,
            paddingBottom: 16,
          }}
        >
          <button
            className="btn ghost"
            onClick={() => setShowSetup(true)}
            style={{ fontSize: 11 }}
          >
            ⚙ Re-Setup
          </button>
          <button
            className="btn ghost"
            onClick={onClearLive}
            style={{ fontSize: 11, color: "#ff5555" }}
          >
            ✕ End Live
          </button>
        </div>
      )}

      {showWicketModal && isAdmin && (
        <WicketModal
          liveScore={liveScore}
          nextBatters={nextBatters}
          bat={bat}
          field={field}
          onConfirm={(dismissal, fielder, newBatsman) => {
            const updated = processBall(liveScore, {
              type: "wicket",
              runs: 0,
              dismissal,
              fielder,
            });
            if (newBatsman && updated.pendingAction === "new_batsman") {
              updated.striker = newBatsman;
              if (!updated.batting[newBatsman])
                updated.batting[newBatsman] = {
                  runs: 0,
                  balls: 0,
                  fours: 0,
                  sixes: 0,
                };
              updated.pendingAction = updated.overEndedWithWicket
                ? "new_bowler"
                : "ball";
              updated.overEndedWithWicket = false;
            }
            onUpdate(updated);
            setShowWicketModal(false);
            if (updated.pendingAction === "new_bowler")
              setShowBowlerModal(true);
          }}
          onClose={() => setShowWicketModal(false)}
        />
      )}

      {showBowlerModal && isAdmin && (
        <div className="modal-back" onClick={() => setShowBowlerModal(false)}>
          <div className="modal small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title" style={{ color: field.primary }}>
                OVER COMPLETE — NEW BOWLER
              </div>
              <button
                className="modal-close"
                onClick={() => setShowBowlerModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="setup-btns wrap">
                {allPlayers(liveScore.fieldingKey).map((p) => {
                  const bowl = liveScore.bowling[p];
                  const isCurr = p === liveScore.currentBowler;
                  return (
                    <button
                      key={p}
                      className={`setup-btn ${isCurr ? "disabled" : ""}`}
                      style={
                        !isCurr
                          ? { borderColor: field.primary, color: field.primary }
                          : { opacity: 0.4 }
                      }
                      onClick={() => !isCurr && handleNewBowler(p)}
                    >
                      {p}
                      {bowl ? ` (${bowl.overs}ov)` : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LiveSetupPanel({ match, liveScore, onSetup, onCancel }) {
  const [battingKey, setBattingKey] = useState(match.a);
  const [opener1, setOpener1] = useState("");
  const [opener2, setOpener2] = useState("");
  const [bowler, setBowler] = useState("");
  const [totalOvers, setTotalOvers] = useState(6);
  const fieldingKey = battingKey === match.a ? match.b : match.a;
  const batters = allPlayers(battingKey),
    bowlers = allPlayers(fieldingKey);
  const ready = opener1 && opener2 && opener1 !== opener2 && bowler;
  return (
    <div className="ls-setup">
      <div className="ls-card">
        <div className="ls-card-title">⚙ MATCH SETUP</div>
        <div className="setup-row">
          <label className="setup-label">WHO BATS FIRST?</label>
          <div className="setup-btns">
            {[match.a, match.b].map((k) => (
              <button
                key={k}
                className={battingKey === k ? "setup-btn active" : "setup-btn"}
                style={
                  battingKey === k
                    ? { borderColor: TEAMS[k].primary, color: TEAMS[k].primary }
                    : {}
                }
                onClick={() => setBattingKey(k)}
              >
                {TEAMS[k].short}
              </button>
            ))}
          </div>
        </div>
        <div className="setup-row">
          <label className="setup-label">TOTAL OVERS</label>
          <div className="setup-btns">
            {[4, 5, 6, 8, 10].map((o) => (
              <button
                key={o}
                className={totalOvers === o ? "setup-btn active" : "setup-btn"}
                style={
                  totalOvers === o
                    ? { borderColor: "#F5B800", color: "#F5B800" }
                    : {}
                }
                onClick={() => setTotalOvers(o)}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
        <div className="setup-row">
          <label className="setup-label">
            OPENING STRIKER ({TEAMS[battingKey].short})
          </label>
          <div className="setup-btns wrap">
            {batters.map((p) => (
              <button
                key={p}
                className={opener1 === p ? "setup-btn active" : "setup-btn"}
                style={
                  opener1 === p
                    ? {
                        borderColor: TEAMS[battingKey].primary,
                        color: TEAMS[battingKey].primary,
                      }
                    : {}
                }
                onClick={() => {
                  setOpener1(p);
                  if (opener2 === p) setOpener2("");
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="setup-row">
          <label className="setup-label">OPENING NON-STRIKER</label>
          <div className="setup-btns wrap">
            {batters
              .filter((p) => p !== opener1)
              .map((p) => (
                <button
                  key={p}
                  className={opener2 === p ? "setup-btn active" : "setup-btn"}
                  style={
                    opener2 === p
                      ? {
                          borderColor: TEAMS[battingKey].primary,
                          color: TEAMS[battingKey].primary,
                        }
                      : {}
                  }
                  onClick={() => setOpener2(p)}
                >
                  {p}
                </button>
              ))}
          </div>
        </div>
        <div className="setup-row">
          <label className="setup-label">
            OPENING BOWLER ({TEAMS[fieldingKey].short})
          </label>
          <div className="setup-btns wrap">
            {bowlers.map((p) => (
              <button
                key={p}
                className={bowler === p ? "setup-btn active" : "setup-btn"}
                style={
                  bowler === p
                    ? {
                        borderColor: TEAMS[fieldingKey].primary,
                        color: TEAMS[fieldingKey].primary,
                      }
                    : {}
                }
                onClick={() => setBowler(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <button
          className="btn primary"
          style={{ width: "100%", marginTop: 8 }}
          disabled={!ready}
          onClick={() =>
            onSetup({ opener1, opener2, bowler, battingKey, totalOvers })
          }
        >
          START INNINGS ▶
        </button>
      </div>
    </div>
  );
}

function BallEntryPanel({ liveScore, onBall, onUndo, bat, field, onWicket }) {
  const [mode, setMode] = useState("normal");
  const [wideExtra, setWideExtra] = useState(0);
  const [nbRuns, setNbRuns] = useState(0);
  const [byeRuns, setByeRuns] = useState(1);
  const [lbRuns, setLbRuns] = useState(1);

  return (
    <div className="ls-card ball-entry-card">
      <div className="be-players">
        <div className="be-player" style={{ borderColor: bat.border }}>
          <div className="be-player-role" style={{ color: bat.primary }}>
            STRIKER ★
          </div>
          <div className="be-player-name">{liveScore.striker || "—"}</div>
          {liveScore.batting[liveScore.striker] && (
            <div className="be-player-stat">
              {liveScore.batting[liveScore.striker].runs}(
              {liveScore.batting[liveScore.striker].balls})
            </div>
          )}
        </div>
        <div className="be-vs">⚡</div>
        <div className="be-player" style={{ borderColor: field.border }}>
          <div className="be-player-role" style={{ color: field.primary }}>
            BOWLER
          </div>
          <div className="be-player-name">{liveScore.currentBowler || "—"}</div>
          {liveScore.bowling[liveScore.currentBowler] && (
            <div className="be-player-stat">
              {liveScore.bowling[liveScore.currentBowler].overs}.
              {liveScore.bowling[liveScore.currentBowler].balls}ov ·{" "}
              {liveScore.bowling[liveScore.currentBowler].wickets}W
            </div>
          )}
        </div>
      </div>
      <div className="be-nonstriker">
        Non-striker: <strong>{liveScore.nonStriker}</strong>
      </div>

      <div className="be-mode-row">
        {[
          ["normal", "RUNS"],
          ["wide", "WIDE"],
          ["noball", "NO BALL"],
          ["bye", "BYE"],
          ["legbye", "LEG BYE"],
        ].map(([m, label]) => (
          <button
            key={m}
            className={mode === m ? "mode-btn active" : "mode-btn"}
            onClick={() => setMode(m)}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "normal" && (
        <div className="be-balls-grid">
          {[0, 1, 2, 3, 4, 6].map((r) => (
            <button
              key={r}
              className={`be-ball-btn ${r === 4 ? "btn-4" : r === 6 ? "btn-6" : ""}`}
              onClick={() => onBall({ type: "runs", runs: r })}
            >
              {r === 0 ? "•" : r}
            </button>
          ))}
          <button className="be-ball-btn btn-wicket" onClick={onWicket}>
            WICKET
          </button>
          <button
            className="be-ball-btn btn-5"
            onClick={() => onBall({ type: "runs", runs: 5 })}
          >
            5
          </button>
        </div>
      )}
      {mode === "wide" && (
        <div className="be-extra-panel">
          <div className="be-extra-label">Extra runs off wide?</div>
          <div className="be-balls-grid">
            {[0, 1, 2, 3, 4].map((r) => (
              <button
                key={r}
                className={`be-ball-btn ${wideExtra === r ? "active-sel" : ""}`}
                onClick={() => setWideExtra(r)}
              >
                {r === 0 ? "None" : `+${r}`}
              </button>
            ))}
          </div>
          <button
            className="btn primary"
            style={{ width: "100%", marginTop: 8 }}
            onClick={() => {
              onBall({ type: "wide", extraRuns: wideExtra });
              setWideExtra(0);
            }}
          >
            LOG WIDE{wideExtra > 0 ? ` (+${wideExtra})` : ""}
          </button>
        </div>
      )}
      {mode === "noball" && (
        <div className="be-extra-panel">
          <div className="be-extra-label">Runs off bat?</div>
          <div className="be-balls-grid">
            {[0, 1, 2, 3, 4, 6].map((r) => (
              <button
                key={r}
                className={`be-ball-btn ${nbRuns === r ? "active-sel" : ""}`}
                onClick={() => setNbRuns(r)}
              >
                {r === 0 ? "None" : r}
              </button>
            ))}
          </div>
          <button
            className="btn primary"
            style={{ width: "100%", marginTop: 8 }}
            onClick={() => {
              onBall({ type: "noball", runs: nbRuns });
              setNbRuns(0);
            }}
          >
            LOG NO-BALL{nbRuns > 0 ? ` (+${nbRuns})` : ""}
          </button>
        </div>
      )}
      {mode === "bye" && (
        <div className="be-extra-panel">
          <div className="be-extra-label">Bye runs</div>
          <div className="be-balls-grid">
            {[1, 2, 3, 4].map((r) => (
              <button
                key={r}
                className={`be-ball-btn ${byeRuns === r ? "active-sel" : ""}`}
                onClick={() => setByeRuns(r)}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            className="btn primary"
            style={{ width: "100%", marginTop: 8 }}
            onClick={() => {
              onBall({ type: "bye", runs: byeRuns });
              setMode("normal");
            }}
          >
            LOG BYE ({byeRuns})
          </button>
        </div>
      )}
      {mode === "legbye" && (
        <div className="be-extra-panel">
          <div className="be-extra-label">Leg bye runs</div>
          <div className="be-balls-grid">
            {[1, 2, 3, 4].map((r) => (
              <button
                key={r}
                className={`be-ball-btn ${lbRuns === r ? "active-sel" : ""}`}
                onClick={() => setLbRuns(r)}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            className="btn primary"
            style={{ width: "100%", marginTop: 8 }}
            onClick={() => {
              onBall({ type: "legbye", runs: lbRuns });
              setMode("normal");
            }}
          >
            LOG LEG BYE ({lbRuns})
          </button>
        </div>
      )}
      <button className="btn ghost undo-btn" onClick={onUndo}>
        ↩ UNDO LAST BALL
      </button>
    </div>
  );
}

function WicketModal({
  liveScore,
  nextBatters,
  bat,
  field,
  onConfirm,
  onClose,
}) {
  const [step, setStep] = useState("howout");
  const [dismissal, setDismissal] = useState("");
  const [fielder, setFielder] = useState("");

  const handleHow = (d) => {
    setDismissal(d);
    if (["bowled", "lbw", "hit wicket"].includes(d)) setStep("batsman");
    else setStep("fielder");
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title" style={{ color: "#ff5555" }}>
            🔴 WICKET!
          </div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {step === "howout" && (
            <>
              <div className="result-label">HOW OUT?</div>
              <div
                className="result-options"
                style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
              >
                {[
                  "bowled",
                  "caught",
                  "lbw",
                  "run out",
                  "stumped",
                  "hit wicket",
                ].map((d) => (
                  <button
                    key={d}
                    className={dismissal === d ? "ropt active" : "ropt"}
                    onClick={() => handleHow(d)}
                  >
                    {d.toUpperCase()}
                  </button>
                ))}
              </div>
            </>
          )}
          {step === "fielder" && (
            <>
              <div className="result-label">FIELDER ({field.short})</div>
              <div className="setup-btns wrap">
                <button
                  className="setup-btn"
                  style={{ borderColor: "#666", color: "#888" }}
                  onClick={() => {
                    setFielder("");
                    setStep("batsman");
                  }}
                >
                  None
                </button>
                {allPlayers(liveScore.fieldingKey).map((p) => (
                  <button
                    key={p}
                    className={fielder === p ? "setup-btn active" : "setup-btn"}
                    style={
                      fielder === p
                        ? { borderColor: field.primary, color: field.primary }
                        : {}
                    }
                    onClick={() => {
                      setFielder(p);
                      setStep("batsman");
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </>
          )}
          {step === "batsman" && (
            <>
              <div className="result-label">NEXT BATSMAN</div>
              <div className="setup-btns wrap">
                {nextBatters.length === 0 ? (
                  <div style={{ color: "#888" }}>
                    All out — innings complete
                  </div>
                ) : (
                  nextBatters.map((p) => (
                    <button
                      key={p}
                      className="setup-btn"
                      style={{ borderColor: bat.primary, color: bat.primary }}
                      onClick={() => onConfirm(dismissal, fielder, p)}
                    >
                      {p}
                    </button>
                  ))
                )}
              </div>
              {nextBatters.length === 0 && (
                <button
                  className="btn primary"
                  style={{ marginTop: 12, width: "100%" }}
                  onClick={() => onConfirm(dismissal, fielder, null)}
                >
                  INNINGS COMPLETE
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Standings({ standings }) {
  const champion = standings[0],
    allZero = standings.every((s) => s.M === 0);
  return (
    <section className="section">
      <SectionTitle text="POINTS TABLE" accent="#F5B800" />
      {!allZero && (
        <div
          className="leader-card"
          style={{
            background: `linear-gradient(135deg,${TEAMS[champion.key].soft},transparent)`,
            borderColor: TEAMS[champion.key].border,
          }}
        >
          <div className="leader-rank">CURRENT LEADER</div>
          <div className="leader-team">
            <TeamBadge teamKey={champion.key} size={48} />
            <div>
              <div
                className="leader-name"
                style={{ color: TEAMS[champion.key].primary }}
              >
                {TEAMS[champion.key].name.toUpperCase()}
              </div>
              <div className="leader-pts">
                {champion.PTS} PTS · NRR {champion.NRR.toFixed(2)}
              </div>
            </div>
            <div className="trophy">🏆</div>
          </div>
        </div>
      )}
      <div className="table-wrap">
        <div className="ptable">
          <div className="ptable-head">
            <div className="col-pos">#</div>
            <div className="col-team">TEAM</div>
            <div className="col-num">M</div>
            <div className="col-num">W</div>
            <div className="col-num">L</div>
            <div className="col-num">T</div>
            <div className="col-num bold">PTS</div>
            <div className="col-num">NRR</div>
          </div>
          {standings.map((row, i) => (
            <div
              key={row.key}
              className="ptable-row"
              style={{
                background:
                  i === 0 && !allZero
                    ? `linear-gradient(90deg,${TEAMS[row.key].soft},transparent)`
                    : "transparent",
                borderLeft: `3px solid ${TEAMS[row.key].primary}`,
              }}
            >
              <div className="col-pos">{i + 1}</div>
              <div className="col-team">
                <TeamBadge teamKey={row.key} size={28} />
                <span style={{ color: TEAMS[row.key].primary }}>
                  {TEAMS[row.key].short}
                </span>
              </div>
              <div className="col-num">{row.M}</div>
              <div className="col-num">{row.W}</div>
              <div className="col-num">{row.L}</div>
              <div className="col-num">{row.T}</div>
              <div
                className="col-num bold pts"
                style={{ color: TEAMS[row.key].primary }}
              >
                {row.PTS}
              </div>
              <div className="col-num nrr">
                {row.NRR >= 0 ? "+" : ""}
                {row.NRR.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rules">
        <div className="rule">
          <span className="rule-k">WIN</span>
          <span className="rule-v">+2 PTS</span>
        </div>
        <div className="rule">
          <span className="rule-k">TIE/NR</span>
          <span className="rule-v">+1 PT</span>
        </div>
        <div className="rule">
          <span className="rule-k">LOSS</span>
          <span className="rule-v">0 PTS</span>
        </div>
      </div>
    </section>
  );
}

function Matches({
  matches,
  onEdit,
  onUpdateMatch,
  isAdmin,
  liveScore,
  onStartLiveScore,
}) {
  return (
    <section className="section">
      <SectionTitle text="MATCH SCHEDULE" accent="#F5B800" />
      <div className="match-list">
        {matches.map((m, i) => (
          <MatchCard
            key={m.id}
            match={m}
            num={i + 1}
            onEdit={onEdit}
            onUpdateMatch={onUpdateMatch}
            isAdmin={isAdmin}
            liveScore={liveScore}
            onStartLiveScore={onStartLiveScore}
          />
        ))}
      </div>
    </section>
  );
}

function MatchCard({
  match,
  num,
  onEdit,
  onUpdateMatch,
  isAdmin,
  liveScore,
  onStartLiveScore,
}) {
  const A = TEAMS[match.a],
    B = TEAMS[match.b];
  const completed = match.status === "completed",
    live = match.status === "live";
  const hasLiveScore = liveScore && liveScore.matchId === match.id;
  let resultText = "";
  if (completed) {
    if (match.result === "a") resultText = `${A.short} WON`;
    else if (match.result === "b") resultText = `${B.short} WON`;
    else if (match.result === "tie") resultText = "TIE";
    else resultText = "NO RESULT";
  }
  const toggleLive = (e) => {
    e.stopPropagation();
    if (completed || !onUpdateMatch) return;
    onUpdateMatch({ ...match, status: live ? "upcoming" : "live" });
  };
  return (
    <div
      className={`match-card ${completed ? "done" : ""} ${live ? "live" : ""}`}
      onClick={isAdmin && onEdit ? () => onEdit(match) : undefined}
      style={{ cursor: isAdmin ? "pointer" : "default" }}
    >
      <div className="match-num">M{num}</div>
      <div className="match-body">
        <div className="match-side">
          <TeamBadge teamKey={match.a} size={42} />
          <div className="match-team-name" style={{ color: A.primary }}>
            {A.short}
          </div>
          {completed && (
            <div className="match-score">
              {match.aRuns}/{match.aWickets}{" "}
              <span className="ov">({match.aOvers})</span>
            </div>
          )}
        </div>
        <div className="match-vs-col">
          <div className="match-vs">VS</div>
          {completed ? (
            <div
              className="match-result-pill"
              style={{
                borderColor:
                  match.result === "a"
                    ? A.primary
                    : match.result === "b"
                      ? B.primary
                      : "#888",
                color:
                  match.result === "a"
                    ? A.primary
                    : match.result === "b"
                      ? B.primary
                      : "#bbb",
              }}
            >
              {resultText}
            </div>
          ) : live ? (
            <div className="status-live">
              <span className="live-dot-sm" /> LIVE
            </div>
          ) : (
            <div className="status-up">UPCOMING</div>
          )}
        </div>
        <div className="match-side right">
          <TeamBadge teamKey={match.b} size={42} />
          <div className="match-team-name" style={{ color: B.primary }}>
            {B.short}
          </div>
          {completed && (
            <div className="match-score">
              {match.bRuns}/{match.bWickets}{" "}
              <span className="ov">({match.bOvers})</span>
            </div>
          )}
        </div>
      </div>
      {isAdmin && (
        <div className="match-actions">
          {!completed && (
            <button className="mini-btn" onClick={toggleLive}>
              {live ? "End Live" : "Mark Live"}
            </button>
          )}
          {live && !hasLiveScore && (
            <button
              className="mini-btn primary"
              onClick={(e) => {
                e.stopPropagation();
                onStartLiveScore(match);
              }}
            >
              🏏 Live Score
            </button>
          )}
          <button
            className="mini-btn primary"
            onClick={(e) => {
              e.stopPropagation();
              onEdit && onEdit(match);
            }}
          >
            {completed ? "Edit Result" : "Enter Result"}
          </button>
        </div>
      )}
    </div>
  );
}

function ResultModal({ match, onClose, onSave }) {
  const A = TEAMS[match.a],
    B = TEAMS[match.b];
  const [form, setForm] = useState({
    aRuns: match.aRuns,
    aWickets: match.aWickets,
    aOvers: match.aOvers,
    bRuns: match.bRuns,
    bWickets: match.bWickets,
    bOvers: match.bOvers,
    result: match.result || "auto",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const computedResult = useMemo(() => {
    const ar = Number(form.aRuns),
      br = Number(form.bRuns);
    if (form.aRuns === "" || form.bRuns === "") return null;
    return ar > br ? "a" : br > ar ? "b" : "tie";
  }, [form.aRuns, form.bRuns]);
  const save = () => {
    const result = form.result === "auto" ? computedResult : form.result;
    if (!result) {
      alert("Enter scores or pick a result.");
      return;
    }
    onSave({
      ...match,
      aRuns: form.aRuns === "" ? 0 : Number(form.aRuns),
      aWickets: form.aWickets === "" ? 0 : Number(form.aWickets),
      aOvers: form.aOvers === "" ? 0 : Number(form.aOvers),
      bRuns: form.bRuns === "" ? 0 : Number(form.bRuns),
      bWickets: form.bWickets === "" ? 0 : Number(form.bWickets),
      bOvers: form.bOvers === "" ? 0 : Number(form.bOvers),
      result,
      status: "completed",
    });
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">ENTER MATCH RESULT</div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {[
            { t: A, runs: "aRuns", wkts: "aWickets", overs: "aOvers" },
            { t: B, runs: "bRuns", wkts: "bWickets", overs: "bOvers" },
          ].map(({ t, runs, wkts, overs }, idx) => (
            <div key={idx}>
              {idx === 1 && <div className="vs-line">VS</div>}
              <div className="score-row" style={{ borderColor: t.border }}>
                <div className="score-team">
                  <TeamBadge teamKey={t.abbr} size={36} />
                  <div className="score-team-name" style={{ color: t.primary }}>
                    {t.short}
                  </div>
                </div>
                <div className="score-fields">
                  <div className="sf">
                    <label>RUNS</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={form[runs]}
                      onChange={(e) => set(runs, e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="sf">
                    <label>WKTS</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="10"
                      value={form[wkts]}
                      onChange={(e) => set(wkts, e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="sf">
                    <label>OVERS</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      value={form[overs]}
                      onChange={(e) => set(overs, e.target.value)}
                      placeholder="0.0"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="result-picker">
            <div className="result-label">RESULT</div>
            <div className="result-options">
              <button
                className={form.result === "auto" ? "ropt active" : "ropt"}
                onClick={() => set("result", "auto")}
              >
                AUTO{" "}
                {computedResult && (
                  <span className="ropt-hint">
                    (
                    {computedResult === "a"
                      ? A.short + " WON"
                      : computedResult === "b"
                        ? B.short + " WON"
                        : "TIE"}
                    )
                  </span>
                )}
              </button>
              <button
                className={form.result === "a" ? "ropt active" : "ropt"}
                style={
                  form.result === "a"
                    ? { borderColor: A.primary, color: A.primary }
                    : {}
                }
                onClick={() => set("result", "a")}
              >
                {A.short} WON
              </button>
              <button
                className={form.result === "b" ? "ropt active" : "ropt"}
                style={
                  form.result === "b"
                    ? { borderColor: B.primary, color: B.primary }
                    : {}
                }
                onClick={() => set("result", "b")}
              >
                {B.short} WON
              </button>
              <button
                className={form.result === "tie" ? "ropt active" : "ropt"}
                onClick={() => set("result", "tie")}
              >
                TIE
              </button>
              <button
                className={form.result === "nr" ? "ropt active" : "ropt"}
                onClick={() => set("result", "nr")}
              >
                NO RESULT
              </button>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          {match.status === "completed" && (
            <button
              className="btn ghost"
              onClick={() =>
                onSave({
                  ...match,
                  status: "upcoming",
                  result: null,
                  aRuns: "",
                  aWickets: "",
                  aOvers: "",
                  bRuns: "",
                  bWickets: "",
                  bOvers: "",
                })
              }
            >
              Clear Result
            </button>
          )}
          <button className="btn primary" onClick={save}>
            Save Result
          </button>
        </div>
      </div>
    </div>
  );
}

function Squads() {
  return (
    <section className="section">
      <SectionTitle text="SQUADS" accent="#F5B800" />
      <div className="squads">
        {Object.entries(TEAMS).map(([k, t]) => (
          <div
            key={k}
            className="squad-card"
            style={{
              background: `linear-gradient(180deg,${t.soft},transparent 80%)`,
              borderColor: t.border,
            }}
          >
            <div className="squad-head">
              <TeamBadge teamKey={k} size={56} />
              <div className="squad-name" style={{ color: t.primary }}>
                {t.short}
              </div>
            </div>
            <ul className="squad-list">
              <li className="squad-row">
                <span
                  className="badge"
                  style={{ background: t.primary, color: "#0a0a0f" }}
                >
                  C
                </span>
                <span className="player">{t.captain}</span>
              </li>
              <li className="squad-row">
                <span
                  className="badge outline"
                  style={{ borderColor: t.primary, color: t.primary }}
                >
                  VC
                </span>
                <span className="player">{t.viceCaptain}</span>
              </li>
              {t.players.map((p) => (
                <li key={p} className="squad-row">
                  <span className="dot" style={{ background: t.primary }} />
                  <span className="player">{p}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionTitle({ text, accent }) {
  return (
    <div className="sec-title">
      <span className="sec-line" style={{ background: accent }} />
      <span className="sec-text">{text}</span>
      <span className="sec-line" style={{ background: accent }} />
    </div>
  );
}

function ConfirmModal({ title, body, onConfirm, onCancel }) {
  return (
    <div className="modal-back" onClick={onCancel}>
      <div className="modal small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{title}</div>
        </div>
        <div className="modal-body">
          <p style={{ color: "#bbb", lineHeight: 1.6 }}>{body}</p>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn danger" onClick={onConfirm}>
            Reset Everything
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@400;500;600;700&display=swap');
html,body,#root{margin:0;padding:0;width:100%;min-height:100%;max-width:100%;overflow-x:hidden;box-sizing:border-box;}
*{box-sizing:border-box;}
.app-root{min-height:100vh;width:100%;background:radial-gradient(ellipse at top,rgba(245,184,0,0.06),transparent 50%),radial-gradient(ellipse at bottom right,rgba(168,85,247,0.07),transparent 60%),radial-gradient(ellipse at bottom left,rgba(59,157,255,0.07),transparent 60%),linear-gradient(180deg,#08080d 0%,#0d0d18 50%,#08080d 100%);color:#fff;font-family:'Rajdhani',sans-serif;padding-bottom:80px;position:relative;overflow-x:hidden;}
.stadium-bg{position:fixed;inset:0;pointer-events:none;z-index:0;}
.beam{position:absolute;top:-100px;width:200px;height:600px;background:linear-gradient(180deg,rgba(245,184,0,0.12),transparent);filter:blur(40px);transform-origin:top center;}
.beam-1{left:5%;transform:rotate(15deg)}.beam-2{left:25%;transform:rotate(-8deg);animation:sway 12s ease-in-out infinite alternate}.beam-3{right:25%;transform:rotate(8deg);animation:sway 14s ease-in-out infinite alternate-reverse}.beam-4{right:5%;transform:rotate(-15deg)}
@keyframes sway{from{opacity:0.6}to{opacity:1}}
.hero{position:relative;z-index:1;padding:36px 20px 28px;text-align:center;}
.lights{position:absolute;top:16px;left:0;right:0;display:flex;justify-content:space-between;padding:0 24px;}
.light{color:#F5B800;opacity:0.6;font-size:24px;animation:twinkle 3s ease-in-out infinite alternate}.l2{animation-delay:1.5s}
@keyframes twinkle{from{opacity:0.3}to{opacity:1;text-shadow:0 0 20px #F5B800}}
.admin-lock-btn{position:absolute;top:14px;right:14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:50%;width:36px;height:36px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;z-index:10;}
.admin-lock-btn:hover{background:rgba(255,255,255,0.1);border-color:rgba(245,184,0,0.4);transform:scale(1.1)}
.hero-eyebrow{font-family:'Rajdhani';font-weight:600;font-size:11px;letter-spacing:4px;color:#F5B800;margin-bottom:8px;opacity:0.85}
.hero-title{font-family:'Bebas Neue';font-size:clamp(44px,11vw,76px);line-height:0.92;margin:0 0 12px;display:flex;flex-direction:column}
.t-gold{color:#F5B800;text-shadow:0 0 30px rgba(245,184,0,0.4)}.t-white{color:#fff}
.t-purple{background:linear-gradient(90deg,#A855F7,#3B9DFF);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.hero-sub{font-weight:600;letter-spacing:3px;font-size:12px;color:#aaa;margin-bottom:20px}
.hero-stat{display:inline-flex;align-items:baseline;gap:8px;padding:8px 18px;background:rgba(245,184,0,0.08);border:1px solid rgba(245,184,0,0.3);border-radius:999px}
.stat-num{font-family:'Bebas Neue';font-size:24px;color:#F5B800}.stat-label{font-size:11px;letter-spacing:2px;font-weight:600;color:#ccc}
.tabs{position:sticky;top:0;z-index:10;display:flex;gap:4px;padding:10px 16px;background:rgba(8,8,13,0.92);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,0.06)}
.tab{flex:1;padding:10px 8px;background:transparent;border:1px solid transparent;color:#888;font-family:'Rajdhani';font-weight:700;font-size:12px;letter-spacing:2px;cursor:pointer;border-radius:8px;transition:all 0.2s}
.tab:hover{color:#ccc}.tab.active{color:#F5B800;background:rgba(245,184,0,0.1);border-color:rgba(245,184,0,0.3)}
.live-tab{color:#ff5555!important;display:flex;align-items:center;justify-content:center;gap:6px}
.live-tab.active{color:#ff5555!important;background:rgba(220,38,38,0.1)!important;border-color:rgba(220,38,38,0.4)!important}
.content{position:relative;z-index:1;padding:24px 16px 40px}.section{max-width:720px;margin:0 auto}
.sec-title{display:flex;align-items:center;gap:12px;margin:0 0 18px}.sec-line{flex:1;height:1px;opacity:0.4}
.sec-text{font-family:'Bebas Neue';letter-spacing:4px;color:#F5B800;font-size:18px}
.leader-card{border:1px solid;border-radius:14px;padding:14px 16px;margin-bottom:16px}
.leader-rank{font-size:10px;letter-spacing:3px;color:#999;font-weight:700;margin-bottom:8px}
.leader-team{display:flex;align-items:center;gap:12px}.leader-name{font-family:'Bebas Neue';font-size:22px;letter-spacing:1px}
.leader-pts{font-size:12px;letter-spacing:1.5px;color:#aaa;font-weight:600}.trophy{margin-left:auto;font-size:28px;filter:drop-shadow(0 0 12px rgba(245,184,0,0.6))}
.table-wrap{background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden}
.ptable{display:flex;flex-direction:column}
.ptable-head,.ptable-row{display:grid;grid-template-columns:28px 1fr 32px 32px 32px 32px 44px 56px;align-items:center;gap:6px;padding:12px}
.ptable-head{background:rgba(245,184,0,0.06);border-bottom:1px solid rgba(245,184,0,0.2);font-family:'Rajdhani';font-weight:700;font-size:11px;letter-spacing:2px;color:#F5B800}
.ptable-row{border-bottom:1px solid rgba(255,255,255,0.05);font-family:'Rajdhani'}.ptable-row:last-child{border-bottom:none}
.col-pos{font-family:'Bebas Neue';font-size:18px;color:#888;text-align:center}
.col-team{display:flex;align-items:center;gap:8px;font-family:'Bebas Neue';letter-spacing:1px;font-size:15px}
.col-num{text-align:center;font-family:'Rajdhani';font-weight:600;font-size:15px;color:#ddd}
.col-num.bold{font-weight:700}.col-num.pts{font-family:'Bebas Neue';font-size:20px}.col-num.nrr{font-size:13px;color:#aaa}
.rules{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
.rule{display:flex;flex-direction:column;align-items:center;padding:10px 6px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px}
.rule-k{font-size:10px;letter-spacing:1.5px;color:#888;font-weight:700}.rule-v{font-family:'Bebas Neue';font-size:18px;color:#F5B800;margin-top:2px}
.match-list{display:flex;flex-direction:column;gap:12px}
.match-card{position:relative;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:14px 14px 12px;transition:all 0.2s}
.match-card:hover{border-color:rgba(245,184,0,0.3);transform:translateY(-1px)}.match-card.done{background:rgba(0,0,0,0.6)}
.match-card.live{border-color:rgba(220,38,38,0.5);background:linear-gradient(135deg,rgba(220,38,38,0.08),rgba(0,0,0,0.4));animation:liveBorder 2s ease-in-out infinite alternate}
@keyframes liveBorder{from{box-shadow:0 0 0 rgba(220,38,38,0)}to{box-shadow:0 0 24px rgba(220,38,38,0.25)}}
.match-num{position:absolute;top:10px;left:12px;font-family:'Bebas Neue';font-size:11px;letter-spacing:1px;color:#666}
.match-body{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;padding:6px 0 12px}
.match-side{display:flex;flex-direction:column;align-items:flex-start;gap:4px}.match-side.right{align-items:flex-end;text-align:right}
.match-team-name{font-family:'Bebas Neue';font-size:15px;letter-spacing:1px;line-height:1}
.match-score{font-family:'Bebas Neue';font-size:22px;color:#fff}.match-score .ov{font-size:12px;color:#888;font-family:'Rajdhani';font-weight:600}
.match-vs-col{display:flex;flex-direction:column;align-items:center;gap:6px}.match-vs{font-family:'Bebas Neue';font-size:14px;color:#555;letter-spacing:1.5px}
.match-result-pill{font-family:'Bebas Neue';font-size:11px;letter-spacing:1.5px;padding:3px 10px;border-radius:999px;border:1px solid;white-space:nowrap}
.status-up{font-size:9px;letter-spacing:2px;color:#666;font-weight:700}
.status-live{display:flex;align-items:center;gap:4px;font-family:'Bebas Neue';letter-spacing:1.5px;font-size:11px;color:#ff5555}
.live-dot-sm{width:6px;height:6px;border-radius:50%;background:#ff3333;box-shadow:0 0 8px #ff3333;animation:pulse 1.2s infinite;display:inline-block}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
.match-actions{display:flex;gap:6px;border-top:1px dashed rgba(255,255,255,0.08);padding-top:10px}
.mini-btn{flex:1;background:transparent;border:1px solid rgba(255,255,255,0.1);color:#aaa;padding:7px 10px;font-family:'Rajdhani';font-weight:700;font-size:11px;letter-spacing:1.5px;border-radius:7px;cursor:pointer;transition:all 0.15s}
.mini-btn:hover{border-color:rgba(255,255,255,0.25);color:#fff}.mini-btn.primary{background:rgba(245,184,0,0.12);border-color:rgba(245,184,0,0.4);color:#F5B800}
.mini-btn.primary:hover{background:rgba(245,184,0,0.2)}
.live-section{max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
.ls-header{background:rgba(0,0,0,0.5);border:1px solid;border-radius:16px;padding:16px}
.ls-teams-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}
.ls-team-info{display:flex;align-items:center;gap:10px}.ls-team-info.right{flex-direction:row-reverse}
.ls-team-name{font-family:'Bebas Neue';font-size:18px;letter-spacing:1px}.ls-batting-label{font-size:9px;letter-spacing:2px;color:#888;font-weight:700}
.ls-score-block{text-align:center}.ls-score{font-family:'Bebas Neue';font-size:48px;line-height:1;letter-spacing:-1px}
.ls-wkts{font-size:28px;color:#aaa}.ls-overs{font-size:12px;letter-spacing:2px;color:#888;font-weight:600;margin-top:2px}
.ls-meta-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;border-top:1px solid rgba(255,255,255,0.06);padding-top:12px}
.ls-meta-item{text-align:center}.ls-meta-label{display:block;font-size:9px;letter-spacing:2px;color:#666;font-weight:700}
.ls-meta-val{display:block;font-family:'Bebas Neue';font-size:20px;color:#F5B800;margin-top:2px}
.ls-card{background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:14px}
.ls-card-title{font-family:'Bebas Neue';font-size:13px;letter-spacing:3px;color:#F5B800;margin-bottom:12px}
.ls-over-balls{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.ls-ball{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue';font-size:14px;border:1px solid rgba(255,255,255,0.15)}
.ls-ball.sm{width:28px;height:28px;font-size:11px}
.ball-dot{background:rgba(255,255,255,0.05);color:#555}.ball-run{background:rgba(255,255,255,0.1);color:#fff}
.ball-4{background:rgba(59,157,255,0.2);border-color:rgba(59,157,255,0.6);color:#3B9DFF;font-size:16px}
.ball-6{background:rgba(245,184,0,0.2);border-color:rgba(245,184,0,0.6);color:#F5B800;font-size:16px}
.ball-w{background:rgba(220,38,38,0.2);border-color:rgba(220,38,38,0.6);color:#ff5555;font-size:16px}
.ball-wd{background:rgba(168,85,247,0.15);border-color:rgba(168,85,247,0.4);color:#A855F7;font-size:10px}
.ball-nb{background:rgba(249,115,22,0.15);border-color:rgba(249,115,22,0.4);color:#f97316;font-size:10px}
.ball-empty{background:rgba(255,255,255,0.02);border:1px dashed rgba(255,255,255,0.08)}
.ls-over-empty{color:#555;font-size:12px;letter-spacing:1px}
.ls-partnership{font-size:12px;color:#888;margin-top:10px;font-weight:600;letter-spacing:0.5px}
.ls-last-wkt{color:#ff8888}
.ls-scorecard-head{display:grid;grid-template-columns:1fr 40px 40px 32px 32px 44px;padding:6px 8px;gap:4px;font-size:10px;letter-spacing:2px;color:#666;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.06)}
.ls-scorecard-row{display:grid;grid-template-columns:1fr 40px 40px 32px 32px 44px;padding:10px 8px;gap:4px;align-items:center;border-bottom:1px solid rgba(255,255,255,0.04);font-family:'Rajdhani';font-weight:600;font-size:14px;border-left:3px solid transparent}
.ls-scorecard-row:last-child{border-bottom:none}.batting-striker{background:rgba(245,184,0,0.04)}.batting-out{opacity:0.55}.bowling-current{background:rgba(59,157,255,0.04)}
.sc-name{font-size:13px;color:#ddd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sc-dismissal{font-size:10px;color:#666;display:block}
.sc-runs{text-align:center;font-family:'Bebas Neue';font-size:18px}.sc-balls{text-align:center;color:#888;font-size:13px}.sc-stat{text-align:center;font-size:13px;color:#aaa}.sc-sr{text-align:center;font-size:12px;color:#888}
.ls-extras-row{display:flex;justify-content:space-between;align-items:center;padding:10px 8px 0;border-top:1px dashed rgba(255,255,255,0.06);margin-top:8px;font-size:12px;color:#888;font-weight:600}
.ls-extras-detail{font-size:11px;color:#555}
.ls-fow{display:flex;flex-direction:column;gap:6px}
.ls-fow-item{display:flex;align-items:center;gap:10px;padding:6px 8px;background:rgba(220,38,38,0.06);border-radius:8px;border:1px solid rgba(220,38,38,0.15)}
.fow-wkt{font-family:'Bebas Neue';font-size:14px;color:#ff5555;min-width:24px}.fow-runs{font-family:'Bebas Neue';font-size:18px;color:#fff}.fow-detail{font-size:11px;color:#888;font-weight:600}
.ls-over-hist{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)}.ls-over-hist:last-child{border-bottom:none}
.oh-label{font-size:10px;letter-spacing:1.5px;color:#666;font-weight:700;min-width:36px}.oh-balls{display:flex;gap:4px;flex:1}
.ball-entry-card{border-color:rgba(245,184,0,0.2)!important}
.be-players{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;margin-bottom:12px}
.be-player{background:rgba(0,0,0,0.3);border:1px solid;border-radius:10px;padding:10px 12px}
.be-player-role{font-size:9px;letter-spacing:2px;font-weight:700;margin-bottom:4px}.be-player-name{font-family:'Bebas Neue';font-size:18px;letter-spacing:1px;color:#fff}
.be-player-stat{font-size:11px;color:#888;font-weight:600;margin-top:2px}.be-vs{text-align:center;font-size:20px}
.be-nonstriker{font-size:12px;color:#888;font-weight:600;letter-spacing:0.5px;margin-bottom:14px;text-align:center}
.be-mode-row{display:flex;gap:4px;margin-bottom:12px;overflow-x:auto;padding-bottom:4px}
.mode-btn{flex-shrink:0;padding:6px 10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);color:#888;font-family:'Rajdhani';font-weight:700;font-size:10px;letter-spacing:1.5px;border-radius:6px;cursor:pointer;transition:all 0.15s;white-space:nowrap}
.mode-btn.active{background:rgba(245,184,0,0.1);border-color:rgba(245,184,0,0.5);color:#F5B800}
.be-balls-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.be-ball-btn{padding:16px 8px;font-family:'Bebas Neue';font-size:22px;letter-spacing:1px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#ddd;cursor:pointer;transition:all 0.15s}
.be-ball-btn:hover{background:rgba(255,255,255,0.1);transform:scale(1.03)}.be-ball-btn:active{transform:scale(0.96)}
.btn-4{background:rgba(59,157,255,0.12);border-color:rgba(59,157,255,0.4);color:#3B9DFF}.btn-4:hover{background:rgba(59,157,255,0.22)}
.btn-6{background:rgba(245,184,0,0.12);border-color:rgba(245,184,0,0.4);color:#F5B800}.btn-6:hover{background:rgba(245,184,0,0.22)}
.btn-5{background:rgba(255,255,255,0.04);color:#888}
.btn-wicket{background:rgba(220,38,38,0.12);border-color:rgba(220,38,38,0.5);color:#ff5555;font-size:14px}.btn-wicket:hover{background:rgba(220,38,38,0.22)}
.active-sel{background:rgba(245,184,0,0.15)!important;border-color:#F5B800!important;color:#F5B800!important}
.be-extra-panel{display:flex;flex-direction:column;gap:8px}.be-extra-label{font-size:10px;letter-spacing:2px;color:#888;font-weight:700}
.undo-btn{width:100%;margin-top:10px;font-size:11px;letter-spacing:2px}
.ls-setup{max-width:720px;margin:0 auto}
.setup-row{margin-bottom:16px}.setup-label{display:block;font-size:10px;letter-spacing:2px;color:#888;font-weight:700;margin-bottom:8px}
.setup-btns{display:flex;gap:6px;flex-wrap:nowrap}.setup-btns.wrap{flex-wrap:wrap}
.setup-btn{padding:8px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);color:#aaa;font-family:'Rajdhani';font-weight:700;font-size:13px;letter-spacing:1px;border-radius:8px;cursor:pointer;transition:all 0.15s;white-space:nowrap}
.setup-btn:hover{border-color:rgba(255,255,255,0.25);color:#fff}.setup-btn.active{background:rgba(245,184,0,0.1)}.setup-btn.disabled{opacity:0.4;cursor:not-allowed}
.squads{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.squad-card{border:1px solid;border-radius:14px;padding:16px 14px}
.squad-head{display:flex;flex-direction:column;align-items:center;gap:8px;padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.06)}
.squad-name{font-family:'Bebas Neue';font-size:22px;letter-spacing:2px}
.squad-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px}
.squad-row{display:flex;align-items:center;gap:10px;padding:7px 8px;background:rgba(0,0,0,0.25);border-radius:7px;font-family:'Rajdhani';font-weight:600}
.player{color:#ddd;font-size:14px}.badge{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 6px;border-radius:6px;font-family:'Bebas Neue';font-size:11px;letter-spacing:1px}
.badge.outline{background:transparent;border:1px solid}.dot{width:6px;height:6px;border-radius:50%;margin-left:8px;opacity:0.6}
.modal-back{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,0.78);backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;padding:16px;animation:fadeIn 0.2s ease}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.modal{background:linear-gradient(180deg,#14141f,#0a0a12);border:1px solid rgba(245,184,0,0.25);border-radius:18px 18px 14px 14px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;display:flex;flex-direction:column;animation:slideUp 0.25s ease}
.modal.small{max-width:420px}
@keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
.modal-head{display:flex;align-items:center;justify-content:space-between;padding:18px 20px 12px;border-bottom:1px solid rgba(255,255,255,0.06)}
.modal-title{font-family:'Bebas Neue';font-size:22px;letter-spacing:2px;color:#F5B800}
.modal-close{background:transparent;border:none;color:#888;font-size:18px;cursor:pointer;width:32px;height:32px;border-radius:50%;transition:all 0.15s}
.modal-close:hover{background:rgba(255,255,255,0.06);color:#fff}
.modal-body{padding:16px 20px}.modal-foot{padding:14px 20px 18px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:10px;justify-content:flex-end}
.score-row{border:1px solid;background:rgba(0,0,0,0.3);border-radius:12px;padding:12px;display:flex;align-items:center;gap:12px}
.score-team{display:flex;align-items:center;gap:8px;min-width:110px}.score-team-name{font-family:'Bebas Neue';letter-spacing:1px;font-size:14px}
.score-fields{flex:1;display:grid;grid-template-columns:1fr 0.7fr 1fr;gap:6px}
.sf{display:flex;flex-direction:column;gap:3px}.sf label{font-size:9px;letter-spacing:1.5px;color:#888;font-weight:700}
.sf input{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#fff;font-family:'Bebas Neue';font-size:18px;letter-spacing:1px;padding:6px 8px;border-radius:7px;width:100%;outline:none;transition:border-color 0.15s;-moz-appearance:textfield}
.sf input:focus{border-color:#F5B800}.sf input::-webkit-outer-spin-button,.sf input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.vs-line{text-align:center;font-family:'Bebas Neue';color:#555;letter-spacing:3px;padding:8px 0}
.result-picker{margin-top:18px}.result-label{font-size:10px;letter-spacing:2px;color:#888;font-weight:700;margin-bottom:8px}
.result-options{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.ropt{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);color:#aaa;padding:9px 10px;font-family:'Rajdhani';font-weight:700;font-size:12px;letter-spacing:1.2px;border-radius:7px;cursor:pointer;transition:all 0.15s;text-align:left}
.ropt:hover{border-color:rgba(255,255,255,0.25);color:#fff}.ropt.active{background:rgba(245,184,0,0.1);border-color:#F5B800;color:#F5B800}
.ropt-hint{color:#888;font-size:10px;margin-left:4px}
.btn{padding:10px 18px;font-family:'Rajdhani';font-weight:700;font-size:12px;letter-spacing:2px;border-radius:8px;border:1px solid transparent;cursor:pointer;transition:all 0.15s}
.btn.primary{background:linear-gradient(180deg,#FFD93B,#F5B800);color:#1a1408;border-color:#F5B800;box-shadow:0 0 16px rgba(245,184,0,0.3)}
.btn.primary:hover{transform:translateY(-1px);box-shadow:0 0 24px rgba(245,184,0,0.5)}.btn.primary:disabled{opacity:0.4;cursor:not-allowed;transform:none}
.btn.ghost{background:transparent;border-color:rgba(255,255,255,0.15);color:#aaa}.btn.ghost:hover{border-color:rgba(255,255,255,0.3);color:#fff}
.btn.danger{background:rgba(220,38,38,0.15);border-color:rgba(220,38,38,0.5);color:#ff6666}.btn.danger:hover{background:rgba(220,38,38,0.25)}
.foot{text-align:center;padding:36px 20px 12px;position:relative;z-index:1}
.foot-line{font-size:11px;letter-spacing:3px;color:#666;font-weight:600}
.foot-tag{font-family:'Bebas Neue';font-size:24px;letter-spacing:3px;color:#F5B800;margin:6px 0 18px;text-shadow:0 0 20px rgba(245,184,0,0.3)}
.reset-btn{background:transparent;border:1px solid rgba(255,255,255,0.1);color:#666;padding:8px 14px;font-family:'Rajdhani';font-size:11px;letter-spacing:1.5px;font-weight:600;border-radius:7px;cursor:pointer;transition:all 0.15s}
.reset-btn:hover{border-color:rgba(220,38,38,0.4);color:#ff6666}
@media(max-width:480px){
  .hero-title{font-size:52px}.ls-score{font-size:36px}.ls-wkts{font-size:22px}
  .ls-scorecard-head,.ls-scorecard-row{grid-template-columns:1fr 36px 36px 28px 28px 40px}
  .ptable-head,.ptable-row{grid-template-columns:22px 1fr 24px 24px 24px 24px 36px 48px;gap:4px;padding:10px 8px;font-size:13px}
  .be-balls-grid{grid-template-columns:repeat(4,1fr)}.score-row{flex-direction:column;align-items:stretch}
  .result-options{grid-template-columns:1fr}.modal-body{padding:14px}
}
`;
