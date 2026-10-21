// 커뮤니티 규칙 → 홍보 가능 여부, AI 글 제한, 플레어, 링크·계정 조건, 홍보 요일

import type { CommunityRule, Platform, PromoPolicy, RulesAnalysis } from "../types";
import { dayKo, usDayToKstWindow } from "./timing";

// 홍보 정책을 다루는 규칙만 고른다. "No spam"처럼 어디에나 있는 규칙은 홍보 금지로 보지 않는다.
const PROMO_RE = /self[- ]?promo\w*|promot(?:e|es|ed|ion|ions|ing)\b|advertis\w*|\bads\b|shill\w*|\bplugs?\b|show[- ]?off|showcase|shar(?:e|ing) your (?:own )?(?:side )?(?:project|startup|work|saas|app|product)/i;
const DAY_RE = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/gi;
const THREAD_RE = /\b(?:weekly|monthly|daily)\b[^.\n]{0,40}\b(?:thread|megathread|post)\b|\b(?:designated|pinned|sticky|stickied) (?:thread|post)\b|\bmegathread\b/i;
const RATIO_RE = /\b10\s?%|\b9\s?:\s?1\b|\b1\s?:\s?10\b|\bratio\b|\b90\s?\/\s?10\b/i;
const PROMO_WORD = "(?:self[- ]?promo\\w*|promot\\w*|advertis\\w*|ads|shill\\w*|sales pitch\\w*)";
const RESTRICT_RE = new RegExp(
  `\\b(?:no|not allowed|prohibited|banned|forbidden|don'?t|do not)\\b[^.\\n]{0,40}\\b${PROMO_WORD}|\\b${PROMO_WORD}\\b[^.\\n]{0,40}\\b(?:not allowed|prohibited|banned|forbidden|will be removed|isn'?t allowed|is not permitted|are not allowed)\\b`,
  "i",
);
const ALLOW_RE =
  /\b(?:shar(?:e|ing) your (?:own )?(?:side )?(?:project|work|creation|startup|saas|app|product)s?|self[- ]?promotion is (?:allowed|welcome|ok|fine|the point)|feel free to (?:share|promote)|show off your|showcase your|is the point of this (?:sub|subreddit|community))\b/i;
const AI_RE = /\b(?:ai[- ]generated|ai[- ]edited|generated text|chatgpt|gpt|llms?|written by (?:an )?ai|ai[- ]written|ai content|generative ai|bot[- ]written|ai slop)\b/i;
const FLAIR_RE = /\bflair/i;
const MUST_RE = /\b(?:must|required|require|requires|need to|needs to|mandatory)\b/i;
const LINK_RE = /\b(?:no links?|link shorteners?|affiliate|referral links?|links? (?:go|belong|only) in (?:the )?comments?|links? in (?:the )?comments?)\b/i;
const ACCOUNT_RE = /\b(?:account age|karma|new accounts?|accounts? (?:younger|newer) than)\b/i;
const TITLE_RE = /\btitles?\b/i;

const POLICY_LABEL: Record<PromoPolicy, string> = {
  allowed: "자기홍보 가능",
  conditional: "조건부 허용",
  restricted: "자기홍보 금지",
  unknown: "규칙 확인 필요",
};

