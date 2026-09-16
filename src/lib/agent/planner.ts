import { aiChat } from "../ai/provider";
import type { BuildPlan } from "./types";

const fallbackPlan = (request: string): BuildPlan => ({
  summary: `Plan for: ${request}`,
  requirements: [request],
  pages: ["Home"],
  stack: ["Next.js", "TypeScript"],
  database: ["PostgreSQL"],
  apis: [],
  tasks: [
    { type: "WEB_APP", title: "Build UI", description: "Create the application interface." },
    { type: "BACKEND", title: "Build backend", description: "Create server-side logic." },
    { type: "DATABASE", title: "Design database", description: "Create the required data model." },
    { type: "TEST", title: "Test application", description: "Run validation and tests." },
  ],
});

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  return first >= 0 && last > first ? text.slice(first, last + 1) : text.trim();
}

function cleanJson(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/,\s*([}\]])/g, "$1");
}

function parsePlan(text: string): BuildPlan {
  const parsed = JSON.parse(cleanJson(extractJson(text))) as Partial<BuildPlan>;
  if (
    typeof parsed.summary !== "string" ||
    !Array.isArray(parsed.requirements) ||
    !Array.isArray(parsed.pages) ||
    !Array.isArray(parsed.stack) ||
    !Array.isArray(parsed.database) ||
    !Array.isArray(parsed.apis) ||
    !Array.isArray(parsed.tasks)
  ) throw new Error("Invalid build plan returned by AI.");
  return parsed as BuildPlan;
}

export async function createBuildPlan(request: string): Promise<BuildPlan> {
  const system = `You are Lumia AI's software architecture planner. Return ONLY one valid JSON object, with no markdown and no commentary. Required keys: summary:string, requirements:string[], pages:string[], stack:string[], database:string[], apis:string[], tasks:array. Each task must contain type, title, description. Allowed task type values: WEB_APP, BACKEND, DATABASE, PROMPT, CODE, TEST, DEBUG. Use double quotes everywhere, no trailing commas, and ensure the JSON is syntactically valid. Do not claim code was built or tested.`;
  try {
    const result = await aiChat(
      [{ role: "system", content: system }, { role: "user", content: request }],
      { temperature: 0.1, maxTokens: 2400 },
    );
    return parsePlan(result.content);
  } catch (error) {
    console.error("Planner error:", error);
    return fallbackPlan(request);
  }
}
