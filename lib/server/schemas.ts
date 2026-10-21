// API 요청 검증. 브라우저가 다시 보내는 분석 결과는 핵심 필드만 확인하고 나머지는 그대로 받는다.

import { z } from "zod";

export const PlatformZ = z.enum(["reddit", "x", "hn"]);

export const CommunityRefZ = z.object({
  platform: PlatformZ,
  id: z.string().min(1).max(80).regex(/^[\w.-]+$/),
  label: z.string().min(1).max(80),
  query: z.string().max(300).optional(),
});

export const ProfileZ = z
  .object({
    url: z.string().max(500),
    name: z.string().max(120),
    oneLiner: z.string().max(400),
    category: z.string().max(80),
    audience: z.array(z.string().max(120)).max(6),
    problems: z.array(z.string().max(300)).max(6),
    features: z.array(z.string().max(300)).max(8),
    pricing: z.string().max(200),
    stage: z.enum(["idea", "beta", "launched", "unknown"]),
    keywords: z.array(z.string().max(60)).max(12),
  })
  .passthrough();

export const PostZ = z
  .object({
    id: z.string().max(80),
    platform: PlatformZ,
    title: z.string().max(400),
    body: z.string().max(20000),
    score: z.number(),
    comments: z.number(),
    createdAt: z.string().max(40),
  })
  .passthrough();

export const CollectedZ = z
  .object({
    community: CommunityRefZ,
    posts: z.array(PostZ).max(300),
    rules: z.array(z.object({ title: z.string().max(300), description: z.string().max(3000) })).max(60),
    source: z.enum(["live", "sample", "pasted"]),
    fetchedAt: z.string().max(40),
  })
  .passthrough();

export const AnalysisZ = z
  .object({
    community: CommunityRefZ,
    stats: z.object({ n: z.number() }).passthrough(),
    rules: z.object({ selfPromo: z.object({ policy: z.string() }).passthrough() }).passthrough(),
    rulesRaw: z.array(z.object({ title: z.string(), description: z.string() })).max(60),
  })
  .passthrough();
