import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = request.headers.get("cookie")?.match(/(?:^|; )lumia_oauth_state_google=([^;]+)/)?.[1];
  if (!code || !state || state !== savedState) return NextResponse.redirect(new URL("/?authError=Invalid+Google+OAuth+state", url.origin));

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return NextResponse.redirect(new URL("/?authError=Google+OAuth+is+not+configured", url.origin));

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: `${url.origin}/api/auth/oauth/google/callback`, grant_type: "authorization_code" }) });
    if (!tokenResponse.ok) throw new Error("Google token exchange failed");
    const token = await tokenResponse.json();
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } });
    if (!profileResponse.ok) throw new Error("Google profile request failed");
    const profile = await profileResponse.json();
    const email = typeof profile.email === "string" ? profile.email.toLowerCase() : "";
    if (!email || profile.email_verified === false) throw new Error("Google did not provide a verified email");

    const user = await prisma.user.upsert({ where: { email }, update: { name: profile.name || null }, create: { email, name: profile.name || null, passwordHash: null } });
    const response = NextResponse.redirect(new URL("/", url.origin));
    await createSession(user.id, response);
    response.cookies.set("lumia_oauth_state_google", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    console.error("Google OAuth error", error);
    return NextResponse.redirect(new URL(`/?authError=${encodeURIComponent(error instanceof Error ? error.message : "Google login failed")}`, url.origin));
  }
}
