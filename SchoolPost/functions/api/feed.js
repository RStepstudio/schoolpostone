export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return Response.json({ error: "The D1 database binding is not configured." }, { status: 503 });
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id") || "";

  const { results } = await env.DB.prepare(
    `SELECT posts.id, posts.author_id AS author, users.name, users.handle,
            users.initials, users.avatar, users.detail, posts.text,
            posts.created_at, posts.kind, posts.repo_name, posts.repo_description,
            posts.repo_language, posts.repo_stars,
            posts.file_name, posts.file_type, posts.file_size,
            (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS likes,
            (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comments,
            EXISTS(SELECT 1 FROM likes WHERE likes.post_id = posts.id AND likes.user_id = ?) AS liked,
            EXISTS(SELECT 1 FROM post_sessions WHERE post_sessions.post_id = posts.id AND post_sessions.session_id = ?) AS can_delete,
            EXISTS(SELECT 1 FROM user_verification WHERE user_id = posts.author_id AND verified = 1) AS verified
      FROM posts JOIN users ON users.id = posts.author_id
      WHERE posts.hidden = 0
      ORDER BY posts.created_at DESC LIMIT 50`
  ).bind(sessionId, sessionId).all();

  const posts = results.map((row) => ({
    id: row.id,
    author: row.author,
    name: row.name,
    handle: row.handle,
    initials: row.initials,
    avatar: row.avatar,
    detail: row.detail,
    text: row.text,
    time: relativeTime(row.created_at),
    likes: row.likes,
    comments: row.comments,
    liked: Boolean(row.liked),
    can_delete: Boolean(row.can_delete),
    verified: Boolean(row.verified),
    file_name: row.file_name,
    file_type: row.file_type,
    file_size: row.file_size,
    ...(row.kind === "repository" ? { repo: { name: row.repo_name, description: row.repo_description, language: row.repo_language, stars: row.repo_stars } } : {}),
  }));

  return Response.json({ posts });
}

function relativeTime(timestamp) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(`${timestamp}Z`).getTime()) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}