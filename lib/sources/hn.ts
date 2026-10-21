// Hacker News 수집: Algolia HN Search API (키 없이 쓸 수 있음)
// 최근 30일 Show HN 중 반응 좋은 글 + 최근 글을 함께 가져와 상위·하위를 비교한다.

import type { CollectResult, CommunityRef, CommunityRule, Post } from "../types";

interface HnHit {
  objectID: string;
  title?: string;
  url?: string | null;
  story_text?: string | null;
  points?: number | null;
  num_comments?: number | null;
  created_at: string;
  created_at_i?: number;
}

export function decodeHnHtml(html: string): string {
  return html
    .replace(/<p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>.*?<\/a>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

export function mapHnHit(h: HnHit): Post {
  return {
    id: `hn_${h.objectID}`,
    platform: "hn",
    community: "show_hn",
    title: h.title ?? "",
    body: h.story_text ? decodeHnHtml(h.story_text) : "",
    permalink: `https://news.ycombinator.com/item?id=${h.objectID}`,
    externalUrl: h.url ?? undefined,
    score: h.points ?? 0,
    comments: h.num_comments ?? 0,
    createdAt: new Date(h.created_at).toISOString(),
    media: h.story_text ? "text" : "link",
  };
}

// Show HN 가이드라인을 짧게 옮긴 것 (원문: https://news.ycombinator.com/showhn.html)
export const SHOW_HN_RULES: CommunityRule[] = [
  {
    title: "Show HN is for things people can try",
    description:
      "It has to be something you made that people can run or hold now. Blog posts, sign-up pages, newsletters, lists, landing pages and fundraisers don't count.",
  },
  { title: "Make it easy to try", description: "Ideally no sign-ups or email gates. You need to be around to discuss it in the thread." },
  { title: "Non-trivial work", description: "Quickly generated one-offs don't qualify. Explain how and why you built it." },
  { title: "Plain titles", description: "Don't use uppercase, exclamation points or hype to make titles stand out. Say plainly what it is." },
  { title: "Not primarily for promotion", description: "Posting your own work some of the time is fine, but the site is mainly for curiosity, not marketing." },
  {
    title: "No generated text",
    description: "HN guidelines ask people not to put generated text in posts, and not to post generated or AI-edited text in comments.",
  },
  { title: "No upvote requests", description: "Don't ask friends to upvote or comment on your Show HN." },
];

async function algolia(path: string, params: Record<string, string>): Promise<HnHit[]> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`https://hn.algolia.com/api/v1/${path}?${qs}`, { signal: AbortSignal.timeout(7000) });
  if (!res.ok) throw new Error(`hn ${res.status}`);
  const data = (await res.json()) as { hits?: HnHit[] };
  return data.hits ?? [];
}

export async function collectHN(ref: CommunityRef): Promise<CollectResult> {
  const since = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;
  const base = { tags: "show_hn", ...(ref.query ? { query: ref.query } : {}) };
  const [popular, recent] = await Promise.all([
    algolia("search", { ...base, numericFilters: `created_at_i>${since},points>5`, hitsPerPage: "40" }),
    algolia("search_by_date", { ...base, hitsPerPage: "30" }),
  ]);
  const seen = new Set<string>();
  const posts: Post[] = [];
  for (const h of [...popular, ...recent]) {
    if (seen.has(h.objectID) || !h.title) continue;
    seen.add(h.objectID);
    posts.push(mapHnHit(h));
  }
  return {
    community: ref,
    about: { title: "Show HN", description: "Hacker News section for sharing something you've made." },
    posts,
    rules: SHOW_HN_RULES,
    source: "live",
    fetchedAt: new Date().toISOString(),
  };
}
