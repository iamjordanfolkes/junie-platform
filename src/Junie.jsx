import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── FONTS ────────────────────────────────────────────────────────────────────
const FONT_LINK = document.createElement("link");
FONT_LINK.rel = "stylesheet";
FONT_LINK.href = "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap";
document.head.appendChild(FONT_LINK);

const STYLE = document.createElement("style");
STYLE.textContent = `
  @keyframes junieUp { from { opacity:0; transform:translateY(9px) } to { opacity:1; transform:none } }
  @keyframes junieDot { 0%,60%,100% { transform:translateY(0);opacity:.4 } 30% { transform:translateY(-4px);opacity:1 } }
  @keyframes junieFade { from { opacity:0 } to { opacity:1 } }
  .j-scroll::-webkit-scrollbar { width:0 }
  .j-scroll { scrollbar-width:none }
  .j-ta::placeholder { color:inherit; opacity:.45 }
  .j-chip { transition: background .16s, border-color .16s, transform .12s }
  .j-chip:active { transform: scale(.96) }
  * { box-sizing: border-box; margin:0; padding:0; -webkit-tap-highlight-color: transparent }
`;
document.head.appendChild(STYLE);

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#F6F1E8", bgSubtle: "#EFE8DB", surface: "#FFFFFF",
  ink: "#1F1B16", muted: "#8C8174", faint: "#B8AD9D", line: "rgba(31,27,22,0.10)",
  accent: "#B07F22", accentSoft: "rgba(176,127,34,0.12)",
  userBg: "#DBAB3D", userInk: "#241B07",
  junieBg: "#FFFFFF", junieInk: "#211D17", junieLine: "rgba(31,27,22,0.07)",
  avatarBg: "#DBAB3D", avatarInk: "#241B07",
  sendBg: "#CB9A2E", sendInk: "#231A06",
  sendIdleBg: "rgba(31,27,22,0.06)", sendIdleInk: "#B8AD9D",
  pillLine: "rgba(31,27,22,0.14)",
  danger: "#C0392B", dangerSoft: "rgba(192,57,43,0.08)",
};
const T = {
  font: "'DM Sans', system-ui, sans-serif",
  wm: "'Syne', sans-serif", wmW: 800,
  r: { bubble: 21, card: 20, chip: 999, input: 24 },
};

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const LS_KEY = "junie-platform-v1";
function lsLoad() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } }
function lsSave(d) { try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch {} }

const IS_DEPLOYED = typeof window !== "undefined"
  && window.location.hostname !== "localhost"
  && !window.location.hostname.includes("127.0.0.1")
  && window.location.protocol !== "file:";

async function remoteLoad(eventId) {
  if (!IS_DEPLOYED) return null;
  try {
    const res = await fetch(`/api/state?event=${eventId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function remoteSave(eventId, payload) {
  if (!IS_DEPLOYED) return;
  try {
    await fetch(`/api/state?event=${eventId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {}
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function genId() { return Math.random().toString(36).slice(2, 9); }

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T19:00:00");
  return Math.max(0, Math.ceil((target - new Date()) / 86400000));
}

function buildWeekDays(mainDate, endDate) {
  if (!mainDate) return [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Trip mode: show every day from start to end
  if (endDate && endDate > mainDate) {
    const start = new Date(mainDate + "T12:00:00");
    const end = new Date(endDate + "T12:00:00");
    const days = [];
    const cur = new Date(start);
    while (cur <= end) {
      days.push({
        dateStr: cur.toISOString().slice(0, 10),
        label: dayNames[cur.getDay()],
        dayNum: cur.getDate(),
        month: cur.getMonth(),
        isMain: cur.toISOString().slice(0, 10) === mainDate,
        isEnd: cur.toISOString().slice(0, 10) === endDate,
        offset: 0,
      });
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }

  // Event mode: ±5 days around main date
  const main = new Date(mainDate + "T12:00:00");
  const days = [];
  for (let i = -5; i <= 3; i++) {
    const d = new Date(main);
    d.setDate(main.getDate() + i);
    days.push({
      dateStr: d.toISOString().slice(0, 10),
      label: dayNames[d.getDay()],
      dayNum: d.getDate(),
      month: d.getMonth(),
      isMain: i === 0,
      isEnd: false,
      offset: i,
    });
  }
  return days;
}

// ─── API ──────────────────────────────────────────────────────────────────────
const IS_NETLIFY = IS_DEPLOYED;
const CHAT_API = IS_NETLIFY ? "/api/chat" : "https://api.anthropic.com/v1/messages";

async function callAPI(body) {
  const res = await fetch(CHAT_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
}

function buildPersona(event) {
  const briefLines = (event.brief || []).map(r => `• ${r.key}: ${r.value}`).join("\n");
  return [
    `You are Junie — a warm, witty, sharp personal planning assistant for ONE occasion: ${({event:"a party or event",trip:"a group trip",getaway:"a getaway",date:"a date night",selfcare:"a self-care day"})[event.occasionType] || "a special occasion"}. You talk like a stylish well-traveled friend texting back — never corporate, never a help-desk. Tailor everything to the occasion type: itineraries and logistics for trips, romance and pacing for date nights, restoration and treats for self-care days, hosting and vibe for parties.`,
    "",
    "THE EVENT:",
    `• Name: ${event.name || "Untitled event"}`,
    `• Host: ${event.hostName || "the host"}`,
    event.occasionType === "trip"
      ? `• Dates: ${event.mainDate || "TBD"} to ${event.endDate || "TBD"}`
      : `• Date: ${event.mainDate || "TBD"}`,
    `• Venue/Location: ${event.venue || "TBD"}`,
    briefLines,
    "",
    "HOW YOU WRITE: Short. Like a text thread. Specific and opinionated. Warm and a little funny. Never markdown symbols. Never disclaim about being an AI.",
  ].join("\n");
}

async function generatePrompts(event) {
  const persona = buildPersona(event);
  const ask = `Based on this event brief, generate exactly 6 short, specific, useful prompt suggestions the host might want to ask their party planner. Return ONLY a JSON array of 6 strings. No preamble, no markdown.`;
  try {
    const txt = await callAPI({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      messages: [{ role: "user", content: persona + "\n\n" + ask }],
    });
    const chips = JSON.parse(txt.replace(/```json|```/g, "").trim());
    if (Array.isArray(chips)) return chips.slice(0, 6);
  } catch {}
  return [
    `What should guests wear to ${event.name || "the event"}?`,
    "Cocktail ideas for the vibe",
    "Best late-night food nearby",
    "Build a playlist arc for the night",
    "Draft the invite text",
    "Rain backup plan",
  ];
}

async function getReply(history, event) {
  const persona = buildPersona(event);
  const apiMessages = [
    { role: "user", content: persona },
    { role: "assistant", content: "Got it — I'm Junie. I know the whole event. Ask me anything." },
    ...history.map(m => ({ role: m.role, content: m.content })),
  ];
  try {
    const txt = await callAPI({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: apiMessages,
    });
    if (txt) return txt;
  } catch {}
  return "I'd need web search live to give you the best answer. Try me on the deployed version!";
}

// ─── SHARED SMALL COMPONENTS ──────────────────────────────────────────────────
function Avatar({ size = 30, letter = "J" }) {
  return (
    <div style={{ width: size, height: size, flexShrink: 0, borderRadius: "50%", background: C.avatarBg, color: C.avatarInk, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.wm, fontWeight: 800, fontSize: size * 0.52, lineHeight: 1 }}>{letter}</div>
  );
}

function SectionLabel({ children, style }) {
  return <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted, ...style }}>{children}</div>;
}

function Btn({ children, onClick, primary, danger, disabled, style }) {
  return (
    <button onClick={onClick} disabled={disabled} className="j-chip" style={{
      border: primary ? "none" : danger ? `1px solid ${C.danger}` : `1px solid ${C.pillLine}`,
      background: primary ? C.sendBg : danger ? C.dangerSoft : "transparent",
      color: primary ? C.sendInk : danger ? C.danger : C.ink,
      borderRadius: 999, padding: "10px 18px", fontFamily: T.font,
      fontSize: 13.5, fontWeight: 600, cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.5 : 1, ...style,
    }}>{children}</button>
  );
}

function Dots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", height: 16 }}>
      {[0, 1, 2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, animation: `junieDot 1.1s ${i * 0.16}s infinite ease-in-out` }} />)}
    </div>
  );
}

