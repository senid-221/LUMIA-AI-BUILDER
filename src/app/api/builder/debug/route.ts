import { NextResponse } from "next/server";
import { debugFiles } from "@/lib/agent/debugger";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const files = Array.isArray(body?.files) ? body.files : [];
    const stderr = typeof body?.stderr === "string" ? body.stderr : "";
    const stdout = typeof body?.stdout === "string" ? body.stdout : "";
    if (!files.length) return NextResponse.json({ error: "At least one file is required." }, { status: 400 });
    if (body?.projectId) {
      const project = await prisma.builderProject.findFirst({ where: { id: body.projectId, ownerId: user.id }, select: { id: true } });
      if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    const result = await debugFiles({ files, stdout, stderr });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI debug failed." }, { status: 500 });
  }
}
