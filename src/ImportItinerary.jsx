// ─────────────────────────────────────────────────────────────────────────────
// ImportItinerary.jsx
//
// Fully self-contained. Does not import anything from Junie.jsx and defines its
// own tiny copy of the color/type tokens so it can be dropped in or deleted
// without touching any other file's internals.
//
// To fully revert this feature: delete this file, remove the one `import`
// line for it in Junie.jsx, and remove the two button/modal call-sites that
// reference it (search for "ImportItinerary" in Junie.jsx).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";

const IC = {
  bg: "#F6F1E8", surface: "#FFFFFF", ink: "#1F1B16", muted: "#8C8174", faint: "#B8AD9D",
  line: "rgba(31,27,22,0.10)", accent: "#B07F22", accentSoft: "rgba(176,127,34,0.12)",
  sendBg: "#CB9A2E", sendInk: "#231A06",
  danger: "#B3432B", dangerSoft: "rgba(179,67,43,0.08)",
  pillLine: "rgba(31,27,22,0.14)",
};
const IFONT = "'DM Sans', system-ui, sans-serif";
const IWM = "'Syne', sans-serif";

const EXAMPLE_JSON = `{
  "title": "Lisbon Long Weekend",
  "destination": "Lisbon, Portugal",
  "date": "2026-09-11",
  "whosComing": "Me + Sam",
  "packingNotes": "Light layers, comfortable walking shoes",
  "vibe": "Slow mornings, good food, no rigid plans",
  "checklist": [
    "Book flights",
    "Reserve the apartment",
    "Dinner reservation for Saturday night"
  ],
  "days": [
    {
      "date": "2026-09-11",
      "label": "Arrival Day",
      "items": [
        { "time": "3:00 PM", "title": "Land + check in", "notes": "Flight lands 2:40pm" },
        { "time": "7:00 PM", "title": "Dinner in Alfama", "notes": "Casual, near the apartment" }
      ]
    },
    {
      "date": "2026-09-12",
      "label": "Exploring",
      "items": [
        { "time": "10:00 AM", "title": "Belém Tower + Jerónimos Monastery" },
        { "time": "1:00 PM", "title": "Pastéis de Belém", "notes": "Get there before the line" },
        { "time": "8:00 PM", "title": "Fado dinner show" }
      ]
    }
  ],
  "savedTips": [
    { "title": "Best time for Belém", "description": "Go right when it opens at 10am — it gets packed with tour buses by noon." }
  ]
}`;

// ─── Pure functions (exported for reuse / testing) ────────────────────────────

