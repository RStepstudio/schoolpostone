export async function onRequestGet({ request, env, params }) {
  if (!env.DB) {
    return Response.json({ error: "The D1 database binding is not configured." }, { status: 503 });
  }

  const clubId = params.id;
  if (!clubId) {
    return Response.json({ error: "Club ID is required." }, { status: 400 });
  }

  const club = await env.DB.prepare(
    `SELECT c.*, u.name as owner_name, u.handle as owner_handle,
            (SELECT COUNT(*) FROM club_members WHERE club_id = c.id) as member_count
      FROM clubs c JOIN users u ON u.id = c.owner_id
      WHERE c.id = ?`
  ).bind(clubId).first();

  if (!club) {
    return Response.json({ error: "Club not found." }, { status: 404 });
  }

  const members = await env.DB.prepare(
    `SELECT u.id, u.name, u.handle, u.initials, u.avatar, u.detail, cm.joined_at
      FROM club_members cm JOIN users u ON u.id = cm.user_id
      WHERE cm.club_id = ?
      ORDER BY cm.joined_at ASC`
  ).bind(clubId).all();

  return Response.json({ club: { ...club, members: members.results } });
}