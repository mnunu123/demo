// 서버 쪽 파이프라인: 제품 이해 → 분석 → 초안 → 쇼츠. 단계마다 LLM이 없거나 실패하면 규칙 기반 결과로 대체한다.

import type {
  Angle,
  CollectResult,
  CommunityAnalysis,
  Draft,
  GenerateResult,
  ProductProfile,
  ShortsScript,
} from "./types";
import { analyzeCommunity } from "./analysis/community";
import { heuristicPlaybook } from "./analysis/playbook";
import { analyzeRules } from "./analysis/rules";
import { SAMPLE_PRODUCT, isSampleUrl } from "./fixtures/sample-product";
import { templateShorts } from "./generate/shorts";
import { templateDrafts } from "./generate/templates";
import { LLMError, generateJSON, llmConfig } from "./llm/provider";
import { WRITER_SYSTEM, draftsPrompt, playbookPrompt, profilePrompt, shortsPrompt } from "./llm/prompts";
import { DraftsSchema, PlaybookSchema, ProfileSchema, ShortsSchema } from "./llm/schemas";
import { FetchError, extractPage, fetchPage, heuristicProfile, manualProfile, pageDigest } from "./sources/product";

export interface Notice {
  noticeKo?: string;
}

function llmNotice(e: unknown, what: string): string {
  const reason = e instanceof LLMError ? e.messageKo : "알 수 없는 오류";
  return `${what}에 LLM을 쓰지 못해서(${reason}) 규칙 기반 결과를 보여 줘요`;
}

export async function buildProfile(input: {
  url?: string;
  manual?: { name: string; description: string };
  useLLM: boolean;
}): Promise<{ profile: ProductProfile } & Notice> {
  if (input.url && isSampleUrl(input.url)) return { profile: SAMPLE_PRODUCT };

  if (input.manual) {
    const base = manualProfile({ url: input.url, ...input.manual });
    if (!input.useLLM || llmConfig().provider === "none") return { profile: base };
    try {
      const out = await generateJSON({
        system: WRITER_SYSTEM,
        prompt: profilePrompt(`Name: ${input.manual.name}\nDescription written by the maker:\n${input.manual.description}`),
        schema: ProfileSchema,
        name: "product_profile",
        description: "Factual product profile",
        maxTokens: 1500,
      });
      return { profile: { ...base, ...out, url: input.url ?? "", source: "manual", extractedBy: "llm" } };
    } catch (e) {
      return { profile: base, noticeKo: llmNotice(e, "제품 정리") };
    }
  }

  if (!input.url) throw new FetchError("no url", "제품 URL을 넣어 주세요.");
  const { html, finalUrl } = await fetchPage(input.url);
  const page = extractPage(html, input.url, finalUrl);
  const base = heuristicProfile(page);
  if (!input.useLLM || llmConfig().provider === "none") return { profile: base };
  try {
    const out = await generateJSON({
      system: WRITER_SYSTEM,
      prompt: profilePrompt(pageDigest(page)),
      schema: ProfileSchema,
      name: "product_profile",
      description: "Factual product profile extracted from the page",
      maxTokens: 1500,
    });
    return { profile: { ...base, ...out, url: finalUrl, source: "live", extractedBy: "llm" } };
  } catch (e) {
    return { profile: base, noticeKo: llmNotice(e, "제품 정리") };
  }
}

export async function analyze(collected: CollectResult, profile: ProductProfile, useLLM: boolean): Promise<CommunityAnalysis> {
  const stats = analyzeCommunity(collected.posts, collected.community.platform);
  const rules = analyzeRules(collected.rules, collected.community.platform, collected.about?.description ?? "");
  if (collected.source === "pasted") {
    // 붙여 넣은 글에는 시간 정보가 없고, 점수가 없으면 상위·하위 비교도 의미가 없다
    stats.timing = { blocks: [], bestLabelKo: "붙여 넣은 글에는 시간 정보가 없어요", sampleSize: 0 };
    if (collected.posts.every((p) => p.score === 0)) {
      stats.lifts = [];
      stats.archetypes = stats.archetypes.map((a) => ({ ...a, performance: 1 }));
      stats.adSmell.correlation = null;
    }
  }
  const base: CommunityAnalysis = {
    community: collected.community,
    source: collected.source,
    fetchedAt: collected.fetchedAt,
    noticeKo: collected.noticeKo,
    about: collected.about,
    stats,
    rules,
    rulesRaw: collected.rules,
    playbook: heuristicPlaybook(collected.community, stats, rules),
  };
  if (!useLLM || llmConfig().provider === "none") return base;
  try {
    const out = await generateJSON({
      system: WRITER_SYSTEM,
      prompt: playbookPrompt(base, collected.rules, profile),
      schema: PlaybookSchema,
      name: "community_playbook",
      description: "How to post well in this community",
      maxTokens: 2500,
    });
    return { ...base, playbook: { ...out, engine: "llm" } };
  } catch (e) {
    return { ...base, noticeKo: [base.noticeKo, llmNotice(e, "현지 가이드")].filter(Boolean).join(" / ") };
  }
}

