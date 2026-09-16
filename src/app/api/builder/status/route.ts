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
        name: true,
        status: true,
        description: true,
        updatedAt: true,
        _count: { select: { files: true } },
        tasks: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, output: true, createdAt: true },
        },
      },
    });

    if (!project) return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
    return NextResponse.json({ ok: true, project });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to read build status." }, { status: 500 });
  }
}
