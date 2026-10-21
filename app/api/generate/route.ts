import { z } from "zod";
import { writeDrafts } from "@/lib/pipeline";
import { AnalysisZ, ProfileZ } from "@/lib/server/schemas";
import { canUseLLM, errorKo, json, readJson } from "@/lib/server/guard";
import type { CommunityAnalysis, ProductProfile } from "@/lib/types";

export const maxDuration = 60;

const Body = z.object({
  profile: ProfileZ,
  analysis: AnalysisZ,
  tone: z.enum(["more casual", "more technical", "plainer"]).optional(),
  length: z.enum(["shorter", "longer"]).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return errorKo("요청 형식이 올바르지 않아요.");
  const gate = canUseLLM(req);
  const result = await writeDrafts({
    profile: parsed.data.profile as unknown as ProductProfile,
    analysis: parsed.data.analysis as unknown as CommunityAnalysis,
    useLLM: gate.ok,
    tone: parsed.data.tone,
    length: parsed.data.length,
  });
  return json({ ...result, noticeKo: result.noticeKo ?? (gate.ok ? undefined : gate.reasonKo) });
}
