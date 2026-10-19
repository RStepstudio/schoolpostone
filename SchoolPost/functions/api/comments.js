import { checkContentAI } from "../../utils/content-filter.js";

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

  const postId = typeof body.postId === "string" ? body.postId.trim() : "";
  if (!postId) {
    return Response.json({ error: "Post ID is required." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 500) {
    return Response.json({ error: "Comments must be between 1 and 500 characters." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!username) {
    return Response.json({ error: "Username is required." }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId) {
    return Response.json({ error: "Session ID is required." }, { status: 400 });
  }

  const filterResult = await checkContentAI(text, env);
  if (!filterResult.allowed) {
    return Response.json({ error: filterResult.reason || "Your comment was blocked by the content filter." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    "INSERT OR IGNORE INTO users (id, name, handle, initials, avatar, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    username,
    username.charAt(0).toUpperCase() + username.slice(1),
    "@" + username,
    username.slice(0, 2).toUpperCase(),
    "avatar-" + username,
    "Schoolpost user",
    now
  ).run();

  await env.DB.prepare(
    "INSERT INTO comments (id, post_id, author_id, text, created_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(id, postId, username, text, now).run();

  return Response.json({
    comment: { id, author: username, time: "now", text, session_id: sessionId },
  }, { status: 201 });
}