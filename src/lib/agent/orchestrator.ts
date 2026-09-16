import { createBuildPlan } from "./planner";
import { memoryContext, recall, remember } from "./memory";

export async function planBuild(request: string, projectId?: string) {
  const memories = projectId ? await recall(projectId, 12) : [];
  const context = memoryContext(memories);
  const enrichedRequest = projectId && memories.length
    ? `${request}\n\nRelevant project memory:\n${context}`
    : request;
  const plan = await createBuildPlan(enrichedRequest);
  if (projectId) {
    await remember({
      projectId,
      agentType: "planner",
      role: "assistant",
      content: JSON.stringify({ request, summary: plan.summary, tasks: plan.tasks }),
      metadata: { kind: "build_plan" },
    });
  }
  return { ok: true, phase: "PLANNED" as const, plan, memoryCount: memories.length };
}
