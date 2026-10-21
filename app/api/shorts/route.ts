import { z } from "zod";
import { writeShorts } from "@/lib/pipeline";
import { AnalysisZ, ProfileZ } from "@/lib/server/schemas";
import { canUseLLM, errorKo, json, readJson } from "@/lib/server/guard";
import type { CommunityAnalysis, ProductProfile } from "@/lib/types";

export const maxDuration = 60;

const Body = z.object({
  profile: ProfileZ,
  analyses: z.array(AnalysisZ).max(8),
  format: z.enum(["shorts", "reels", "tiktok"]).optional(),
  seconds: z.union([z.literal(30), z.literal(45), z.literal(60)]).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await readJson(req, 4_000_000));
  if (!parsed.success) return errorKo("요청 형식이 올바르지 않아요.");
  const gate = canUseLLM(req);
  const out = await writeShorts({
    profile: parsed.data.profile as unknown as ProductProfile,
    analyses: parsed.data.analyses as unknown as CommunityAnalysis[],
    format: parsed.data.format,
    seconds: parsed.data.seconds,
    useLLM: gate.ok,
  });
  return json({ ...out, noticeKo: out.noticeKo ?? (gate.ok ? undefined : gate.reasonKo) });
}
