export async function onRequestDelete({ request, env, params }) {
  if (!env.DB) {
    return Response.json({ error: "The D1 database binding is not configured." }, { status: 503 });
  }

  const postId = params.id;
  if (!postId) {
    return Response.json({ error: "Post ID is required." }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId) {
    return Response.json({ error: "Session ID is required." }, { status: 400 });
  }

  const sessionMatch = await env.DB.prepare(
    "SELECT 1 FROM post_sessions WHERE post_id = ? AND session_id = ?"
  ).bind(postId, sessionId).first();

  if (!sessionMatch) {
    return Response.json({ error: "You can only delete your own posts from this session." }, { status: 403 });
  }

  await env.DB.prepare(
    "UPDATE posts SET hidden = 1 WHERE id = ?"
  ).bind(postId).run();

  return Response.json({ success: true });
}