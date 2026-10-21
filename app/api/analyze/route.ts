import { z } from "zod";
import { analyze } from "@/lib/pipeline";
import { CollectedZ, ProfileZ } from "@/lib/server/schemas";
import { canUseLLM, errorKo, json, readJson } from "@/lib/server/guard";
import type { CollectResult, ProductProfile } from "@/lib/types";

export const maxDuration = 60;

const Body = z.object({ collected: CollectedZ, profile: ProfileZ });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await readJson(req, 4_000_000));
  if (!parsed.success) return errorKo("요청 형식이 올바르지 않아요.");
  const gate = canUseLLM(req);
  const analysis = await analyze(
    parsed.data.collected as unknown as CollectResult,
    parsed.data.profile as unknown as ProductProfile,
    gate.ok,
  );
  return json(analysis);
}
