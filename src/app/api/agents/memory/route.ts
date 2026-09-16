import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 20), 1), 50);
  if (!projectId) return NextResponse.json({ ok: false, error: "projectId is required." }, { status: 400 });
  const project = await prisma.builderProject.findFirst({ where: { id: projectId, ownerId: user.id }, select: { id: true } });
  if (!project) return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
  const memories = await prisma.agentMemory.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: limit });
  return NextResponse.json({ ok: true, memories });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const agentType = typeof body?.agentType === "string" ? body.agentType.trim() : "";
  const role = typeof body?.role === "string" ? body.role.trim() : "assistant";
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!projectId || !agentType || !content) return NextResponse.json({ ok: false, error: "projectId, agentType and content are required." }, { status: 400 });
  if (content.length > 20000) return NextResponse.json({ ok: false, error: "Memory content is too long." }, { status: 400 });
  const project = await prisma.builderProject.findFirst({ where: { id: projectId, ownerId: user.id }, select: { id: true } });
  if (!project) return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
  const memory = await prisma.agentMemory.create({ data: { projectId, agentType, role, content, metadata: body?.metadata ?? undefined } });
  return NextResponse.json({ ok: true, memory }, { status: 201 });
}
