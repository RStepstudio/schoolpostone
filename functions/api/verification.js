export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return Response.json({ error: "The D1 database binding is not configured." }, { status: 503 });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id");
  if (!userId) {
    return Response.json({ error: "User ID is required." }, { status: 400 });
  }

  const verification = await env.DB.prepare(
    "SELECT verified, verified_at, reason FROM user_verification WHERE user_id = ?"
  ).bind(userId).first();

  if (!verification) {
    return Response.json({ verified: false });
  }

  return Response.json({ verified: Boolean(verification.verified), verified_at: verification.verified_at, reason: verification.reason });
}