import { aiChat } from "../ai/provider";
import { memoryContext, recall, remember } from "./memory";
import type { GeneratedFile } from "./codegen";

function extractJson(text: string) {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (m) return m[1].trim();
  const a = text.indexOf("[");
  const b = text.lastIndexOf("]");
  return a >= 0 && b > a ? text.slice(a, b + 1) : text.trim();
}

function cleanJson(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/,\s*([}\]])/g, "$1");
}

export async function debugFiles(
  files: GeneratedFile[],
  stderr: string,
  stdout: string,
  projectId?: string,
): Promise<GeneratedFile[]> {
  const memories = projectId ? await recall(projectId, 8) : [];
  const system = `You are Lumia AI's Debug Agent. Return ONLY valid JSON, an array of complete replacement file objects {path,language,content}. Fix the smallest necessary set using build logs and project memory. No absolute paths, .., backslashes, secrets, malware, spyware, destructive commands. If no safe fix is identifiable return [].`;
  const result = await aiChat(
    [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify({ files, stdout: stdout.slice(-12000), stderr: stderr.slice(-12000), memory: memoryContext(memories) }) },
    ],
    { temperature: 0.05, maxTokens: 7000 },
  );
  const parsed = JSON.parse(cleanJson(extractJson(result.content))) as GeneratedFile[];
  if (!Array.isArray(parsed)) throw new Error("Invalid debug response");
  const replacements = parsed
    .filter(f => f && typeof f.path === "string" && typeof f.content === "string" && !f.path.startsWith("/") && !f.path.includes("..") && !f.path.includes("\\"))
    .slice(0, 12);
  if (projectId) await remember({ projectId, agentType: "debugger", role: "assistant", content: JSON.stringify({ stderr: stderr.slice(-3000), changedFiles: replacements.map(f => f.path) }), metadata: { kind: "debug_result" } });
  return replacements;
}