export async function writeDrafts(input: {
  profile: ProductProfile;
  analysis: CommunityAnalysis;
  useLLM: boolean;
  tone?: string;
  length?: string;
}): Promise<GenerateResult> {
  const { profile, analysis } = input;
  const ctx = { profile, ref: analysis.community, stats: analysis.stats, rules: analysis.rules };
  const base = templateDrafts(ctx);
  const result: GenerateResult = { community: analysis.community, drafts: base, engine: "template" };

  // AI 글을 금지하는 곳에서는 LLM으로도 대신 쓰지 않는다
  if (analysis.rules.aiContent.level === "banned") return result;
  if (!input.useLLM || llmConfig().provider === "none") return result;

  const angles: Angle[] = base.map((d) => d.angle);
  const linkInBody = analysis.rules.selfPromo.policy !== "restricted" && analysis.stats.body.linkRate >= 0.15;
  try {
    const out = await generateJSON({
      system: WRITER_SYSTEM,
      prompt: draftsPrompt({ product: profile, analysis, rules: analysis.rulesRaw, angles, linkInBody, tone: input.tone, length: input.length }),
      schema: DraftsSchema,
      name: "write_drafts",
      description: "Drafts that fit the community",
      maxTokens: 5000,
    });
    const drafts: Draft[] = out.drafts.map((d, i) => {
      const fallback = base.find((b) => b.angle === d.angle) ?? base[i] ?? base[0];
      const thread = analysis.community.platform === "x" ? (d.thread?.length ? d.thread : [d.body].filter(Boolean)) : undefined;
      return {
        id: `${analysis.community.id}-${d.angle}-llm-${i}`,
        angle: d.angle,
        angleKo: fallback?.angleKo ?? d.angle,
        title: d.title,
        body: thread ? thread.join("\n\n") : d.body,
        thread,
        firstComment: d.firstComment || fallback?.firstComment,
        flairSuggestion: fallback?.flairSuggestion,
        whyKo:
          analysis.rules.aiContent.level === "limited"
            ? [...d.whyKo.slice(0, 3), "성의 없는 AI 글을 지우는 곳이에요. 자기 경험과 말투로 꼭 다시 쓰세요"]
            : d.whyKo,
        glossKo: d.translationKo,
        glossKind: "translation",
        mode: "draft",
        postTimingKo: fallback?.postTimingKo,
      };
    });
    return { community: analysis.community, drafts, engine: "llm" };
  } catch (e) {
    return { ...result, noticeKo: llmNotice(e, "초안 쓰기") };
  }
}

export async function writeShorts(input: {
  profile: ProductProfile;
  analyses: CommunityAnalysis[];
  format?: ShortsScript["format"];
  seconds?: number;
  useLLM: boolean;
}): Promise<{ script: ShortsScript } & Notice> {
  const base = templateShorts(input.profile, input.analyses, { format: input.format, seconds: input.seconds });
  if (!input.useLLM || llmConfig().provider === "none") return { script: base };
  try {
    const out = await generateJSON({
      system: WRITER_SYSTEM,
      prompt: shortsPrompt({ product: input.profile, analyses: input.analyses, format: base.format, seconds: base.seconds }),
      schema: ShortsSchema,
      name: "shorts_script",
      description: "Vertical short-form video script",
      maxTokens: 3000,
    });
    return { script: { ...out, format: base.format, seconds: base.seconds, engine: "llm" } };
  } catch (e) {
    return { script: base, noticeKo: llmNotice(e, "쇼츠 대본") };
  }
}