// ─── EVENT PICKER / DASHBOARD ─────────────────────────────────────────────────
function EventCard({ event, onSelect, onDelete }) {
  const days = daysUntil(event.mainDate);
  return (
    <div onClick={() => onSelect(event.id)} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: T.r.card, padding: "18px 18px 16px", cursor: "pointer", animation: "junieUp .3s ease", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: T.wm, fontWeight: 800, fontSize: 20, letterSpacing: "-0.01em", color: C.ink, lineHeight: 1.1 }}>{event.name || "Untitled event"}</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 5 }}>{event.venue || "Venue TBD"} · {event.mainDate || "Date TBD"}</div>
        </div>
        {days !== null && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontFamily: T.wm, fontWeight: 800, fontSize: 28, color: C.accent, lineHeight: 1 }}>{days}</div>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>days</div>
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
        <div style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>
          {event.role === "creator" ? "✦ Creator" : "✦ Collaborator"}
        </div>
        <button onClick={e => { e.stopPropagation(); onDelete(event.id); }} style={{ border: "none", background: "transparent", color: C.faint, cursor: "pointer", fontSize: 12, fontFamily: T.font }}>Remove</button>
      </div>
    </div>
  );
}

function Dashboard({ events, onCreate, onSelect, onDelete, onJoin }) {
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    const code = joinCode.trim();
    if (!code) return;
    setJoining(true);
    await onJoin(code);
    setJoining(false);
    setJoinCode("");
  };

  return (
    <div className="j-scroll" style={{ height: "100%", overflowY: "auto", background: C.bg }}>
      <div style={{ padding: "52px 20px 32px" }}>
        <div style={{ fontFamily: T.wm, fontWeight: 800, fontSize: 34, letterSpacing: "-0.02em", color: C.ink, lineHeight: 1 }}>Junie</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 6, marginBottom: 28 }}>Plan anything worth looking forward to.</div>

        {events.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
            {events.map(ev => <EventCard key={ev.id} event={ev} onSelect={onSelect} onDelete={onDelete} />)}
          </div>
        )}

        {events.length === 0 && (
          <div style={{ background: C.surface, border: `1px dashed ${C.pillLine}`, borderRadius: T.r.card, padding: "32px 20px", textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🎉</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>Nothing planned yet</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>A trip, a party, a date night, a self-care day — start one or join with an invite code.</div>
          </div>
        )}

        <Btn primary onClick={onCreate} style={{ width: "100%", marginBottom: 12 }}>+ Plan something new</Btn>

        <div style={{ display: "flex", gap: 8 }}>
          <input value={joinCode} onChange={e => setJoinCode(e.target.value)} onKeyDown={e => e.key === "Enter" && handleJoin()} placeholder="Join with invite code…" style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 14px", fontFamily: T.font, fontSize: 13.5, color: C.ink, background: C.surface, outline: "none" }} />
          <Btn onClick={handleJoin} disabled={!joinCode.trim() || joining}>{joining ? "…" : "Join"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
const ONBOARDING_STEPS = ["basics", "details", "prompts"];

function OnboardingStep({ step, data, onChange }) {
  if (step === "basics") {
    const isTrip = ["trip", "getaway"].includes(data.occasionType);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: T.wm, color: C.ink }}>What's the occasion?</div>
        <div style={{ fontSize: 13.5, color: C.muted }}>Tell Junie the basics and she'll take it from here.</div>

        {/* Occasion type picker */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[
            { id: "event", label: "🎉 Party" },
            { id: "trip", label: "✈️ Trip" },
            { id: "getaway", label: "🏝 Getaway" },
            { id: "date", label: "🌹 Date night" },
            { id: "selfcare", label: "🧖 Self-care" },
            { id: "other", label: "✨ Something else" },
          ].map(t => {
            const on = (data.occasionType || "event") === t.id;
            return (
              <button key={t.id} onClick={() => onChange("occasionType", t.id)} className="j-chip" style={{ border: on ? "none" : `1px solid ${C.pillLine}`, background: on ? C.sendBg : "transparent", color: on ? C.sendInk : C.ink, borderRadius: 999, padding: "9px 15px", fontFamily: T.font, fontSize: 13, fontWeight: on ? 700 : 500, cursor: "pointer" }}>
                {t.label}
              </button>
            );
          })}
        </div>

        {[
          { key: "name", label: isTrip ? "Trip name" : "Event name", placeholder: isTrip ? "e.g. Madrid Birthday Trip, Girls Trip…" : "e.g. Jordanteenth, Mia's 30th…" },
          { key: "hostName", label: "Your name", placeholder: "Who's organizing?" },
          { key: "venue", label: isTrip ? "Destination" : data.occasionType === "date" ? "Spot / neighborhood" : data.occasionType === "selfcare" ? "Where (home, spa, city…)" : "Venue", placeholder: isTrip ? "e.g. Madrid, Spain" : "Name, address, or area" },
        ].map(f => (
          <div key={f.key}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>{f.label}</div>
            <input type="text" value={data[f.key] || ""} onChange={e => onChange(f.key, e.target.value)} placeholder={f.placeholder} style={{ width: "100%", border: `1px solid ${C.line}`, borderRadius: 12, padding: "11px 14px", fontFamily: T.font, fontSize: 14, color: C.ink, background: C.surface, outline: "none" }} />
          </div>
        ))}

        {/* Date fields — single for event, range for trip */}
        {isTrip ? (
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>Start date</div>
              <input type="date" value={data.mainDate || ""} onChange={e => onChange("mainDate", e.target.value)} style={{ width: "100%", border: `1px solid ${C.line}`, borderRadius: 12, padding: "11px 14px", fontFamily: T.font, fontSize: 14, color: C.ink, background: C.surface, outline: "none" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>End date</div>
              <input type="date" value={data.endDate || ""} onChange={e => onChange("endDate", e.target.value)} style={{ width: "100%", border: `1px solid ${C.line}`, borderRadius: 12, padding: "11px 14px", fontFamily: T.font, fontSize: 14, color: C.ink, background: C.surface, outline: "none" }} />
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>Main date</div>
            <input type="date" value={data.mainDate || ""} onChange={e => onChange("mainDate", e.target.value)} style={{ width: "100%", border: `1px solid ${C.line}`, borderRadius: 12, padding: "11px 14px", fontFamily: T.font, fontSize: 14, color: C.ink, background: C.surface, outline: "none" }} />
          </div>
        )}
      </div>
    );
  }

  if (step === "details") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: T.wm, color: C.ink }}>Set the vibe.</div>
      <div style={{ fontSize: 13.5, color: C.muted }}>Junie uses this to tailor every suggestion to your event.</div>
      {[
        { key: "dressCode", label: "Dress code", placeholder: "Monochrome summer, black tie, come as you are…" },
        { key: "guestCount", label: "Guest count", placeholder: "~50" },
        { key: "vibe", label: "Vibe / description", placeholder: "The feeling you want people to have…", multiline: true },
      ].map(f => (
        <div key={f.key}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>{f.label}</div>
          {f.multiline
            ? <textarea value={data[f.key] || ""} onChange={e => onChange(f.key, e.target.value)} placeholder={f.placeholder} rows={3} style={{ width: "100%", border: `1px solid ${C.line}`, borderRadius: 12, padding: "11px 14px", fontFamily: T.font, fontSize: 14, color: C.ink, background: C.surface, outline: "none", resize: "none" }} />
            : <input value={data[f.key] || ""} onChange={e => onChange(f.key, e.target.value)} placeholder={f.placeholder} style={{ width: "100%", border: `1px solid ${C.line}`, borderRadius: 12, padding: "11px 14px", fontFamily: T.font, fontSize: 14, color: C.ink, background: C.surface, outline: "none" }} />
          }
        </div>
      ))}
    </div>
  );

  if (step === "prompts") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: T.wm, color: C.ink }}>Your starter prompts.</div>
      <div style={{ fontSize: 13.5, color: C.muted }}>Junie generated these from your brief. Edit or add more — you can always change them later.</div>
      {(data.chips || []).map((ch, i) => (
        <div key={i} style={{ display: "flex", gap: 8 }}>
          <input value={ch} onChange={e => { const updated = [...(data.chips || [])]; updated[i] = e.target.value; onChange("chips", updated); }} style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 14px", fontFamily: T.font, fontSize: 13.5, color: C.ink, background: C.surface, outline: "none" }} />
          <button onClick={() => onChange("chips", (data.chips || []).filter((_, j) => j !== i))} style={{ width: 34, height: 40, border: `1px solid ${C.pillLine}`, borderRadius: 10, background: "transparent", color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
      ))}
      <button onClick={() => onChange("chips", [...(data.chips || []), ""])} style={{ border: `1px dashed ${C.pillLine}`, borderRadius: 12, padding: "10px 0", background: "transparent", color: C.accent, fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add prompt</button>
    </div>
  );
}

function Onboarding({ onComplete, onCancel }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ chips: [] });
  const [generating, setGenerating] = useState(false);

  const onChange = (key, val) => setData(d => ({ ...d, [key]: val }));

  const next = async () => {
    if (step === 1) {
      // Generate prompts from brief
      setGenerating(true);
      const chips = await generatePrompts(data);
      onChange("chips", chips);
      setGenerating(false);
    }
    if (step < ONBOARDING_STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      // Build event object
      const brief = [
        { id: genId(), key: ["trip","getaway"].includes(data.occasionType) ? "Destination" : data.occasionType === "date" ? "Spot" : data.occasionType === "selfcare" ? "Where" : "Venue", value: data.venue || "" },
        { id: genId(), key: ["event"].includes(data.occasionType || "event") ? "Dress" : "Style", value: data.dressCode || "" },
        { id: genId(), key: "Guests", value: data.guestCount || "" },
        { id: genId(), key: "Vibe", value: data.vibe || "" },
      ].filter(r => r.value);

      onComplete({
        id: genId(),
        name: data.name || "My Event",
        hostName: data.hostName || "",
        mainDate: data.mainDate || "",
        venue: data.venue || "",
        brief,
        chips: data.chips || [],
        role: "creator",
        inviteCode: genId() + genId(),
        todos: ({
          trip: ["Book flights", "Lock the stay", "Build the itinerary", "Sort ground transport"],
          getaway: ["Book the stay", "Plan the drive", "Build the itinerary", "Pack list"],
          date: ["Make the reservation", "Plan the after-spot", "Sort the outfit", "Book anything ticketed"],
          selfcare: ["Book appointments", "Clear the calendar", "Stock the essentials", "Set the do-not-disturb"],
        }[data.occasionType] || ["Lock the venue", "Send invites", "Plan the playlist", "Sort the food & drinks"]).map(label => ({ id: genId(), label })),
        checks: {},
        savedList: [],
        pins: [],
        dayPlans: {},
        messages: [],
      });
    }
  };

  const canNext = () => {
    if (step === 0) { const isTrip = ['trip','getaway'].includes(data.occasionType); return !!(data.name && data.mainDate && (isTrip ? data.endDate : true)); }
    return true;
  };

  const stepName = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: C.bg }}>
      {/* Progress */}
      <div style={{ padding: "52px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
          {ONBOARDING_STEPS.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 999, background: i <= step ? C.accent : C.line, transition: "background .3s" }} />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="j-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 20px" }}>
        {generating ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16 }}>
            <Dots />
            <div style={{ fontSize: 14, color: C.muted }}>Generating your prompts…</div>
          </div>
        ) : (
          <OnboardingStep step={stepName} data={data} onChange={onChange} />
        )}
      </div>

      {/* Nav */}
      <div style={{ padding: "16px 20px 28px", flexShrink: 0, display: "flex", gap: 10 }}>
        <button onClick={step === 0 ? onCancel : () => setStep(s => s - 1)} style={{ flex: 1, border: `1px solid ${C.pillLine}`, borderRadius: 999, padding: "12px 0", background: "transparent", color: C.ink, fontFamily: T.font, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          {step === 0 ? "Cancel" : "Back"}
        </button>
        <button onClick={next} disabled={!canNext() || generating} className="j-chip" style={{ flex: 2, border: "none", borderRadius: 999, padding: "12px 0", background: canNext() && !generating ? C.sendBg : C.sendIdleBg, color: canNext() && !generating ? C.sendInk : C.sendIdleInk, fontFamily: T.font, fontSize: 14, fontWeight: 600, cursor: canNext() && !generating ? "pointer" : "default" }}>
          {isLast ? "Create event" : "Continue"}
        </button>
      </div>
    </div>
  );
}

