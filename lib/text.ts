// 텍스트 처리 공통 함수와 사전. 전부 결정적(같은 입력 → 같은 출력)이라 테스트하기 쉽다.

import type { TitleCase } from "./types";

export const EMOJI_RE = /\p{Extended_Pictographic}/gu;
export const URL_RE = /\bhttps?:\/\/[^\s)<>\]]+/gi;
const BARE_DOMAIN_RE = /\b[a-z0-9-]+\.(?:com|io|app|dev|ai|co|so|xyz|net|org|me|sh|gg|tech|tools)\b(?:\/[^\s)]*)?/gi;

export function normalizeQuotes(s: string): string {
  return s.replace(/[\u2018\u2019\u02bc]/g, "'").replace(/[\u201c\u201d]/g, '"');
}

export function countMatches(s: string, re: RegExp): number {
  const m = s.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"));
  return m ? m.length : 0;
}

export function words(s: string): string[] {
  return normalizeQuotes(s)
    .replace(URL_RE, " ")
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9'+#.-]*[a-z0-9+#]|[a-z0-9]/g) ?? [];
}

export function wordCount(s: string): number {
  return words(s).length;
}

export function sentences(s: string): string[] {
  return normalizeQuotes(s)
    .replace(URL_RE, "link")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((x) => x.trim())
    .filter((x) => /[a-zA-Z]/.test(x));
}

export function paragraphs(s: string): string[] {
  return s
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function countLinks(s: string): number {
  const full = countMatches(s, URL_RE);
  const bare = countMatches(s.replace(URL_RE, " "), BARE_DOMAIN_RE);
  return full + bare;
}

export function firstLinkIndex(s: string): number {
  const a = s.search(URL_RE);
  const b = s.search(BARE_DOMAIN_RE);
  if (a < 0) return b;
  if (b < 0) return a;
  return Math.min(a, b);
}

/** 제목 앞의 "Show HN:", "[Feedback]" 같은 꼬리표를 떼고 본문만 남긴다 */
export function stripTitleTags(title: string): string {
  return title
    .replace(/^\s*(show|ask|tell|launch)\s+hn\s*:\s*/i, "")
    .replace(/^\s*(\[[^\]]{1,30}\]|\([^)]{1,30}\))\s*/g, "")
    .trim();
}

const ACRONYM_RE = /^[A-Z0-9]{2,6}s?$/;
const SMALL_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "for", "nor", "on", "at", "to", "by", "of", "in", "up",
  "as", "is", "it", "vs", "via", "with", "from", "into", "my", "your", "i",
]);

