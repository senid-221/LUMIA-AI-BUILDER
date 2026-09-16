import { aiChat } from "../ai/provider";
import { memoryContext, recall, remember } from "./memory";

export type AgentRole = "ui" | "backend" | "database" | "tester" | "security";
export type AgentStep = { role: AgentRole; status: "DONE" | "FAILED"; output: string };

const ROLE_PROMPTS: Record<AgentRole, string> = {
  ui: "Act as the UI Agent. Review the build request and plan. Define concrete pages, components, states, accessibility requirements, responsive behavior, and UX risks. Do not write code.",
  backend: "Act as the Backend Agent. Review the build request and plan. Define APIs, validation, auth boundaries, error handling, and server-side responsibilities. Do not write code.",
  database: "Act as the Database Agent. Review the build request and plan. Define entities, relationships, indexes, ownership rules, and migration concerns. Do not write code.",
  tester: "Act as the Test Agent. Review the build request and plan. Define acceptance checks, likely failure cases, and build/runtime verification steps. Do not write code.",
  security: "Act as the Security Agent. Review the build request and plan. Identify secrets, authorization, input validation, dependency, sandbox, and data-isolation risks. Give concrete mitigations. Do not write code.",
};

export async function runAgentTeam(input: { request: string; plan: unknown; projectId?: string }) {
  const memories = input.projectId ? await recall(input.projectId, 12) : [];
  const sharedMemory = memoryContext(memories);
  const planText = JSON.stringify(input.plan);
  const steps: AgentStep[] = [];
  const roles: AgentRole[] = ["ui", "backend", "database", "tester", "security"];

  for (const role of roles) {
    try {
      const response = await aiChat(
        [
          { role: "system", content: ROLE_PROMPTS[role] },
          { role: "user", content: `Build request:\n${input.request}\n\nPlan:\n${planText}\n\nShared project memory:\n${sharedMemory || "None"}\n\nReturn concise actionable guidance for the next agents.` },
        ],
        { temperature: 0.15, maxTokens: 1200 },
      );
      const output = response.content.slice(0, 7000);
      steps.push({ role, status: "DONE", output });
      if (input.projectId) {
        await remember({
          projectId: input.projectId,
          agentType: role,
          role: "assistant",
          content: output,
          metadata: { kind: "team_agent", agentRole: role, model: response.model },
        });
      }
    } catch (error) {
      steps.push({ role, status: "FAILED", output: error instanceof Error ? error.message : "Agent failed." });
    }
  }

  const context = steps.filter(s => s.status === "DONE").map(s => `[${s.role.toUpperCase()} AGENT]\n${s.output}`).join("\n\n");
  if (input.projectId && context) {
    await remember({
      projectId: input.projectId,
      agentType: "orchestrator",
      role: "assistant",
      content: context.slice(0, 20000),
      metadata: { kind: "team_context", steps: steps.length },
    });
  }
  return { ok: true as const, steps, context, memoryCount: memories.length };
}
