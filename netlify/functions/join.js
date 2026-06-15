// Scan blob store for event matching invite code
// Events store their inviteCode in metadata indexed separately
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

  // Look up invite code index blob
  const idxUrl = `https://api.netlify.com/api/v1/blobs/${siteId}/junie/invite-index`;
  try {
    const idxRes = await fetch(idxUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!idxRes.ok) return new Response("null", { status: 200, headers });

    const idx = await idxRes.json();
    const eventId = idx[code];
    if (!eventId) return new Response("null", { status: 200, headers });

    // Fetch that event's data
    const evtUrl = `https://api.netlify.com/api/v1/blobs/${siteId}/junie/junie-event-${eventId}`;
    const evtRes = await fetch(evtUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!evtRes.ok) return new Response("null", { status: 200, headers });

    const evtData = await evtRes.json();
    return new Response(JSON.stringify({ id: eventId, ...evtData }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};

export const config = { path: "/api/join" };
