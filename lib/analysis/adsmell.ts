// "광고 냄새" 점수: 글이 커뮤니티 글이 아니라 광고처럼 읽히는 정도를 0~100으로 잰다.
// LLM 없이 돌아가는 규칙 기반 점수라서 편집기에서 글자를 고칠 때마다 바로 다시 계산한다.

import type { AdSmellHit, AdSmellResult, Platform } from "../types";
import { EMOJI_RE, URL_RE, blankPlaceholders, firstLinkIndex, normalizeQuotes, wordCount } from "../text";

type Kind = AdSmellHit["kind"];

interface Pattern {
  re: RegExp;
  kind: Kind;
  weight: number;
  noteKo: string;
  fixKo: string;
}

const FIX = {
  hype: "무엇이 다른지 구체적으로 한 문장으로 바꿔 보세요",
  cta: "가입 권유 대신 피드백을 부탁해 보세요",
  corporate: "'I built…'처럼 1인칭으로 시작해 보세요",
  superlative: "'가장 ~한' 대신 실제로 확인한 사실을 쓰세요",
};

function p(source: string, kind: Kind, weight: number, noteKo: string, fixKo: string): Pattern {
  return { re: new RegExp(source, "gi"), kind, weight, noteKo, fixKo };
}

const PATTERNS: Pattern[] = [
  // 강한 과장
  ...[
    "revolutionar(?:y|ize|izes|izing)",
    "game[- ]?chang(?:er|ers|ing)",
    "groundbreaking",
    "disruptive",
    "unparalleled",
    "unprecedented",
    "world[- ]class",
    "best[- ]in[- ]class",
    "state[- ]of[- ]the[- ]art",
    "look no further",
    "say goodbye to",
    "to the next level",
    "next[- ]level",
    "skyrocket(?:s|ing|ed)?",
    "supercharg(?:e|es|ed|ing)",
    "turbocharg(?:e|es|ed|ing)",
    "10x your",
    "the future of",
    "like never before",
    "must[- ]have",
    "life[- ]changing",
  ].map((s) => p(`\\b${s}\\b`, "hype", 7, "과장 표현", FIX.hype)),
  // 중간 과장
  ...[
    "seamless(?:ly)?",
    "effortless(?:ly)?",
    "cutting[- ]edge",
    "innovative",
    "ultimate",
    "all[- ]in[- ]one",
    "one[- ]stop",
    "unlock(?:s|ing)?",
    "unleash(?:es|ing)?",
    "elevate(?:s|d)? your",
    "empower(?:s|ing)?",
    "transform(?:s|ative)? your",
    "streamline(?:s|d)?",
    "boost your",
    "maximi[sz]e your",
    "blazing(?:ly)?[- ]fast",
    "lightning[- ]fast",
    "powerful",
    "top[- ]notch",
    "incredibl(?:e|y)",
    "stunning",
    "magical",
    "hassle[- ]free",
    "at your fingertips",
  ].map((s) => p(`\\b${s}\\b`, "hype", 4, "광고 형용사", FIX.hype)),
  // 약한 과장
  ...["amazing", "awesome", "perfect", "(?:complete|end-to-end|turnkey) solution", "ai[- ]powered", "leverag(?:e|es|ing)"].map((s) =>
    p(`\\b${s}\\b`, "hype", 2, "흔한 홍보 단어", FIX.hype),
  ),
  // 판매 문구
  p(
    "\\b(?:(?:please|pls) (?:upvote|up-vote)|(?:upvote|up-vote) (?:if|this|please|pls|so)|give (?:it |me |us )?(?:an )?upvote)\\b",
    "cta",
    10,
    "추천 요청",
    "추천을 부탁하면 대부분 규칙 위반이에요. 빼 주세요",
  ),
  p("(?<!\\b(?:no|without|without an?|no need to|don'?t need to|zero|nor)\\s+)\\bsign[- ]?up(?: now| today| for free| here)?\\b(?![- ]?(?:required|needed|wall))", "cta", 6, "가입 권유", FIX.cta),
  p("\\btry it (?:now|today|for free|free)\\b", "cta", 6, "사용 권유", FIX.cta),
  p("\\bget started(?: today| now| for free)?\\b", "cta", 5, "가입 권유", FIX.cta),
  p("\\bdownload (?:it )?(?:now|today)\\b", "cta", 6, "다운로드 권유", FIX.cta),
  p("\\bcheck (?:it|us|this) out\\b", "cta", 4, "구경 권유", "링크를 권하기보다 무엇을 봐 줬으면 하는지 적어 보세요"),
  p("\\bjoin (?:now|today|us|the waitlist|our waitlist)\\b", "cta", 5, "가입 권유", FIX.cta),
  p("\\bdon'?t miss(?: out)?\\b", "cta", 7, "재촉 문구", FIX.cta),
  p("\\blimited[- ]time\\b", "cta", 8, "기간 한정", "할인이나 기간 한정 문구는 커뮤니티에서 바로 광고로 보여요"),
  p("\\bact now\\b|\\bhurry\\b", "cta", 8, "재촉 문구", FIX.cta),
  p("\\buse (?:my |our )?(?:promo )?code\\b|\\bdiscount code\\b|\\b\\d{1,2}% off\\b", "cta", 8, "할인 코드", "할인 코드는 빼고 가격 정보만 담백하게 적어 주세요"),
  p("\\bfree trial\\b|\\bstart your free\\b", "cta", 3, "체험판 권유", "가격 정보는 한 문장으로 담백하게"),
  p("\\bbook a (?:demo|call)\\b", "cta", 7, "영업 문구", FIX.cta),
  p("\\blink in (?:bio|my bio)\\b", "cta", 4, "프로필 링크 유도", "링크가 필요하면 위치만 짧게 알려 주세요"),
  p("\\bclick (?:here|the link|below)\\b", "cta", 6, "클릭 유도", FIX.cta),
  p("\\bvisit (?:our|my) (?:site|website)\\b", "cta", 5, "방문 유도", FIX.cta),
  p("\\bfollow (?:me )?for more\\b|\\bsmash that\\b", "cta", 6, "팔로우 유도", "팔로우 요청은 빼는 게 반응이 좋아요"),
  p("\\bonly \\d+ (?:spots|seats|copies) left\\b|\\bearly[- ]bird\\b", "cta", 7, "희소성 압박", FIX.cta),
  // 보도자료 말투
  p("\\b(?:we'?re|we are|i'?m|i am) (?:so |super )?(?:excited|thrilled|proud|delighted) to (?:announce|introduce|share|launch|present|unveil)\\b", "corporate", 6, "보도자료 말투", FIX.corporate),
  p("\\b(?:excited|thrilled|proud) to (?:announce|introduce|present|launch|unveil)\\b", "corporate", 5, "보도자료 말투", FIX.corporate),
  p("(?<=^[^\\w\\n]{0,8}|[.!?]\\s+|\\n)introducing\\b", "corporate", 5, "출시 발표 말투", FIX.corporate),
  p("(?<=^[^\\w\\n]{0,8}|[.!?]\\s+|\\n)meet [A-Z][\\w-]*\\s*[:,—–-]", "corporate", 5, "출시 발표 말투", FIX.corporate),
  p("\\bour (?:platform|solution|product|mission|customers|users love)\\b", "corporate", 4, "회사 말투", "'our platform' 대신 'it'이나 'the tool'처럼 가볍게"),
  p("\\bleading (?:provider|platform)\\b|\\btrusted by\\b", "corporate", 6, "회사 소개서 말투", FIX.corporate),
  // 최상급
  p("\\bthe (?:best|fastest|easiest|cheapest|simplest|smartest)\\b", "superlative", 3, "최상급 표현", FIX.superlative),
  p("#1\\b|\\bnumber one\\b|\\bthe only (?:tool|app|platform|solution)\\b|\\bmost powerful\\b|\\bworld'?s first\\b|\\bfirst[- ]ever\\b", "superlative", 4, "최상급 주장", FIX.superlative),
];

