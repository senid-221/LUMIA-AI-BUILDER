import { nvidiaChat } from "../ai/nvidia";
import { memoryContext, recall, remember } from "./memory";

export type AgentRole = "ui" | "backend" | "database" | "tester" | "security";

export type AgentStep = {
  role: AgentRole;
  status: "DONE" | "FAILED";
  output: string;
};

const ROLE_PROMPTS: Record<AgentRole, string> = {
  ui: "Act as the UI Agent. Review the build request and plan. Define concrete pages, components, states, accessibility requirements, responsive behavior, and UX risks. Do not write code.",
  backend: "Act as the Backend Agent. Review the build request and plan. Define APIs, validation, auth boundaries, error handling, and server-side responsibilities. Do not write code.",
  database: "Act as the Database Agent. Review the build request and plan. Define entities, relationships, indexes, ownership rules, and migration concerns. Do not write code.",
  tester: "Act as the Test Agent. Review the build request and plan. Define acceptance checks, likely failure cases, and build/runtime verification steps. Do not write code.",
  security: "Act as the Security Agent. Review the build request and plan. Identify secrets, authorization, input validation, dependency, sandbox, and data-isolation risks. Give concrete mitigations. Do not write code."
};

const MAX_STEPS = 5;
const MAX_OUTPUT = 7000;

export async function runAgentTeam(input: {
  request: string;
  plan: unknown;
  projectId?: string;
}): Promise<{ ok: true; steps: AgentStep[]; context: string; memoryCount: number }> {
  const memories = input.projectId ? await recall(input.projectId, 12) : [];
  const sharedMemory = memoryContext(memories);
  const planText = JSON.stringify(input.plan);
  const steps: AgentStep[] = [];

  for (const role of Object.keys(ROLE_PROMPTS).slice(0, MAX_STEPS) as AgentRole[]) {
    try {
      const response = await nvidiaChat([
        { role: "system", content: ROLE_PROMPTS[role] },
        {
          role: "user",
          content: `Build request:\n${input.request}\n\nPlan:\n${planText}\n\nShared project memory:\n${sharedMemory || "None"}\n\nReturn concise actionable guidance for the next agents.`,
        },
      ], { temperature: 0.15, maxTokens: 1400 });
      const output = response.content.slice(0, MAX_OUTPUT);
      steps.push({ role, status: "DONE", output });
      if (input.projectId) {
        await remember({
          projectId: input.projectId,
          agentType: role,
          role: "assistant",
          content: output,
          metadata: { kind: "team_agent", agentRole: role },
        });
      }
    } catch (error) {
      const output = error instanceof Error ? error.message : "Agent failed.";
      steps.push({ role, status: "FAILED", output });
    }
  }

  const context = steps
    .filter((step) => step.status === "DONE")
    .map((step) => `[${step.role.toUpperCase()} AGENT]\n${step.output}`)
    .join("\n\n");

  if (input.projectId && context) {
    await remember({
      projectId: input.projectId,
      agentType: "orchestrator",
      role: "assistant",
      content: context.slice(0, 20000),
      metadata: { kind: "team_context", steps: steps.length },
    });
  }

  return { ok: true, steps, context, memoryCount: memories.length };
}
