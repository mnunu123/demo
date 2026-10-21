// Reddit 수집. REDDIT_CLIENT_ID/SECRET이 있으면 OAuth(앱 전용 토큰)로, 없으면 공개 .json 주소로 시도한다.
// 공개 .json은 클라우드 서버 IP에서 자주 막히므로, 실서비스는 OAuth 앱 승인을 받아야 한다 (docs/PLAN.md 참고).

import type { CollectResult, CommunityRef, CommunityRule, Post } from "../types";

const UA = process.env.REDDIT_USER_AGENT || "web:lurk-community-demo:0.1 (by /u/lurk-demo)";

let cachedToken: { token: string; expires: number } | null = null;

async function getToken(): Promise<string | null> {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.token;
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": UA,
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`reddit token ${res.status}`);
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("reddit token missing");
  cachedToken = { token: data.access_token, expires: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cachedToken.token;
}

export function redditMode(): "oauth" | "public" {
  return process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET ? "oauth" : "public";
}

async function redditGet<T>(path: string, query: Record<string, string> = {}): Promise<T> {
  const token = await getToken();
  const qs = new URLSearchParams({ raw_json: "1", ...query }).toString();
  const url = token ? `https://oauth.reddit.com${path}?${qs}` : `https://www.reddit.com${path}.json?${qs}`;
  const res = await fetch(url, {
    headers: { "user-agent": UA, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    signal: AbortSignal.timeout(7000),
  });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.includes("json")) throw new Error(`reddit ${res.status} ${type.split(";")[0]}`);
  return (await res.json()) as T;
}

interface RedditListing {
  data: { children: { kind: string; data: RedditPostData }[] };
}
interface RedditPostData {
  id: string;
  title: string;
  selftext?: string;
  score: number;
  num_comments: number;
  created_utc: number;
  permalink: string;
  url?: string;
  is_self?: boolean;
  is_video?: boolean;
  post_hint?: string;
  link_flair_text?: string | null;
  stickied?: boolean;
  over_18?: boolean;
  removed_by_category?: string | null;
}

export function mapRedditPost(d: RedditPostData, sub: string): Post {
  const media: Post["media"] = d.is_video || d.post_hint === "hosted:video" ? "video" : d.post_hint === "image" ? "image" : d.is_self ? "text" : "link";
  return {
    id: `t3_${d.id}`,
    platform: "reddit",
    community: sub,
    title: d.title ?? "",
    body: d.selftext ?? "",
    permalink: `https://www.reddit.com${d.permalink}`,
    externalUrl: d.is_self ? undefined : d.url,
    score: d.score ?? 0,
    comments: d.num_comments ?? 0,
    createdAt: new Date((d.created_utc ?? 0) * 1000).toISOString(),
    flair: d.link_flair_text ?? undefined,
    media,
  };
}

export async function collectReddit(ref: CommunityRef): Promise<CollectResult> {
  const sub = ref.id.replace(/^r\//i, "");
  const [top, fresh, rules, about] = await Promise.all([
    redditGet<RedditListing>(`/r/${sub}/top`, { t: "week", limit: "50" }),
    redditGet<RedditListing>(`/r/${sub}/new`, { limit: "40" }),
    redditGet<{ rules?: { short_name: string; description?: string }[] }>(`/r/${sub}/about/rules`).catch(() => ({ rules: [] })),
    redditGet<{ data?: { title?: string; public_description?: string; subscribers?: number; over18?: boolean } }>(`/r/${sub}/about`).catch(
      () => ({ data: undefined }),
    ),
  ]);
  if (about.data?.over18) throw new Error("nsfw community");

  const seen = new Set<string>();
  const posts: Post[] = [];
  for (const child of [...top.data.children, ...fresh.data.children]) {
    const d = child.data;
    if (child.kind !== "t3" || d.stickied || d.over_18 || d.removed_by_category) continue;
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    posts.push(mapRedditPost(d, sub));
  }
  const mappedRules: CommunityRule[] = (rules.rules ?? []).map((r) => ({ title: r.short_name, description: r.description ?? "" }));
  return {
    community: ref,
    about: {
      title: about.data?.title,
      description: about.data?.public_description,
      members: about.data?.subscribers,
    },
    posts,
    rules: mappedRules,
    source: "live",
    fetchedAt: new Date().toISOString(),
  };
}

/** 키워드로 서브레딧 찾기 (OAuth가 있을 때만 쓴다) */
export async function searchSubreddits(q: string): Promise<{ name: string; members: number; description: string }[]> {
  if (redditMode() !== "oauth") return [];
  const res = await redditGet<{ data: { children: { data: { display_name: string; subscribers: number; public_description: string; over18: boolean } }[] } }>(
    "/subreddits/search",
    { q, limit: "10" },
  );
  return res.data.children
    .map((c) => c.data)
    .filter((d) => !d.over18)
    .map((d) => ({ name: d.display_name, members: d.subscribers, description: d.public_description }));
}
