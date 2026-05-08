import { useState, useEffect, useMemo } from "react";

// ============= ADMIN CONFIG =============
// Change this PIN to whatever you want — only you need to know it
const ADMIN_PIN = "271104";
const ADMIN_SESSION_KEY = "kpl-admin-session";

// ============= TOURNAMENT DATA =============
const TEAMS = {
  GG: {
    name: "Golden Gladiators",
    short: "GLADIATORS",
    abbr: "GG",
    primary: "#F5B800",
    glow: "rgba(245, 184, 0, 0.45)",
    soft: "rgba(245, 184, 0, 0.08)",
    border: "rgba(245, 184, 0, 0.25)",
    captain: "Sabu",
    viceCaptain: "Rachit",
    players: ["Charvi", "Hiten", "Khusagra", "Manya", "Adwit"],
  },
  MS: {
    name: "Mumbai Strikers",
    short: "STRIKERS",
    abbr: "MS",
    primary: "#3B9DFF",
    glow: "rgba(59, 157, 255, 0.45)",
    soft: "rgba(59, 157, 255, 0.08)",
    border: "rgba(59, 157, 255, 0.28)",
    captain: "Sparsh",
    viceCaptain: "Parv",
    players: ["Vivaan", "Sharvin", "Kiaan", "Dhriti", "Kabir"],
  },
  MC: {
    name: "Manhattan Challengers",
    short: "CHALLENGERS",
    abbr: "MC",
    primary: "#A855F7",
    glow: "rgba(168, 85, 247, 0.45)",
    soft: "rgba(168, 85, 247, 0.08)",
    border: "rgba(168, 85, 247, 0.28)",
    captain: "Shreesay",
    viceCaptain: "Prish",
    players: ["Sanvika", "Ajinkya", "Ovi", "Sharanya", "Udbhav"],
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

// ============= STANDINGS LOGIC =============
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

    const aRuns = Number(m.aRuns) || 0;
    const bRuns = Number(m.bRuns) || 0;
    const aOvers = Number(m.aOvers) || 0;
    const bOvers = Number(m.bOvers) || 0;

    A.runsFor += aRuns;
    A.oversFor += aOvers;
    A.runsAgainst += bRuns;
    A.oversAgainst += bOvers;

    B.runsFor += bRuns;
    B.oversFor += bOvers;
    B.runsAgainst += aRuns;
    B.oversAgainst += aOvers;

    if (m.result === "a") {
      A.W++;
      A.PTS += 2;
      B.L++;
    } else if (m.result === "b") {
      B.W++;
      B.PTS += 2;
      A.L++;
    } else if (m.result === "tie" || m.result === "nr") {
      A.T++;
      B.T++;
      A.PTS += 1;
      B.PTS += 1;
    }
  });

  Object.values(table).forEach((t) => {
    const rrFor = t.oversFor > 0 ? t.runsFor / t.oversFor : 0;
    const rrAg = t.oversAgainst > 0 ? t.runsAgainst / t.oversAgainst : 0;
    t.NRR = t.oversFor > 0 || t.oversAgainst > 0 ? rrFor - rrAg : 0;
  });

  return Object.values(table).sort((x, y) => {
    if (y.PTS !== x.PTS) return y.PTS - x.PTS;
    return y.NRR - x.NRR;
  });
}