export function analyzeRules(rules: CommunityRule[], platform: Platform, aboutText = ""): RulesAnalysis {
  const text = (r: CommunityRule) => `${r.title}\n${r.description}`;
  const promoRules = rules.filter((r) => PROMO_RE.test(text(r)));
  const promoText = promoRules.map(text).join("\n");

  const days = [...new Set([...promoText.matchAll(DAY_RE)].map((m) => m[1].toLowerCase()))];
  const hasThread = THREAD_RE.test(promoText);
  const hasRatio = RATIO_RE.test(promoText);
  const restricted = RESTRICT_RE.test(promoText);
  const allowed = ALLOW_RE.test(promoText) || ALLOW_RE.test(aboutText);

  let policy: PromoPolicy;
  if (platform === "hn") policy = "allowed";
  else if (platform === "x") policy = "allowed";
  else if (days.length > 0 || hasThread || hasRatio) policy = "conditional";
  else if (restricted && !allowed) policy = "restricted";
  else if (allowed) policy = "allowed";
  else policy = "unknown";

  const daysKo = days.map((d) => dayKo(d)).filter(Boolean) as string[];
  let noteKo: string;
  switch (policy) {
    case "conditional": {
      const parts: string[] = [];
      if (days.length) parts.push(`홍보 글은 ${daysKo.join(", ")}에만 올릴 수 있어요`);
      if (hasThread) parts.push("제품 홍보는 정해진 정기 스레드 안에서만 해야 해요");
      if (hasRatio) parts.push("전체 활동 중 홍보 비율을 제한하는 규칙이 있어요");
      noteKo = parts.join(". ");
      break;
    }
    case "restricted":
      noteKo = "제품을 소개하는 글은 지워질 가능성이 높아요. 링크 없이 경험담이나 질문으로 접근하세요";
      break;
    case "allowed":
      noteKo =
        platform === "hn"
          ? "직접 만든 것을 보여 주는 게시판이에요. 바로 써 볼 수 있어야 하고, 만든 사람이 댓글에 답하는 문화예요"
          : platform === "x"
            ? "서브레딧 같은 규칙은 없지만, 같은 문구나 링크를 반복하면 스팸으로 분류될 수 있어요"
            : "만든 것을 공유하는 곳이에요. 왜 만들었는지와 질문을 함께 쓰면 반응이 좋아요";
      break;
    default:
      noteKo = "규칙에 홍보 관련 내용이 따로 없어요. 사이드바와 고정글을 직접 한 번 확인하세요";
  }

  const aiRules = rules.filter((r) => AI_RE.test(text(r)));
  const softAi = /\b(?:low[- ]effort|obviously|spammy|mass[- ]produced|marketing copy)\b/i;
  const aiLevel: RulesAnalysis["aiContent"]["level"] =
    aiRules.length === 0 ? "none" : aiRules.every((r) => softAi.test(text(r))) ? "limited" : "banned";
  const flairRequired = rules.some((r) => FLAIR_RE.test(text(r)) && MUST_RE.test(text(r)));
  const linkRule = rules.find((r) => LINK_RE.test(text(r)));
  const accountRule = rules.find((r) => ACCOUNT_RE.test(text(r)));
  const titleRules = rules.filter((r) => TITLE_RE.test(r.title) || (TITLE_RE.test(r.description) && MUST_RE.test(r.description)));

  const promoDaysNoteKo = days.length
    ? days
        .map((d) => usDayToKstWindow(d))
        .filter(Boolean)
        .join(", ")
    : undefined;

  const checklistKo: string[] = [];
  checklistKo.push(`${POLICY_LABEL[policy]}: ${noteKo}`);
  if (promoDaysNoteKo) checklistKo.push(`안전하게 올리려면 ${promoDaysNoteKo} 사이에 올리세요`);
  if (flairRequired) checklistKo.push("플레어(말머리)를 꼭 고르세요");
  if (aiLevel === "banned") checklistKo.push("AI가 쓴 글을 금지하는 규칙이 있어요. 뼈대를 보고 직접 쓰세요 (점검은 계속 해 드려요)");
  else if (aiLevel === "limited") checklistKo.push("성의 없는 AI 글을 지우는 규칙이 있어요. 초안을 자기 경험과 말투로 꼭 다시 쓰세요");
  if (linkRule) checklistKo.push(`링크를 다루는 규칙이 있어요: "${linkRule.title}"`);
  if (accountRule) checklistKo.push(`계정 조건이 있어요: "${accountRule.title}"`);
  for (const r of titleRules.slice(0, 2)) checklistKo.push(`제목 규칙: "${r.title}"`);
  if (platform === "reddit") {
    checklistKo.push("같은 글을 여러 서브레딧에 한꺼번에 올리지 마세요");
    checklistKo.push("새 계정이나 카르마가 낮은 계정은 자동으로 지워지는 곳이 많아요 (기준은 대개 공개되지 않아요)");
  }
  if (platform === "hn") checklistKo.push("올린 뒤 몇 시간은 댓글에 직접 답할 수 있을 때 올리세요");
  checklistKo.push("제품 이야기를 할 땐 만든 사람이라고 밝히세요");

  return {
    selfPromo: {
      policy,
      labelKo: POLICY_LABEL[policy],
      evidence: promoRules.slice(0, 3).map((r) => r.title),
      noteKo,
    },
    aiContent: { level: aiLevel, evidence: aiRules.slice(0, 2).map((r) => r.title) },
    flairRequired,
    linkNoteKo: linkRule ? `"${linkRule.title}"` : undefined,
    accountNoteKo: accountRule ? `"${accountRule.title}"` : undefined,
    promoDays: days,
    promoDaysNoteKo,
    titleNotesKo: titleRules.slice(0, 2).map((r) => r.title),
    checklistKo,
  };
}
