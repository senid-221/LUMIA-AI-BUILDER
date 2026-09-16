import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await prisma.builderProject.findFirst({ where: { id, ownerId: user.id }, select: { id: true, name: true } });
  if (!project) return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });

  const hook = process.env.VERCEL_DEPLOY_HOOK_URL?.trim();
  if (!hook) return NextResponse.json({ ok: false, error: "Vercel deployment is not configured. Set VERCEL_DEPLOY_HOOK_URL on the server." }, { status: 503 });

  try {
    const response = await fetch(hook, { method: "POST", cache: "no-store" });
    const text = await response.text();
    if (!response.ok) return NextResponse.json({ ok: false, error: `Vercel deploy hook returned HTTP ${response.status}.`, details: text.slice(0, 500) }, { status: 502 });
    return NextResponse.json({ ok: true, status: "QUEUED", project: project.name, message: "Deployment triggered. Vercel is building the connected repository." });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to trigger Vercel deployment." }, { status: 502 });
  }
}
