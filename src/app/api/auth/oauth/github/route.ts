import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return NextResponse.json({ ok: false, error: "GitHub OAuth is not configured." }, { status: 503 });

  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/auth/oauth/github/callback`;
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "read:user user:email",
      state,
    })}`,
  );
  response.cookies.set("lumia_oauth_state_github", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
  return response;
}
