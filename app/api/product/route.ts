import { z } from "zod";
import { buildProfile } from "@/lib/pipeline";
import { FetchError } from "@/lib/sources/product";
import { canUseLLM, errorKo, json, readJson } from "@/lib/server/guard";

export const maxDuration = 60;

const Body = z.object({
  url: z.string().max(500).optional(),
  manual: z.object({ name: z.string().min(1).max(120), description: z.string().min(10).max(8000) }).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success || (!parsed.data.url && !parsed.data.manual)) return errorKo("제품 URL이나 설명을 넣어 주세요.");
  const gate = canUseLLM(req);
  try {
    const out = await buildProfile({ ...parsed.data, useLLM: gate.ok });
    return json({ ...out, noticeKo: out.noticeKo ?? (gate.ok ? undefined : gate.reasonKo) });
  } catch (e) {
    if (e instanceof FetchError) return json({ error: e.messageKo, needManual: true }, { status: 422 });
    return errorKo("제품 페이지를 읽다가 문제가 생겼어요. 설명을 직접 입력해 주세요.", 500);
  }
}
