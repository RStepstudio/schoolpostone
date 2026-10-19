export function getIdentity(request) {
  const username = request.headers.get("x-schoolpost-username");
  const sessionId = request.headers.get("x-schoolpost-session-id");

  if (typeof username !== "string" || !/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
    return { error: "Choose a username between 3 and 20 characters using letters, numbers, _ or -." };
  }

  if (typeof sessionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
    return { error: "A valid Schoolpost session is required." };
  }

  return { username: username.toLowerCase(), sessionId };
}

export async function ensureUser(db, username) {
  const existing = await db.prepare("SELECT 1 FROM users WHERE id = ?").bind(username).first();
  if (existing) return;

  const initials = username.slice(0, 2).toUpperCase();
  const defaultHandle = `@${username}`;
  const collision = await db.prepare("SELECT 1 FROM users WHERE handle = ?").bind(defaultHandle).first();
  const handle = collision ? `@${username}-${crypto.randomUUID().slice(0, 6)}` : defaultHandle;
  await db.prepare(
    `INSERT INTO users (id, name, handle, initials, avatar, detail)
     VALUES (?, ?, ?, ?, 'avatar-anon', 'Schoolpost community')
     ON CONFLICT(id) DO NOTHING`,
  ).bind(username, username, handle, initials).run();
}
