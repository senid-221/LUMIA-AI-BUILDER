import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { planBuild } from "@/lib/agent/orchestrator";
import { runAgentTeam } from "@/lib/agent/team";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });

    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const projectId = typeof body?.projectId === "string" ? body.projectId : "";
    if (!prompt || !projectId) return NextResponse.json({ ok: false, error: "prompt and projectId are required." }, { status: 400 });

    const project = await prisma.builderProject.findFirst({ where: { id: projectId, ownerId: user.id }, select: { id: true } });
    if (!project) return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });

    const planned = await planBuild(prompt, projectId);
    const team = await runAgentTeam({ request: prompt, plan: planned.plan, projectId });

    return NextResponse.json({ projectId, plan: planned.plan, ...team });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Agent team failed." }, { status: 500 });
  }
}
