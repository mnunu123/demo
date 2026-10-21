import { z } from "zod";
import { CollectError, collect } from "@/lib/collect";
import { collectPasted } from "@/lib/sources/paste";
import { CommunityRefZ } from "@/lib/server/schemas";
import { errorKo, json, readJson } from "@/lib/server/guard";

export const maxDuration = 30;

const Body = z.object({
  community: CommunityRefZ,
  preferSample: z.boolean().optional(),
  pasted: z.object({ posts: z.string().min(1).max(200_000), rules: z.string().max(20_000).optional() }).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return errorKo("요청 형식이 올바르지 않아요.");
  const { community, preferSample, pasted } = parsed.data;
  if (pasted) {
    const result = collectPasted(community, pasted.posts, pasted.rules);
    if (result.posts.length < 3) return errorKo("붙여 넣은 글이 3개보다 적어요. 글마다 --- 줄로 구분해 주세요.");
    return json(result);
  }
  try {
    return json(await collect(community, { preferSample }));
  } catch (e) {
    if (e instanceof CollectError) return json({ error: e.messageKo }, { status: 422 });
    return errorKo("글을 모으다가 문제가 생겼어요.", 500);
  }
}
