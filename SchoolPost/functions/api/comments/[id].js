export async function onRequestDelete({ request, env, params }) {
  if (!env.DB) {
    return Response.json({ error: "The D1 database binding is not configured." }, { status: 503 });
  }

  const commentId = params.id;
  if (!commentId) {
    return Response.json({ error: "Comment ID is required." }, { status: 400 });
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

  const comment = await env.DB.prepare(
    "SELECT author_id FROM comments WHERE id = ?"
  ).bind(commentId).first();

  if (!comment) {
    return Response.json({ error: "Comment not found." }, { status: 404 });
  }

  const post = await env.DB.prepare(
    "SELECT p.id FROM posts p JOIN comments c ON c.post_id = p.id WHERE c.id = ?"
  ).bind(commentId).first();

  if (!post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  const sessionMatch = await env.DB.prepare(
    "SELECT 1 FROM post_sessions WHERE post_id = ? AND session_id = ?"
  ).bind(post.id, sessionId).first();

  const isAuthor = comment.author_id === sessionId;

  if (!sessionMatch && !isAuthor) {
    return Response.json({ error: "You can only delete your own comments." }, { status: 403 });
  }

  await env.DB.prepare(
    "DELETE FROM comments WHERE id = ?"
  ).bind(commentId).run();

  return Response.json({ success: true });
}