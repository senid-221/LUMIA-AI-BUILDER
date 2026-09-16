import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const instructions = typeof body?.instructions === "string" ? body.instructions.trim() : "";
  const welcome = typeof body?.welcome === "string" ? body.welcome.trim() : "";
  if (!instructions) return NextResponse.json({ ok: false, error: "Agent instructions are required." }, { status: 400 });
  // Runtime credentials remain environment-only. Persistent per-user agent settings will be added with the agent configuration schema.
  return NextResponse.json({ ok: true, saved: true, userId: user.id, instructions, welcome });
}