export function validateItinerary(obj) {
  const errors = [];
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    errors.push("Top level of the JSON must be an object ({ ... }), not an array or plain value.");
    return errors;
  }
  if (!obj.title || typeof obj.title !== "string") errors.push('"title" is required and must be a string.');
  if (!obj.date || typeof obj.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(obj.date)) {
    errors.push('"date" is required and must be formatted YYYY-MM-DD.');
  }
  if (obj.destination !== undefined && typeof obj.destination !== "string") errors.push('"destination" must be a string.');
  if (obj.whosComing !== undefined && typeof obj.whosComing !== "string") errors.push('"whosComing" must be a string.');
  if (obj.packingNotes !== undefined && typeof obj.packingNotes !== "string") errors.push('"packingNotes" must be a string.');
  if (obj.vibe !== undefined && typeof obj.vibe !== "string") errors.push('"vibe" must be a string.');

  if (obj.checklist !== undefined) {
    if (!Array.isArray(obj.checklist)) errors.push('"checklist" must be an array of strings.');
    else obj.checklist.forEach((item, i) => {
      if (typeof item !== "string") errors.push(`checklist[${i}] must be a string.`);
    });
  }

  if (obj.days !== undefined) {
    if (!Array.isArray(obj.days)) {
      errors.push('"days" must be an array.');
    } else {
      obj.days.forEach((day, i) => {
        if (typeof day !== "object" || day === null || Array.isArray(day)) {
          errors.push(`days[${i}] must be an object.`);
          return;
        }
        if (!day.date || typeof day.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day.date)) {
          errors.push(`days[${i}].date is required and must be formatted YYYY-MM-DD.`);
        }
        if (day.label !== undefined && typeof day.label !== "string") errors.push(`days[${i}].label must be a string.`);
        if (day.items !== undefined) {
          if (!Array.isArray(day.items)) {
            errors.push(`days[${i}].items must be an array.`);
          } else {
            day.items.forEach((item, j) => {
              if (typeof item !== "object" || item === null || Array.isArray(item)) {
                errors.push(`days[${i}].items[${j}] must be an object.`);
                return;
              }
              if (!item.title || typeof item.title !== "string") errors.push(`days[${i}].items[${j}].title is required.`);
              if (item.time !== undefined && typeof item.time !== "string") errors.push(`days[${i}].items[${j}].time must be a string.`);
              if (item.notes !== undefined && typeof item.notes !== "string") errors.push(`days[${i}].items[${j}].notes must be a string.`);
              if (item.link !== undefined && typeof item.link !== "string") errors.push(`days[${i}].items[${j}].link must be a string.`);
            });
          }
        }
      });
    }
  }

  if (obj.savedTips !== undefined) {
    if (!Array.isArray(obj.savedTips)) {
      errors.push('"savedTips" must be an array.');
    } else {
      obj.savedTips.forEach((tip, i) => {
        if (typeof tip !== "object" || tip === null || Array.isArray(tip)) {
          errors.push(`savedTips[${i}] must be an object.`);
          return;
        }
        if (!tip.title || typeof tip.title !== "string") errors.push(`savedTips[${i}].title is required.`);
        if (tip.description !== undefined && typeof tip.description !== "string") errors.push(`savedTips[${i}].description must be a string.`);
      });
    }
  }

  return errors;
}