const LAUNCH_EMOJI = new Set(["🚀", "🔥", "✨", "💯", "⚡", "🎉", "👉", "✅", "💥", "🤯", "😱", "🙌", "📈", "💰", "🤑", "⭐", "🌟"]);

const CAPS_WHITELIST = new Set(
  "HTML HTTP HTTPS JSON YAML REST CRUD AWS GCP SQL NOSQL UUID CORS OAUTH MRR ARR LTV CAC MVP PMF ICP GPT LLM LLMS ASAP FAQ PWA SDK CLI IDE CSS NPM RSS PDF CSV OCR SEO B2B B2C USA EDIT UPDATE TLDR PSA ELI5 YMMV IIRC AFAIK IMHO LMAO SAAS API APIS GPU CPU RAM SSD URL URLS DIY ETA EOD AMA TIL NSFW OSS GDPR HIPAA SOC2 UTC JSX TSX WASM IOS MACOS RFC VPN DNS SSH SMTP IMAP README OPML LICENSE TODO NOTE WCAG EXIF AGPL LGPL ARIA HTMX NAND SQLITE POSTGRES MYSQL MONGODB GRAPHQL OPENAPI KUBERNETES DOCKER LINUX UBUNTU WEBGL WEBGPU UNICODE ASCII JPEG HDMI CMYK SVG PNG GIF MP4 PDFS CSVS CRDT CRDTS OAUTH2 SAML LDAP OIDC NFT NFTS DAO WYSIWYG".split(
    " ",
  ),
);