// ─── INVITE MODAL ─────────────────────────────────────────────────────────────
function InviteModal({ event, onClose }) {
  const [copied, setCopied] = useState(false);
  const code = event.inviteCode || "N/A";
  const copy = () => { try { navigator.clipboard.writeText(code); } catch {} setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(31,27,22,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 393, background: C.bg, borderRadius: "20px 20px 0 0", padding: "24px 20px 40px" }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: C.line, margin: "0 auto 20px" }} />
        <div style={{ fontFamily: T.wm, fontWeight: 800, fontSize: 22, color: C.ink, marginBottom: 6 }}>Invite collaborators</div>
        <div style={{ fontSize: 13.5, color: C.muted, marginBottom: 20, lineHeight: 1.5 }}>Share this code with anyone you want to plan with. They'll get full edit access to this event.</div>
        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontFamily: T.wm, fontWeight: 700, fontSize: 22, letterSpacing: "0.08em", color: C.accent }}>{code}</div>
          <button onClick={copy} style={{ border: `1px solid ${C.pillLine}`, borderRadius: 10, padding: "8px 14px", background: "transparent", color: copied ? C.accent : C.ink, fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{copied ? "Copied ✓" : "Copy"}</button>
        </div>
        <div style={{ fontSize: 12, color: C.faint, textAlign: "center" }}>Collaborators can view, edit, and plan alongside you.</div>
      </div>
    </div>
  );
}

