type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type AionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string; type?: string };
};

const DEFAULT_BASE_URL = "https://api.aionlabs.ai/v1";
const DEFAULT_MODEL = "aion-labs/aion-3.0";

function getConfig() {
  const apiKey = process.env.AION_LABS_API_KEY?.trim();
  if (!apiKey) throw new Error("AION_LABS_API_KEY is not configured on the server.");

  const baseUrl = (process.env.AION_LABS_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/$/, "");
  const model = (process.env.AION_LABS_MODEL || DEFAULT_MODEL).trim();
  return { apiKey, baseUrl, model };
}

function friendlyAionError(status: number, data: AionResponse) {
  const message = data?.error?.message?.trim();
  if (status === 401 || status === 403) {
    return `Aion Labs authentication failed. Check AION_LABS_API_KEY in Vercel.`;
  }
  if (status === 429) {
    return `Aion Labs rate limit or usage limit reached.${message ? ` ${message}` : " Try again shortly or use another configured model."}`;
  }
  if (status === 502 || status === 503) {
    return `Aion Labs is temporarily unavailable.${message ? ` ${message}` : " Try again shortly."}`;
  }
  return message
    ? `Aion Labs API request failed with HTTP ${status}: ${message}`
    : `Aion Labs API request failed with HTTP ${status}.`;
}

export async function aionLabsChat(
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

  const data = (await response.json().catch(() => ({}))) as AionResponse;
  if (!response.ok) throw new Error(friendlyAionError(response.status, data));

  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Aion Labs API returned no assistant content.");
  return { content, model };
}

export function aionLabsConfigured() {
  return Boolean(process.env.AION_LABS_API_KEY?.trim());
}
