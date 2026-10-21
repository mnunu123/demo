// 템플릿 문장을 자연스럽게 잇기 위한 작은 영어 도우미들

const BASE_VERBS = new Set(
  (
    "turn make build create get track find write generate automate manage save send plan learn ship launch design convert organize " +
    "monitor analyze analyse share collect schedule edit record translate help check measure compare summarize summarise draft keep " +
    "show let give bring connect sync publish post search sort filter clean fix catch spot detect protect block remove replace store " +
    "back run test deploy host scan read watch notify remind book order sell buy pay invoice price chart map visualize visualise turn"
  ).split(/\s+/),
);

const IRREGULAR_3RD: Record<string, string> = { have: "has", do: "does", go: "goes", be: "is" };

export function lcFirst(s: string): string {
  if (!s) return s;
  const first = s.split(/\s+/)[0];
  // 약어나 고유명사(GitHub, AI)는 그대로
  if (/^[A-Z0-9]{2,}/.test(first) || /[a-z][A-Z]/.test(first)) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export function ucFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function stripEndPunct(s: string): string {
  return s.trim().replace(/[.!。]+$/, "");
}

export function thirdPerson(verb: string): string {
  const v = verb.toLowerCase();
  if (IRREGULAR_3RD[v]) return IRREGULAR_3RD[v];
  if (/(s|sh|ch|x|z|o)$/.test(v)) return `${v}es`;
  if (/[^aeiou]y$/.test(v)) return `${v.slice(0, -1)}ies`;
  return `${v}s`;
}

export function article(phrase: string): string {
  const w = phrase.trim().split(/\s+/)[0] ?? "";
  if (/^(a|an|the|my|our|your|this|one)$/i.test(w)) return "";
  if (/^(uni|use|usa|euro|one)/i.test(w)) return "a";
  if (/^(hour|honest)/i.test(w)) return "an";
  if (/^[A-Z]{2,}/.test(w)) return /^[AEFHILMNORSX]/.test(w) ? "an" : "a";
  return /^[aeiou]/i.test(w) ? "an" : "a";
}

export function withArticle(phrase: string): string {
  const a = article(phrase);
  return a ? `${a} ${phrase}` : phrase;
}

/** 한 줄 소개에서 "무엇을 하는지" 동사구를 뽑는다.
 *  "Turns your commits into notes" → { verbPhrase: "turns your commits into notes" }
 *  "AI changelog generator for devs" → { nounPhrase: "AI changelog generator for devs" } */
export function parseOneLiner(oneLiner: string, name: string): { verbPhrase?: string; nounPhrase?: string } {
  let s = stripEndPunct(oneLiner);
  const nameRe = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?:is\\s+|[:–—-]\\s*)?`, "i");
  s = s.replace(nameRe, "");
  const words = s.split(/\s+/);
  const first = (words[0] ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (BASE_VERBS.has(first)) {
    return { verbPhrase: [thirdPerson(first), ...words.slice(1)].join(" ") };
  }
  if (first.endsWith("s") && (BASE_VERBS.has(first.slice(0, -1)) || BASE_VERBS.has(first.slice(0, -2)) || BASE_VERBS.has(first.replace(/ies$/, "y")))) {
    return { verbPhrase: lcFirst(s) };
  }
  if (/^(a|an|the)\s/i.test(s)) return { nounPhrase: lcFirst(s).replace(/^(a|an|the)\s/i, "") };
  return { nounPhrase: s };
}

/** "It turns your commits into notes." 형태의 문장 */
export function itSentence(oneLiner: string, name: string): string {
  const { verbPhrase, nounPhrase } = parseOneLiner(oneLiner, name);
  if (verbPhrase) return `It ${verbPhrase}.`;
  return `It's ${withArticle(lcFirst(nounPhrase ?? oneLiner))}.`;
}

// 잘라도 뜻이 남는 곳(꾸밈말이 시작되는 곳)에서만 자른다. into/to/from처럼 목적어를 잇는 말 앞에서는 자르지 않는다.
const BOUNDARY = new Set(["for", "with", "without", "so", "that", "which", "who", "people", "users", "everyone", "by", "using", "via", "—", "–", "-", "while", "when", "across", "in"]);

/** 동사구를 의미 단위로 잘라 여러 길이 후보를 만든다 (제목 길이 맞추기용) */
export function phraseCuts(phrase: string): string[] {
  const ws = phrase.split(/\s+/).filter(Boolean);
  const cuts: string[] = [];
  for (let i = 2; i < ws.length; i++) {
    if (BOUNDARY.has(ws[i].toLowerCase().replace(/[^a-z—–-]/g, ""))) cuts.push(ws.slice(0, i).join(" ").replace(/[,;:]$/, ""));
  }
  cuts.push(ws.join(" "));
  return [...new Set(cuts)];
}

/** 불편 문장을 "~ing" 구로. "writing notes by hand" 그대로, "Messy notes" → "dealing with messy notes" */
export function painGerund(pain: string): string {
  const p = lcFirst(stripEndPunct(pain));
  const first = p.split(/\s+/)[0] ?? "";
  if (/ing$/.test(first) && first.length > 4) return p;
  return `dealing with ${p}`;
}

/** 제목 후보 중 목표 길이에 가장 가까운 것 */
export function pickByLength(candidates: string[], target: number, max: number): string {
  const ok = candidates.filter((c) => c.length <= max);
  const pool = ok.length ? ok : candidates;
  return [...pool].sort((a, b) => Math.abs(a.length - target) - Math.abs(b.length - target))[0];
}

export function categoryNoun(category: string): string {
  const c = category.toLowerCase();
  if (/extension|browser/.test(c)) return "browser extension";
  if (/game/.test(c)) return "game";
  if (/mobile|ios|android/.test(c)) return "app";
  if (/cli|command/.test(c)) return "CLI";
  if (/library|sdk|package/.test(c)) return "library";
  if (/site|web/.test(c) && !/tool/.test(c)) return "site";
  if (/app|productivity|finance|health|education|notes/.test(c)) return "app";
  return "tool";
}