// ─── CHAT TAB ─────────────────────────────────────────────────────────────────
function parseLinks(text) {
  const parts = [];
  const urlRegex = /https?:\/\/[^\s\)\],]+/g;
  let last = 0, match;
  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > last) parts.push({ type: "text", value: text.slice(last, match.index) });
    parts.push({ type: "url", value: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}

function RichText({ text }) {
  return (
    <span>
      {parseLinks(text).map((p, i) =>
        p.type === "url"
          ? <a key={i} href={p.value} target="_blank" rel="noopener noreferrer" style={{ color: C.accent, textDecoration: "underline", wordBreak: "break-all" }}>{p.value.replace(/^https?:\/\//, "").split("/")[0]}</a>
          : <span key={i} style={{ whiteSpace: "pre-wrap" }}>{p.value}</span>
      )}
    </span>
  );
}

function Bubble({ m, onSaveText }) {
  const [saved, setSaved] = useState(false);
  if (m.role === "user") return (
    <div style={{ display: "flex", justifyContent: "flex-end", animation: "junieUp .32s ease" }}>
      <div style={{ maxWidth: "82%", background: C.userBg, color: C.userInk, padding: "10px 14px", fontSize: 14.5, lineHeight: 1.5, whiteSpace: "pre-wrap", borderRadius: T.r.bubble, borderBottomRightRadius: 6, fontWeight: 500 }}>{m.content}</div>
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "flex-start", animation: "junieUp .32s ease" }}>
      <Avatar size={28} letter="J" />
      <div style={{ maxWidth: "86%", minWidth: 0 }}>
        <div style={{ background: C.junieBg, color: C.junieInk, border: `1px solid ${C.junieLine}`, padding: "10px 14px", fontSize: 14.5, lineHeight: 1.55, borderRadius: T.r.bubble, borderTopLeftRadius: 6 }}>
          <RichText text={m.content} />
        </div>
        <button onClick={() => { onSaveText(m.content); setSaved(true); setTimeout(() => setSaved(false), 2000); }} style={{ marginTop: 5, border: "none", background: "transparent", cursor: "pointer", fontFamily: T.font, fontSize: 11.5, fontWeight: 600, color: saved ? C.accent : C.faint, display: "flex", alignItems: "center", gap: 4, padding: "2px 0" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z"/></svg>
          {saved ? "Saved ✓" : "Save response"}
        </button>
      </div>
    </div>
  );
}

function ChatTab({ event, messages, setMessages, onSave, chips, onEditChips }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dynamicChips, setDynamicChips] = useState(null);
  const [editingChips, setEditingChips] = useState(false);
  const [chipDraft, setChipDraft] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const scrollRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const send = useCallback(async (override) => {
    const content = (override != null ? override : input).trim();
    if (!content || loading) return;
    const history = [...messages, { role: "user", content }];
    setMessages(history);
    setInput("");
    if (taRef.current) { taRef.current.style.height = "auto"; }
    setLoading(true);
    setDynamicChips(null);
    const reply = await getReply(history, event);
    setMessages([...history, { role: "assistant", content: reply }]);
    setLoading(false);
  }, [input, loading, messages, event, setMessages]);

  const displayChips = dynamicChips || chips || [];

  const handleLogoClick = () => {
    if (!messages.length) return;
    if (confirming) { setMessages([]); setConfirming(false); }
    else { setConfirming(true); setTimeout(() => setConfirming(false), 2500); }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: C.bg }}>
      {/* Header */}
      <div style={{ padding: "52px 20px 14px", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div onClick={handleLogoClick} style={{ cursor: messages.length ? "pointer" : "default" }}>
            <div style={{ fontFamily: T.wm, fontWeight: 800, fontSize: 28, letterSpacing: "-0.02em", color: confirming ? C.accent : C.ink, transition: "color .2s", lineHeight: 1 }}>
              {confirming ? "Tap to reset" : "Junie"}
            </div>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted, marginTop: 5 }}>
              {confirming ? "chat will clear" : event.name || "your personal planner"}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            <div style={{ border: `1px solid ${C.pillLine}`, borderRadius: 999, padding: "5px 11px", fontSize: 11.5, fontWeight: 600, color: C.ink, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent }} />
              {event.venue || "No venue"}
            </div>
            <div style={{ border: `1px solid ${C.pillLine}`, borderRadius: 999, padding: "5px 11px", fontSize: 11.5, fontWeight: 600, color: C.ink }}>{event.mainDate || "No date"}</div>
          </div>
        </div>
      </div>

      {/* Chat */}
      <div className="j-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 16px" }}>
        {messages.length === 0 ? (
          <div style={{ padding: "16px 0 8px" }}>
            <div style={{ background: C.surface, borderRadius: T.r.card, border: `1px solid ${C.line}`, padding: "18px 18px 20px", marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 11, alignItems: "center", marginBottom: 13 }}>
                <Avatar size={34} letter="J" />
                <div style={{ fontSize: 17, fontWeight: 600, color: C.ink }}>Hi, I'm Junie.</div>
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.62, color: C.ink }}>
                I'm planning <strong style={{ fontWeight: 600 }}>{event.name || "your event"}</strong>. I've got the brief, the vibe, and every open question. Web search is live. Where do you want to start?
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <SectionLabel>Try asking</SectionLabel>
              <button onClick={() => { setEditingChips(true); setChipDraft([...displayChips]); }} style={{ border: "none", background: "transparent", cursor: "pointer", fontFamily: T.font, fontSize: 11.5, fontWeight: 700, color: C.accent, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>
                Edit
              </button>
            </div>
            {!editingChips ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                {displayChips.map((ch, i) => (
                  <button key={i} className="j-chip" onClick={() => send(ch)} style={{ border: `1px solid ${C.accent}`, background: "transparent", color: C.ink, borderRadius: T.r.chip, padding: "9px 15px", fontFamily: T.font, fontSize: 13, fontWeight: 500, cursor: "pointer", flexShrink: 0 }}>{ch}</button>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {chipDraft.map((ch, i) => (
                  <div key={i} style={{ display: "flex", gap: 8 }}>
                    <input value={ch} onChange={e => { const d = [...chipDraft]; d[i] = e.target.value; setChipDraft(d); }} style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 13px", fontFamily: T.font, fontSize: 13, color: C.ink, background: C.surface, outline: "none" }} />
                    <button onClick={() => setChipDraft(chipDraft.filter((_, j) => j !== i))} style={{ width: 34, height: 34, border: `1px solid ${C.pillLine}`, borderRadius: 10, background: "transparent", color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
                    </button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setChipDraft([...chipDraft, ""])} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: `1px dashed ${C.pillLine}`, background: "transparent", color: C.accent, cursor: "pointer", fontFamily: T.font, fontSize: 13, fontWeight: 600 }}>+ Add</button>
                  <button onClick={() => { onEditChips(chipDraft.filter(Boolean)); setEditingChips(false); }} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "none", background: C.sendBg, color: C.sendInk, cursor: "pointer", fontFamily: T.font, fontSize: 13, fontWeight: 600 }}>Done</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 16 }}>
            {messages.map((m, i) => (
              <Bubble key={i} m={m} onSaveText={(text) => {
                const card = { id: "txt" + Date.now(), type: "text", kicker: "Junie said", title: text.split("\n")[0].slice(0, 50), body: text, ts: Date.now() };
                onSave(card);
              }} />
            ))}
            {loading && (
              <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <Avatar size={28} letter="J" />
                <div style={{ background: C.junieBg, border: `1px solid ${C.junieLine}`, borderRadius: T.r.bubble, padding: "11px 14px" }}><Dots /></div>
              </div>
            )}
          </div>
        )}
        <div ref={scrollRef} style={{ height: 8 }} />
      </div>

      {/* Input */}
      <div style={{ padding: "8px 16px 12px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, background: C.surface, border: `1px solid ${C.line}`, borderRadius: T.r.input, padding: "5px 5px 5px 16px" }}>
          <textarea ref={taRef} className="j-ta" rows={1} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 104) + "px"; }} placeholder="Ask Junie anything…" style={{ flex: 1, border: "none", outline: "none", resize: "none", background: "transparent", fontFamily: T.font, fontSize: 15, lineHeight: 1.4, color: C.ink, padding: "7px 0", maxHeight: 104 }} />
          <button onClick={() => send()} disabled={!input.trim() || loading} className="j-chip" style={{ width: 38, height: 38, flexShrink: 0, border: "none", cursor: input.trim() && !loading ? "pointer" : "default", borderRadius: "50%", background: input.trim() && !loading ? C.sendBg : C.sendIdleBg, color: input.trim() && !loading ? C.sendInk : C.sendIdleInk, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 15V4M4 8.5L9 3.5l5 5"/></svg>
          </button>
        </div>
        <div style={{ textAlign: "center", marginTop: 8, fontSize: 10.5, color: C.faint, letterSpacing: "0.02em" }}>Web search enabled · location-aware recs</div>
      </div>
    </div>
  );
}

// ─── PLAN TAB ─────────────────────────────────────────────────────────────────
function GrowText({ value, onChange, placeholder, bold }) {
  const ref = useRef(null);
  const grow = () => { const el = ref.current; if (!el) return; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; };
  useEffect(grow, [value]);
  return <textarea ref={ref} rows={1} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} onInput={grow} style={{ width: "100%", border: "none", outline: "none", resize: "none", background: "transparent", fontFamily: T.font, color: C.ink, fontSize: bold ? 9.5 : 13.5, fontWeight: bold ? 700 : 400, letterSpacing: bold ? "0.12em" : "normal", textTransform: bold ? "uppercase" : "none", lineHeight: bold ? 1.3 : 1.45, padding: 0, overflow: "hidden" }} />;
}

