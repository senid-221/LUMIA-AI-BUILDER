import { aionLabsChat } from "./aionlabs";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
type ProviderResponse = { content: string; model: string };

const AION_BASE_URL = "https://api.aionlabs.ai/v1";
const KILO_BASE_URL = "https://api.kilo.ai/api/gateway";

function enabled(name: string) { return Boolean(process.env[name]?.trim()); }

function providerOrder() {
  const preferred = (process.env.LUMIA_AI_PROVIDER || "aion").trim().toLowerCase();
  if (preferred === "kilo") return ["kilo", "aion", "openrouter"];
  if (preferred === "openrouter") return ["openrouter", "aion", "kilo"];
  return ["aion", "kilo", "openrouter"];
}

function timeoutMs() { return Number(process.env.LUMIA_AI_TIMEOUT_MS || 45000); }

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms.`)), ms); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

async function openRouterChat(messages: ChatMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<ProviderResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OpenRouter is not configured.");
  const baseUrl = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").trim().replace(/\/$/, "");
  const model = (process.env.OPENROUTER_MODEL || "openrouter/free").trim();
  const response = await withTimeout(fetch(`${baseUrl}/chat/completions`, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${apiKey}`, "HTTP-Referer": process.env.NEXT_PUBLIC_PRODUCTION_URL || "https://lumia-ai-builder.vercel.app", "X-Title": "Lumia AI Builder" },
    body: JSON.stringify({ model, messages, temperature: options?.temperature ?? 0.15, max_tokens: Math.min(options?.maxTokens ?? 3000, 8000), stream: false }), cache: "no-store",
  }), timeoutMs(), "OpenRouter request");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`OpenRouter HTTP ${response.status}${data?.error?.message ? `: ${data.error.message}` : ""}`);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned no assistant content.");
  return { content, model };
}

async function kiloChat(messages: ChatMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<ProviderResponse> {
  const apiKey = process.env.KILO_API_KEY?.trim();
  if (!apiKey) throw new Error("Kilo Code is not configured.");
  const baseUrl = (process.env.KILO_BASE_URL || KILO_BASE_URL).trim().replace(/\/$/, "");
  const model = (process.env.KILO_MODEL || "deepseek/deepseek-v3.2").trim();
  const response = await withTimeout(fetch(`${baseUrl}/chat/completions`, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature: options?.temperature ?? 0.15, max_tokens: Math.min(options?.maxTokens ?? 3000, 8000), stream: false }), cache: "no-store",
  }), timeoutMs(), "Kilo request");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Kilo HTTP ${response.status}${data?.error?.message ? `: ${data.error.message}` : ""}`);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Kilo returned no assistant content.");
  return { content, model };
}

export async function aiChat(messages: ChatMessage[], options?: { temperature?: number; maxTokens?: number }) {
  const errors: string[] = [];
  for (const provider of providerOrder()) {
    try {
      if (provider === "aion" && enabled("AION_LABS_API_KEY")) return await aionLabsChat(messages, options);
      if (provider === "kilo" && enabled("KILO_API_KEY")) return await kiloChat(messages, options);
      if (provider === "openrouter" && enabled("OPENROUTER_API_KEY")) return await openRouterChat(messages, options);
    } catch (error) {
      errors.push(`${provider}: ${error instanceof Error ? error.message : "request failed"}`);
    }
  }
  if (!enabled("AION_LABS_API_KEY") && !enabled("KILO_API_KEY") && !enabled("OPENROUTER_API_KEY")) throw new Error("No AI provider configured. Set AION_LABS_API_KEY, KILO_API_KEY, or OPENROUTER_API_KEY in Vercel.");
  throw new Error(`All configured AI providers failed. ${errors.join(" | ")}`);
}

export function aiProviderStatus() {
  const order = providerOrder();
  return { primary: order[0], order, aionConfigured: enabled("AION_LABS_API_KEY"), aionBaseUrl: AION_BASE_URL, kiloConfigured: enabled("KILO_API_KEY"), kiloBaseUrl: KILO_BASE_URL, openRouterConfigured: enabled("OPENROUTER_API_KEY") };
}
