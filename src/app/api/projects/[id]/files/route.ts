import {NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";
import {getCurrentUser} from "@/lib/auth";

function safePath(value: unknown) {
  const path = String(value || "").replaceAll("\\", "/").trim();
  if (!path || path.startsWith("/") || path.includes("..") || path.length > 500) return null;
  return path;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await prisma.builderProject.findFirst({ where: { id, ownerId: user.id }, select: { id: true } });
  if (!project) return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
  const files = await prisma.builderFile.findMany({ where: { projectId: id }, orderBy: { path: "asc" } });
  return NextResponse.json({ ok: true, files });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await prisma.builderProject.findFirst({ where: { id, ownerId: user.id }, select: { id: true } });
  if (!project) return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
  try {
    const body = await req.json();
    const input = Array.isArray(body.files) ? body.files : [body];
    if (!input.length || input.length > 100) return NextResponse.json({ ok: false, error: "Provide 1-100 files." }, { status: 400 });
    for (const file of input) {
      const path = safePath(file.path);
      if (!path) return NextResponse.json({ ok: false, error: `Invalid file path: ${String(file.path || "")}` }, { status: 400 });
      await prisma.builderFile.upsert({
        where: { projectId_path: { projectId: id, path } },
        create: { projectId: id, path, content: String(file.content ?? ""), language: file.language ? String(file.language) : null },
        update: { content: String(file.content ?? ""), language: file.language ? String(file.language) : null }
      });
    }
    return NextResponse.json({ ok: true, count: input.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "File save failed" }, { status: 400 });
  }
}
