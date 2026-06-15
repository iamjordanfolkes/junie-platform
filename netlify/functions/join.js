const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

function getEnv(context) {
  const siteId = process.env.SITE_ID || (context?.site?.id);
  const token = process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  return { siteId, token };
}

export default async (request, context) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return new Response(JSON.stringify({ error: "Missing code" }), { status: 400, headers });

  const { siteId, token } = getEnv(context);
  if (!siteId || !token) return new Response(JSON.stringify({ error: "Missing env vars" }), { status: 500, headers });

  try {
    // Look up invite index
    const idxUrl = `https://api.netlify.com/api/v1/blobs/${siteId}/junie/invite-index`;
    const idxRes = await fetch(idxUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!idxRes.ok) return new Response("null", { status: 200, headers });

    const idx = await idxRes.json();
    const eventId = idx[code];
    if (!eventId) return new Response("null", { status: 200, headers });

    // Try meta blob first
    try {
      const metaUrl = `https://api.netlify.com/api/v1/blobs/${siteId}/junie/meta-${eventId}`;
      const metaRes = await fetch(metaUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (metaRes.ok) {
        const meta = await metaRes.json();
        // Also get full state to merge
        const stateUrl = `https://api.netlify.com/api/v1/blobs/${siteId}/junie/junie-event-${eventId}`;
        const stateRes = await fetch(stateUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (stateRes.ok) {
          const state = await stateRes.json();
          return new Response(JSON.stringify({ ...state, ...meta, id: eventId }), { status: 200, headers });
        }
        return new Response(JSON.stringify({ ...meta, id: eventId }), { status: 200, headers });
      }
    } catch {}

    // Fallback: get state blob and extract what we can
    const stateUrl = `https://api.netlify.com/api/v1/blobs/${siteId}/junie/junie-event-${eventId}`;
    const stateRes = await fetch(stateUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!stateRes.ok) return new Response("null", { status: 200, headers });

    const state = await stateRes.json();

    // Try to extract name from brief if not stored at root
    const nameBrief = state.brief?.find(r => /name|event|title/i.test(r.key))?.value || "";
    const venueBrief = state.brief?.find(r => /venue|destination|location/i.test(r.key))?.value || "";

    return new Response(JSON.stringify({
      ...state,
      id: eventId,
      name: state.name || nameBrief || eventId,
      venue: state.venue || venueBrief || "",
      mainDate: state.mainDate || "",
      endDate: state.endDate || "",
      occasionType: state.occasionType || "event",
    }), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};

export const config = { path: "/api/join" };
