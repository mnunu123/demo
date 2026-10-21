import { z } from "zod";
import { defaultSelection, suggestCommunities } from "@/lib/directory";
import { isSampleUrl } from "@/lib/fixtures/sample-product";
import { PlatformZ, ProfileZ } from "@/lib/server/schemas";
import { errorKo, json, readJson } from "@/lib/server/guard";
import type { ProductProfile } from "@/lib/types";

const Body = z.object({ profile: ProfileZ, platforms: z.array(PlatformZ).min(1).max(3) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return errorKo("요청 형식이 올바르지 않아요.");
  const profile = parsed.data.profile as unknown as ProductProfile;
  const sample = isSampleUrl(profile.url);
  const suggestions = suggestCommunities(profile, parsed.data.platforms, { preferSample: sample });
  const selected = defaultSelection(suggestions, { onlySample: sample });
  return json({ suggestions, selected: selected.map((s) => `${s.platform}:${s.id}`) });
}
