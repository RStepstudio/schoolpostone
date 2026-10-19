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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length < 3 || name.length > 50) {
    return Response.json({ error: "Club name must be 3-50 characters." }, { status: 400 });
  }

  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (description.length > 500) {
    return Response.json({ error: "Description must be under 500 characters." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!username) {
    return Response.json({ error: "Username is required." }, { status: 400 });
  }

  const filterResult = await checkContentAI(name + " " + description, env);
  if (!filterResult.allowed) {
    return Response.json({ error: filterResult.reason || "Club name/description blocked by content filter." }, { status: 400 });
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

  const existing = await env.DB.prepare("SELECT 1 FROM clubs WHERE name = ?").bind(name).first();
  if (existing) {
    return Response.json({ error: "A club with this name already exists." }, { status: 400 });
  }

  await env.DB.prepare(
    "INSERT INTO clubs (id, name, description, owner_id, created_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(id, name, description, username, now).run();

  await env.DB.prepare(
    "INSERT INTO club_members (club_id, user_id, joined_at) VALUES (?, ?, ?)"
  ).bind(id, username, now).run();

  return Response.json({ club: { id, name, description, owner_id: username, member_count: 1, created_at: now } }, { status: 201 });
}