const SHOUT_WORDS = new Set(
  "FREE NOW TODAY HUGE BEST NEW WOW AMAZING INSANE LIMITED OFFER SALE MUST NEVER EVER EVERYONE ATTENTION ALERT BREAKING LAUNCH LAUNCHING LAUNCHED BIG FAST CRAZY EPIC GAME BONUS DEAL HURRY LAST CHANCE EXCLUSIVE".split(" "),
);

const GOOD_ASK =
  /\b(?:what do you think|would love (?:your |some |any )?(?:feedback|thoughts|input|opinions?)|i'?d love (?:your |some |any )?(?:feedback|thoughts|input)|any (?:feedback|thoughts|suggestions)|curious (?:what|how|if|whether)|i'?d (?:really )?appreciate|open to (?:feedback|suggestions|criticism)|roast (?:it|my)|be (?:brutally )?honest|what am i missing|how do you (?:handle|deal|do))\b/i;
const PERSONAL =
  /\b(?:i spent|i was|i've been|i have been|i got tired|i kept|i struggled|i failed|i learned|i realized|i wasted|my (?:wife|partner|friend|day job|kid|cofounder|co-founder|boss)|(?:years|months|weeks) ago|on weekends|at night|mistakes? i)\b/gi;
export const DISCLOSURE_RE =
  /\b(?:i built|i made|i'?ve built|i'?ve been building|i'?m building|i created|i wrote|i'?m the (?:developer|dev|founder|maker|creator|author)|full disclosure|disclaimer: i|disclosure: i|i work on|my own (?:app|tool|project)|my (?:side )?project|solo dev(?:eloper)? (?:behind|here)|building [\w.-]+ in public|(?:maker|developer|founder|dev) here)\b/i;

interface RawHit extends AdSmellHit {
  group: string;
}

function scanField(text: string, field: "title" | "body", platform: Platform): RawHit[] {
  const hits: RawHit[] = [];
  const src = normalizeQuotes(text);

  for (const pat of PATTERNS) {
    pat.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pat.re.exec(src))) {
      let start = m.index;
      let matched = m[0];
      // 앞쪽 구분자(문장 끝, 줄바꿈)는 하이라이트에서 뺀다
      const lead = matched.match(/^(?:[.!?]\s+|\n)/);
      if (lead) {
        start += lead[0].length;
        matched = matched.slice(lead[0].length);
      }
      hits.push({
        field,
        start,
        end: start + matched.length,
        text: matched,
        kind: pat.kind,
        weight: pat.weight,
        noteKo: pat.noteKo,
        fixKo: pat.fixKo,
        group: pat.kind,
      });
      if (m[0].length === 0) pat.re.lastIndex++;
    }
  }

  // 이모지
  for (const m of src.matchAll(EMOJI_RE)) {
    const e = m[0];
    const launch = LAUNCH_EMOJI.has(e);
    if (platform === "x" && !launch) continue; // X에서는 일반 이모지는 문제 삼지 않는다
    hits.push({
      field,
      start: m.index ?? 0,
      end: (m.index ?? 0) + e.length,
      text: e,
      kind: "emoji",
      weight: launch ? 3 : 1,
      noteKo: launch ? "런칭 이모지" : "이모지",
      fixKo: "커뮤니티 상위글은 이모지를 거의 안 써요. 빼 보세요",
      group: "emoji",
    });
  }

  // 느낌표: 첫 번째는 봐준다
  const bangs = [...src.matchAll(/!+/g)];
  bangs.forEach((m, i) => {
    const run = m[0].length;
    const w = (i === 0 ? 0 : 2) + (run >= 2 ? 3 : 0);
    if (w === 0) return;
    hits.push({
      field,
      start: m.index ?? 0,
      end: (m.index ?? 0) + run,
      text: m[0],
      kind: "exclaim",
      weight: w,
      noteKo: run >= 2 ? "느낌표 연타" : "느낌표 과다",
      fixKo: "느낌표는 글 전체에서 한 개 이하로",
      group: "exclaim",
    });
  });

  // 대문자 강조: 외치는 단어 목록이거나, 6자 이상 대문자 단어(약어는 대개 5자 이하)
  for (const m of src.matchAll(/\b[A-Z]{3,}\b/g)) {
    if (CAPS_WHITELIST.has(m[0])) continue;
    if (!SHOUT_WORDS.has(m[0]) && m[0].length < 6) continue;
    hits.push({
      field,
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
      text: m[0],
      kind: "caps",
      weight: 3,
      noteKo: "대문자 강조",
      fixKo: "소리치는 느낌이 나요. 소문자로 바꿔 보세요",
      group: "caps",
    });
  }

  // 해시태그
  const tags = [...src.matchAll(/(?<![\w&/])#[A-Za-z][\w]{1,40}/g)];
  tags.forEach((m, i) => {
    if (platform === "x" && i < 2) return;
    hits.push({
      field,
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
      text: m[0],
      kind: "hashtag",
      weight: platform === "x" ? 3 : 3,
      noteKo: platform === "x" ? "해시태그 과다" : "해시태그",
      fixKo: platform === "x" ? "해시태그는 1~2개면 충분해요" : "Reddit과 HN에서는 해시태그를 쓰지 않아요",
      group: "hashtag",
    });
  });

  // 링크
  if (field === "body" || platform === "x") {
    const first = firstLinkIndex(src);
    const urls = [...src.matchAll(new RegExp(URL_RE.source, "gi"))];
    if (first >= 0 && first < 80 && src.length > 120) {
      const len = (src.slice(first).match(/^\S+/)?.[0] ?? "").length;
      hits.push({
        field,
        start: first,
        end: first + len,
        text: src.slice(first, first + len),
        kind: "link",
        weight: 8,
        noteKo: "첫머리 링크",
        fixKo: "링크를 먼저 내밀면 광고로 보여요. 본문 끝이나 첫 댓글로 옮기세요",
        group: "link",
      });
    }
    urls.forEach((m, i) => {
      const u = m[0];
      const start = m.index ?? 0;
      if (/[?&]utm_|bit\.ly|tinyurl|t\.co\/|ref=/i.test(u)) {
        hits.push({
          field,
          start,
          end: start + u.length,
          text: u,
          kind: "link",
          weight: 4,
          noteKo: "추적 링크",
          fixKo: "utm 꼬리표나 단축 링크는 빼고 원래 주소를 쓰세요",
          group: "link",
        });
      } else if (i >= 1) {
        hits.push({
          field,
          start,
          end: start + u.length,
          text: u,
          kind: "link",
          weight: 4,
          noteKo: "링크 여러 개",
          fixKo: "링크는 하나면 충분해요",
          group: "link",
        });
      }
    });
  }

  return hits;
}

const GROUP_CAP: Record<string, number> = { emoji: 12, exclaim: 10, caps: 9, hashtag: 9, link: 16 };

function dedupe(hits: RawHit[]): RawHit[] {
  const sorted = [...hits].sort((a, b) => b.weight - a.weight || a.start - b.start);
  const kept: RawHit[] = [];
  for (const h of sorted) {
    if (kept.some((k) => k.field === h.field && h.start < k.end && k.start < h.end)) continue;
    kept.push(h);
  }
  return kept.sort((a, b) => (a.field === b.field ? a.start - b.start : a.field === "title" ? -1 : 1));
}

export function bandOf(score: number): AdSmellResult["band"] {
  if (score < 25) return "native";
  if (score < 50) return "light";
  if (score < 75) return "promo";
  return "danger";
}

export const BAND_KO: Record<AdSmellResult["band"], string> = {
  native: "현지인 같음",
  light: "살짝 홍보 티",
  promo: "광고 냄새",
  danger: "삭제 위험",
};

export function scoreAdSmell(input: { title?: string; body: string; platform: Platform }): AdSmellResult {
  // [직접 채울 칸]은 점수에서 뺀다 (위치는 유지)
  const title = blankPlaceholders(input.title ?? "");
  const body = blankPlaceholders(input.body ?? "");
  const hits = dedupe([...scanField(title, "title", input.platform), ...scanField(body, "body", input.platform)]);

  const byGroup = new Map<string, number>();
  for (const h of hits) byGroup.set(h.group, (byGroup.get(h.group) ?? 0) + h.weight);
  let positive = 0;
  for (const [g, w] of byGroup) positive += Math.min(w, GROUP_CAP[g] ?? Infinity);

  const all = normalizeQuotes(`${title}\n${body}`);
  const good: string[] = [];
  let negative = 0;
  const hasQuestion = /\?/.test(all);
  if (hasQuestion) {
    negative += 5;
    good.push("읽는 사람에게 질문함");
  }
  if (GOOD_ASK.test(all)) {
    negative += 5;
    good.push("피드백을 구체적으로 부탁함");
  }
  const personal = Math.min(3, [...all.matchAll(PERSONAL)].length);
  if (personal > 0) {
    negative += personal * 3;
    good.push("직접 겪은 이야기가 있음");
  }
  if (DISCLOSURE_RE.test(all)) {
    negative += 5;
    good.push("직접 만든 사람이라고 밝힘");
  }
  const numbers = Math.min(4, (all.replace(URL_RE, " ").match(/\b\d+(?:[.,]\d+)?\b/g) ?? []).length);
  if (numbers > 0) {
    negative += numbers;
    good.push("구체적인 숫자가 있음");
  }
  negative = Math.min(negative, 22);

  const lengthFactor = Math.max(1, Math.sqrt(wordCount(all) / 120));
  const raw = positive / lengthFactor - negative;
  const score = Math.round(100 * (1 - Math.exp(-Math.max(0, raw) / 16)));

  return {
    score,
    band: bandOf(score),
    hits: hits.map((h) => ({
      field: h.field,
      start: h.start,
      end: h.end,
      text: h.text,
      kind: h.kind,
      weight: h.weight,
      noteKo: h.noteKo,
      fixKo: h.fixKo,
    })),
    goodSignalsKo: good,
  };
}
