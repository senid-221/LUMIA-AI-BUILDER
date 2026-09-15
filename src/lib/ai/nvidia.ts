type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type NvidiaResponse = { choices?: Array<{ message?: { content?: string | null } }>; error?: { message?: string } };
const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_MODEL = "qwen/qwen2.5-coder-32b-instruct";

function getConfig() {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  if (!apiKey) throw new Error("NVIDIA_API_KEY is not configured on the server.");
  return { apiKey, baseUrl: (process.env.NVIDIA_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ""), model: process.env.NVIDIA_MODEL || DEFAULT_MODEL };
}

export async function nvidiaChat(messages: ChatMessage[], options?: { temperature?: number; maxTokens?: number }) {
  const { apiKey, baseUrl, model } = getConfig();
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature: options?.temperature ?? 0.2, top_p: 0.7, max_tokens: options?.maxTokens ?? 2500, stream: false }),
    cache: "no-store"
  });
  const data = (await response.json().catch(() => ({}))) as NvidiaResponse;
  if (!response.ok) throw new Error(data?.error?.message || `NVIDIA API request failed with HTTP ${response.status}`);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("NVIDIA API returned no assistant content.");
  return { content, model };
}

export function nvidiaConfigured() { return Boolean(process.env.NVIDIA_API_KEY?.trim()); }
