type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type NvidiaResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string; code?: string | number };
};

const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_MODEL = "qwen/qwen3-next-80b-a3b-instruct";

function getConfig() {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  if (!apiKey) throw new Error("NVIDIA_API_KEY is not configured on the server.");

  const baseUrl = (process.env.NVIDIA_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/$/, "");
  const model = (process.env.NVIDIA_MODEL || DEFAULT_MODEL).trim();

  return { apiKey, baseUrl, model };
}

function friendlyNvidiaError(status: number, data: NvidiaResponse) {
  const message = data?.error?.message?.trim();
  const code = data?.error?.code ? ` (${data.error.code})` : "";

  if (status === 401 || status === 403) {
    return `NVIDIA authentication failed${code}. Check NVIDIA_API_KEY in Vercel Production environment variables.`;
  }

  if (status === 404) {
    return `NVIDIA model or endpoint was not found${code}. Check NVIDIA_BASE_URL and NVIDIA_MODEL.`;
  }

  if (status === 410) {
    return `NVIDIA free endpoint is no longer available for the selected model${code}${message ? `: ${message}` : ". Change NVIDIA_MODEL to a currently available model in Vercel."}`;
  }

  if (status === 422) {
    return `NVIDIA rejected the request${code}${message ? `: ${message}` : ". Check the model and request parameters."}`;
  }

  if (status === 429) {
    return `NVIDIA rate limit or quota reached${code}.${message ? ` ${message}` : " Try again shortly or check your NVIDIA API quota."}`;
  }

  return message
    ? `NVIDIA API request failed with HTTP ${status}${code}: ${message}`
    : `NVIDIA API request failed with HTTP ${status}${code}.`;
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
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.2,
      top_p: 0.7,
      max_tokens: Math.min(options?.maxTokens ?? 2500, 4000),
      stream: false,
    }),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as NvidiaResponse;

  if (!response.ok) {
    throw new Error(friendlyNvidiaError(response.status, data));
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("NVIDIA API returned no assistant content.");

  return { content, model };
}

export function nvidiaConfigured() {
  return Boolean(process.env.NVIDIA_API_KEY?.trim());
}
