type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string; code?: string | number };
};

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "openrouter/free";

function getConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured on the server.");

  const baseUrl = (process.env.OPENROUTER_BASE_URL || DEFAULT_BASE_URL)
    .trim()
    .replace(/\/$/, "");
  const model = (process.env.OPENROUTER_MODEL || DEFAULT_MODEL).trim();

  return { apiKey, baseUrl, model };
}

function friendlyOpenRouterError(status: number, data: OpenRouterResponse) {
  const message = data?.error?.message?.trim();
  const code = data?.error?.code ? ` (${data.error.code})` : "";

  if (status === 401 || status === 403) {
    return `OpenRouter authentication failed${code}. Check OPENROUTER_API_KEY in Vercel.`;
  }

  if (status === 404) {
    return `OpenRouter model or endpoint was not found${code}. Check OPENROUTER_BASE_URL and OPENROUTER_MODEL.`;
  }

  if (status === 429) {
    return `OpenRouter rate limit or free-model quota reached${code}.${message ? ` ${message}` : " Try again shortly or choose another available model."}`;
  }

  if (status === 502 || status === 503 || status === 504) {
    return `OpenRouter upstream model is temporarily unavailable${code}.${message ? ` ${message}` : " Try again shortly."}`;
  }

  return message
    ? `OpenRouter API request failed with HTTP ${status}${code}: ${message}`
    : `OpenRouter API request failed with HTTP ${status}${code}.`;
}

export async function nvidiaChat(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
) {
  const { apiKey, baseUrl, model } = getConfig();

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
      temperature: options?.temperature ?? 0.2,
      top_p: 0.7,
      max_tokens: Math.min(options?.maxTokens ?? 2500, 8000),
      stream: false,
    }),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as OpenRouterResponse;

  if (!response.ok) {
    throw new Error(friendlyOpenRouterError(response.status, data));
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter API returned no assistant content.");

  return { content, model };
}

export function nvidiaConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}
