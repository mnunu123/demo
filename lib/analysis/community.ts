// 수집한 게시물 묶음 → 커뮤니티 통계 (제목 패턴, 말투, 잘 되는 유형, 시간대, 광고 냄새 기준선)

import type {
  Archetype,
  ArchetypeShare,
  CommunityStats,
  FeatureLift,
  Platform,
  Post,
  PostFeatures,
  TitleCase,
  TopPostSummary,
} from "../types";
import { LEXICON, median, mean, ngrams, quantile, round, spearman, stripTitleTags, words } from "../text";
import { ARCHETYPE_KO, featuresOf } from "./features";
import { analyzeTiming } from "./timing";

function range(xs: number[]) {
  return { p25: round(quantile(xs, 0.25)), median: round(median(xs)), p75: round(quantile(xs, 0.75)) };
}

function rate(fs: PostFeatures[], pick: (f: PostFeatures) => boolean): number {
  return fs.length ? fs.filter(pick).length / fs.length : 0;
}

const LIFT_DEFS: { key: string; labelKo: string; pick: (f: PostFeatures) => boolean; skip?: Platform[] }[] = [
  { key: "question", labelKo: "제목이 질문형", pick: (f) => f.isQuestion },
  { key: "firstPerson", labelKo: "제목에 1인칭(I, my, we)", pick: (f) => f.firstPerson },
  { key: "number", labelKo: "제목에 숫자", pick: (f) => f.hasNumber },
  { key: "bracket", labelKo: "제목에 [말머리]", pick: (f) => f.hasBracketTag, skip: ["x", "hn"] },
  { key: "emoji", labelKo: "이모지 사용", pick: (f) => f.emojiCount > 0 },
  { key: "link", labelKo: "본문에 링크", pick: (f) => f.linkCount > 0, skip: ["hn"] },
  { key: "endsQuestion", labelKo: "질문으로 끝남", pick: (f) => f.endsWithQuestion },
  { key: "list", labelKo: "목록(불릿) 사용", pick: (f) => f.hasList },
  { key: "disclosure", labelKo: "만든 사람이라고 밝힘", pick: (f) => f.disclosure },
  { key: "long", labelKo: "본문 150단어 이상", pick: (f) => f.bodyWords >= 150, skip: ["x"] },
];

function dominantCase(fs: PostFeatures[]): { style: TitleCase; share: number } {
  const counts = new Map<TitleCase, number>();
  for (const f of fs) counts.set(f.titleCase, (counts.get(f.titleCase) ?? 0) + 1);
  let style: TitleCase = "sentence";
  let best = -1;
  for (const [k, v] of counts) {
    if (k === "mixed") continue;
    if (v > best) {
      best = v;
      style = k;
    }
  }
  return { style, share: fs.length ? Math.max(0, best) / fs.length : 0 };
}

function whyItWorks(post: Post, f: PostFeatures, titleRange: { p25: number; p75: number }): string[] {
  const out: string[] = [];
  if (f.firstPerson && (f.archetype === "showcase" || f.archetype === "lesson")) out.push("1인칭으로 자기 이야기를 시작함");
  if (f.archetype === "lesson") out.push("겪은 일에서 나온 교훈을 나눔");
  if (f.archetype === "milestone" && f.hasNumber) out.push("구체적인 숫자로 결과를 보여 줌");
  else if (f.hasNumber) out.push("제목에 구체적인 숫자가 있음");
  if (f.endsWithQuestion) out.push("질문으로 끝나서 댓글을 부름");
  if (f.disclosure && f.archetype !== "lesson") out.push("만든 사람이라고 먼저 밝힘");
  if (f.hasList) out.push("목록으로 짧게 정리함");
  if (post.media === "image" || post.media === "video") out.push("이미지나 영상으로 바로 보여 줌");
  if (f.adSmell < 15) out.push("광고 냄새가 거의 없음");
  if (f.titleChars >= titleRange.p25 && f.titleChars <= titleRange.p75) out.push("제목 길이가 이 동네 평균");
  return out.slice(0, 3);
}

