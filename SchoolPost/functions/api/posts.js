import { checkContentAI } from "../utils/content-filter.js";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_FILE_TYPES = ["text/plain", "application/json", "text/csv", "text/markdown"];

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

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 500) {
    return Response.json({ error: "Posts must contain between 1 and 500 characters." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!username || username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_-]+$/.test(username)) {
    return Response.json({ error: "Invalid username. Must be 3-20 characters, alphanumeric, underscore, or hyphen." }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId) {
    return Response.json({ error: "Session ID is required." }, { status: 400 });
  }

  const filterResult = await checkContentAI(text, env);
  if (!filterResult.allowed) {
    return Response.json({ error: filterResult.reason || "Your post was blocked by the content filter." }, { status: 400 });
  }

  let fileName = null;
  let fileType = null;
  let fileSize = null;
  let fileData = null;

  if (body.file) {
    const file = body.file;
    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: "File size exceeds 50MB limit." }, { status: 400 });
    }
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return Response.json({ error: "Only .txt, .json, .csv, .md files are allowed." }, { status: 400 });
    }
    fileName = file.name;
    fileType = file.type;
    fileSize = file.size;
    fileData = file.data; // base64
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
    "INSERT INTO posts (id, author_id, text, kind, created_at, file_name, file_type, file_size, file_data) VALUES (?, ?, ?, 'post', ?, ?, ?, ?, ?)"
  ).bind(id, username, text, now, fileName, fileType, fileSize, fileData).run();

  await env.DB.prepare(
    "INSERT INTO post_sessions (post_id, session_id, created_at) VALUES (?, ?, ?)"
  ).bind(id, sessionId, now).run();

  return Response.json({
    post: { id, author: username, time: "now", text, likes: 0, comments: 0, session_id: sessionId, file_name: fileName },
  }, { status: 201 });
}