export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return Response.json({ error: "The D1 database binding is not configured." }, { status: 503 });
  }

  const secret = new URL(request.url).searchParams.get("secret");
  if (secret !== env.VERIFICATION_CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const topPosts = await env.DB.prepare(
    `SELECT author_id, COUNT(*) as post_count
      FROM posts
      WHERE created_at >= ? AND hidden = 0
      GROUP BY author_id
      ORDER BY post_count DESC
      LIMIT 3`
  ).bind(weekAgo).all();

  for (const post of topPosts.results) {
    const followerCount = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM follows WHERE followed_id = ?"
    ).bind(post.author_id).first();

    if (followerCount && followerCount.count >= 5) {
      await env.DB.prepare(
        "INSERT OR REPLACE INTO user_verification (user_id, verified, verified_at, reason) VALUES (?, 1, ?, 'Top 3 poster this week with 5+ fans')"
      ).bind(post.author_id, now.toISOString()).run();
    }
  }

  const bigClubs = await env.DB.prepare(
    `SELECT owner_id FROM clubs
      WHERE id IN (
        SELECT club_id FROM club_members
        GROUP BY club_id
        HAVING COUNT(*) >= 10
      )`
  ).all();

  for (const club of bigClubs.results) {
    await env.DB.prepare(
      "INSERT OR REPLACE INTO user_verification (user_id, verified, verified_at, reason) VALUES (?, 1, ?, 'Owns a club with 10+ members')"
    ).bind(club.owner_id, now.toISOString()).run();
  }

  return Response.json({ success: true, message: "Verification check completed" });
}