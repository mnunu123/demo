// X(트위터) 수집: v2 최근 검색 API. X_BEARER_TOKEN이 있어야 하고, 호출마다 비용이 든다.
// 키가 없으면 수집하지 않고 샘플 데이터로 넘어간다.

import type { CollectResult, CommunityRef, CommunityRule, Post } from "../types";

interface Tweet {
  id: string;
  text: string;
  created_at?: string;
  lang?: string;
  public_metrics?: { like_count?: number; reply_count?: number; retweet_count?: number; quote_count?: number };
  attachments?: { media_keys?: string[] };
}

export const X_RULES: CommunityRule[] = [
  {
    title: "Don't repeat the same post",
    description: "Posting the same text or link over and over can be treated as spam under X's platform manipulation rules.",
  },
  { title: "No automated replies", description: "Bulk or automated replies and mentions to people you don't know are treated as spam." },
  { title: "Keep hashtags few", description: "One or two relevant hashtags are normal. A wall of hashtags reads as spam." },
];

export function xConfigured(): boolean {
  return Boolean(process.env.X_BEARER_TOKEN);
}

export function mapTweet(t: Tweet, community: string): Post {
  const m = t.public_metrics ?? {};
  return {
    id: `x_${t.id}`,
    platform: "x",
    community,
    title: t.text.split("\n")[0].slice(0, 200),
    body: t.text,
    permalink: `https://x.com/i/web/status/${t.id}`,
    score: m.like_count ?? 0,
    comments: m.reply_count ?? 0,
    shares: (m.retweet_count ?? 0) + (m.quote_count ?? 0),
    createdAt: t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString(),
    media: t.attachments?.media_keys?.length ? "image" : "text",
  };
}

export async function collectX(ref: CommunityRef): Promise<CollectResult> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) throw new Error("x not configured");
  const query = `${ref.query || `#${ref.id}`} -is:retweet -is:reply lang:en`;
  const params = new URLSearchParams({
    query,
    max_results: process.env.X_MAX_RESULTS || "50",
    sort_order: "relevancy",
    "tweet.fields": "created_at,public_metrics,lang,attachments",
  });
  const res = await fetch(`https://api.x.com/2/tweets/search/recent?${params}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`x ${res.status}`);
  const data = (await res.json()) as { data?: Tweet[] };
  const posts = (data.data ?? []).map((t) => mapTweet(t, ref.id));
  return {
    community: ref,
    about: { title: ref.label, description: `Recent posts matching ${ref.query ?? ref.id}` },
    posts,
    rules: X_RULES,
    source: "live",
    fetchedAt: new Date().toISOString(),
  };
}
