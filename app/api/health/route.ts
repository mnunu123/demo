import { connection } from "next/server";
import { llmConfig } from "@/lib/llm/provider";
import { redditMode } from "@/lib/sources/reddit";
import { xConfigured } from "@/lib/sources/x";
import { accessCodeRequired, json } from "@/lib/server/guard";
import type { HealthInfo } from "@/lib/types";

// 어떤 연결이 켜져 있는지 화면에 보여 주기 위한 상태 확인 (키 값은 절대 내보내지 않는다)
export async function GET() {
  await connection();
  const llm = llmConfig();
  const info: HealthInfo = {
    llm: llm.provider,
    model: llm.model,
    reddit: redditMode(),
    x: xConfigured(),
    hn: true,
    accessCodeRequired: accessCodeRequired(),
  };
  return json(info);
}
