import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = request.headers.get("cookie")?.match(/(?:^|; )lumia_oauth_state_github=([^;]+)/)?.[1];
  if (!code || !state || state !== savedState) return NextResponse.redirect(new URL("/?authError=Invalid+GitHub+OAuth+state", url.origin));

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return NextResponse.redirect(new URL("/?authError=GitHub+OAuth+is+not+configured", url.origin));

  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: `${url.origin}/api/auth/oauth/github/callback` }) });
    if (!tokenResponse.ok) throw new Error("GitHub token exchange failed");
    const token = await tokenResponse.json();
    const profileResponse = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "Lumia-Builder" } });
    if (!profileResponse.ok) throw new Error("GitHub profile request failed");
    const profile = await profileResponse.json();
    let email = typeof profile.email === "string" ? profile.email.toLowerCase() : "";
    if (!email) {
      const emailsResponse = await fetch("https://api.github.com/user/emails", { headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "Lumia-Builder" } });
      if (emailsResponse.ok) {
        const emails = await emailsResponse.json();
        const primary = Array.isArray(emails) && emails.find((x: any) => x.primary && x.verified);
        email = typeof primary?.email === "string" ? primary.email.toLowerCase() : "";
      }
    }
    if (!email) throw new Error("GitHub did not provide a verified email");

    const user = await prisma.user.upsert({ where: { email }, update: { name: profile.name || profile.login || null }, create: { email, name: profile.name || profile.login || null, passwordHash: null } });
    const response = NextResponse.redirect(new URL("/", url.origin));
    await createSession(user.id, response);
    response.cookies.set("lumia_oauth_state_github", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    console.error("GitHub OAuth error", error);
    return NextResponse.redirect(new URL(`/?authError=${encodeURIComponent(error instanceof Error ? error.message : "GitHub login failed")}`, url.origin));
  }
}
