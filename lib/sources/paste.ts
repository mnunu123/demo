// 붙여넣기 수집: API로 가져올 수 없는 커뮤니티(Reddit 공개 API 종료 이후, 디스코드, 국내 커뮤니티 등)를
// 사용자가 직접 본 글을 붙여 넣어 분석한다. 형식: 글마다 --- 줄로 구분, 첫 줄은 제목, 나머지는 본문.
// 점수를 알면 첫 줄을 "120 | 제목"처럼 쓴다.

import type { CollectResult, CommunityRef, CommunityRule, Post } from "../types";

function parseScore(raw: string): number {
  const m = raw.trim().toLowerCase().match(/^(\d+(?:[.,]\d+)?)(k)?$/);
  if (!m) return 0;
  const n = Number(m[1].replace(",", "."));
  return Math.round(m[2] ? n * 1000 : n);
}

export function parsePasted(text: string, ref: CommunityRef): Post[] {
  const now = new Date().toISOString();
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const blocks = /^\s*-{3,}\s*$/m.test(normalized)
    ? normalized.split(/^\s*-{3,}\s*$/m)
    : normalized.split(/\n/).filter((l) => l.trim().length > 0); // 구분선이 없으면 줄마다 제목 하나
  return blocks
    .map((block, i) => {
      const lines = block.split("\n").map((l) => l.trimEnd());
      const firstIdx = lines.findIndex((l) => l.trim().length > 0);
      if (firstIdx < 0) return null;
      let title = lines[firstIdx].trim();
      let score = 0;
      const m = title.match(/^(\d+(?:[.,]\d+)?k?)\s*[|:]\s*(.+)$/i);
      if (m) {
        score = parseScore(m[1]);
        title = m[2].trim();
      }
      const body = lines.slice(firstIdx + 1).join("\n").trim();
      const post: Post = {
        id: `pasted-${ref.id}-${i + 1}`,
        platform: ref.platform,
        community: ref.id,
        title: ref.platform === "x" ? title.slice(0, 200) : title,
        body: ref.platform === "x" ? [title, body].filter(Boolean).join("\n") : body,
        score,
        comments: 0,
        createdAt: now,
        media: "text",
      };
      return post;
    })
    .filter((p): p is Post => p !== null)
    .slice(0, 200);
}

export function parseRules(text: string): CommunityRule[] {
  return text
    .split(/\n/)
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((l) => {
      const [title, ...rest] = l.split(/\s*[:–—-]\s+/);
      return { title: title.slice(0, 120), description: rest.join(" - ") };
    });
}

export function collectPasted(ref: CommunityRef, postsText: string, rulesText = ""): CollectResult {
  const posts = parsePasted(postsText, ref);
  return {
    community: ref,
    about: { title: ref.label, description: "" },
    posts,
    rules: parseRules(rulesText),
    source: "pasted",
    fetchedAt: new Date().toISOString(),
    noticeKo: posts.every((p) => p.score === 0)
      ? "붙여 넣은 글이에요. 점수 정보가 없어서 상위글과 나머지 비교,  시간 분석은 건너뛰어요."
      : "붙여 넣은 글이에요. 시간 정보가 없어서 시간 분석은 건너뛰어요.",
  };
}
