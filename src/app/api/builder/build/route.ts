import { NextResponse } from "next/server";
import { planBuild } from "@/lib/agent/orchestrator";
import { autonomousBuild } from "@/lib/agent/build-loop";
import { runAgentTeam } from "@/lib/agent/team";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const maxDuration = 10;

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });

    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) return NextResponse.json({ ok: false, error: "A build request is required." }, { status: 400 });

    let projectId = typeof body?.projectId === "string" ? body.projectId : null;
    if (projectId) {
      const owned = await prisma.builderProject.findFirst({ where: { id: projectId, ownerId: user.id }, select: { id: true } });
      if (!owned) return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
    } else {
      const name = prompt.split(/\s+/).slice(0, 6).join(" ").replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "Lumia Project";
      const project = await prisma.builderProject.create({ data: { ownerId: user.id, name, description: prompt, status: "PLANNING" } });
      projectId = project.id;
    }

    await prisma.builderProject.update({ where: { id: projectId! }, data: { status: "BUILDING", description: prompt } });

    const jobProjectId = projectId!;
    void (async () => {
      try {
        console.info(`[LUMIA BUILD] started project=${jobProjectId}`);
        const planned = await planBuild(prompt, jobProjectId);
        console.info(`[LUMIA BUILD] planned project=${jobProjectId}`);
        const team = await runAgentTeam({ request: prompt, plan: planned.plan, projectId: jobProjectId });
        console.info(`[LUMIA BUILD] agents complete project=${jobProjectId}`);
        const buildRequest = team.context ? `${prompt}\n\nMulti-agent implementation guidance:\n${team.context}` : prompt;
        const built = await autonomousBuild(buildRequest, planned.plan, jobProjectId);
        console.info(`[LUMIA BUILD] autonomous build ${built.result?.status} project=${jobProjectId}`);

        if (built.files?.length) {
          await prisma.$transaction(built.files.map((file: any) => prisma.builderFile.upsert({
            where: { projectId_path: { projectId: jobProjectId, path: file.path } },
            create: { projectId: jobProjectId, path: file.path, content: file.content, language: file.language ?? null },
            update: { content: file.content, language: file.language ?? null },
          })));
        }

        await prisma.builderTask.create({
          data: {
            projectId: jobProjectId,
            type: "PLAN",
            title: "Multi-agent build",
            status: built.result?.status === "PASSED" ? "DONE" : "FAILED",
            input: { prompt },
            output: { plan: planned.plan, teamSteps: team.steps, retries: built.retries, memoryCount: planned.memoryCount },
          },
        });

        await prisma.builderProject.update({
          where: { id: jobProjectId },
          data: { status: built.result?.status === "PASSED" ? "READY" : "FAILED" },
        });
      } catch (error) {
        console.error(`[LUMIA BUILD] failed project=${jobProjectId}`, error);
        await prisma.builderProject.update({
          where: { id: jobProjectId },
          data: { status: "FAILED", description: `${prompt}\n\nBuild error: ${error instanceof Error ? error.message : "Autonomous build failed."}` },
        }).catch(() => undefined);
      }
    })();

    return NextResponse.json({ ok: true, projectId, status: "BUILDING" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to start build." }, { status: 500 });
  }
}
