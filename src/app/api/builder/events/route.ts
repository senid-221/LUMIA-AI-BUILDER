import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });
    const projectId = new URL(request.url).searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ ok: false, error: "Project id is required." }, { status: 400 });

    const project = await prisma.builderProject.findFirst({
      where: { id: projectId, ownerId: user.id },
      select: {
        id: true,
        status: true,
        description: true,
        updatedAt: true,
        files: {
          orderBy: { updatedAt: "asc" },
          select: { id: true, path: true, language: true, content: true, updatedAt: true },
        },
        tasks: {
          orderBy: { createdAt: "asc" },
          select: { id: true, type: true, title: true, status: true, createdAt: true, output: true },
        },
      },
    });

    if (!project) return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
    return NextResponse.json({ ok: true, project }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to read build events." }, { status: 500 });
  }
}
