export async function onRequestPost({ request, env, params }) {
  if (!env.DB) {
    return Response.json({ error: "The D1 database binding is not configured." }, { status: 503 });
  }

  const clubId = params.id;
  if (!clubId) {
    return Response.json({ error: "Club ID is required." }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!username) {
    return Response.json({ error: "Username is required." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (action !== "join" && action !== "leave") {
    return Response.json({ error: "Action must be 'join' or 'leave'." }, { status: 400 });
  }

  const club = await env.DB.prepare("SELECT 1 FROM clubs WHERE id = ?").bind(clubId).first();
  if (!club) {
    return Response.json({ error: "Club not found." }, { status: 404 });
  }

  const existing = await env.DB.prepare(
    "SELECT 1 FROM club_members WHERE club_id = ? AND user_id = ?"
  ).bind(clubId, username).first();

  if (action === "join") {
    if (existing) {
      return Response.json({ error: "Already a member." }, { status: 400 });
    }
    await env.DB.prepare(
      "INSERT INTO club_members (club_id, user_id, joined_at) VALUES (?, ?, ?)"
    ).bind(clubId, username, new Date().toISOString()).run();
    return Response.json({ joined: true });
  } else {
    if (!existing) {
      return Response.json({ error: "Not a member." }, { status: 400 });
    }
    const clubOwner = await env.DB.prepare("SELECT owner_id FROM clubs WHERE id = ?").bind(clubId).first();
    if (clubOwner && clubOwner.owner_id === username) {
      return Response.json({ error: "Owner cannot leave their own club." }, { status: 400 });
    }
    await env.DB.prepare(
      "DELETE FROM club_members WHERE club_id = ? AND user_id = ?"
    ).bind(clubId, username).run();
    return Response.json({ joined: false });
  }
}