// ============= TEAM BADGE SVGs =============
function TeamBadge({ teamKey, size = 56 }) {
  const t = TEAMS[teamKey];
  const id = `grad-${teamKey}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={t.primary} stopOpacity="1" />
          <stop offset="100%" stopColor={t.primary} stopOpacity="0.55" />
        </linearGradient>
        <filter id={`glow-${teamKey}`}>
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M32 4 L56 12 L56 32 C56 46 44 56 32 60 C20 56 8 46 8 32 L8 12 Z"
        fill={`url(#${id})`}
        stroke={t.primary}
        strokeWidth="1.5"
        opacity="0.95"
      />
      <path
        d="M32 4 L56 12 L56 32 C56 46 44 56 32 60 C20 56 8 46 8 32 L8 12 Z"
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="0.5"
      />
      {teamKey === "GG" && (
        <g filter={`url(#glow-${teamKey})`}>
          <path
            d="M22 26 Q22 18 32 18 Q42 18 42 26 L42 38 Q42 44 32 46 Q22 44 22 38 Z"
            fill="#1a1408"
            stroke="#fff"
            strokeWidth="0.6"
          />
          <rect x="24" y="28" width="16" height="2" fill="#1a1408" />
          <rect x="24" y="32" width="16" height="2" fill="#1a1408" />
          <path
            d="M28 18 Q32 10 36 18"
            fill="#1a1408"
            stroke="#fff"
            strokeWidth="0.6"
          />
          <line
            x1="14"
            y1="32"
            x2="22"
            y2="40"
            stroke="#fff"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <line
            x1="50"
            y1="32"
            x2="42"
            y2="40"
            stroke="#fff"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </g>
      )}
      {teamKey === "MS" && (
        <g filter={`url(#glow-${teamKey})`}>
          <circle
            cx="38"
            cy="24"
            r="6"
            fill="#fff"
            stroke="#0a1a2e"
            strokeWidth="0.6"
          />
          <path
            d="M34 22 Q38 24 42 22"
            fill="none"
            stroke="#0a1a2e"
            strokeWidth="0.5"
          />
          <path
            d="M34 26 Q38 24 42 26"
            fill="none"
            stroke="#0a1a2e"
            strokeWidth="0.5"
          />
          <line
            x1="14"
            y1="20"
            x2="28"
            y2="22"
            stroke="#fff"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.7"
          />
          <line
            x1="14"
            y1="26"
            x2="28"
            y2="26"
            stroke="#fff"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="14"
            y1="32"
            x2="28"
            y2="30"
            stroke="#fff"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.7"
          />
          <rect
            x="28"
            y="36"
            width="4"
            height="14"
            rx="1"
            fill="#fff"
            transform="rotate(-30, 30, 43)"
          />
          <rect
            x="27"
            y="48"
            width="6"
            height="3"
            rx="0.5"
            fill="#fff"
            transform="rotate(-30, 30, 49.5)"
          />
        </g>
      )}
      {teamKey === "MC" && (
        <g filter={`url(#glow-${teamKey})`}>
          <rect x="14" y="36" width="4" height="14" fill="#1a0a2e" />
          <rect x="20" y="30" width="5" height="20" fill="#1a0a2e" />
          <rect x="27" y="22" width="4" height="28" fill="#1a0a2e" />
          <polygon points="29,18 31,22 27,22" fill="#fff" />
          <rect x="33" y="28" width="6" height="22" fill="#1a0a2e" />
          <rect x="41" y="34" width="4" height="16" fill="#1a0a2e" />
          <rect x="47" y="38" width="3" height="12" fill="#1a0a2e" />
          <rect x="22" y="34" width="1" height="1" fill="#fff" />
          <rect x="29" y="28" width="1" height="1" fill="#fff" />
          <rect x="35" y="34" width="1" height="1" fill="#fff" />
        </g>
      )}
    </svg>
  );
}

// ============= ADMIN PIN MODAL =============
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
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: 4,
              padding: "10px 14px",
              borderRadius: 10,
              outline: "none",
              transition: "border-color 0.2s, background 0.2s",
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
              INCORRECT PIN — TRY AGAIN
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

