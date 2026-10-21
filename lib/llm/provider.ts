// LLM 호출. ANTHROPIC_API_KEY가 있으면 Claude, 없고 OPENAI_API_KEY+OPENAI_MODEL이 있으면 OpenAI 호환 API.
// 둘 다 없으면 호출하지 않고 템플릿 엔진만 쓴다.
// 구조화된 결과를 받기 위해 Claude는 "도구 하나를 반드시 쓰게" 해서 JSON을 받고, OpenAI 호환은 JSON 모드를 쓴다.

import { z } from "zod";

export type LLMProvider = "anthropic" | "openai" | "none";

export function llmConfig(): { provider: LLMProvider; model?: string } {
  if (process.env.ANTHROPIC_API_KEY) return { provider: "anthropic", model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5" };
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL) return { provider: "openai", model: process.env.OPENAI_MODEL };
  return { provider: "none" };
}

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly messageKo: string,
  ) {
    super(message);
  }
}

function toToolSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

interface CallOptions<T> {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  name: string;
  description: string;
  maxTokens?: number;
  timeoutMs?: number;
}

async function callAnthropic<T>(o: CallOptions<T>, model: string): Promise<unknown> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: o.maxTokens ?? 4000,
      system: o.system,
      messages: [{ role: "user", content: o.prompt }],
      tools: [{ name: o.name, description: o.description, input_schema: toToolSchema(o.schema) }],
      tool_choice: { type: "tool", name: o.name },
    }),
    signal: AbortSignal.timeout(o.timeoutMs ?? 55_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new LLMError(`anthropic ${res.status}: ${text.slice(0, 300)}`, `Claude API 오류(${res.status})`);
  }
  const data = (await res.json()) as { content?: { type: string; name?: string; input?: unknown }[]; stop_reason?: string };
  if (data.stop_reason === "max_tokens") throw new LLMError("max_tokens", "응답이 너무 길어 중간에 끊겼어요");
  const block = data.content?.find((b) => b.type === "tool_use" && b.name === o.name);
  if (!block) throw new LLMError("no tool_use block", "Claude가 형식에 맞는 결과를 주지 않았어요");
  return block.input;
}

async function callOpenAI<T>(o: CallOptions<T>, model: string): Promise<unknown> {
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${o.system}\n\nReturn only one JSON object that matches this JSON Schema (${o.description}):\n${JSON.stringify(toToolSchema(o.schema))}`,
        },
        { role: "user", content: o.prompt },
      ],
    }),
    signal: AbortSignal.timeout(o.timeoutMs ?? 55_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new LLMError(`openai ${res.status}: ${text.slice(0, 300)}`, `OpenAI 호환 API 오류(${res.status})`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(content);
  } catch {
    throw new LLMError("bad json", "모델이 JSON이 아닌 답을 줬어요");
  }
}

export async function generateJSON<T>(o: CallOptions<T>): Promise<T> {
  const cfg = llmConfig();
  if (cfg.provider === "none" || !cfg.model) throw new LLMError("no provider", "LLM API 키가 없어요");
  const raw = cfg.provider === "anthropic" ? await callAnthropic(o, cfg.model) : await callOpenAI(o, cfg.model);
  const parsed = o.schema.safeParse(raw);
  if (!parsed.success) {
    throw new LLMError(`schema: ${parsed.error.message.slice(0, 300)}`, "모델 결과가 약속한 형식과 달라요");
  }
  return parsed.data;
}