export function analyzeCommunity(posts: Post[], platform: Platform): CommunityStats {
  const valid = posts.filter((p) => (p.title || p.body).trim().length > 0);
  const fs = valid.map(featuresOf);
  const n = fs.length;

  const engagements = fs.map((f) => f.engagement);
  const order = engagements.map((e, i) => [e, i] as const).sort((a, b) => b[0] - a[0]);
  const topCut = Math.max(1, Math.ceil(n / 4));
  const topIdx = new Set(order.slice(0, topCut).map(([, i]) => i));
  const topF = fs.filter((_, i) => topIdx.has(i));
  const restF = fs.filter((_, i) => !topIdx.has(i));

  // 제목
  const titleChars = fs.map((f) => f.titleChars);
  const titleWords = fs.map((f) => f.titleWords);
  const { style, share } = dominantCase(fs);
  const openerCounts = new Map<string, number>();
  for (const p of valid) {
    const ws = words(stripTitleTags(p.title || p.body.split("\n")[0])).slice(0, 2);
    if (ws.length < 2) continue;
    const key = ws.join(" ");
    openerCounts.set(key, (openerCounts.get(key) ?? 0) + 1);
  }
  const openers = [...openerCounts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([text, count]) => ({ text, count }));

  // 본문
  const withBody = fs.filter((f) => f.bodyWords > 0);

  // 말투
  const toneFs = fs.filter((f) => f.bodyWords + f.titleWords >= 15);
  const contractions = median(toneFs.map((f) => f.contractionsPer100));
  const avgSentence = median(fs.map((f) => f.avgSentenceWords));
  const lexCounts = new Map<string, number>();
  for (const f of fs) for (const term of f.slang) lexCounts.set(term, (lexCounts.get(term) ?? 0) + 1);
  const lexicon = [...lexCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([term, count]) => ({ term, count, glossKo: LEXICON.find((l) => l.term === term)?.glossKo ?? "" }));
  const slangShare = rate(fs, (f) => f.slang.some((s) => /^(tbh|ngl|imo|imho|lol|lmao|idk|kinda|gonna|wanna|lowkey|legit|y'all|fwiw|iirc)$/.test(s)));
  const register: CommunityStats["tone"]["register"] =
    contractions >= 1.6 || slangShare >= 0.25 ? "casual" : contractions < 0.6 && avgSentence > 17 ? "formal" : "neutral";

  // 유형
  const overallMean = mean(engagements) || 1;
  const typeMap = new Map<Archetype, number[]>();
  fs.forEach((f) => typeMap.set(f.archetype, [...(typeMap.get(f.archetype) ?? []), f.engagement]));
  const archetypes: ArchetypeShare[] = [...typeMap.entries()]
    .map(([type, es]) => ({
      type,
      labelKo: ARCHETYPE_KO[type],
      share: es.length / Math.max(1, n),
      performance: round(mean(es) / overallMean, 2),
      count: es.length,
    }))
    .sort((a, b) => Number(a.type === "other") - Number(b.type === "other") || b.share - a.share || b.performance - a.performance);

  // 상위 25% vs 나머지
  const lifts: FeatureLift[] =
    n >= 12
      ? LIFT_DEFS.filter((d) => !d.skip?.includes(platform))
          .map((d) => ({ key: d.key, labelKo: d.labelKo, topRate: rate(topF, d.pick), restRate: rate(restF, d.pick) }))
          .filter((l) => Math.abs(l.topRate - l.restRate) >= 0.2)
          .sort((a, b) => Math.abs(b.topRate - b.restRate) - Math.abs(a.topRate - a.restRate))
          .slice(0, 5)
      : [];

  // 자주 나오는 구절 (여러 글에 걸쳐 나오고 반응 좋은 글에 많이 나오는 순)
  const phraseScore = new Map<string, { posts: Set<number>; weight: number }>();
  valid.forEach((p, i) => {
    const text = `${p.title}\n${p.body}`;
    const grams = new Set([...ngrams(text, 2), ...ngrams(text, 3)]);
    for (const g of grams) {
      const cur = phraseScore.get(g) ?? { posts: new Set<number>(), weight: 0 };
      cur.posts.add(i);
      cur.weight += fs[i].engagement;
      phraseScore.set(g, cur);
    }
  });
  const phraseList = [...phraseScore.entries()]
    // 두 글 이상에 나오되, 거의 모든 글에 붙는 형식 문구("show hn")는 뺀다
    .filter(([, v]) => v.posts.size >= 2 && v.posts.size <= Math.max(2, n * 0.6))
    .sort((a, b) => b[1].weight - a[1].weight);
  const phrases: { text: string; count: number }[] = [];
  for (const [text, v] of phraseList) {
    if (phrases.some((p) => p.text.includes(text) || text.includes(p.text))) continue;
    phrases.push({ text, count: v.posts.size });
    if (phrases.length >= 10) break;
  }

  const adSmells = fs.map((f) => f.adSmell);
  const titleRange = range(titleChars);

  const topPosts: TopPostSummary[] = order.slice(0, 6).map(([, i]) => {
    const p = valid[i];
    const f = fs[i];
    return {
      id: p.id,
      title: p.title || p.body.split("\n")[0].slice(0, 140),
      excerpt: (p.title ? p.body : p.body.split("\n").slice(1).join(" ")).replace(/\s+/g, " ").trim().slice(0, 180),
      score: p.score,
      comments: p.comments,
      archetype: f.archetype,
      archetypeKo: ARCHETYPE_KO[f.archetype],
      adSmell: f.adSmell,
      permalink: p.permalink,
      createdAt: p.createdAt,
      whyKo: whyItWorks(p, f, titleRange),
    };
  });

  return {
    n,
    engagement: {
      medianScore: round(median(valid.map((p) => p.score))),
      medianComments: round(median(valid.map((p) => p.comments))),
      discussionRatio: round(median(valid.map((p) => p.comments / Math.max(1, p.score))), 2),
    },
    title: {
      chars: titleRange,
      words: range(titleWords),
      questionRate: rate(fs, (f) => f.isQuestion),
      numberRate: rate(fs, (f) => f.hasNumber),
      firstPersonRate: rate(fs, (f) => f.firstPerson),
      bracketRate: rate(fs, (f) => f.hasBracketTag),
      caseStyle: style,
      caseShare: share,
      openers,
    },
    body: {
      words: range(withBody.map((f) => f.bodyWords)),
      listRate: rate(withBody, (f) => f.hasList),
      linkRate: rate(fs, (f) => f.linkCount > 0),
      endsWithQuestionRate: rate(fs, (f) => f.endsWithQuestion),
      emptyRate: rate(fs, (f) => f.bodyWords === 0),
    },
    tone: {
      contractionsPer100: round(contractions, 1),
      emojiPerPost: round(mean(fs.map((f) => f.emojiCount)), 2),
      exclamationsPerPost: round(mean(fs.map((f) => f.exclamations)), 2),
      hashtagsPerPost: round(mean(fs.map((f) => f.hashtags)), 2),
      avgSentenceWords: round(avgSentence, 1),
      register,
      lexicon,
      disclosureRate: rate(fs, (f) => f.disclosure),
    },
    archetypes,
    lifts,
    phrases,
    timing: analyzeTiming(valid.map((p, i) => ({ createdAt: p.createdAt, engagement: fs[i].engagement }))),
    adSmell: {
      median: round(median(adSmells)),
      p75: round(quantile(adSmells, 0.75)),
      correlation: (() => {
        const r = spearman(adSmells, engagements);
        return r === null ? null : round(r, 2);
      })(),
    },
    topPosts,
    flairs: (() => {
      const m = new Map<string, { count: number; showcase: number }>();
      valid.forEach((p, i) => {
        if (!p.flair) return;
        const cur = m.get(p.flair) ?? { count: 0, showcase: 0 };
        cur.count += 1;
        if (fs[i].archetype === "showcase") cur.showcase += 1;
        m.set(p.flair, cur);
      });
      return [...m.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 6)
        .map(([text, v]) => ({ text, count: v.count, showcaseShare: v.showcase / v.count }));
    })(),
    examples: (() => {
      const best = new Map<Archetype, { title: string; e: number }>();
      valid.forEach((p, i) => {
        const f = fs[i];
        if (f.adSmell >= 50) return;
        const cur = best.get(f.archetype);
        const title = p.title || p.body.split("\n")[0];
        if (!cur || f.engagement > cur.e) best.set(f.archetype, { title, e: f.engagement });
      });
      return [...best.entries()].map(([type, v]) => ({ type, title: v.title }));
    })(),
  };
}