// ============= MAIN APP =============
export default function TournamentApp() {
  const [matches, setMatches] = useState(SCHEDULE.map(blankMatch));
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [tab, setTab] = useState("standings");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  // Restore admin session on mount
  useEffect(() => {
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "1") {
      setIsAdmin(true);
    }
  }, []);

  // Load from localStorage (works on Vercel)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === 6) {
          setMatches(parsed);
        }
      }
    } catch (e) {
      // first run
    }
    setLoaded(true);
  }, []);

  // Save on change (after initial load)
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
    } catch (e) {
      console.error("Save failed", e);
    }
  }, [matches, loaded]);

  const standings = useMemo(() => calcStandings(matches), [matches]);

  const completedCount = matches.filter((m) => m.status === "completed").length;
  const liveMatch = matches.find((m) => m.status === "live");

  const updateMatch = (updated) => {
    setMatches((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  };

  const resetAll = () => {
    setMatches(SCHEDULE.map(blankMatch));
    setShowResetConfirm(false);
  };

  const logout = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setIsAdmin(false);
  };

  return (
    <div className="app-root">
      <style>{styles}</style>

      {/* Stadium light beams */}
      <div className="stadium-bg">
        <div className="beam beam-1" />
        <div className="beam beam-2" />
        <div className="beam beam-3" />
        <div className="beam beam-4" />
      </div>

      {/* HEADER */}
      <header className="hero">
        <div className="lights">
          <div className="light l1">✦</div>
          <div className="light l2">✦</div>
        </div>

        {/* Admin lock button — top-right corner */}
        <button
          className="admin-lock-btn"
          onClick={() => (isAdmin ? logout() : setShowAdminModal(true))}
          title={isAdmin ? "Click to log out of admin" : "Admin login"}
        >
          {isAdmin ? "🔓" : "🔒"}
        </button>

        <div className="hero-eyebrow">3-TEAM ROUND ROBIN</div>
        <h1 className="hero-title">
          <span className="t-gold">KIDS</span>
          <span className="t-white">PREMIER</span>
          <span className="t-purple">LEAGUE</span>
        </h1>
        <div className="hero-sub">ONE LEAGUE · ONE CHAMPION</div>
        <div className="hero-stat">
          <span className="stat-num">{completedCount}</span>
          <span className="stat-label">/ 6 MATCHES PLAYED</span>
        </div>
      </header>

      {/* LIVE MATCH BANNER — only clickable/tappable for admin */}
      {liveMatch && (
        <LiveBanner
          match={liveMatch}
          onTap={isAdmin ? () => setEditing(liveMatch) : undefined}
          isAdmin={isAdmin}
        />
      )}

      {/* TABS */}
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
          />
        )}
        {tab === "teams" && <Squads />}
      </main>

      {/* FOOTER */}
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

      {/* MODALS */}
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
          body="This wipes all match results and points for everyone viewing this. Cannot be undone."
          onConfirm={resetAll}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
    </div>
  );
}

