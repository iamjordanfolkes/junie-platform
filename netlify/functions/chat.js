export default async (request, context) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
  try {
    const body = await request.json();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), { status: res.status, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};
export const config = { path: "/api/chat" };
