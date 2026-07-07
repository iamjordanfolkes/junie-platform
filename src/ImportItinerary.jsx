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

const IS_DEPLOYED = typeof window !== "undefined"
  && window.location.hostname !== "localhost"
  && !window.location.hostname.includes("127.0.0.1")
  && window.location.protocol !== "file:";

const EXAMPLE_TEXT = "Lisbon trip, Sept 11-12. Me + Sam.\nPack light layers and good walking shoes.\nVibe: slow mornings, good food, nothing too planned out.\n\nTo do: book flights, reserve the apartment, get a dinner reservation for Saturday night.\n\nDay 1 (arrival):\n- Land around 2:40pm, check in around 3\n- Dinner in Alfama around 7pm, something casual near the apartment\n\nDay 2:\n- 10am Belem Tower + Jeronimos Monastery\n- Pasteis de Belem around 1pm - get there before the line forms\n- Fado dinner show at 8pm\n\nTip: go to Belem right when it opens at 10am, it gets packed with tour buses by noon.";

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
    else obj.checklist.forEach((item, i) => { if (typeof item !== "string") errors.push("checklist[" + i + "] must be a string."); });
  }
  if (obj.days !== undefined) {
    if (!Array.isArray(obj.days)) {
      errors.push('"days" must be an array.');
    } else {
      obj.days.forEach((day, i) => {
        if (typeof day !== "object" || day === null || Array.isArray(day)) { errors.push("days[" + i + "] must be an object."); return; }
        if (!day.date || typeof day.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day.date)) {
          errors.push("days[" + i + "].date is required and must be formatted YYYY-MM-DD.");
        }
        if (day.label !== undefined && typeof day.label !== "string") errors.push("days[" + i + "].label must be a string.");
        if (day.items !== undefined) {
          if (!Array.isArray(day.items)) {
            errors.push("days[" + i + "].items must be an array.");
          } else {
            day.items.forEach((item, j) => {
              if (typeof item !== "object" || item === null || Array.isArray(item)) { errors.push("days[" + i + "].items[" + j + "] must be an object."); return; }
              if (!item.title || typeof item.title !== "string") errors.push("days[" + i + "].items[" + j + "].title is required.");
              if (item.time !== undefined && typeof item.time !== "string") errors.push("days[" + i + "].items[" + j + "].time must be a string.");
              if (item.notes !== undefined && typeof item.notes !== "string") errors.push("days[" + i + "].items[" + j + "].notes must be a string.");
              if (item.link !== undefined && typeof item.link !== "string") errors.push("days[" + i + "].items[" + j + "].link must be a string.");
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
        if (typeof tip !== "object" || tip === null || Array.isArray(tip)) { errors.push("savedTips[" + i + "] must be an object."); return; }
        if (!tip.title || typeof tip.title !== "string") errors.push("savedTips[" + i + "].title is required.");
        if (tip.description !== undefined && typeof tip.description !== "string") errors.push("savedTips[" + i + "].description must be a string.");
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
  return rows.map((r) => Object.assign({ id: genLocalId("b") }, r));
}

export function buildTodosFromItinerary(parsed) {
  return (parsed.checklist || []).map((label) => ({ id: genLocalId("t"), label: label }));
}

export function buildDayPlansFromItinerary(parsed) {
  const dayPlans = {};
  (parsed.days || []).forEach((day) => {
    const activities = (day.items || []).map((item) => {
      let text = item.title;
      if (item.time) text = item.time + " \u2014 " + text;
      if (item.notes) text = text + " (" + item.notes + ")";
      const act = { id: genLocalId("a"), text: text, done: false };
      if (item.link) act.link = item.link;
      return act;
    });
    dayPlans[day.date] = { notes: day.label || "", activities: activities };
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
    mainDate: mainDate,
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
      savedList: importedTips.concat(existingEvent.savedList || []),
    };
  }

  const existingBrief = existingEvent.brief || [];
  const existingKeys = {};
  existingBrief.forEach((r) => { existingKeys[r.key] = true; });
  const mergedBrief = existingBrief.concat(importedBrief.filter((r) => !existingKeys[r.key]));

  const existingTodos = existingEvent.todos || [];
  const existingLabels = {};
  existingTodos.forEach((t) => { existingLabels[t.label] = true; });
  const mergedTodos = existingTodos.concat(importedTodos.filter((t) => !existingLabels[t.label]));

  const mergedDayPlans = Object.assign({}, existingEvent.dayPlans || {});
  Object.keys(importedDayPlans).forEach((date) => {
    const plan = importedDayPlans[date];
    const existingPlan = mergedDayPlans[date];
    if (!existingPlan) {
      mergedDayPlans[date] = plan;
    } else {
      const existingTexts = {};
      (existingPlan.activities || []).forEach((a) => { existingTexts[a.text] = true; });
      const newActivities = plan.activities.filter((a) => !existingTexts[a.text]);
      const combinedNotes = existingPlan.notes
        ? (plan.notes && existingPlan.notes.indexOf(plan.notes) === -1 ? existingPlan.notes + " \u00b7 " + plan.notes : existingPlan.notes)
        : (plan.notes || "");
      mergedDayPlans[date] = {
        notes: combinedNotes,
        activities: (existingPlan.activities || []).concat(newActivities),
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
    savedList: importedTips.concat(existingEvent.savedList || []),
    endDate: mergedEndDate,
  };
}

const SCHEMA_REFERENCE = "{\n  \"title\": string,\n  \"destination\": string,\n  \"date\": \"YYYY-MM-DD\",\n  \"whosComing\": string,\n  \"packingNotes\": string,\n  \"vibe\": string,\n  \"checklist\": [string, ...],\n  \"days\": [\n    {\n      \"date\": \"YYYY-MM-DD\",\n      \"label\": string,\n      \"items\": [\n        { \"time\": string, \"title\": string, \"notes\": string, \"link\": string }\n      ]\n    }\n  ],\n  \"savedTips\": [\n    { \"title\": string, \"description\": string }\n  ]\n}";

async function organizeWithAI(rawText) {
  const today = new Date().toISOString().slice(0, 10);
  const prompt = "You convert a person's pasted trip plan \u2014 written in ANY format: casual notes, a copied email, bullet points, a text thread, whatever \u2014 into structured JSON for a trip-planning app.\n\nReturn ONLY valid JSON. No markdown code fences, no commentary, nothing before or after it. Match exactly this shape:\n" + SCHEMA_REFERENCE + "\n\nRules:\n- If exact calendar dates aren't given, invent a reasonable consecutive date range starting a few weeks from today (today is " + today + "), staying internally consistent with any \"Day 1 / Day 2\" structure in the source text.\n- Pull anything that sounds like a packing note, a vibe/description, or a to-do into the matching field.\n- Any recommendation, tip, or \"don't miss this\" line becomes a savedTips entry.\n- Keep item titles short \u2014 a place or activity name. Put extra detail in notes.\n- Omit a field entirely if the information truly isn't present, rather than inventing it.\n\nHere is what they pasted:\n\"\"\"\n" + rawText + "\n\"\"\"";

  const callOnce = async (url) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error("request failed");
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  };

  try {
    if (IS_DEPLOYED) return await callOnce("/api/chat");
    return await callOnce("https://api.anthropic.com/v1/messages");
  } catch (e) {
    return null;
  }
}

export default function ImportItinerary(props) {
  const mode = props.mode;
  const existingEvent = props.existingEvent;
  const onCreate = props.onCreate;
  const onUpdate = props.onUpdate;
  const onClose = props.onClose;

  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiCouldntParse, setAiCouldntParse] = useState(false);
  const [technicalErrors, setTechnicalErrors] = useState([]);
  const [parsed, setParsed] = useState(null);
  const [showFormat, setShowFormat] = useState(false);

  const existingHasData = !!existingEvent && (
    (existingEvent.todos && existingEvent.todos.length > 0) ||
    (existingEvent.brief && existingEvent.brief.some((r) => r.value)) ||
    (existingEvent.dayPlans && Object.keys(existingEvent.dayPlans).length > 0)
  );

  const reset = () => { setParsed(null); setAiCouldntParse(false); setTechnicalErrors([]); };
  const loadExample = () => { setRaw(EXAMPLE_TEXT); reset(); };

  const organize = async () => {
    const text = raw.trim();
    if (!text) return;
    reset();

    let direct = null;
    try { direct = JSON.parse(text); } catch (e) { direct = null; }
    if (direct) {
      const errs = validateItinerary(direct);
      if (errs.length === 0) { setParsed(direct); return; }
      setTechnicalErrors(errs);
    }

    setLoading(true);
    const aiResult = await organizeWithAI(text);
    setLoading(false);

    if (aiResult) {
      const errs = validateItinerary(aiResult);
      if (errs.length === 0) { setParsed(aiResult); return; }
      setTechnicalErrors(errs);
    }
    setAiCouldntParse(true);
  };

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

  const dayCount = (parsed && parsed.days && parsed.days.length) || 0;
  const tipCount = (parsed && parsed.savedTips && parsed.savedTips.length) || 0;
  const checklistCount = (parsed && parsed.checklist && parsed.checklist.length) || 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: IC.bg, display: "flex", flexDirection: "column", fontFamily: IFONT }}>
      <div style={{ padding: "52px 20px 16px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: IWM, fontWeight: 800, fontSize: 22, color: IC.ink }}>Add your itinerary</div>
          <div style={{ fontSize: 12.5, color: IC.muted, marginTop: 4 }}>
            {mode === "update" ? ("Adding to " + (existingEvent && existingEvent.name ? existingEvent.name : "this trip")) : "However it's written, Junie will turn it into a plan"}
          </div>
        </div>
        <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid " + IC.pillLine, background: "transparent", color: IC.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px" }}>
        {!parsed && (
          <div>
            <textarea
              value={raw}
              onChange={(e) => { setRaw(e.target.value); reset(); }}
              placeholder="Paste your itinerary here — an email, notes, bullet points, anything. Junie will organize it."
              rows={12}
              disabled={loading}
              style={{
                width: "100%", border: "1px solid " + IC.line, borderRadius: 14, padding: "14px 16px",
                fontFamily: IFONT, fontSize: 14, lineHeight: 1.6, color: IC.ink,
                background: loading ? IC.bg : IC.surface, outline: "none", resize: "vertical",
              }}
            />

            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, padding: "12px 14px", background: IC.accentSoft, borderRadius: 12 }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: IC.accent, animation: "bounceDot 1.1s " + (i * 0.15) + "s infinite ease-in-out" }} />
                  ))}
                </div>
                <span style={{ fontSize: 13, color: IC.accent, fontWeight: 600 }}>Junie's organizing this\u2026</span>
                <style>{"@keyframes bounceDot { 0%,60%,100% { opacity:.4; transform:translateY(0) } 30% { opacity:1; transform:translateY(-3px) } }"}</style>
              </div>
            )}

            {aiCouldntParse && !loading && (
              <div style={{ marginTop: 10, background: IC.dangerSoft, border: "1px solid " + IC.danger, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: IC.danger, marginBottom: 4 }}>Couldn't quite make sense of this one</div>
                <div style={{ fontSize: 12.5, color: IC.danger, lineHeight: 1.5 }}>
                  Try adding a bit more detail \u2014 dates, place names, or what happens each day \u2014 and give it another try.
                </div>
                {technicalErrors.length > 0 && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ fontSize: 11.5, color: IC.danger, cursor: "pointer" }}>Technical details</summary>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                      {technicalErrors.map((e, i) => (
                        <li key={i} style={{ fontSize: 11.5, color: IC.danger, lineHeight: 1.5 }}>{e}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={organize} disabled={!raw.trim() || loading} style={{
                flex: 1, border: "none", borderRadius: 999, padding: "12px 0",
                background: raw.trim() && !loading ? IC.sendBg : "rgba(31,27,22,0.08)",
                color: raw.trim() && !loading ? IC.sendInk : IC.faint,
                fontFamily: IFONT, fontSize: 14, fontWeight: 700, cursor: raw.trim() && !loading ? "pointer" : "default",
              }}>
                {loading ? "Organizing\u2026" : "Organize it"}
              </button>
              <button onClick={loadExample} disabled={loading} style={{ border: "1px solid " + IC.pillLine, borderRadius: 999, padding: "12px 18px", background: "transparent", color: IC.ink, fontFamily: IFONT, fontSize: 13.5, fontWeight: 600, cursor: loading ? "default" : "pointer", opacity: loading ? 0.5 : 1 }}>
                Try an example
              </button>
            </div>

            <button onClick={() => setShowFormat(!showFormat)} style={{ marginTop: 16, border: "none", background: "transparent", color: IC.muted, fontFamily: IFONT, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>
              {showFormat ? "Hide" : "Prefer structured JSON?"}
            </button>
            {showFormat && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: IC.muted, marginBottom: 8 }}>Paste JSON in this exact shape and it'll import instantly, no waiting:</div>
                <pre style={{
                  background: IC.surface, border: "1px solid " + IC.line, borderRadius: 12,
                  padding: "14px 16px", fontSize: 11, lineHeight: 1.6, color: IC.muted, overflowX: "auto",
                  fontFamily: "'SF Mono', 'Menlo', monospace", whiteSpace: "pre",
                }}>{SCHEMA_REFERENCE}</pre>
              </div>
            )}
          </div>
        )}

        {parsed && (
          <div>
            <div style={{ background: IC.surface, border: "1px solid " + IC.line, borderRadius: 16, padding: "18px 18px 16px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: IC.accent, marginBottom: 6 }}>Looks good</div>
              <div style={{ fontFamily: IWM, fontWeight: 700, fontSize: 19, color: IC.ink, marginBottom: 4 }}>{parsed.title}</div>
              <div style={{ fontSize: 13, color: IC.muted, marginBottom: 12 }}>
                {parsed.destination ? (parsed.destination + " \u00b7 ") : ""}{parsed.date}{computeEndDate(parsed) !== parsed.date ? (" \u2192 " + computeEndDate(parsed)) : ""}
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 12.5, color: IC.ink }}>
                <span>{checklistCount} checklist item{checklistCount === 1 ? "" : "s"}</span>
                <span>{dayCount} day{dayCount === 1 ? "" : "s"} planned</span>
                <span>{tipCount} tip{tipCount === 1 ? "" : "s"}</span>
              </div>
              <div style={{ fontSize: 11.5, color: IC.muted, marginTop: 10, fontStyle: "italic" }}>
                Double check the dates look right \u2014 you can adjust anything anytime in the Plan tab.
              </div>
            </div>

            <button onClick={reset} style={{ marginTop: 10, border: "none", background: "transparent", color: IC.muted, fontFamily: IFONT, fontSize: 12.5, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
              Start over
            </button>

            {mode === "create" && (
              <button onClick={doCreate} style={{ width: "100%", marginTop: 20, border: "none", borderRadius: 999, padding: "13px 0", background: IC.sendBg, color: IC.sendInk, fontFamily: IFONT, fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}>
                Create trip
              </button>
            )}

            {mode === "update" && !existingHasData && (
              <button onClick={() => doUpdate("overwrite")} style={{ width: "100%", marginTop: 20, border: "none", borderRadius: 999, padding: "13px 0", background: IC.sendBg, color: IC.sendInk, fontFamily: IFONT, fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}>
                Add to this trip
              </button>
            )}

            {mode === "update" && existingHasData && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12.5, color: IC.muted, marginBottom: 12, lineHeight: 1.5 }}>
                  This trip already has details saved. Tips are always added, never removed \u2014 but choose how to handle the brief, checklist, and calendar:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button onClick={() => doUpdate("append")} style={{ border: "1px solid " + IC.pillLine, borderRadius: 14, padding: "13px 16px", background: "transparent", textAlign: "left", cursor: "pointer", fontFamily: IFONT }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: IC.ink }}>Add to what's there</div>
                    <div style={{ fontSize: 12, color: IC.muted, marginTop: 2 }}>Adds new items, keeps everything already there</div>
                  </button>
                  <button onClick={() => doUpdate("overwrite")} style={{ border: "1px solid " + IC.danger, borderRadius: 14, padding: "13px 16px", background: IC.dangerSoft, textAlign: "left", cursor: "pointer", fontFamily: IFONT }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: IC.danger }}>Replace what's there</div>
                    <div style={{ fontSize: 12, color: IC.danger, marginTop: 2 }}>Overwrites the brief, checklist, and calendar with this</div>
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
