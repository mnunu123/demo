// 프롬프트. 정직 규칙은 모든 생성 작업에 공통으로 들어간다.

import type { Angle, CommunityAnalysis, ProductProfile } from "../types";
import { TITLE_CASE_KO } from "../text";

export const HONESTY_RULES = `Non-negotiable rules:
1. The author is the maker. Whenever the product is mentioned, the post must make that clear in a natural way (e.g. "I built", "I'm the developer").
2. Never invent facts: no made-up numbers, user counts, revenue, testimonials, quotes, or personal anecdotes. When a specific fact would help but you don't know it, insert a short placeholder in square brackets written in Korean, e.g. [작업 기간 — 예: 6 months]. The user fills these in.
3. Never write content meant to look like it comes from an unaffiliated user, a customer, or a "friend who found this tool".
4. Respect the community's rules you are given. If self-promotion is restricted, write a value-first post that does not name or link the product.
5. No marketing language: no hype adjectives (revolutionary, game-changer, seamless, supercharge...), no calls to action like "sign up now", no launch emojis unless the community data shows they are normal there.`;

export const WRITER_SYSTEM = `You help solo founders post about their products in online communities (Reddit, X, Hacker News) in a way that fits each community's culture, based on real data about what performs well there. You write like a regular member of that community, in its own register, never like an ad.

${HONESTY_RULES}

Korean fields must be natural, plain Korean (해요체), short sentences, no filler.`;

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function statsSummary(a: CommunityAnalysis): string {
  const s = a.stats;
  const lines = [
    `Community: ${a.community.label} (${a.community.platform}). Data: ${s.n} posts (${a.source === "live" ? "live" : "sample data"}).`,
    `Engagement: median score ${s.engagement.medianScore}, median comments ${s.engagement.medianComments}.`,
    a.community.platform === "x"
      ? `First lines: ${s.title.chars.p25}-${s.title.chars.p75} chars (median ${s.title.chars.median}).`
      : `Titles: ${s.title.chars.p25}-${s.title.chars.p75} chars (median ${s.title.chars.median}); case style ${s.title.caseStyle} (${pct(s.title.caseShare)}; ${TITLE_CASE_KO[s.title.caseStyle]}); questions ${pct(s.title.questionRate)}; numbers ${pct(s.title.numberRate)}; first person ${pct(s.title.firstPersonRate)}.`,
    `Bodies: ${s.body.words.p25}-${s.body.words.p75} words (median ${s.body.words.median}); lists ${pct(s.body.listRate)}; links in body ${pct(s.body.linkRate)}; ending with a question ${pct(s.body.endsWithQuestionRate)}.`,
    `Tone: ${s.tone.register}; contractions ${s.tone.contractionsPer100}/100 words; emoji ${s.tone.emojiPerPost}/post; exclamation marks ${s.tone.exclamationsPerPost}/post; hashtags ${s.tone.hashtagsPerPost}/post; average sentence ${s.tone.avgSentenceWords} words.`,
    s.tone.lexicon.length ? `Local terms seen: ${s.tone.lexicon.map((l) => `${l.term} (${l.count})`).join(", ")}.` : "",
    `Post types (share; performance vs average): ${s.archetypes.map((t) => `${t.type} ${pct(t.share)} x${t.performance}`).join("; ")}.`,
    s.lifts.length ? `Top 25% vs the rest: ${s.lifts.map((l) => `${l.key} ${pct(l.topRate)} vs ${pct(l.restRate)}`).join("; ")}.` : "",
    `Ad-smell score (0-100) of posts: median ${s.adSmell.median}, p75 ${s.adSmell.p75}; rank correlation with engagement ${s.adSmell.correlation ?? "n/a"}.`,
    s.flairs.length ? `Flairs used: ${s.flairs.map((f) => f.text).join(", ")}.` : "",
    `Self-promotion policy (parsed from rules): ${a.rules.selfPromo.policy} — ${a.rules.selfPromo.noteKo}${a.rules.promoDaysNoteKo ? ` (${a.rules.promoDaysNoteKo})` : ""}.`,
    a.rules.aiContent.level !== "none" ? `Rules restrict AI-generated content (${a.rules.aiContent.level}).` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export function examplesBlock(a: CommunityAnalysis, n = 8): string {
  return a.stats.topPosts
    .slice(0, n)
    .map((p, i) => `${i + 1}. [score ${p.score}, ${p.comments} comments, type ${p.archetype}] "${p.title}"${p.excerpt ? ` — ${p.excerpt}` : ""}`)
    .join("\n");
}

export function rulesBlock(a: CommunityAnalysis, rules: { title: string; description: string }[]): string {
  if (!rules.length) return "No rules were provided.";
  return rules
    .slice(0, 12)
    .map((r) => `- ${r.title}: ${r.description.replace(/\s+/g, " ").slice(0, 300)}`)
    .join("\n");
}

export function profileBlock(p: ProductProfile): string {
  return [
    `Name: ${p.name}`,
    `One-liner: ${p.oneLiner}`,
    `Category: ${p.category}`,
    `Audience: ${p.audience.join(", ") || "unknown"}`,
    `Problems it removes: ${p.problems.join("; ") || "unknown"}`,
    `Features: ${p.features.join("; ") || "unknown"}`,
    `Pricing: ${p.pricing || "unknown"}`,
    `Stage: ${p.stage}`,
    `URL: ${p.url}`,
  ].join("\n");
}

export function profilePrompt(digest: string): string {
  return `Read this product page and extract a factual product profile. Use only what the page says. If the page is in Korean or another language, write the English fields in natural English and the Korean field in Korean. Keep problems as lowercase gerund phrases ("writing release notes by hand").

<page>
${digest}
</page>`;
}

export function playbookPrompt(a: CommunityAnalysis, rules: { title: string; description: string }[], product: ProductProfile): string {
  return `Summarize how to post well in this community, for a Korean solo founder who will post about the product below. Ground every point in the data; cite numbers where you can. Write the Korean fields in natural Korean.

<community_data>
${statsSummary(a)}
</community_data>

<community_rules>
${rulesBlock(a, rules)}
</community_rules>

<top_posts>
${examplesBlock(a)}
</top_posts>

<product>
${profileBlock(product)}
</product>`;
}

const ANGLE_GUIDE: Record<Angle, string> = {
  story: "story: the maker's own story — the problem they hit, what they built, an honest question. Product named, maker disclosed.",
  feedback: "feedback: asking the community for specific, answerable feedback on the product. Product named, maker disclosed.",
  lesson: "lesson: value-first post sharing lessons from building (placeholders for the actual lessons). Mention the product only at the end if allowed, without a link.",
  thread: "thread: a short comment for the community's designated self-promotion thread (no title).",
  question: "question: a genuine discussion question about the problem space. Do not mention or link the product.",
  link: "link: Show HN link submission (title only, empty body) plus a first comment from the maker giving context.",
};

export function draftsPrompt(input: {
  product: ProductProfile;
  analysis: CommunityAnalysis;
  rules: { title: string; description: string }[];
  angles: Angle[];
  linkInBody: boolean;
  tone?: string;
  length?: string;
}): string {
  const { analysis: a } = input;
  const platformNotes =
    a.community.platform === "x"
      ? "X: put tweets in `thread` (each at most 280 characters), leave title and body empty. At most one hashtag in total. Put any link only in the last tweet."
      : a.community.platform === "hn"
        ? 'Hacker News: title must be "Show HN: <Name> – <plain description>", at most 80 characters, no uppercase emphasis or exclamation marks. Body: why you built it, how it works technically, current limitations, how to try it. No marketing language.'
        : `Reddit: aim for a title near ${a.stats.title.chars.median} characters in ${a.stats.title.caseStyle} case, body around ${a.stats.body.words.median} words (range ${a.stats.body.words.p25}-${a.stats.body.words.p75}). ${input.linkInBody ? "You may put the product link once at the end of the body." : "Do not put the link in the body; put it in firstComment."}`;
  return `Write ${input.angles.length} draft(s) for ${a.community.label}, one per angle, in this order:
${input.angles.map((x) => `- ${ANGLE_GUIDE[x]}`).join("\n")}

${platformNotes}
Write in the community's own register (see tone data). Use square-bracket Korean placeholders for anything personal you don't know.
${input.tone ? `Tone adjustment requested: ${input.tone}.` : ""}${input.length ? ` Length adjustment requested: ${input.length}.` : ""}

<product>
${profileBlock(input.product)}
</product>

<community_data>
${statsSummary(a)}
</community_data>

<community_rules>
${rulesBlock(a, input.rules)}
</community_rules>

<top_posts>
${examplesBlock(a)}
</top_posts>

For each draft also give whyKo (Korean, cite the data) and translationKo (Korean translation per paragraph or per tweet).`;
}

export function shortsPrompt(input: {
  product: ProductProfile;
  analyses: CommunityAnalysis[];
  format: string;
  seconds: number;
}): string {
  const hooks = input.analyses
    .flatMap((a) => a.stats.topPosts.slice(0, 4).map((p) => `- (${a.community.label}) ${p.title}`))
    .slice(0, 16)
    .join("\n");
  return `Write a ${input.seconds}-second vertical short-form video script (${input.format}) where the maker shows the product below. The audience is the same people as in these communities; borrow their language and the kind of hooks that perform well there, not ad language.

Structure: a 0-3 second hook, the problem, the product in action (screen recording), the result, an honest ask for feedback. Scene times must cover 0 to ${input.seconds} seconds without gaps.
The result scene must not claim numbers you don't know; use a Korean placeholder like [실제로 줄어든 시간] or a before/after visual instead.
Give 3 hook options with a Korean reason each, a short caption, up to 5 hashtags, and a Korean shooting checklist.

<product>
${profileBlock(input.product)}
</product>

<top_titles_in_target_communities>
${hooks}
</top_titles_in_target_communities>`;
}