function genLocalId(prefix) {
  return (prefix || "id") + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function computeEndDate(parsed) {
  let end = parsed.date;
  if (Array.isArray(parsed.days)) {
    parsed.days.forEach((d) => { if (d.date && d.date > end) end = d.date; });
  }
  return end;
}

export function buildBriefFromItinerary(parsed) {
  const rows = [
    { key: "Destination", value: parsed.destination || "" },
    { key: "Who's coming", value: parsed.whosComing || "" },
    { key: "Packing notes", value: parsed.packingNotes || "" },
    { key: "Vibe / description", value: parsed.vibe || "" },
  ].filter((r) => r.value);
  return rows.map((r) => ({ id: genLocalId("b"), ...r }));
}

export function buildTodosFromItinerary(parsed) {
  return (parsed.checklist || []).map((label) => ({ id: genLocalId("t"), label }));
}

// Folds time + notes into the existing single-line `text` field so the
// calendar's activity row component needs ZERO changes to render imported
// items. `link` is kept as an extra harmless property (ignored by the
// current UI, available if a future feature wants to surface it).
export function buildDayPlansFromItinerary(parsed) {
  const dayPlans = {};
  (parsed.days || []).forEach((day) => {
    const activities = (day.items || []).map((item) => {
      let text = item.title;
      if (item.time) text = `${item.time} — ${text}`;
      if (item.notes) text = `${text} (${item.notes})`;
      return {
        id: genLocalId("a"),
        text,
        done: false,
        ...(item.link ? { link: item.link } : {}),
      };
    });
    dayPlans[day.date] = { notes: day.label || "", activities };
  });
  return dayPlans;
}

export function buildSavedTipsFromItinerary(parsed) {
  return (parsed.savedTips || []).map((tip) => ({
    id: genLocalId("tip"),
    type: "text",
    kicker: "Trip tip",
    title: tip.title,
    body: tip.description || "",
    ts: Date.now(),
  }));
}

export function buildNewEventFromItinerary(parsed) {
  const mainDate = parsed.date;
  const endDate = computeEndDate(parsed);
  return {
    id: genLocalId("evt"),
    name: parsed.title,
    hostName: "",
    mainDate,
    endDate: endDate !== mainDate ? endDate : "",
    venue: parsed.destination || "",
    occasionType: "trip",
    role: "creator",
    inviteCode: genLocalId("inv"),
    messages: [],
    brief: buildBriefFromItinerary(parsed),
    todos: buildTodosFromItinerary(parsed),
    checks: {},
    chips: [],
    dayPlans: buildDayPlansFromItinerary(parsed),
    savedList: buildSavedTipsFromItinerary(parsed),
    pins: [],
  };
}

// strategy: "overwrite" | "append"
export function mergeIntoEvent(existingEvent, parsed, strategy) {
  const importedBrief = buildBriefFromItinerary(parsed);
  const importedTodos = buildTodosFromItinerary(parsed);
  const importedDayPlans = buildDayPlansFromItinerary(parsed);
  const importedTips = buildSavedTipsFromItinerary(parsed);
  const importedEnd = computeEndDate(parsed);

  if (strategy === "overwrite") {
    return {
      name: parsed.title || existingEvent.name,
      venue: parsed.destination || existingEvent.venue,
      mainDate: parsed.date || existingEvent.mainDate,
      endDate: importedEnd !== parsed.date ? importedEnd : (existingEvent.endDate || ""),
      brief: importedBrief.length ? importedBrief : (existingEvent.brief || []),
      todos: importedTodos.length ? importedTodos : (existingEvent.todos || []),
      checks: {},
      dayPlans: Object.keys(importedDayPlans).length ? importedDayPlans : (existingEvent.dayPlans || {}),
      savedList: [...importedTips, ...(existingEvent.savedList || [])],
    };
  }

  // append — never deletes or overwrites existing values
  const existingBrief = existingEvent.brief || [];
  const existingKeys = new Set(existingBrief.map((r) => r.key));
  const mergedBrief = [...existingBrief, ...importedBrief.filter((r) => !existingKeys.has(r.key))];

  const existingTodos = existingEvent.todos || [];
  const existingLabels = new Set(existingTodos.map((t) => t.label));
  const mergedTodos = [...existingTodos, ...importedTodos.filter((t) => !existingLabels.has(t.label))];

  const mergedDayPlans = { ...(existingEvent.dayPlans || {}) };
  Object.entries(importedDayPlans).forEach(([date, plan]) => {
    const existingPlan = mergedDayPlans[date];
    if (!existingPlan) {
      mergedDayPlans[date] = plan;
    } else {
      const existingTexts = new Set((existingPlan.activities || []).map((a) => a.text));
      const newActivities = plan.activities.filter((a) => !existingTexts.has(a.text));
      const combinedNotes = existingPlan.notes
        ? (plan.notes && !existingPlan.notes.includes(plan.notes) ? `${existingPlan.notes} · ${plan.notes}` : existingPlan.notes)
        : (plan.notes || "");
      mergedDayPlans[date] = {
        notes: combinedNotes,
        activities: [...(existingPlan.activities || []), ...newActivities],
      };
    }
  });

  const mergedEndDate = !existingEvent.endDate
    ? (importedEnd !== parsed.date ? importedEnd : existingEvent.endDate || "")
    : (importedEnd > existingEvent.endDate ? importedEnd : existingEvent.endDate);

  return {
    brief: mergedBrief,
    todos: mergedTodos,
    dayPlans: mergedDayPlans,
    savedList: [...importedTips, ...(existingEvent.savedList || [])],
    endDate: mergedEndDate,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImportItinerary({ mode, existingEvent, onCreate, onUpdate, onClose }) {
  const [raw, setRaw] = useState("");
  const [parseError, setParseError] = useState("");
  const [schemaErrors, setSchemaErrors] = useState([]);
  const [parsed, setParsed] = useState(null);
  const [showExample, setShowExample] = useState(false);

  const existingHasData = !!existingEvent && (
    (existingEvent.todos && existingEvent.todos.length > 0) ||
    (existingEvent.brief && existingEvent.brief.some((r) => r.value)) ||
    (existingEvent.dayPlans && Object.keys(existingEvent.dayPlans).length > 0)
  );

  const runValidation = () => {
    setParseError("");
    setSchemaErrors([]);
    setParsed(null);
    let obj;
    try {
      obj = JSON.parse(raw);
    } catch (err) {
      setParseError(err.message || "Could not parse this as JSON.");
      return;
    }
    const errors = validateItinerary(obj);
    if (errors.length) {
      setSchemaErrors(errors);
      return;
    }
    setParsed(obj);
  };

  const reset = () => { setParsed(null); setSchemaErrors([]); setParseError(""); };

  const loadExample = () => { setRaw(EXAMPLE_JSON); reset(); };

  const doCreate = () => {
    const event = buildNewEventFromItinerary(parsed);
    onCreate(event);
    onClose();
  };

  const doUpdate = (strategy) => {
    const patch = mergeIntoEvent(existingEvent, parsed, strategy);
    onUpdate(patch);
    onClose();
  };

  const dayCount = parsed?.days?.length || 0;
  const tipCount = parsed?.savedTips?.length || 0;
  const checklistCount = parsed?.checklist?.length || 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: IC.bg, display: "flex", flexDirection: "column", fontFamily: IFONT }}>
      {/* Header */}
      <div style={{ padding: "52px 20px 16px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: IWM, fontWeight: 800, fontSize: 22, color: IC.ink }}>Import itinerary</div>
          <div style={{ fontSize: 12.5, color: IC.muted, marginTop: 4 }}>
            {mode === "update" ? `Adding to ${existingEvent?.name || "this trip"}` : "Paste JSON to build a new trip instantly"}
          </div>
        </div>
        <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: "50%", border: `1px solid ${IC.pillLine}`, background: "transparent", color: IC.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px" }}>
        {/* Textarea + errors, shown until valid */}
        {!parsed && (
          <>
            <textarea
              value={raw}
              onChange={(e) => { setRaw(e.target.value); reset(); }}
              placeholder="Paste itinerary JSON here…"
              rows={12}
              style={{
                width: "100%", border: `1px solid ${IC.line}`, borderRadius: 14, padding: "14px 16px",
                fontFamily: "'SF Mono', 'Menlo', monospace", fontSize: 12.5, lineHeight: 1.6, color: IC.ink,
                background: IC.surface, outline: "none", resize: "vertical",
              }}
            />

            {parseError && (
              <div style={{ marginTop: 10, background: IC.dangerSoft, border: `1px solid ${IC.danger}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: IC.danger, marginBottom: 4 }}>Couldn't parse this as JSON</div>
                <div style={{ fontSize: 12, color: IC.danger, fontFamily: "'SF Mono', monospace" }}>{parseError}</div>
              </div>
            )}

            {schemaErrors.length > 0 && (
              <div style={{ marginTop: 10, background: IC.dangerSoft, border: `1px solid ${IC.danger}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: IC.danger, marginBottom: 6 }}>
                  {schemaErrors.length} issue{schemaErrors.length > 1 ? "s" : ""} found
                </div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {schemaErrors.map((e, i) => (
                    <li key={i} style={{ fontSize: 12, color: IC.danger, lineHeight: 1.6 }}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={runValidation} disabled={!raw.trim()} style={{
                flex: 1, border: "none", borderRadius: 999, padding: "12px 0",
                background: raw.trim() ? IC.sendBg : "rgba(31,27,22,0.08)",
                color: raw.trim() ? IC.sendInk : IC.faint,
                fontFamily: IFONT, fontSize: 14, fontWeight: 700, cursor: raw.trim() ? "pointer" : "default",
              }}>
                Check it
              </button>
              <button onClick={loadExample} style={{ border: `1px solid ${IC.pillLine}`, borderRadius: 999, padding: "12px 18px", background: "transparent", color: IC.ink, fontFamily: IFONT, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                Try an example
              </button>
            </div>

            <button onClick={() => setShowExample((v) => !v)} style={{ marginTop: 16, border: "none", background: "transparent", color: IC.accent, fontFamily: IFONT, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>
              {showExample ? "Hide format reference" : "See the expected JSON format"}
            </button>
            {showExample && (
              <pre style={{
                marginTop: 10, background: IC.surface, border: `1px solid ${IC.line}`, borderRadius: 12,
                padding: "14px 16px", fontSize: 11, lineHeight: 1.6, color: IC.muted, overflowX: "auto",
                fontFamily: "'SF Mono', 'Menlo', monospace", whiteSpace: "pre",
              }}>{EXAMPLE_JSON}</pre>
            )}
          </>
        )}

        {/* Valid — show preview + confirm */}
        {parsed && (
          <div>
            <div style={{ background: IC.surface, border: `1px solid ${IC.line}`, borderRadius: 16, padding: "18px 18px 16px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: IC.accent, marginBottom: 6 }}>Looks good</div>
              <div style={{ fontFamily: IWM, fontWeight: 700, fontSize: 19, color: IC.ink, marginBottom: 4 }}>{parsed.title}</div>
              <div style={{ fontSize: 13, color: IC.muted, marginBottom: 12 }}>
                {parsed.destination ? `${parsed.destination} · ` : ""}{parsed.date}{computeEndDate(parsed) !== parsed.date ? ` → ${computeEndDate(parsed)}` : ""}
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 12.5, color: IC.ink }}>
                <span>{checklistCount} checklist item{checklistCount === 1 ? "" : "s"}</span>
                <span>{dayCount} day{dayCount === 1 ? "" : "s"} planned</span>
                <span>{tipCount} tip{tipCount === 1 ? "" : "s"}</span>
              </div>
            </div>

            <button onClick={reset} style={{ marginTop: 10, border: "none", background: "transparent", color: IC.muted, fontFamily: IFONT, fontSize: 12.5, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
              Edit the JSON
            </button>

            {mode === "create" && (
              <button onClick={doCreate} style={{ width: "100%", marginTop: 20, border: "none", borderRadius: 999, padding: "13px 0", background: IC.sendBg, color: IC.sendInk, fontFamily: IFONT, fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}>
                Create trip
              </button>
            )}

            {mode === "update" && !existingHasData && (
              <button onClick={() => doUpdate("overwrite")} style={{ width: "100%", marginTop: 20, border: "none", borderRadius: 999, padding: "13px 0", background: IC.sendBg, color: IC.sendInk, fontFamily: IFONT, fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}>
                Import into this trip
              </button>
            )}

            {mode === "update" && existingHasData && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12.5, color: IC.muted, marginBottom: 12, lineHeight: 1.5 }}>
                  This trip already has details saved. Tips are always added, never removed — but choose how to handle the brief, checklist, and calendar:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button onClick={() => doUpdate("append")} style={{ border: `1px solid ${IC.pillLine}`, borderRadius: 14, padding: "13px 16px", background: "transparent", textAlign: "left", cursor: "pointer", fontFamily: IFONT }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: IC.ink }}>Append to existing</div>
                    <div style={{ fontSize: 12, color: IC.muted, marginTop: 2 }}>Adds new items, keeps everything already there</div>
                  </button>
                  <button onClick={() => doUpdate("overwrite")} style={{ border: `1px solid ${IC.danger}`, borderRadius: 14, padding: "13px 16px", background: IC.dangerSoft, textAlign: "left", cursor: "pointer", fontFamily: IFONT }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: IC.danger }}>Replace existing</div>
                    <div style={{ fontSize: 12, color: IC.danger, marginTop: 2 }}>Overwrites the brief, checklist, and calendar with this import</div>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
