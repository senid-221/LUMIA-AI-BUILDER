import { aionLabsChat } from "./aionlabs";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type ProviderResponse = { content: string; model: string };

const AION_BASE_URL = "https://api.aionlabs.ai/v1";

function aionEnabled() {
  return Boolean(process.env.AION_LABS_API_KEY?.trim());
}

function openRouterEnabled() {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

function providerOrder() {
  const preferred = (process.env.LUMIA_AI_PROVIDER || "aion").trim().toLowerCase();
  return preferred === "openrouter" ? ["openrouter", "aion"] : ["aion", "openrouter"];
}

async function openRouterChat(messages: ChatMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<ProviderResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OpenRouter is not configured.");
  const baseUrl = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").trim().replace(/\/$/, "");
  const model = (process.env.OPENROUTER_MODEL || "openrouter/free").trim();
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_PRODUCTION_URL || "https://lumia-ai-builder.vercel.app",
      "X-Title": "Lumia AI Builder",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.15,
      max_tokens: Math.min(options?.maxTokens ?? 3000, 8000),
      stream: false,
    }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`OpenRouter HTTP ${response.status}${data?.error?.message ? `: ${data.error.message}` : ""}`);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned no assistant content.");
  return { content, model };
}

export async function aiChat(messages: ChatMessage[], options?: { temperature?: number; maxTokens?: number }) {
  const errors: string[] = [];
  for (const provider of providerOrder()) {
    try {
      if (provider === "aion" && aionEnabled()) {
        return await aionLabsChat(messages, options);
      }
      if (provider === "openrouter" && openRouterEnabled()) {
        return await openRouterChat(messages, options);
      }
    } catch (error) {
      errors.push(`${provider}: ${error instanceof Error ? error.message : "request failed"}`);
    }
  }

  if (!aionEnabled() && !openRouterEnabled()) {
    throw new Error("No AI provider configured. Set AION_LABS_API_KEY or OPENROUTER_API_KEY in Vercel.");
  }
  throw new Error(`All configured AI providers failed. ${errors.join(" | ")}`);
}

export function aiProviderStatus() {
  return {
    primary: providerOrder()[0],
    aionConfigured: aionEnabled(),
    aionBaseUrl: AION_BASE_URL,
    openRouterConfigured: openRouterEnabled(),
  };
}
