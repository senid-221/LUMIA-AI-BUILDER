import { nvidiaChat } from "../ai/nvidia";
import { memoryContext, recall, remember } from "./memory";

export type GeneratedFile = { path: string; language: string; content: string };

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf("[");
  const last = text.lastIndexOf("]");
  return first >= 0 && last > first ? text.slice(first, last + 1) : text.trim();
}

function cleanJson(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/,\s*([}\]])/g, "$1");
}

function parseFiles(text: string): GeneratedFile[] {
  const parsed = JSON.parse(cleanJson(extractJson(text))) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Invalid file list returned by AI.");

  const safe = parsed.filter((f): f is GeneratedFile => {
    if (!f || typeof f !== "object") return false;
    const x = f as Record<string, unknown>;
    const path = typeof x.path === "string" ? x.path : "";
    return (
      Boolean(path) &&
      typeof x.content === "string" &&
      !path.startsWith("/") &&
      !path.includes("..") &&
      !path.includes("\\")
    );
  });

  if (!safe.length) throw new Error("No safe files returned by AI.");
  return safe.slice(0, 40);
}

export async function generateFiles(request: string, plan: unknown, projectId?: string) {
  const memories = projectId ? await recall(projectId, 10) : [];
  const context = memoryContext(memories);
  const system = `You are Lumia AI's production code-generation agent. Return ONLY one valid JSON array and nothing else. Each item must be {"path":"...","language":"...","content":"..."}. Generate a coherent, runnable Next.js starter from the request and plan. Use double quotes in JSON, no trailing commas, and valid JSON string escaping. Paths must be relative and contain no .., absolute paths, or backslashes. Do not generate secrets, malware, spyware, destructive scripts, or shell commands. Prefer a small complete implementation over many placeholder files.`;

  const result = await nvidiaChat(
    [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify({ request, plan, memory: context }) },
    ],
    { temperature: 0.1, maxTokens: 7000 },
  );

  const output = parseFiles(result.content);
  if (projectId) {
    await remember({
      projectId,
      agentType: "coder",
      role: "assistant",
      content: JSON.stringify({ request, files: output.map(f => f.path) }),
      metadata: { kind: "code_generation" },
    });
  }

  return output;
}
