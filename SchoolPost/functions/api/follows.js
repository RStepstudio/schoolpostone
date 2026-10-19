export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return Response.json({ error: "The D1 database binding is not configured." }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (typeof body.userId !== "string" || body.userId.length < 3 || body.userId.length > 20 || !/^[a-zA-Z0-9_-]+$/.test(body.userId)) {
    return Response.json({ error: "A valid userId is required." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!username) {
    return Response.json({ error: "Username is required." }, { status: 400 });
  }

  if (username === body.userId) {
    return Response.json({ error: "You cannot follow yourself." }, { status: 400 });
  }

  const existing = await env.DB.prepare(
    "SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?"
  ).bind(username, body.userId).first();

  if (existing) {
    await env.DB.prepare("DELETE FROM follows WHERE follower_id = ? AND followed_id = ?").bind(username, body.userId).run();
    return Response.json({ following: false });
  }

  await env.DB.prepare(
    "INSERT OR IGNORE INTO follows (follower_id, followed_id) VALUES (?, ?)"
  ).bind(username, body.userId).run();
  return Response.json({ following: true });
}