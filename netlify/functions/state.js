const BLOB_KEY_PREFIX = "junie-event-";
const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

function getEnv(context) {
  const siteId = process.env.SITE_ID || (context?.site?.id);
  const token = process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  return { siteId, token };
}

function blobUrl(siteId, key) {
  return `https://api.netlify.com/api/v1/blobs/${siteId}/junie/${key}`;
}

async function blobGet(siteId, token, key) {
  try {
    const res = await fetch(blobUrl(siteId, key), { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

async function blobPut(siteId, token, key, body) {
  await fetch(blobUrl(siteId, key), {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" },
    body,
  });
}

export default async (request, context) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

  const url = new URL(request.url);
  const eventId = url.searchParams.get("event");
  if (!eventId) return new Response(JSON.stringify({ error: "Missing event ID" }), { status: 400, headers });

  const { siteId, token } = getEnv(context);
  if (!siteId || !token) return new Response(JSON.stringify({ error: "Missing SITE_ID or NETLIFY_API_TOKEN" }), { status: 500, headers });

  const blobKey = BLOB_KEY_PREFIX + eventId;

  if (request.method === "GET") {
    const raw = await blobGet(siteId, token, blobKey);
    return new Response(raw || "null", { status: 200, headers });
  }

  if (request.method === "POST") {
    try {
      const incoming = await request.json();
      let existing = {};
      try { const raw = await blobGet(siteId, token, blobKey); if (raw) existing = JSON.parse(raw); } catch {}
      const merged = {
        ...existing,
        ...(incoming.brief !== undefined && { brief: incoming.brief }),
        ...(incoming.todos !== undefined && { todos: incoming.todos }),
        ...(incoming.checks !== undefined && { checks: incoming.checks }),
        ...(incoming.savedList !== undefined && { savedList: incoming.savedList }),
        ...(incoming.pins !== undefined && { pins: incoming.pins }),
        ...(incoming.chips !== undefined && { chips: incoming.chips }),
        ...(incoming.dayPlans !== undefined && { dayPlans: incoming.dayPlans }),
        updatedAt: Date.now(),
      };
      await blobPut(siteId, token, blobKey, JSON.stringify(merged));

      // Always write meta if we have enough info (name may come from brief)
      const eventName = incoming.name ||
        (incoming.brief?.find(r => /name|event|title/i.test(r?.key || ""))?.value) || "";
      const eventVenue = incoming.venue ||
        (incoming.brief?.find(r => /venue|destination/i.test(r?.key || ""))?.value) || "";
      if (incoming.inviteCode || eventName) {
        try {
          const meta = {
            id: eventId,
            name: eventName,
            hostName: incoming.hostName || "",
            mainDate: incoming.mainDate || "",
            endDate: incoming.endDate || "",
            venue: eventVenue,
            occasionType: incoming.occasionType || "event",
            inviteCode: incoming.inviteCode || "",
          };
          await blobPut(siteId, token, `meta-${eventId}`, JSON.stringify(meta));
        } catch {}
      }

      if (incoming.inviteCode) {
        try {
          let index = {};
          const idxRaw = await blobGet(siteId, token, "invite-index");
          if (idxRaw) index = JSON.parse(idxRaw);
          index[incoming.inviteCode] = eventId;
          await blobPut(siteId, token, "invite-index", JSON.stringify(index));
        } catch {}
      }

      return new Response(JSON.stringify(merged), { status: 200, headers });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
    }
  }

  return new Response("Method not allowed", { status: 405, headers });
};

export const config = { path: "/api/state" };