// ============= STANDINGS TABLE =============
function Standings({ standings }) {
  const champion = standings[0];
  const allZero = standings.every((s) => s.M === 0);

  return (
    <section className="section">
      <SectionTitle text="POINTS TABLE" accent="#F5B800" />

      {!allZero && (
        <div
          className="leader-card"
          style={{
            background: `linear-gradient(135deg, ${TEAMS[champion.key].soft}, transparent)`,
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
                    ? `linear-gradient(90deg, ${TEAMS[row.key].soft}, transparent)`
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
          <span className="rule-k">TIE / NR</span>
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

// ============= LIVE BANNER =============
function LiveBanner({ match, onTap, isAdmin }) {
  const A = TEAMS[match.a];
  const B = TEAMS[match.b];
  return (
    <div
      className="live-banner"
      onClick={onTap}
      style={{ cursor: isAdmin ? "pointer" : "default" }}
    >
      <div className="live-pulse">
        <span className="live-dot" /> LIVE NOW
      </div>
      <div className="live-teams">
        <div className="live-team">
          <TeamBadge teamKey={match.a} size={36} />
          <span style={{ color: A.primary }}>{A.short}</span>
        </div>
        <div className="live-vs">VS</div>
        <div className="live-team">
          <TeamBadge teamKey={match.b} size={36} />
          <span style={{ color: B.primary }}>{B.short}</span>
        </div>
      </div>
      {isAdmin ? (
        <div className="live-cta">TAP TO UPDATE →</div>
      ) : (
        <div className="live-cta" style={{ color: "#888" }}>
          MATCH IN PROGRESS
        </div>
      )}
    </div>
  );
}

// ============= MATCHES =============
function Matches({ matches, onEdit, onUpdateMatch, isAdmin }) {
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
          />
        ))}
      </div>
    </section>
  );
}

function MatchCard({ match, num, onEdit, onUpdateMatch, isAdmin }) {
  const A = TEAMS[match.a];
  const B = TEAMS[match.b];
  const completed = match.status === "completed";
  const live = match.status === "live";

  let resultText = "";
  if (completed) {
    if (match.result === "a") resultText = `${A.short} WON`;
    else if (match.result === "b") resultText = `${B.short} WON`;
    else if (match.result === "tie") resultText = "TIE";
    else if (match.result === "nr") resultText = "NO RESULT";
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

      {/* Edit controls: only visible to admin */}
      {isAdmin && (
        <div className="match-actions">
          {!completed && (
            <button className="mini-btn" onClick={toggleLive}>
              {live ? "End Live" : "Mark Live"}
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

// ============= RESULT MODAL =============
function ResultModal({ match, onClose, onSave }) {
  const A = TEAMS[match.a];
  const B = TEAMS[match.b];
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
    const ar = Number(form.aRuns);
    const br = Number(form.bRuns);
    if (form.aRuns === "" || form.bRuns === "") return null;
    if (ar > br) return "a";
    if (br > ar) return "b";
    return "tie";
  }, [form.aRuns, form.bRuns]);

  const save = () => {
    const result = form.result === "auto" ? computedResult : form.result;
    if (!result) {
      alert("Enter scores or pick a result type.");
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

  const reopenAsUpcoming = () => {
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
          <ScoreInput
            team={A}
            runs={form.aRuns}
            wkts={form.aWickets}
            overs={form.aOvers}
            onRuns={(v) => set("aRuns", v)}
            onWkts={(v) => set("aWickets", v)}
            onOvers={(v) => set("aOvers", v)}
          />
          <div className="vs-line">VS</div>
          <ScoreInput
            team={B}
            runs={form.bRuns}
            wkts={form.bWickets}
            overs={form.bOvers}
            onRuns={(v) => set("bRuns", v)}
            onWkts={(v) => set("bWickets", v)}
            onOvers={(v) => set("bOvers", v)}
          />

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
            <button className="btn ghost" onClick={reopenAsUpcoming}>
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

function ScoreInput({ team, runs, wkts, overs, onRuns, onWkts, onOvers }) {
  return (
    <div className="score-row" style={{ borderColor: team.border }}>
      <div className="score-team">
        <TeamBadge teamKey={team.abbr} size={36} />
        <div className="score-team-name" style={{ color: team.primary }}>
          {team.short}
        </div>
      </div>
      <div className="score-fields">
        <div className="sf">
          <label>RUNS</label>
          <input
            type="number"
            inputMode="numeric"
            value={runs}
            onChange={(e) => onRuns(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="sf small">
          <label>WKTS</label>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            max="10"
            value={wkts}
            onChange={(e) => onWkts(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="sf">
          <label>OVERS</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={overs}
            onChange={(e) => onOvers(e.target.value)}
            placeholder="0.0"
          />
        </div>
      </div>
    </div>
  );
}

// ============= SQUADS =============
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
              background: `linear-gradient(180deg, ${t.soft}, transparent 80%)`,
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

// ============= UTILS =============
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

// ============= STYLES =============
const styles = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@400;500;600;700&family=Oswald:wght@500;700&display=swap');

/* ===== FULL SCREEN FIX ===== */
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  min-height: 100%;
  overflow-x: hidden;
}

* { box-sizing: border-box; }

.app-root {
  min-height: 100vh;
  width: 100%;
  background:
    radial-gradient(ellipse at top, rgba(245,184,0,0.06), transparent 50%),
    radial-gradient(ellipse at bottom right, rgba(168,85,247,0.07), transparent 60%),
    radial-gradient(ellipse at bottom left, rgba(59,157,255,0.07), transparent 60%),
    linear-gradient(180deg, #08080d 0%, #0d0d18 50%, #08080d 100%);
  color: #fff;
  font-family: 'Rajdhani', sans-serif;
  padding-bottom: 80px;
  position: relative;
  overflow-x: hidden;
}

.stadium-bg {
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
}
.beam {
  position: absolute;
  top: -100px;
  width: 200px;
  height: 600px;
  background: linear-gradient(180deg, rgba(245,184,0,0.12), transparent);
  filter: blur(40px);
  transform-origin: top center;
}
.beam-1 { left: 5%; transform: rotate(15deg); }
.beam-2 { left: 25%; transform: rotate(-8deg); animation: sway 12s ease-in-out infinite alternate; }
.beam-3 { right: 25%; transform: rotate(8deg); animation: sway 14s ease-in-out infinite alternate-reverse; }
.beam-4 { right: 5%; transform: rotate(-15deg); }

@keyframes sway {
  from { opacity: 0.6; }
  to { opacity: 1; }
}

/* HERO */
.hero {
  position: relative;
  z-index: 1;
  padding: 36px 20px 28px;
  text-align: center;
}
.lights { position: absolute; top: 16px; left: 0; right: 0; display: flex; justify-content: space-between; padding: 0 24px; }
.light { color: #F5B800; opacity: 0.6; font-size: 24px; animation: twinkle 3s ease-in-out infinite alternate; }
.l2 { animation-delay: 1.5s; }
@keyframes twinkle { from { opacity: 0.3; } to { opacity: 1; text-shadow: 0 0 20px #F5B800; } }

/* ADMIN LOCK BUTTON */
.admin-lock-btn {
  position: absolute;
  top: 14px;
  right: 14px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 50%;
  width: 36px;
  height: 36px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 10;
}
.admin-lock-btn:hover {
  background: rgba(255,255,255,0.1);
  border-color: rgba(245,184,0,0.4);
  transform: scale(1.1);
}

.hero-eyebrow {
  font-family: 'Rajdhani', sans-serif;
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 4px;
  color: #F5B800;
  margin-bottom: 8px;
  opacity: 0.85;
}
.hero-title {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(44px, 11vw, 76px);
  line-height: 0.92;
  letter-spacing: 1px;
  margin: 0 0 12px;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.t-gold { color: #F5B800; text-shadow: 0 0 30px rgba(245,184,0,0.4); }
.t-white { color: #fff; }
.t-purple {
  background: linear-gradient(90deg, #A855F7, #3B9DFF);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.hero-sub {
  font-weight: 600;
  letter-spacing: 3px;
  font-size: 12px;
  color: #aaa;
  margin-bottom: 20px;
}
.hero-stat {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  padding: 8px 18px;
  background: rgba(245,184,0,0.08);
  border: 1px solid rgba(245,184,0,0.3);
  border-radius: 999px;
}
.stat-num { font-family: 'Bebas Neue'; font-size: 24px; color: #F5B800; }
.stat-label { font-size: 11px; letter-spacing: 2px; font-weight: 600; color: #ccc; }

/* LIVE BANNER */
.live-banner {
  position: relative;
  z-index: 1;
  margin: 0 16px 16px;
  padding: 14px 16px;
  background: linear-gradient(90deg, rgba(220, 38, 38, 0.18), rgba(220, 38, 38, 0.05));
  border: 1px solid rgba(220, 38, 38, 0.5);
  border-radius: 14px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 16px;
  align-items: center;
  transition: transform 0.15s;
}
.live-banner:hover { transform: translateY(-1px); }
.live-pulse {
  display: flex; align-items: center; gap: 6px;
  font-family: 'Bebas Neue';
  letter-spacing: 2px;
  color: #ff4444;
  font-size: 14px;
}
.live-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #ff3333;
  box-shadow: 0 0 12px #ff3333;
  animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
.live-teams { display: flex; align-items: center; gap: 12px; justify-content: center; }
.live-team { display: flex; align-items: center; gap: 8px; font-family: 'Bebas Neue'; letter-spacing: 1.5px; font-size: 16px; }
.live-vs { color: #888; font-family: 'Bebas Neue'; font-size: 14px; }
.live-cta { font-size: 11px; letter-spacing: 1.5px; color: #ff8888; font-weight: 600; }

/* TABS */
.tabs {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  gap: 4px;
  padding: 10px 16px;
  background: rgba(8, 8, 13, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.tab {
  flex: 1;
  padding: 10px 8px;
  background: transparent;
  border: 1px solid transparent;
  color: #888;
  font-family: 'Rajdhani';
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 2px;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
}
.tab:hover { color: #ccc; }
.tab.active {
  color: #F5B800;
  background: rgba(245,184,0,0.1);
  border-color: rgba(245,184,0,0.3);
}

/* CONTENT */
.content { position: relative; z-index: 1; padding: 24px 16px 40px; }
.section { max-width: 720px; margin: 0 auto; }

.sec-title {
  display: flex; align-items: center; gap: 12px;
  margin: 0 0 18px;
}
.sec-line { flex: 1; height: 1px; opacity: 0.4; }
.sec-text {
  font-family: 'Bebas Neue';
  letter-spacing: 4px;
  color: #F5B800;
  font-size: 18px;
}

/* LEADER CARD */
.leader-card {
  border: 1px solid;
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 16px;
}
.leader-rank { font-size: 10px; letter-spacing: 3px; color: #999; font-weight: 700; margin-bottom: 8px; }
.leader-team { display: flex; align-items: center; gap: 12px; }
.leader-name { font-family: 'Bebas Neue'; font-size: 22px; letter-spacing: 1px; }
.leader-pts { font-size: 12px; letter-spacing: 1.5px; color: #aaa; font-weight: 600; }
.trophy { margin-left: auto; font-size: 28px; filter: drop-shadow(0 0 12px rgba(245,184,0,0.6)); }

/* POINTS TABLE */
.table-wrap { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden; }
.ptable { display: flex; flex-direction: column; }
.ptable-head, .ptable-row {
  display: grid;
  grid-template-columns: 28px 1fr 32px 32px 32px 32px 44px 56px;
  align-items: center;
  gap: 6px;
  padding: 12px 12px;
}
.ptable-head {
  background: rgba(245,184,0,0.06);
  border-bottom: 1px solid rgba(245,184,0,0.2);
  font-family: 'Rajdhani';
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 2px;
  color: #F5B800;
}
.ptable-row {
  border-bottom: 1px solid rgba(255,255,255,0.05);
  font-family: 'Rajdhani';
}
.ptable-row:last-child { border-bottom: none; }
.col-pos { font-family: 'Bebas Neue'; font-size: 18px; color: #888; text-align: center; }
.col-team { display: flex; align-items: center; gap: 8px; font-family: 'Bebas Neue'; letter-spacing: 1px; font-size: 15px; }
.col-num { text-align: center; font-family: 'Rajdhani'; font-weight: 600; font-size: 15px; color: #ddd; }
.col-num.bold { font-weight: 700; }
.col-num.pts { font-family: 'Bebas Neue'; font-size: 20px; }
.col-num.nrr { font-size: 13px; color: #aaa; font-variant-numeric: tabular-nums; }

.rules {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 14px;
}
.rule {
  display: flex; flex-direction: column; align-items: center;
  padding: 10px 6px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
}
.rule-k { font-size: 10px; letter-spacing: 1.5px; color: #888; font-weight: 700; }
.rule-v { font-family: 'Bebas Neue'; font-size: 18px; color: #F5B800; margin-top: 2px; }

/* MATCHES */
.match-list { display: flex; flex-direction: column; gap: 12px; }
.match-card {
  position: relative;
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  padding: 14px 14px 12px;
  transition: all 0.2s;
}
.match-card:hover { border-color: rgba(245,184,0,0.3); transform: translateY(-1px); }
.match-card.done { background: rgba(0,0,0,0.6); }
.match-card.live {
  border-color: rgba(220,38,38,0.5);
  background: linear-gradient(135deg, rgba(220,38,38,0.08), rgba(0,0,0,0.4));
  animation: liveBorder 2s ease-in-out infinite alternate;
}
@keyframes liveBorder { from { box-shadow: 0 0 0 rgba(220,38,38,0); } to { box-shadow: 0 0 24px rgba(220,38,38,0.25); } }
.match-num {
  position: absolute;
  top: 10px; left: 12px;
  font-family: 'Bebas Neue'; font-size: 11px; letter-spacing: 1px; color: #666;
}
.match-body {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 8px;
  align-items: center;
  padding: 6px 0 12px;
}
.match-side { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.match-side.right { align-items: flex-end; text-align: right; }
.match-team-name { font-family: 'Bebas Neue'; font-size: 15px; letter-spacing: 1px; line-height: 1; }
.match-score { font-family: 'Bebas Neue'; font-size: 22px; color: #fff; letter-spacing: 0.5px; }
.match-score .ov { font-size: 12px; color: #888; font-family: 'Rajdhani'; font-weight: 600; }
.match-vs-col { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.match-vs { font-family: 'Bebas Neue'; font-size: 14px; color: #555; letter-spacing: 1.5px; }
.match-result-pill {
  font-family: 'Bebas Neue';
  font-size: 11px;
  letter-spacing: 1.5px;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid;
  white-space: nowrap;
}
.status-up {
  font-size: 9px; letter-spacing: 2px; color: #666; font-weight: 700;
}
.status-live {
  display: flex; align-items: center; gap: 4px;
  font-family: 'Bebas Neue'; letter-spacing: 1.5px; font-size: 11px;
  color: #ff5555;
}
.live-dot-sm { width: 6px; height: 6px; border-radius: 50%; background: #ff3333; box-shadow: 0 0 8px #ff3333; animation: pulse 1.2s infinite; }

.match-actions {
  display: flex;
  gap: 6px;
  border-top: 1px dashed rgba(255,255,255,0.08);
  padding-top: 10px;
}
.mini-btn {
  flex: 1;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.1);
  color: #aaa;
  padding: 7px 10px;
  font-family: 'Rajdhani';
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 1.5px;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.15s;
}
.mini-btn:hover { border-color: rgba(255,255,255,0.25); color: #fff; }
.mini-btn.primary {
  background: rgba(245,184,0,0.12);
  border-color: rgba(245,184,0,0.4);
  color: #F5B800;
}
.mini-btn.primary:hover { background: rgba(245,184,0,0.2); }

/* SQUADS */
.squads {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
.squad-card {
  border: 1px solid;
  border-radius: 14px;
  padding: 16px 14px;
}
.squad-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.squad-name { font-family: 'Bebas Neue'; font-size: 22px; letter-spacing: 2px; }
.squad-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.squad-row {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 8px;
  background: rgba(0,0,0,0.25);
  border-radius: 7px;
  font-family: 'Rajdhani';
  font-weight: 600;
}
.player { color: #ddd; font-size: 14px; letter-spacing: 0.5px; }
.badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 22px; height: 22px; padding: 0 6px;
  border-radius: 6px;
  font-family: 'Bebas Neue';
  font-size: 11px; letter-spacing: 1px;
}
.badge.outline { background: transparent; border: 1px solid; }
.dot { width: 6px; height: 6px; border-radius: 50%; margin-left: 8px; opacity: 0.6; }

/* MODAL */
.modal-back {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.78);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 16px;
  animation: fadeIn 0.2s ease;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.modal {
  background: linear-gradient(180deg, #14141f, #0a0a12);
  border: 1px solid rgba(245,184,0,0.25);
  border-radius: 18px 18px 14px 14px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.25s ease;
}
.modal.small { max-width: 420px; }
@keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

.modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.modal-title {
  font-family: 'Bebas Neue';
  font-size: 22px;
  letter-spacing: 2px;
  color: #F5B800;
}
.modal-close {
  background: transparent; border: none; color: #888; font-size: 18px; cursor: pointer;
  width: 32px; height: 32px; border-radius: 50%; transition: all 0.15s;
}
.modal-close:hover { background: rgba(255,255,255,0.06); color: #fff; }

.modal-body { padding: 16px 20px; }
.modal-foot {
  padding: 14px 20px 18px;
  border-top: 1px solid rgba(255,255,255,0.06);
  display: flex; gap: 10px; justify-content: flex-end;
}

.score-row {
  border: 1px solid;
  background: rgba(0,0,0,0.3);
  border-radius: 12px;
  padding: 12px;
  display: flex; align-items: center; gap: 12px;
}
.score-team { display: flex; align-items: center; gap: 8px; min-width: 110px; }
.score-team-name { font-family: 'Bebas Neue'; letter-spacing: 1px; font-size: 14px; }
.score-fields { flex: 1; display: grid; grid-template-columns: 1fr 0.7fr 1fr; gap: 6px; }
.sf { display: flex; flex-direction: column; gap: 3px; }
.sf label {
  font-size: 9px; letter-spacing: 1.5px; color: #888; font-weight: 700;
}
.sf input {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  color: #fff;
  font-family: 'Bebas Neue';
  font-size: 18px;
  letter-spacing: 1px;
  padding: 6px 8px;
  border-radius: 7px;
  width: 100%;
  outline: none;
  transition: border-color 0.15s;
  -moz-appearance: textfield;
}
.sf input:focus { border-color: #F5B800; }
.sf input::-webkit-outer-spin-button, .sf input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

.vs-line { text-align: center; font-family: 'Bebas Neue'; color: #555; letter-spacing: 3px; padding: 8px 0; }

.result-picker { margin-top: 18px; }
.result-label { font-size: 10px; letter-spacing: 2px; color: #888; font-weight: 700; margin-bottom: 8px; }
.result-options { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.ropt {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.1);
  color: #aaa;
  padding: 9px 10px;
  font-family: 'Rajdhani';
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 1.2px;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}
.ropt:hover { border-color: rgba(255,255,255,0.25); color: #fff; }
.ropt.active { background: rgba(245,184,0,0.1); border-color: #F5B800; color: #F5B800; }
.ropt-hint { color: #888; font-size: 10px; margin-left: 4px; }

/* BUTTONS */
.btn {
  padding: 10px 18px;
  font-family: 'Rajdhani';
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 2px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}
.btn.primary {
  background: linear-gradient(180deg, #FFD93B, #F5B800);
  color: #1a1408;
  border-color: #F5B800;
  box-shadow: 0 0 16px rgba(245,184,0,0.3);
}
.btn.primary:hover { transform: translateY(-1px); box-shadow: 0 0 24px rgba(245,184,0,0.5); }
.btn.ghost {
  background: transparent;
  border-color: rgba(255,255,255,0.15);
  color: #aaa;
}
.btn.ghost:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
.btn.danger {
  background: rgba(220,38,38,0.15);
  border-color: rgba(220,38,38,0.5);
  color: #ff6666;
}
.btn.danger:hover { background: rgba(220,38,38,0.25); }

/* FOOTER */
.foot {
  text-align: center;
  padding: 36px 20px 12px;
  position: relative;
  z-index: 1;
}
.foot-line { font-size: 11px; letter-spacing: 3px; color: #666; font-weight: 600; }
.foot-tag {
  font-family: 'Bebas Neue';
  font-size: 24px;
  letter-spacing: 3px;
  color: #F5B800;
  margin: 6px 0 18px;
  text-shadow: 0 0 20px rgba(245,184,0,0.3);
}
.reset-btn {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.1);
  color: #666;
  padding: 8px 14px;
  font-family: 'Rajdhani';
  font-size: 11px;
  letter-spacing: 1.5px;
  font-weight: 600;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.15s;
}
.reset-btn:hover { border-color: rgba(220,38,38,0.4); color: #ff6666; }

/* RESPONSIVE */
@media (max-width: 480px) {
  .hero-title { font-size: 52px; }
  .ptable-head, .ptable-row {
    grid-template-columns: 22px 1fr 24px 24px 24px 24px 36px 48px;
    gap: 4px;
    padding: 10px 8px;
    font-size: 13px;
  }
  .col-team { font-size: 13px; }
  .col-num { font-size: 13px; }
  .col-num.pts { font-size: 17px; }
  .col-num.nrr { font-size: 11px; }
  .live-banner { grid-template-columns: 1fr; text-align: center; gap: 8px; }
  .score-row { flex-direction: column; align-items: stretch; }
  .score-team { justify-content: center; }
  .result-options { grid-template-columns: 1fr; }
  .modal-body { padding: 14px; }
}
`;
