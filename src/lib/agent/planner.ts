import { nvidiaChat } from "../ai/nvidia";
import type { BuildPlan } from "./types";

const fallbackPlan = (request: string): BuildPlan => ({ summary: `Plan for: ${request}`, requirements: [request], pages: ["Home"], stack: ["Next.js", "TypeScript"], database: ["PostgreSQL"], apis: [], tasks: [
 { type: "WEB_APP", title: "Build UI", description: "Create the application interface." },
 { type: "BACKEND", title: "Build backend", description: "Create server-side logic." },
 { type: "DATABASE", title: "Design database", description: "Create the required data model." },
 { type: "TEST", title: "Test application", description: "Run validation and tests." }
] });

function extractJson(text: string) { const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i); if (m) return m[1].trim(); const a=text.indexOf("{"); const b=text.lastIndexOf("}"); return a>=0&&b>a?text.slice(a,b+1):text.trim(); }

export async function createBuildPlan(request: string): Promise<BuildPlan> {
 const system = `You are Lumia AI's software architecture planner. Return ONLY valid JSON with summary, requirements[], pages[], stack[], database[], apis[], and tasks[] where each task has type WEB_APP|BACKEND|DATABASE|PROMPT|CODE|TEST|DEBUG, title and description. Do not claim code was built or tested.`;
 try { const result=await nvidiaChat([{role:"system",content:system},{role:"user",content:request}],{temperature:.15,maxTokens:2500}); const parsed=JSON.parse(extractJson(result.content)) as BuildPlan; if(typeof parsed.summary!=="string"||!Array.isArray(parsed.tasks)) throw new Error("Invalid plan"); return parsed; }
 catch(error){ console.error("Planner error:",error); return fallbackPlan(request); }
}