/** 제목 대소문자 스타일 판별 */
export function detectTitleCase(rawTitle: string): TitleCase {
  const title = stripTitleTags(normalizeQuotes(rawTitle));
  const tokens = title.split(/\s+/).filter((t) => /[A-Za-z]/.test(t));
  if (tokens.length === 0) return "mixed";
  const letters = title.replace(/[^A-Za-z]/g, "");
  const upperShare = letters.replace(/[^A-Z]/g, "").length / Math.max(1, letters.length);
  if (tokens.length >= 3 && upperShare > 0.8) return "upper";

  const clean = (t: string) => t.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9']+$/g, "");
  // "$0 to $4k MRR..."처럼 숫자·기호로 시작하면 첫 글자 규칙을 적용하지 않는다
  const startsWithLetter = /^[^A-Za-z0-9$#@]*[A-Za-z]/.test(title.trim());
  const first = startsWithLetter ? clean(tokens[0]) : "X";
  const rest = (startsWithLetter ? tokens.slice(1) : tokens).map(clean).filter(Boolean);
  // 고유명사·약어·혼합 대소문자(GitHub)는 판별에서 뺀다
  const judged = rest.filter((t) => !ACRONYM_RE.test(t) && !/[a-z][A-Z]/.test(t) && t !== "I" && !/^I'/.test(t));
  const capRest = judged.filter((t) => /^[A-Z]/.test(t));
  const bigWords = judged.filter((t) => !SMALL_WORDS.has(t.toLowerCase()));
  const capBig = bigWords.filter((t) => /^[A-Z]/.test(t));

  if (/^[a-z]/.test(first) && capRest.length / Math.max(1, judged.length) <= 0.15) return "lower";
  if (bigWords.length >= 2 && capBig.length / bigWords.length >= 0.75) return "title";
  if (/^[A-Z0-9]/.test(first) && capRest.length / Math.max(1, judged.length) <= 0.34) return "sentence";
  if (judged.length === 0) return /^[a-z]/.test(first) ? "lower" : "sentence";
  return "mixed";
}

export const TITLE_CASE_KO: Record<TitleCase, string> = {
  sentence: "첫 글자만 대문자",
  title: "단어마다 대문자",
  lower: "전부 소문자",
  upper: "전부 대문자",
  mixed: "섞여 있음",
};

/** 제목에 대소문자 스타일 적용. 제품 이름과 약어는 그대로 둔다 */
export function applyTitleCase(title: string, style: TitleCase, keep: string[] = []): string {
  const keepSet = new Set(keep.map((k) => k.toLowerCase()));
  const parts = title.split(/(\s+)/);
  let wordIndex = 0;
  return parts
    .map((part) => {
      if (/^\s+$/.test(part) || !/[A-Za-z]/.test(part)) return part;
      const idx = wordIndex++;
      const bare = part.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
      if (keepSet.has(bare.toLowerCase()) || ACRONYM_RE.test(bare) || /[a-z][A-Z]/.test(bare)) return part;
      if (bare === "I" || /^I'/.test(bare)) return style === "lower" ? part.replace(/^I/, "i") : part;
      const lower = part.toLowerCase();
      const cap = lower.replace(/[a-z]/, (c) => c.toUpperCase());
      switch (style) {
        case "lower":
          return lower;
        case "title":
          return idx > 0 && SMALL_WORDS.has(bare.toLowerCase()) ? lower : cap;
        case "upper":
          return part.toUpperCase();
        case "sentence":
        case "mixed":
        default:
          return idx === 0 ? cap : lower;
      }
    })
    .join("");
}

const CONTRACTION_RE =
  /\b(i'm|i've|i'd|i'll|you're|you've|you'd|you'll|we're|we've|we'd|we'll|they're|they've|they'd|they'll|it's|that's|there's|here's|what's|who's|how's|let's|isn't|aren't|wasn't|weren't|don't|doesn't|didn't|can't|couldn't|won't|wouldn't|shouldn't|haven't|hasn't|hadn't|ain't|y'all|gonna|wanna|gotta|kinda|sorta)\b/gi;

export function contractionsPer100(s: string): number {
  const n = wordCount(s);
  if (n === 0) return 0;
  return (countMatches(normalizeQuotes(s), CONTRACTION_RE) / n) * 100;
}

/** 현지 말투·용어 사전 (용어 → 한국어 풀이) */
export const LEXICON: { term: string; re: RegExp; glossKo: string }[] = [
  ["tbh", "솔직히"],
  ["ngl", "솔직히 말하면"],
  ["imo", "내 생각엔"],
  ["imho", "조심스럽게 내 생각엔"],
  ["fwiw", "참고로 말하자면"],
  ["iirc", "기억이 맞다면"],
  ["afaik", "내가 알기로는"],
  ["tl;dr", "요약하면"],
  ["tldr", "요약하면"],
  ["lol", "ㅋㅋ"],
  ["lmao", "빵 터짐"],
  ["idk", "잘 모르겠음"],
  ["ymmv", "사람마다 다를 수 있음"],
  ["til", "오늘 처음 안 사실"],
  ["psa", "다들 알아 두세요"],
  ["kinda", "좀, 약간"],
  ["gonna", "~할 거예요"],
  ["wanna", "~하고 싶어요"],
  ["y'all", "여러분"],
  ["legit", "진짜로, 제대로"],
  ["lowkey", "은근히"],
  ["rabbit hole", "한번 빠지면 끝없는 주제"],
  ["hot take", "논쟁이 될 만한 의견"],
  ["unpopular opinion", "반대가 많을 의견"],
  ["am i the only one", "나만 그런가요"],
  ["rant", "하소연"],
  ["roast", "가차 없이 평가해 달라는 말"],
  ["brutally honest", "아주 솔직한 평가"],
  ["mrr", "월 반복 매출"],
  ["arr", "연 반복 매출"],
  ["churn", "구독 이탈"],
  ["bootstrapped", "외부 투자 없이 운영"],
  ["side project", "사이드 프로젝트"],
  ["build in public", "만드는 과정을 공개하기"],
  ["#buildinpublic", "만드는 과정 공개 해시태그"],
  ["indie hacker", "1인 또는 소규모 창업자"],
  ["indie hackers", "1인 또는 소규모 창업자들"],
  ["dogfooding", "자기 제품을 직접 써 보기"],
  ["shipped", "출시했다"],
  ["mvp", "최소 기능 제품"],
  ["pmf", "시장 적합성"],
  ["product-market fit", "시장 적합성"],
  ["icp", "이상적인 고객 유형"],
  ["cac", "고객 한 명 데려오는 비용"],
  ["ltv", "고객 한 명이 남기는 총매출"],
  ["waitlist", "대기자 명단"],
  ["open source", "오픈소스"],
  ["open-source", "오픈소스"],
  ["self-hosted", "직접 서버에 설치해서 쓰는"],
  ["yak shaving", "본론 전에 딴 일에 빠지기"],
  ["footgun", "실수하기 쉬운 기능"],
  ["solo dev", "1인 개발자"],
  ["solo founder", "1인 창업자"],
  ["weekend project", "주말에 만든 프로젝트"],
  ["first paying customer", "첫 유료 고객"],
  ["ramen profitable", "생활비 정도는 버는 단계"],
  ["landing page", "랜딩 페이지"],
  ["cold email", "모르는 사람에게 보내는 영업 메일"],
  ["🧵", "스레드가 이어진다는 표시"],
].map(([term, glossKo]) => ({
  term,
  glossKo,
  re: new RegExp(
    term === "🧵"
      ? "🧵"
      : `(?<![\\w#])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+")}(?![\\w])`,
    "gi",
  ),
}));

export function lexiconHits(s: string): string[] {
  const text = normalizeQuotes(s);
  const found: string[] = [];
  for (const entry of LEXICON) {
    entry.re.lastIndex = 0;
    if (entry.re.test(text)) found.push(entry.term);
  }
  return found;
}

export const STOPWORDS = new Set(
  (
    "a about above after again against all am an and any are aren't as at be because been before being below between both but by " +
    "can can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has hasn't " +
    "have haven't having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm i've if in into is isn't " +
    "it it's its itself just let's me more most mustn't my myself no nor not of off on once only or other ought our ours ourselves out over " +
    "own same shan't she she'd she'll she's should shouldn't so some such than that that's the their theirs them themselves then there " +
    "there's these they they'd they'll they're they've this those through to too under until up very was wasn't we we'd we'll we're we've " +
    "were weren't what what's when when's where where's which while who who's whom why why's with won't would wouldn't you you'd you'll " +
    "you're you've your yours yourself yourselves also really get got one like now still even much many lot way thing things any every " +
    "will can just make made use using used new want need know think going go week day time"
  ).split(/\s+/),
);

/** 의미 있는 2~3단어 구절 뽑기 */
export function ngrams(s: string, n: number): string[] {
  const ws = words(s).filter((w) => !/^\d+$/.test(w));
  const out: string[] = [];
  for (let i = 0; i + n <= ws.length; i++) {
    const gram = ws.slice(i, i + n);
    if (STOPWORDS.has(gram[0]) || STOPWORDS.has(gram[n - 1])) continue;
    if (gram.filter((g) => !STOPWORDS.has(g)).length < Math.min(2, n)) continue;
    if (gram.some((g) => g.length < 2)) continue;
    out.push(gram.join(" "));
  }
  return out;
}

export function median(xs: number[]): number {
  return quantile(xs, 0.5);
}

export function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function ranks(xs: number[]): number[] {
  const idx = xs.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

/** 스피어만 순위 상관계수. 표본이 적거나 값이 모두 같으면 null */
export function spearman(a: number[], b: number[]): number | null {
  if (a.length !== b.length || a.length < 8) return null;
  const ra = ranks(a);
  const rb = ranks(b);
  const ma = mean(ra);
  const mb = mean(rb);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < ra.length; i++) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  if (da === 0 || db === 0) return null;
  return num / Math.sqrt(da * db);
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function round(n: number, digits = 0): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function truncateWords(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  const cut = s.slice(0, maxChars + 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > maxChars * 0.5 ? cut.slice(0, lastSpace) : cut.slice(0, maxChars)).replace(/[\s,;:–-]+$/, "");
}

/** [직접 채울 칸]. 마크다운 링크 [글](주소)는 제외 */
export const PLACEHOLDER_RE = /\[(?!\s*\])[^\]\n]{2,90}\](?!\()/g;

/** 채울 칸을 같은 길이의 공백으로 바꾼다 (위치는 그대로 두고 점수 계산에서만 뺀다) */
export function blankPlaceholders(s: string): string {
  return s.replace(new RegExp(PLACEHOLDER_RE.source, "g"), (m) => " ".repeat(m.length));
}

export function hasHangul(s: string): boolean {
  return /[\u3131-\u318e\uac00-\ud7a3]/.test(s);
}
