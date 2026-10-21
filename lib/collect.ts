// 플랫폼별 수집을 한곳에서. 실시간 수집이 실패하면 샘플 데이터로 넘어가고, 이유를 함께 돌려준다.

import type { CollectResult, CommunityRef } from "./types";
import { getSample } from "./fixtures/communities";
import { collectHN } from "./sources/hn";
import { collectReddit, redditMode } from "./sources/reddit";
import { collectX, xConfigured } from "./sources/x";

export class CollectError extends Error {
  constructor(
    message: string,
    public readonly messageKo: string,
  ) {
    super(message);
  }
}

const MIN_POSTS = 8;

function reasonKo(ref: CommunityRef, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (ref.platform === "x" && !xConfigured()) return "X API 키(X_BEARER_TOKEN)가 없어서 샘플 데이터를 보여 줘요";
  if (ref.platform === "reddit" && redditMode() === "public")
    return `Reddit 공개 주소로 수집하지 못했어요(${msg}). 서버 IP가 막혔을 수 있어요. REDDIT_CLIENT_ID를 설정하면 실제 데이터를 가져와요`;
  if (msg === "too few posts") return "실제 게시물이 너무 적어서 샘플 데이터를 보여 줘요";
  return `실시간 수집에 실패했어요(${msg})`;
}

export async function collect(ref: CommunityRef, options: { preferSample?: boolean } = {}): Promise<CollectResult> {
  if (!options.preferSample) {
    try {
      const live =
        ref.platform === "reddit" ? await collectReddit(ref) : ref.platform === "hn" ? await collectHN(ref) : await collectX(ref);
      if (live.posts.length < MIN_POSTS) throw new Error("too few posts");
      return live;
    } catch (err) {
      const sample = getSample(ref);
      if (sample) return { ...sample, community: { ...sample.community, ...ref }, noticeKo: `${reasonKo(ref, err)}. 지금 보이는 글은 샘플(합성) 데이터예요.` };
      throw new CollectError(String(err), `${ref.label}: ${reasonKo(ref, err)}. 이 커뮤니티는 샘플 데이터가 없어서 건너뛰어요.`);
    }
  }
  const sample = getSample(ref);
  if (sample) return { ...sample, noticeKo: "체험용 샘플(합성) 데이터예요. 실제 게시물이 아니에요." };
  throw new CollectError("no sample", `${ref.label}: 샘플 데이터가 없어요.`);
}