function BriefCard({ brief, onChange, onAdd, onDelete }) {
  const [editing, setEditing] = useState(false);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "26px 0 8px" }}>
        <SectionLabel>The brief</SectionLabel>
        <button onClick={() => setEditing(e => !e)} style={{ border: "none", background: "transparent", cursor: "pointer", fontFamily: T.font, fontSize: 11.5, fontWeight: 700, color: C.accent, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
          {!editing && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>}
          {editing ? "Done" : "Edit"}
        </button>
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: T.r.card, padding: editing ? "10px 12px" : "4px 16px" }}>
        {brief.length === 0 && <div style={{ padding: "14px 4px", fontSize: 13, color: C.muted }}>No details yet — tap Edit to add some.</div>}
        {brief.map((row, i) => {
          const last = i === brief.length - 1;
          if (!editing) return (
            <div key={row.id} style={{ display: "flex", gap: 12, padding: "11px 0", borderBottom: last ? "none" : `1px solid ${C.line}` }}>
              <div style={{ width: 58, flexShrink: 0, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>{row.key}</div>
              <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.45, color: C.ink }}>{row.value}</div>
            </div>
          );
          return (
            <div key={row.id} style={{ display: "flex", gap: 8, alignItems: "stretch", padding: "6px 0" }}>
              <div style={{ flex: 1, minWidth: 0, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 12, padding: "9px 12px" }}>
                <GrowText value={row.key} bold placeholder="LABEL" onChange={v => onChange(row.id, "key", v)} />
                <div style={{ height: 3 }} />
                <GrowText value={row.value} placeholder="Details…" onChange={v => onChange(row.id, "value", v)} />
              </div>
              <button onClick={() => onDelete(row.id)} style={{ width: 36, flexShrink: 0, height: 36, borderRadius: 10, border: `1px solid ${C.pillLine}`, background: "transparent", color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a1 1 0 01-1 1H7a1 1 0 01-1-1L5 6"/></svg>
              </button>
            </div>
          );
        })}
      </div>
      {editing && <button onClick={onAdd} style={{ width: "100%", marginTop: 10, padding: "11px 0", borderRadius: 12, border: `1px dashed ${C.pillLine}`, background: "transparent", color: C.accent, cursor: "pointer", fontFamily: T.font, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>Add field
      </button>}
    </div>
  );
}

function ChecklistCard({ todos, checks, onToggle, onChange, onAdd, onDelete }) {
  const [editing, setEditing] = useState(false);
  const done = todos.filter(x => checks[x.id]).length;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "26px 0 8px" }}>
        <SectionLabel>Checklist</SectionLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {!editing && todos.length > 0 && <span style={{ fontSize: 11.5, fontWeight: 600, color: C.accent }}>{done}/{todos.length}</span>}
          <button onClick={() => setEditing(e => !e)} style={{ border: "none", background: "transparent", cursor: "pointer", fontFamily: T.font, fontSize: 11.5, fontWeight: 700, color: C.accent, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
            {!editing && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>}
            {editing ? "Done" : "Edit"}
          </button>
        </div>
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: T.r.card, padding: editing ? "10px 12px" : "4px 16px" }}>
        {todos.length === 0 && <div style={{ padding: "14px 4px", fontSize: 13, color: C.muted }}>No to-dos yet — tap Edit to add some.</div>}
        {todos.map((todo, i) => {
          const last = i === todos.length - 1;
          const on = !!checks[todo.id];
          if (!editing) return (
            <button key={todo.id} onClick={() => onToggle(todo.id)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "transparent", border: "none", cursor: "pointer", padding: "13px 0", textAlign: "left", fontFamily: T.font, borderBottom: last ? "none" : `1px solid ${C.line}` }}>
              <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: "50%", border: on ? "none" : `1.5px solid ${C.pillLine}`, background: on ? C.sendBg : "transparent", color: C.sendInk, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {on && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.5l2.5 2.5 4.5-5"/></svg>}
              </span>
              <span style={{ flex: 1, fontSize: 14.5, color: on ? C.muted : C.ink, textDecoration: on ? "line-through" : "none", fontWeight: 500 }}>{todo.label}</span>
            </button>
          );
          return (
            <div key={todo.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0" }}>
              <div style={{ flex: 1, minWidth: 0, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 12, padding: "4px 12px" }}>
                <GrowText value={todo.label} placeholder="Checklist item…" onChange={v => onChange(todo.id, v)} />
              </div>
              <button onClick={() => onDelete(todo.id)} style={{ width: 36, flexShrink: 0, height: 36, borderRadius: 10, border: `1px solid ${C.pillLine}`, background: "transparent", color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a1 1 0 01-1 1H7a1 1 0 01-1-1L5 6"/></svg>
              </button>
            </div>
          );
        })}
      </div>
      {editing && <button onClick={onAdd} style={{ width: "100%", marginTop: 10, padding: "11px 0", borderRadius: 12, border: `1px dashed ${C.pillLine}`, background: "transparent", color: C.accent, cursor: "pointer", fontFamily: T.font, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>Add item
      </button>}
    </div>
  );
}

function CalendarModule({ event, dayPlans, onDayPlanChange, onAskJunie }) {
  const weekDays = useMemo(() => buildWeekDays(event.mainDate, event.endDate), [event.mainDate, event.endDate]);
  const [selectedDate, setSelectedDate] = useState(event.mainDate || (weekDays[5]?.dateStr));
  const plan = dayPlans[selectedDate] || { notes: "", activities: [] };
  const selectedDay = weekDays.find(d => d.dateStr === selectedDate);

  const updatePlan = (updates) => onDayPlanChange(selectedDate, { ...plan, ...updates });
  const [addingActivity, setAddingActivity] = useState(false);
  const [newActivity, setNewActivity] = useState("");

  const moveActivity = (i, dir) => {
    const acts = [...(plan.activities || [])];
    const j = i + dir;
    if (j < 0 || j >= acts.length) return;
    [acts[i], acts[j]] = [acts[j], acts[i]];
    updatePlan({ activities: acts });
  };

  const addActivity = () => {
    const val = newActivity.trim();
    if (!val) return;
    updatePlan({ activities: [...(plan.activities || []), { id: genId(), text: val, done: false }] });
    setNewActivity("");
    setAddingActivity(false);
  };

  const toggleActivity = (id) => updatePlan({ activities: plan.activities.map(a => a.id === id ? { ...a, done: !a.done } : a) });
  const removeActivity = (id) => updatePlan({ activities: plan.activities.filter(a => a.id !== id) });

  if (!weekDays.length) return null;

  const DAYNAMES = { Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday" };
  const tagFor = (d) => {
    const isTrip = ["trip","getaway"].includes(event.occasionType);
    if (isTrip) {
      if (d.isMain) return "✈️ First day";
      if (d.isEnd) return "✈️ Last day";
      return null;
    }
    if (d.isMain) return ({date:"🌹 The night",selfcare:"🧖 The day",other:"✨ The day"})[event.occasionType] || "🎉 Main event";
    if (d.offset === -1) return "Day before";
    if (d.offset === 1) return "Day after";
    if (d.offset < 0 && d.offset >= -3) return "Weekend before";
    if (d.offset > 1 && d.offset <= 3) return "Weekend after";
    return null;
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "26px 0 12px" }}>
        <SectionLabel>Event week</SectionLabel>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }} className="j-scroll">
        {weekDays.map(d => {
          const isSel = d.dateStr === selectedDate;
          const isMain = d.isMain;
          const hasPlan = dayPlans[d.dateStr]?.activities?.length > 0 || dayPlans[d.dateStr]?.notes;
          return (
            <button key={d.dateStr} onClick={() => setSelectedDate(d.dateStr)} className="j-chip" style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "10px 10px 9px", borderRadius: 14, border: isSel ? "none" : `1px solid ${C.line}`, background: isSel ? (isMain ? C.sendBg : C.ink) : C.surface, cursor: "pointer", minWidth: 46 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: isSel ? (isMain ? C.sendInk : C.bg) : C.muted }}>{d.label.toUpperCase()}</span>
              <span style={{ fontSize: 17, fontWeight: 800, fontFamily: T.wm, color: isSel ? (isMain ? C.sendInk : C.bg) : C.ink, lineHeight: 1 }}>{d.dayNum}</span>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: hasPlan ? (isSel ? (isMain ? "rgba(0,0,0,0.3)" : C.bg) : C.accent) : "transparent" }} />
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 12, background: C.surface, border: `1px solid ${C.line}`, borderRadius: T.r.card, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px 12px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            {selectedDay && tagFor(selectedDay) && <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.accent, marginBottom: 3 }}>{tagFor(selectedDay)}</div>}
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{selectedDay ? `${DAYNAMES[selectedDay.label]}, ${selectedDate}` : selectedDate}</div>
          </div>
          <button onClick={() => onAskJunie(selectedDate)} style={{ border: `1px solid ${C.pillLine}`, borderRadius: 999, padding: "7px 12px", background: "transparent", color: C.accent, fontFamily: T.font, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-9 8.4 9.5 9.5 0 01-4-.9L3 21l1.9-4.5A8.38 8.38 0 0112 3.1a8.5 8.5 0 019 8.4z"/></svg>
            Ask Junie
          </button>
        </div>
        <div style={{ padding: "4px 16px 0" }}>
          {(plan.activities || []).length === 0 && !addingActivity && <div style={{ padding: "14px 0 4px", fontSize: 13, color: C.muted, fontStyle: "italic" }}>Nothing planned yet.</div>}
          {(plan.activities || []).map((a, i) => {
            const last = i === plan.activities.length - 1 && !addingActivity;
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: last ? "none" : `1px solid ${C.line}` }}>
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                  <button onClick={() => moveActivity(i, -1)} disabled={i === 0} style={{ width: 20, height: 16, border: "none", background: "transparent", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "#D8D0C4" : "#8C8174", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
                  </button>
                  <button onClick={() => moveActivity(i, 1)} disabled={i === (plan.activities || []).length - 1} style={{ width: 20, height: 16, border: "none", background: "transparent", cursor: i === (plan.activities || []).length - 1 ? "default" : "pointer", color: i === (plan.activities || []).length - 1 ? "#D8D0C4" : "#8C8174", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                  </button>
                </div>
                <button onClick={() => toggleActivity(a.id)} style={{ width: 22, height: 22, flexShrink: 0, borderRadius: "50%", border: a.done ? "none" : `1.5px solid ${C.pillLine}`, background: a.done ? C.sendBg : "transparent", color: C.sendInk, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {a.done && <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.5l2.5 2.5 4.5-5"/></svg>}
                </button>
                <span style={{ flex: 1, fontSize: 14, color: a.done ? C.muted : C.ink, textDecoration: a.done ? "line-through" : "none", lineHeight: 1.4 }}>{a.text}</span>
                <button onClick={() => removeActivity(a.id)} style={{ width: 28, height: 28, flexShrink: 0, border: "none", background: "transparent", color: C.faint, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
                </button>
              </div>
            );
          })}
          {addingActivity ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 0 12px" }}>
              <input autoFocus value={newActivity} onChange={e => setNewActivity(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addActivity(); if (e.key === "Escape") { setAddingActivity(false); setNewActivity(""); } }} placeholder="Add an activity…" style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 12px", fontFamily: T.font, fontSize: 13.5, color: C.ink, background: C.bg, outline: "none" }} />
              <button onClick={addActivity} style={{ border: "none", borderRadius: 10, padding: "9px 14px", background: C.sendBg, color: C.sendInk, fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
            </div>
          ) : (
            <button onClick={() => setAddingActivity(true)} style={{ width: "100%", padding: "12px 0", border: "none", borderTop: plan.activities?.length ? `1px solid ${C.line}` : "none", background: "transparent", color: C.accent, fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>Add activity
            </button>
          )}
        </div>
        <div style={{ padding: "0 16px 14px", borderTop: `1px solid ${C.line}`, marginTop: 2 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted, padding: "12px 0 8px" }}>Notes</div>
          <textarea value={plan.notes || ""} onChange={e => updatePlan({ notes: e.target.value })} placeholder="Vibe, logistics, ideas for the day…" rows={2} style={{ width: "100%", border: "none", outline: "none", resize: "none", background: "transparent", fontFamily: T.font, fontSize: 13.5, color: C.ink, lineHeight: 1.5, padding: 0 }} />
        </div>
      </div>
    </div>
  );
}

function PlanTab({ event, onUpdate, onShowInvite }) {
  const { brief = [], todos = [], checks = {}, dayPlans = {} } = event;
  const days = daysUntil(event.mainDate);
  const done = todos.filter(x => checks[x.id]).length;

  const onBriefChange = (id, field, val) => onUpdate({ brief: brief.map(r => r.id === id ? { ...r, [field]: val } : r) });
  const onBriefAdd = () => onUpdate({ brief: [...brief, { id: genId(), key: "", value: "" }] });
  const onBriefDelete = (id) => onUpdate({ brief: brief.filter(r => r.id !== id) });
  const onTodoChange = (id, label) => onUpdate({ todos: todos.map(t => t.id === id ? { ...t, label } : t) });
  const onTodoAdd = () => onUpdate({ todos: [...todos, { id: genId(), label: "" }] });
  const onTodoDelete = (id) => { const c = { ...checks }; delete c[id]; onUpdate({ todos: todos.filter(t => t.id !== id), checks: c }); };
  const onToggle = (id) => onUpdate({ checks: { ...checks, [id]: !checks[id] } });
  const onDayPlanChange = (date, plan) => onUpdate({ dayPlans: { ...dayPlans, [date]: plan } });
  const onAskJunie = () => {}; // handled by parent

  return (
    <div className="j-scroll" style={{ height: "100%", overflowY: "auto", background: C.bg }}>
      <div style={{ padding: "52px 20px 18px" }}>
        <SectionLabel>The Plan</SectionLabel>
        <div style={{ fontFamily: T.wm, fontWeight: 800, fontSize: 26, letterSpacing: "-0.02em", color: C.ink, lineHeight: 1.08, marginTop: 8 }}>{event.name || "Your event"}</div>
        {event.mainDate && <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>{event.mainDate}</div>}

        {days !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 18, background: C.surface, border: `1px solid ${C.line}`, borderRadius: T.r.card, padding: "16px 18px" }}>
            <div style={{ fontFamily: T.wm, fontWeight: 800, fontSize: 52, lineHeight: 0.9, color: C.accent, letterSpacing: "-0.03em" }}>{days}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>{days === 1 ? "day to go" : "days to go"}</div>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>
                {event.occasionType === "trip" && event.endDate ? `${event.mainDate} → ${event.endDate} · ` : ""}{done} of {todos.length} things sorted.
              </div>
            </div>
          </div>
        )}

        {/* Invite button */}
        <button onClick={onShowInvite} style={{ width: "100%", marginTop: 16, padding: "12px 0", borderRadius: 14, border: `1px solid ${C.pillLine}`, background: "transparent", color: C.ink, fontFamily: T.font, fontSize: 13.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
          Invite collaborators
        </button>

        {event.mainDate && <CalendarModule event={event} dayPlans={dayPlans} onDayPlanChange={onDayPlanChange} onAskJunie={onAskJunie} />}
        <BriefCard brief={brief} onChange={onBriefChange} onAdd={onBriefAdd} onDelete={onBriefDelete} />
        <ChecklistCard todos={todos} checks={checks} onToggle={onToggle} onChange={onTodoChange} onAdd={onTodoAdd} onDelete={onTodoDelete} />
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

// ─── SAVED TAB ────────────────────────────────────────────────────────────────
function SavedTab({ savedList, pins, onAddPin, onRemovePin, onRemoveCard }) {
  const fileRef = useRef(null);
  const [view, setView] = useState("board");
  const [urls, setUrls] = useState({});
  const urlsRef = useRef({});
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    let alive = true;
    pins.filter(p => p.kind === "image").forEach(p => {
      if (urlsRef.current[p.id]) return;
      const tryLoad = async () => {
        try {
          const req = indexedDB.open("junie-board-v2", 1);
          req.onupgradeneeded = () => req.result.createObjectStore("img");
          req.onsuccess = () => {
            const tx = req.result.transaction("img", "readonly");
            const r2 = tx.objectStore("img").get(p.id);
            r2.onsuccess = () => {
              if (!alive || !r2.result) return;
              const u = URL.createObjectURL(r2.result);
              urlsRef.current[p.id] = u;
              setUrls(m => ({ ...m, [p.id]: u }));
            };
          };
        } catch {}
      };
      tryLoad();
    });
    return () => { alive = false; };
  }, [pins]);

  const handleFiles = async (fileList) => {
    for (const file of [...fileList].filter(f => f.type.startsWith("image/"))) {
      const id = "img" + Date.now() + Math.random().toString(36).slice(2, 5);
      const dims = await new Promise(res => { const u = URL.createObjectURL(file); const im = new Image(); im.onload = () => { res({ w: im.naturalWidth || 4, h: im.naturalHeight || 3 }); URL.revokeObjectURL(u); }; im.src = u; });
      try {
        await new Promise((res, rej) => {
          const r = indexedDB.open("junie-board-v2", 1);
          r.onupgradeneeded = () => r.result.createObjectStore("img");
          r.onsuccess = () => { const tx = r.result.transaction("img", "readwrite"); tx.objectStore("img").put(file, id); tx.oncomplete = res; tx.onerror = rej; };
        });
      } catch {}
      onAddPin({ id, kind: "image", ts: Date.now(), w: dims.w, h: dims.h });
    }
  };

  const removePin = (pin) => {
    try {
      const r = indexedDB.open("junie-board-v2", 1);
      r.onsuccess = () => { const tx = r.result.transaction("img", "readwrite"); tx.objectStore("img").delete(pin.id); };
    } catch {}
    onRemovePin(pin.id);
  };

  const addLink = () => {
    const u = url.trim();
    if (!u) return;
    onAddPin({ id: "lnk" + Date.now(), kind: "link", ts: Date.now(), url: /^https?:\/\//i.test(u) ? u : "https://" + u, note: note.trim() });
    setUrl(""); setNote(""); setOpen(false);
  };

  const RemoveBtn = ({ onClick }) => (
    <button onClick={onClick} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(20,16,12,0.6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
  );

  return (
    <div className="j-scroll" style={{ height: "100%", overflowY: "auto", background: C.bg }}>
      <input ref={fileRef} type="file" accept="image/*" multiple onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />
      <div style={{ padding: "52px 20px 24px" }}>
        <SectionLabel>Saved</SectionLabel>
        <div style={{ fontFamily: T.wm, fontWeight: 800, fontSize: 26, letterSpacing: "-0.02em", color: C.ink, marginTop: 8 }}>Your collection</div>

        {/* Segmented */}
        <div style={{ display: "flex", gap: 3, background: C.bgSubtle, padding: 3, marginTop: 16, borderRadius: 999, border: `1px solid ${C.line}` }}>
          {["board", "cards"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{ flex: 1, border: "none", cursor: "pointer", borderRadius: 999, padding: "8px 10px", background: view === v ? C.surface : "transparent", color: view === v ? C.ink : C.muted, fontFamily: T.font, fontSize: 12.5, fontWeight: view === v ? 700 : 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {v === "board" ? "Board" : "From Junie"}
              {v === "board" && pins.length > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: view === v ? C.accent : C.faint }}>{pins.length}</span>}
              {v === "cards" && savedList.length > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: view === v ? C.accent : C.faint }}>{savedList.length}</span>}
            </button>
          ))}
        </div>

        {view === "board" && (
          <>
            <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
              <button onClick={() => fileRef.current?.click()} className="j-chip" style={{ flex: 1, border: `1px solid ${C.pillLine}`, background: "transparent", color: C.ink, borderRadius: 999, padding: "11px 12px", fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="9" cy="9" r="1.4"/></svg>Upload image
              </button>
              <button onClick={() => setOpen(v => !v)} className="j-chip" style={{ flex: 1, border: `1px solid ${open ? C.accent : C.pillLine}`, background: open ? C.accentSoft : "transparent", color: C.ink, borderRadius: 999, padding: "11px 12px", fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1.5-1.5"/></svg>Add link
              </button>
            </div>
            {open && (
              <div style={{ marginTop: 10, background: C.surface, border: `1px solid ${C.line}`, borderRadius: T.r.card, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <input value={url} onChange={e => setUrl(e.target.value)} autoFocus onKeyDown={e => e.key === "Enter" && addLink()} placeholder="Paste a link…" style={{ width: "100%", border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", fontFamily: T.font, fontSize: 13.5, color: C.ink, background: C.bg, outline: "none" }} />
                <input value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === "Enter" && addLink()} placeholder="Add a note (optional)" style={{ width: "100%", border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", fontFamily: T.font, fontSize: 13.5, color: C.ink, background: C.bg, outline: "none" }} />
                <button onClick={addLink} disabled={!url.trim()} style={{ alignSelf: "flex-end", border: "none", cursor: url.trim() ? "pointer" : "default", background: url.trim() ? C.sendBg : C.sendIdleBg, color: url.trim() ? C.sendInk : C.sendIdleInk, borderRadius: 999, padding: "9px 20px", fontFamily: T.font, fontSize: 13, fontWeight: 600 }}>Save</button>
              </div>
            )}
            {pins.length === 0 ? (
              <div style={{ marginTop: 16, padding: "40px 22px", textAlign: "center", background: C.surface, border: `1px dashed ${C.pillLine}`, borderRadius: T.r.card }}>
                <div style={{ fontSize: 13, color: C.muted }}>Upload inspiration images or paste links.</div>
              </div>
            ) : (
              <div style={{ marginTop: 16, columnCount: 2, columnGap: 10 }}>
                {pins.map(pin => {
                  if (pin.kind === "image") {
                    const ratio = pin.w && pin.h ? pin.w / pin.h : 4 / 3;
                    return (
                      <div key={pin.id} style={{ position: "relative", breakInside: "avoid", marginBottom: 10, borderRadius: T.r.card, overflow: "hidden", border: `1px solid ${C.line}`, background: C.bgSubtle }}>
                        <div style={{ width: "100%", aspectRatio: String(ratio) }}>{urls[pin.id] && <img src={urls[pin.id]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}</div>
                        <RemoveBtn onClick={() => removePin(pin)} />
                      </div>
                    );
                  }
                  const domain = (() => { try { return new URL(pin.url).hostname.replace(/^www\./, ""); } catch { return pin.url; } })();
                  return (
                    <a key={pin.id} href={pin.url} target="_blank" rel="noopener noreferrer" style={{ position: "relative", breakInside: "avoid", display: "block", marginBottom: 10, borderRadius: T.r.card, border: `1px solid ${C.line}`, background: C.surface, padding: "14px 14px 15px", textDecoration: "none" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{domain}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, lineHeight: 1.4 }}>{pin.note || domain}</div>
                      <RemoveBtn onClick={e => { e.preventDefault(); removePin(pin); }} />
                    </a>
                  );
                })}
              </div>
            )}
          </>
        )}

        {view === "cards" && (
          savedList.length === 0 ? (
            <div style={{ marginTop: 16, padding: "40px 22px", textAlign: "center", background: C.surface, border: `1px dashed ${C.pillLine}`, borderRadius: T.r.card }}>
              <div style={{ fontSize: 13, color: C.muted }}>Tap "Save response" on any Junie reply and it'll appear here.</div>
            </div>
          ) : (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
              {savedList.map(card => (
                <div key={card.id} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: T.r.card, padding: "14px 16px 15px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.accent }}>{card.kicker || "Junie said"}</div>
                  <div style={{ fontFamily: T.wm, fontWeight: 700, fontSize: 16, color: C.ink, marginTop: 5, marginBottom: 8 }}>{card.title}</div>
                  <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{card.body || card.items?.map(i => i.name).join(" · ")}</div>
                  <button onClick={() => onRemoveCard(card.id)} style={{ marginTop: 12, border: `1px solid ${C.pillLine}`, borderRadius: 999, padding: "7px 14px", background: "transparent", color: C.muted, fontFamily: T.font, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Remove</button>
                </div>
              ))}
            </div>
          )
        )}
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

// ─── TAB BAR ──────────────────────────────────────────────────────────────────
const TAB_ICONS = {
  chat: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-9 8.4 9.5 9.5 0 01-4-.9L3 21l1.9-4.5A8.38 8.38 0 0112 3.1a8.5 8.5 0 019 8.4z"/></svg>,
  plan: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 1.5-1.5M4 12l1 1 1.5-1.5M4 18l1 1 1.5-1.5"/></svg>,
  saved: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z"/></svg>,
};

function TabBar({ active, onChange, savedCount }) {
  return (
    <div style={{ flexShrink: 0, display: "flex", background: C.bg, borderTop: `1px solid ${C.line}`, padding: "8px 10px 28px" }}>
      {["chat", "plan", "saved"].map(id => {
        const on = id === active;
        return (
          <button key={id} onClick={() => onChange(id)} style={{ flex: 1, background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "4px 0", fontFamily: T.font, color: on ? C.accent : C.faint, position: "relative" }}>
            <div style={{ position: "relative" }}>
              {TAB_ICONS[id]}
              {id === "saved" && savedCount > 0 && <span style={{ position: "absolute", top: -4, right: -8, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: C.sendBg, color: C.sendInk, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{savedCount}</span>}
            </div>
            <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 500, letterSpacing: "0.02em" }}>{id.charAt(0).toUpperCase() + id.slice(1)}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── EVENT SHELL ──────────────────────────────────────────────────────────────
function EventShell({ event, onUpdate, onBack }) {
  const [tab, setTab] = useState("chat");
  const [showInvite, setShowInvite] = useState(false);
  const [loaded, setLoaded] = useState(!IS_DEPLOYED);
  const isFirstRender = useRef(true);

  const { messages = [], savedList = [], checks = {}, brief = [], todos = [], pins = [], dayPlans = {}, chips = [] } = event;

  // Load remote state on mount
  useEffect(() => {
    if (!IS_DEPLOYED) return;
    remoteLoad(event.id).then(remote => {
      if (remote) {
        const merged = {};
        if (remote.brief?.length) merged.brief = remote.brief;
        if (remote.todos?.length) merged.todos = remote.todos;
        if (remote.checks && Object.keys(remote.checks).length) merged.checks = remote.checks;
        if (remote.savedList?.length) merged.savedList = remote.savedList;
        if (remote.pins?.length) merged.pins = remote.pins;
        if (remote.chips?.length) merged.chips = remote.chips;
        if (remote.dayPlans && Object.keys(remote.dayPlans).length) merged.dayPlans = remote.dayPlans;
        if (Object.keys(merged).length) onUpdate(merged);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [event.id]);

  // Save shared state to remote (not messages)
  useEffect(() => {
    if (!loaded) return;
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    remoteSave(event.id, {
      brief, todos, checks, savedList, pins, chips, dayPlans,
      inviteCode: event.inviteCode,
      name: event.name,
      hostName: event.hostName,
      mainDate: event.mainDate,
      endDate: event.endDate,
      venue: event.venue,
      occasionType: event.occasionType,
    });
  }, [brief, todos, checks, savedList, pins, chips, dayPlans]);

  const onSave = useCallback((card) => onUpdate({ savedList: savedList.some(x => x.id === card.id) ? savedList : [{ ...card, ts: Date.now() }, ...savedList] }), [savedList, onUpdate]);
  const onRemoveCard = useCallback((id) => onUpdate({ savedList: savedList.filter(x => x.id !== id) }), [savedList, onUpdate]);
  const onAddPin = useCallback((pin) => onUpdate({ pins: [pin, ...pins] }), [pins, onUpdate]);
  const onRemovePin = useCallback((id) => onUpdate({ pins: pins.filter(x => x.id !== id) }), [pins, onUpdate]);
  const onEditChips = useCallback((newChips) => onUpdate({ chips: newChips }), [onUpdate]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Back button */}
      <button onClick={onBack} style={{ position: "fixed", top: 14, left: 14, zIndex: 50, width: 36, height: 36, borderRadius: "50%", border: `1px solid ${C.line}`, background: C.bg, color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      </button>

      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === "chat" && <ChatTab event={event} messages={messages} setMessages={msgs => onUpdate({ messages: msgs })} onSave={onSave} chips={chips} onEditChips={onEditChips} />}
        {tab === "plan" && <PlanTab event={event} onUpdate={onUpdate} onShowInvite={() => setShowInvite(true)} />}
        {tab === "saved" && <SavedTab savedList={savedList} pins={pins} onAddPin={onAddPin} onRemovePin={onRemovePin} onRemoveCard={onRemoveCard} />}
      </div>
      <TabBar active={tab} onChange={setTab} savedCount={savedList.length + pins.length} />
      {showInvite && <InviteModal event={event} onClose={() => setShowInvite(false)} />}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
// ─── JORDANTEENTH SEED EVENT ─────────────────────────────────────────────────
const JORDANTEENTH_SEED = {
  id: "jordanteenth-2026",
  name: "Jordanteenth: An Ode to 30 Years",
  hostName: "Jordan Folkes",
  mainDate: "2026-06-18",
  venue: "Love's Club",
  role: "creator",
  occasionType: "event",
  endDate: "",
  inviteCode: "jordanteenth2026",
  messages: [],
  brief: [
    {"id":"venue","key":"Venue","value":"Love's Club · 106 Melrose St, Brooklyn, NY"},
    {"id":"dress","key":"Dress","value":"Monochrome summer. Dress like Jordy. Dress like you have aux privileges."},
    {"id":"guests","key":"Guests","value":"~50 confirmed"},
    {"id":"vibe","key":"Vibe","value":"Love's Club in Bushwick, Brooklyn brings a \"dive bar meets concert venue\" vibe—a blend of 1970s aesthetics, premium sound, and cozy socializing."}
  ],
  todos: [
    {"id":"eats","label":"Confirm the late-night plan"},
    {"id":"invite","label":"Send Partiful followups"},
    {"id":"playlist","label":"Build the 4-hour playlist"},
    {"id":"t1780423463289","label":"Share Monochrome outfit Pinterest board"}
  ],
  checks: {"t1780423463289":true,"playlist":true},
  chips: ["Cocktails recs","Late-night eats near Love's Club","Set the playlist vibe","Gift ideas"],
  dayPlans: {
    "2026-06-13": {"notes":"","activities":[{"id":"a1780616292799","text":"Run","done":false},{"id":"a1781044117174","text":"Brunch","done":false},{"id":"a1781209923156","text":"KNICKS!","done":false}]},
    "2026-06-14": {"notes":"Sunday I","activities":[{"id":"a1780530605049","text":"Liberty Game","done":false},{"id":"a1780539031640","text":"Bathhouse","done":false}]},
    "2026-06-16": {"notes":"","activities":[{"id":"a1780788160930","text":"Record Room","done":false}]},
    "2026-06-17": {"notes":"","activities":[{"id":"a1","text":"Date night","done":false}]},
    "2026-06-18": {"notes":"- For Party: Everyone send Jordan favorite picture together\n- For Party: Ask Zoda to bring her camera","activities":[{"id":"a1780420767703","text":"Haircut","done":false},{"id":"a1780446546905","text":"Bodega Nights","done":false},{"id":"a1780420763376","text":"Love's Club - Party!","done":false}]},
    "2026-06-20": {"notes":"","activities":[]}
  },
  savedList: [
    {"id":"arc1780458004671","type":"arc","kicker":"Playlist Flow","title":"Night Music Timeline","items":[{"time":"Golden Hour","name":"Deep House Opening","sub":"Set sophisticated warehouse energy"},{"time":"Dinner Party","name":"Melodic Techno","sub":"Peggy Gou, Four Tet, Bonobo vibes"},{"time":"Mid Evening","name":"Classic Disco Edits","sub":"Brooklyn electronic scene feels"},{"time":"Peak Hours","name":"Afrobeats Bangers","sub":"Kaytranada energy for the crowd"},{"time":"Dance Floor","name":"Takeover Mode","sub":"FKA twigs for the monochrome crowd"}],"ts":1780458017940},
    {"id":"list1780427256886","type":"list","kicker":"SIGNATURE COCKTAIL","title":"Mezcal Spritz Recipe","items":[{"name":"Individual Serve","sub":"Fill wine glass with ice, add mezcal, fresh orange juice, and Campari/Aperol. Top with sparkling water, orange slice, fresh herbs","tag":"Per Glass"},{"name":"Batch Version","sub":"2 bottles mezcal, 1 bottle Aperol, fresh orange juice. Let guests top with sparkling water","tag":"For Crowd"},{"name":"Glass Style","sub":"Large wine glass filled with ice","tag":"Presentation"},{"name":"Garnish","sub":"Orange slice and fresh herbs","tag":"Finishing Touch"}],"note":"Smoky but summery, sophisticated but not fussy","ts":1780427272356},
    {"id":"arc1780375508184","type":"arc","kicker":"Photography Setup Timeline","title":"Capturing Your Event at Love's Club","items":[{"time":"Setup","name":"Equipment Positioning","sub":"Place LED panels with diffusers in main room"},{"time":"Early Event","name":"Natural Light Phase","sub":"Utilize billiards room daylight for group shots"},{"time":"Peak Hours","name":"Roaming Documentation","sub":"Candid photography throughout"},{"time":"Golden Moments","name":"Gallery Portraits","sub":"Posed shots against white walls for monochrome aesthetic"},{"time":"Late Night","name":"Warehouse Atmosphere","sub":"Leverage dim lighting for intimate after-hours mood"}],"ts":1780375939431}
  ],
  pins: [
    {"id":"lnk1780446662449","kind":"link","ts":1780446662449,"url":"https://www.tiktok.com/t/ZTBSsws7d/","note":"Casa Piada - Spritz Happy Hour"},
    {"id":"lnk1780422861313","kind":"link","ts":1780422861313,"url":"https://www.tiktok.com/t/ZTBSkSq7j/","note":"Bodega Nights"},
    {"id":"lnk1780375250035","kind":"link","ts":1780375250035,"url":"https://www.pinterest.com/pin/931541504177352311/","note":"Brown Suit"},
    {"id":"lnk1780375236535","kind":"link","ts":1780375236535,"url":"https://www.asos.com/us/asos-design/asos-design-oversized-tapered-suit-pants-in-mid-blue/prd/209573030","note":"Blue Suit"},
    {"id":"lnk1780375214919","kind":"link","ts":1780375214919,"url":"https://jaxxon.com/products/studded-inset-hoop-earrings-gold?Finish=14k+Gold","note":"Hoop Earrings - 1"}
  ]
};

export default function Junie() {
  const init = lsLoad();
  const [events, setEvents] = useState(init.events?.length ? init.events : [JORDANTEENTH_SEED]);
  const [activeId, setActiveId] = useState(null);
  const [view, setView] = useState("dashboard"); // dashboard | onboarding | event

  // Persist events to localStorage
  useEffect(() => { lsSave({ events }); }, [events]);

  const createEvent = (eventData) => {
    setEvents(ev => [...ev, eventData]);
    setActiveId(eventData.id);
    setView("event");
  };

  const updateEvent = useCallback((id, updates) => {
    setEvents(evs => evs.map(ev => ev.id === id ? { ...ev, ...updates } : ev));
  }, []);

  const deleteEvent = (id) => {
    setEvents(evs => evs.filter(ev => ev.id !== id));
    if (activeId === id) { setActiveId(null); setView("dashboard"); }
  };

  const joinEvent = async (code) => {
    // Check remote for event with this invite code
    if (!IS_DEPLOYED) return;
    try {
      const res = await fetch(`/api/join?code=${code}`);
      if (!res.ok) return;
      const remote = await res.json();
      if (!remote) return;
      const existing = events.find(e => e.id === remote.id);
      if (existing) { setActiveId(remote.id); setView("event"); return; }
      const newEvent = {
        ...remote,
        role: "collaborator",
        messages: [],
        name: remote.name || remote.id,
        venue: remote.venue || "",
        mainDate: remote.mainDate || "",
        endDate: remote.endDate || "",
        occasionType: remote.occasionType || "event",
      };
      setEvents(ev => [...ev, newEvent]);
      setActiveId(newEvent.id);
      setView("event");
    } catch {}
  };

  const activeEvent = events.find(e => e.id === activeId);

  if (view === "onboarding") return (
    <div style={{ width: "100%", maxWidth: 393, margin: "0 auto", height: "100vh", fontFamily: T.font, background: C.bg }}>
      <Onboarding onComplete={createEvent} onCancel={() => setView("dashboard")} />
    </div>
  );

  if (view === "event" && activeEvent) return (
    <div style={{ width: "100%", maxWidth: 393, margin: "0 auto", height: "100vh", fontFamily: T.font, background: C.bg }}>
      <EventShell
        event={activeEvent}
        onUpdate={(updates) => updateEvent(activeId, updates)}
        onBack={() => { setActiveId(null); setView("dashboard"); }}
      />
    </div>
  );

  return (
    <div style={{ width: "100%", maxWidth: 393, margin: "0 auto", height: "100vh", fontFamily: T.font, background: C.bg, WebkitFontSmoothing: "antialiased" }}>
      <Dashboard
        events={events}
        onCreate={() => setView("onboarding")}
        onSelect={(id) => { setActiveId(id); setView("event"); }}
        onDelete={deleteEvent}
        onJoin={joinEvent}
      />
    </div>
  );
}
