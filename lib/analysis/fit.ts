// 초안이 그 커뮤니티 상위글과 얼마나 닮았는지(어울림 점수)와 올리기 전 점검 항목

import type { CommunityStats, Platform, RulesAnalysis } from "../types";
import {
  EMOJI_RE,
  PLACEHOLDER_RE as PH,
  TITLE_CASE_KO,
  contractionsPer100,
  countLinks,
  countMatches,
  detectTitleCase,
  firstLinkIndex,
  normalizeQuotes,
  stripTitleTags,
  wordCount,
} from "../text";
import { DISCLOSURE_RE, scoreAdSmell } from "./adsmell";

export interface FitCheck {
  key: string;
  labelKo: string;
  ok: boolean;
  detailKo: string;
  weight: number;
}

export interface FitResult {
  score: number;
  checks: FitCheck[];
  placeholders: string[];
}

export { PLACEHOLDER_RE } from "../text";
const PLACEHOLDER_SOURCE = PH.source;

export function findPlaceholders(text: string): { start: number; end: number; text: string }[] {
  return [...text.matchAll(new RegExp(PLACEHOLDER_SOURCE, "g"))].map((m) => ({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, text: m[0] }));
}

export function scoreFit(input: {
  title: string;
  body: string;
  thread?: string[];
  platform: Platform;
  stats: CommunityStats;
  rules?: RulesAnalysis;
  productName?: string;
  /** "comment": 정기 스레드 댓글처럼 제목·길이 기준이 다른 글 */
  kind?: "post" | "comment";
}): FitResult {
  const isComment = input.kind === "comment";
  const { stats, platform } = input;
  const title = normalizeQuotes(input.title ?? "");
  const body = normalizeQuotes(input.body ?? "");
  const all = `${title}\n${body}`;
  const checks: FitCheck[] = [];
  const add = (key: string, labelKo: string, ok: boolean, detailKo: string, weight: number) =>
    checks.push({ key, labelKo, ok, detailKo, weight });

  // 제목 길이 (X는 첫 줄)
  const headline = platform === "x" ? (input.thread?.[0] ?? body).split("\n")[0] : stripTitleTags(title);
  const tLen = headline.length;
  const { p25, p75 } = stats.title.chars;
  if (stats.n >= 5 && !isComment) {
    const ok = tLen >= p25 - 6 && tLen <= p75 + 6;
    add(
      "titleLength",
      platform === "x" ? "첫 줄 길이" : "제목 길이",
      ok,
      `${tLen}자 (이 동네 상위권 ${p25}~${p75}자)`,
      12,
    );
  }

  // 대소문자
  if (platform !== "x" && !isComment && stats.title.caseShare >= 0.45) {
    const mine = detectTitleCase(title);
    const ok = mine === stats.title.caseStyle || (stats.title.caseStyle === "sentence" && mine === "mixed");
    add("case", "제목 표기", ok, ok ? `${TITLE_CASE_KO[mine]} — 이 동네와 같아요` : `이 동네는 '${TITLE_CASE_KO[stats.title.caseStyle]}'가 ${Math.round(stats.title.caseShare * 100)}%`, 8);
  }

  // 본문 길이
  if (platform !== "x" && !isComment && stats.body.words.median > 0 && stats.body.emptyRate < 0.6) {
    const n = wordCount(body);
    const lo = Math.round(stats.body.words.p25 * 0.6);
    const hi = Math.round(stats.body.words.p75 * 1.5);
    add("bodyLength", "본문 길이", n >= lo && n <= hi, `${n}단어 (이 동네 상위권 ${stats.body.words.p25}~${stats.body.words.p75}단어)`, 10);
  }

  // 이모지
  const emoji = countMatches(all, EMOJI_RE);
  if (stats.tone.emojiPerPost < 0.3) {
    add("emoji", "이모지", emoji === 0, emoji === 0 ? "안 썼어요 — 이 동네와 같아요" : `${emoji}개 — 이 동네는 거의 안 써요`, 8);
  }

  // 말투
  if (stats.tone.register === "casual" && wordCount(all) >= 40) {
    const c = contractionsPer100(all);
    add("register", "말투", c >= 0.8, c >= 0.8 ? "말하듯 편한 말투예요" : "딱딱해요. I'm, it's, don't 같은 축약형을 섞어 보세요", 10);
  }

  // 질문으로 마무리
  if (stats.body.endsWithQuestionRate >= 0.4 && !isComment) {
    const tail = (body.trim() || title).slice(-220);
    add("endQuestion", "끝맺음", /\?/.test(tail), /\?/.test(tail) ? "질문으로 끝나요" : `상위권 글 ${Math.round(stats.body.endsWithQuestionRate * 100)}%가 질문으로 끝나요`, 10);
  }

  // 링크 위치
  const links = countLinks(body);
  const idx = firstLinkIndex(body);
  const restricted = input.rules?.selfPromo.policy === "restricted";
  if (restricted) {
    add("link", "링크", links === 0, links === 0 ? "링크 없음 — 이 곳 규칙에 맞아요" : "자기홍보 금지 커뮤니티예요. 링크를 빼세요", 12);
  } else {
    add("link", "링크 위치", !(idx >= 0 && idx < 80), idx >= 0 && idx < 80 ? "첫머리에 링크가 있어요. 끝이나 첫 댓글로 옮기세요" : links ? "링크가 뒤쪽에 있어요" : "본문에 링크가 없어요", 12);
  }

  // 만든 사람 공개
  const name = (input.productName ?? "").trim();
  if (name && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(all)) {
    const ok = DISCLOSURE_RE.test(all);
    add("disclosure", "만든 사람 공개", ok, ok ? "직접 만들었다고 밝혔어요" : "제품 이름은 나오는데 만든 사람이라는 말이 없어요", 10);
  }

  // 광고 냄새 (이 동네 기준)
  const smell = scoreAdSmell({ title, body, platform }).score;
  const limit = Math.max(stats.adSmell.p75, 25);
  add("adSmell", "광고 냄새", smell <= limit, `${smell}점 (이 동네 상위권 중간값 ${stats.adSmell.median}점)`, 15);

  // 플랫폼 한도
  if (platform === "x") {
    const tweets = input.thread?.length ? input.thread : [body];
    const over = tweets.filter((t) => [...t].length > 280).length;
    add("xLimit", "글자 수", over === 0, over === 0 ? `트윗 ${tweets.length}개 모두 280자 이내` : `${over}개 트윗이 280자를 넘어요`, 15);
  }
  if (platform === "hn") {
    const ok = /^show hn:/i.test(title.trim()) && title.length <= 80;
    add("hnTitle", "Show HN 제목", ok, ok ? `${title.length}자, 형식 맞음` : !/^show hn:/i.test(title.trim()) ? "'Show HN:'으로 시작해야 해요" : `${title.length}자 — 80자를 넘어요`, 15);
  }

  const total = checks.reduce((a, c) => a + c.weight, 0) || 1;
  const passed = checks.filter((c) => c.ok).reduce((a, c) => a + c.weight, 0);
  const placeholders = findPlaceholders(`${title}\n${body}`).map((p) => p.text);

  return { score: Math.round((passed / total) * 100), checks, placeholders };
}
