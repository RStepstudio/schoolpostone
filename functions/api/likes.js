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

  if (typeof body.postId !== "string" || body.postId.length > 64) {
    return Response.json({ error: "A valid postId is required." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!username) {
    return Response.json({ error: "Username is required." }, { status: 400 });
  }

  const existing = await env.DB.prepare(
    "SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?"
  ).bind(username, body.postId).first();

  if (existing) {
    await env.DB.prepare("DELETE FROM likes WHERE user_id = ? AND post_id = ?").bind(username, body.postId).run();
    return Response.json({ liked: false });
  }

  await env.DB.prepare(
    "INSERT OR IGNORE INTO likes (user_id, post_id) SELECT ?, id FROM posts WHERE id = ?"
  ).bind(username, body.postId).run();
  return Response.json({ liked: true });
}