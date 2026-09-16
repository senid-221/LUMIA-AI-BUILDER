import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_INSTRUCTIONS = "You are Lumia's helpful WhatsApp AI assistant. Answer clearly and concisely.";
const DEFAULT_WELCOME = "Hello! How can I help you today?";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || null;
  if (projectId) {
    const project = await prisma.builderProject.findFirst({ where: { id: projectId, ownerId: user.id }, select: { id: true } });
    if (!project) return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
  }
  const config = await prisma.whatsAppAgentConfig.findUnique({ where: { userId_projectId: { userId: user.id, projectId } } });
  return NextResponse.json({ ok: true, config: config ?? { instructions: DEFAULT_INSTRUCTIONS, welcome: DEFAULT_WELCOME, enabled: true, projectId } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const instructions = typeof body?.instructions === "string" ? body.instructions.trim() : "";
  const welcome = typeof body?.welcome === "string" ? body.welcome.trim() : DEFAULT_WELCOME;
  const projectId = typeof body?.projectId === "string" && body.projectId ? body.projectId : null;
  const enabled = body?.enabled === undefined ? true : Boolean(body.enabled);
  if (!instructions) return NextResponse.json({ ok: false, error: "Agent instructions are required." }, { status: 400 });
  if (instructions.length > 12000 || welcome.length > 2000) return NextResponse.json({ ok: false, error: "Agent settings are too long." }, { status: 400 });
  if (projectId) {
    const project = await prisma.builderProject.findFirst({ where: { id: projectId, ownerId: user.id }, select: { id: true } });
    if (!project) return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
  }
  const config = await prisma.whatsAppAgentConfig.upsert({
    where: { userId_projectId: { userId: user.id, projectId } },
    create: { userId: user.id, projectId, instructions, welcome, enabled },
    update: { instructions, welcome, enabled },
  });
  return NextResponse.json({ ok: true, saved: true, config: { id: config.id, projectId: config.projectId, instructions: config.instructions, welcome: config.welcome, enabled: config.enabled } });
}
