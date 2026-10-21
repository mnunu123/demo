// 게시물 한 개에서 뽑는 특징값. 커뮤니티 통계는 이 값들을 모아서 만든다.

import type { Archetype, Platform, Post, PostFeatures } from "../types";
import {
  EMOJI_RE,
  contractionsPer100,
  countLinks,
  countMatches,
  detectTitleCase,
  firstLinkIndex,
  lexiconHits,
  mean,
  normalizeQuotes,
  paragraphs,
  sentences,
  stripTitleTags,
  wordCount,
} from "../text";
import { DISCLOSURE_RE, scoreAdSmell } from "./adsmell";

export const ARCHETYPE_KO: Record<Archetype, string> = {
  showcase: "만든 것 공개",
  feedback: "피드백 요청",
  milestone: "성과 공유",
  lesson: "경험담과 교훈",
  guide: "방법 공유",
  question: "질문",
  discussion: "의견과 토론",
  other: "기타",
};

const MILESTONE_RE =
  /(\$\s?\d[\d,.]*\s?[km]?\b|\b\d[\d,.]*\s?[km]?\+?\s?(?:mrr|arr|users|customers|downloads|subscribers|sales|stars|signups|sign-ups|visitors|installs|members|paying)\b|\bfirst (?:paying )?(?:customer|sale|user|dollar|\$)s?\b|\bmrr\b|\bramen profitable\b|\b(?:hit|reached|crossed|passed) (?:\$|\d)|\b\d+(?:\.\d+)?% (?:to|→) \d+(?:\.\d+)?%)/i;
const FEEDBACK_RE =
  /\b(?:feedback|roast|thoughts on|review my|rate my|critique|honest opinions?|would you (?:use|pay|try)|what do you think (?:of|about))\b/i;
const SHOWCASE_RE =
  /(?:^show hn\b|^(?:built|made|created|launched|shipped|wrote)\b|\b(?:i|we) (?:just )?(?:built|made|created|launched|shipped|wrote|developed|designed|released)\b|\bi'?ve (?:built|made|created)\b|\bmy (?:new |first )?(?:app|tool|side project|project|extension|game|saas|plugin|library|cli)\b|\bjust (?:launched|shipped|released)\b|\bintroducing\b|\bshowoff\b)/i;
const LESSON_STRONG_RE =
  /\b(?:lessons?|learned|learnings|mistakes?|what i wish|honest (?:picture|take|update|numbers|notes)|takeaways?|post-?mortem|why i (?:quit|stopped|shut)|the truth about|here'?s what (?:i|happened|worked))\b/i;
const LESSON_WEAK_RE = /\b(?:after \d+ (?:years?|months?|weeks?)|\d+ (?:years?|months?) (?:of|in|into|building|later))\b/i;
const GUIDE_RE = /\b(?:how (?:to|i|we)\b|guide|tutorial|tips|step[- ]by[- ]step|playbook|checklist|framework for)\b/i;
const QUESTION_START =
  /^(?:how|what|why|when|where|which|who|is|are|does|do|did|should|can|could|would|has|have|any(?:one|body)?|anybody|has anyone)\b/i;
const DISCUSSION_RE = /\b(?:unpopular opinion|hot take|rant|am i the only|is it just me|let'?s talk|debate|change my mind|vs\.?)\b/i;

export function classifyArchetype(title: string, body: string, platform: Platform): Archetype {
  const t = normalizeQuotes(title).trim();
  const head = normalizeQuotes(body).slice(0, 240);
  const both = `${t}\n${head}`;
  if (MILESTONE_RE.test(t) || (platform === "x" && MILESTONE_RE.test(head))) return "milestone";
  if (FEEDBACK_RE.test(t)) return "feedback";
  if (LESSON_STRONG_RE.test(t)) return "lesson";
  if (SHOWCASE_RE.test(t) || (platform !== "reddit" && SHOWCASE_RE.test(head))) return "showcase";
  if (LESSON_WEAK_RE.test(t)) return "lesson";
  if (GUIDE_RE.test(t)) return "guide";
  if (DISCUSSION_RE.test(t)) return "discussion";
  const stripped = stripTitleTags(t);
  if (stripped.endsWith("?") || QUESTION_START.test(stripped)) return "question";
  if (FEEDBACK_RE.test(head)) return "feedback";
  if (SHOWCASE_RE.test(both)) return "showcase";
  return "other";
}

export function engagementOf(post: Pick<Post, "score" | "comments" | "shares">): number {
  return (
    Math.log1p(Math.max(0, post.score)) +
    Math.log1p(Math.max(0, post.comments)) +
    0.5 * Math.log1p(Math.max(0, post.shares ?? 0))
  );
}

export function featuresOf(post: Post): PostFeatures {
  const title = normalizeQuotes(post.title ?? "");
  const body = normalizeQuotes(post.body ?? "");
  const all = `${title}\n${body}`;
  const strippedTitle = stripTitleTags(title);
  const sents = sentences(all);
  const created = new Date(post.createdAt);
  const tail = (body.trim() || title).slice(-220);

  return {
    titleChars: strippedTitle.length,
    titleWords: wordCount(strippedTitle),
    titleCase: detectTitleCase(title),
    isQuestion: strippedTitle.trim().endsWith("?") || QUESTION_START.test(strippedTitle),
    hasNumber: /\d/.test(strippedTitle),
    firstPerson: /\b(?:i|i'm|i've|i'd|my|me|we|we're|we've|our)\b/i.test(strippedTitle),
    hasBracketTag: /^\s*[[(]|\[[^\]]{1,30}\]/.test(title),
    emojiCount: countMatches(all, EMOJI_RE),
    exclamations: countMatches(all, /!/g),
    bodyWords: wordCount(body),
    bodyParagraphs: paragraphs(body).length,
    hasList: /^\s*(?:[-*•→]|\d+[.)])\s+\S/m.test(body),
    linkCount: countLinks(body),
    linkInOpening: (() => {
      const i = firstLinkIndex(body);
      return i >= 0 && i < 80;
    })(),
    endsWithQuestion: /\?/.test(tail),
    contractionsPer100: contractionsPer100(all),
    slang: lexiconHits(all),
    hashtags: countMatches(all, /(?<![\w&/])#[A-Za-z][\w]{1,40}/g),
    disclosure: DISCLOSURE_RE.test(all),
    avgSentenceWords: sents.length ? mean(sents.map((s) => wordCount(s))) : wordCount(all),
    archetype: classifyArchetype(title, body, post.platform),
    adSmell: scoreAdSmell({ title, body, platform: post.platform }).score,
    weekdayUtc: created.getUTCDay(),
    hourUtc: created.getUTCHours(),
    engagement: engagementOf(post),
  };
}
