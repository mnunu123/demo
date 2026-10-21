// 제품 URL → 페이지 내용 추출 → 제품 프로필(규칙 기반). LLM이 있으면 추출한 내용으로 더 정확히 만든다.

import * as cheerio from "cheerio";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { ProductProfile, ProductStage } from "../types";
import { STOPWORDS, hasHangul, truncateWords, words } from "../text";

export interface PageExtract {
  url: string;
  finalUrl: string;
  title: string;
  description: string;
  siteName: string;
  headings: string[];
  bullets: string[];
  paragraphs: string[];
  text: string;
  lang: string;
}

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly messageKo: string,
  ) {
    super(message);
  }
}

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("::ffff:127.") || v6.startsWith("::ffff:10.") || v6.startsWith("::ffff:192.168.");
}

/** 서버가 내부망을 대신 열어 주는 일(SSRF)을 막는다. 리다이렉트마다 다시 검사한다. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    throw new FetchError("invalid url", "URL 형식이 올바르지 않아요. https://로 시작하는 주소를 넣어 주세요.");
  }
  if (!/^https?:$/.test(u.protocol)) throw new FetchError("bad protocol", "http 또는 https 주소만 열 수 있어요.");
  if (u.username || u.password) throw new FetchError("credentials", "주소에 아이디나 비밀번호가 들어 있으면 열지 않아요.");
  if (u.port && !["80", "443", "8080", "8443"].includes(u.port)) throw new FetchError("port", "일반 웹 포트가 아닌 주소는 열지 않아요.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) throw new FetchError("private host", "내부 주소는 열 수 없어요.");
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new FetchError("private ip", "내부 IP 주소는 열 수 없어요.");
  } else {
    try {
      const addrs = await lookup(host, { all: true });
      if (addrs.some((a) => isPrivateIp(a.address))) throw new FetchError("private dns", "내부망으로 연결되는 주소는 열 수 없어요.");
    } catch (e) {
      if (e instanceof FetchError) throw e;
      throw new FetchError("dns", "주소를 찾을 수 없어요. 철자를 확인해 주세요.");
    }
  }
  return u;
}

const MAX_BYTES = 1_500_000;

// 광고·추적용 꼬리표. 초안에 들어갈 제품 링크에서 뺀다 (utm 같은 꼬리표는 광고 냄새로 잡힌다)
const TRACKING_PARAM = /^(utm_\w+|napm|fbclid|gclid|gbraid|wbraid|yclid|msclkid|igshid|mc_cid|mc_eid|_ga|_gl|ref|ref_src|site_preference|nacn|n_media|n_query|n_rank|n_ad_group|n_ad|n_campaign_type|n_keyword_id|n_keyword|n_ad_group_type|n_match)$/i;

/** 제품 링크에서 추적용 꼬리표를 지운다. 해석이 안 되면 그대로 돌려준다 */
export function cleanProductUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    for (const key of [...u.searchParams.keys()]) if (TRACKING_PARAM.test(key)) u.searchParams.delete(key);
    u.hash = "";
    return u.toString().replace(/\?$/, "");
  } catch {
    return trimmed;
  }
}

/** 응답 코드별로 무슨 일인지와 다음에 할 일을 알려 준다 */
export function statusMessageKo(status: number, host: string): string {
  const site = host.replace(/^(www|m)\./, "");
  const shop = /(^|\.)(smartstore\.naver\.com|brand\.naver\.com|shopping\.naver\.com|coupang\.com)$/.test(site);
  if (status === 429)
    return shop
      ? `${site}가 서버에서 오는 접속을 막았어요(429). 네이버 스마트스토어처럼 봇 차단이 강한 쇼핑몰은 서버가 페이지를 읽을 수 없어요. 아래에 제품 설명을 직접 넣어 주세요.`
      : `${site}가 접속을 막았어요(429, 요청이 너무 많다는 응답). 처음 요청부터 이러면 서버에서 오는 봇 접속을 막는 사이트예요. 아래에 제품 설명을 직접 넣어 주세요.`;
  if (status === 401 || status === 403)
    return `${site}가 접속을 거부했어요(${status}). 로그인이 필요하거나 봇 접속을 막는 페이지예요. 아래에 제품 설명을 직접 넣어 주세요.`;
  if (status === 404 || status === 410) return `페이지를 찾을 수 없어요(${status}). 주소를 다시 확인하거나 제품 설명을 직접 넣어 주세요.`;
  if (status >= 500) return `${site} 서버가 오류를 냈어요(${status}). 잠시 뒤 다시 시도하거나 제품 설명을 직접 넣어 주세요.`;
  return `페이지가 ${status} 응답을 돌려줬어요. 제품 설명을 직접 넣어 주세요.`;
}

export async function fetchPage(rawUrl: string, timeoutMs = 8000): Promise<{ html: string; finalUrl: string }> {
  let current = await assertPublicUrl(rawUrl);
  for (let hop = 0; hop < 4; hop++) {
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; LurkBot/0.1; +https://github.com/mnunu123/demo)",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en-US,en;q=0.9,ko;q=0.8",
        },
      });
    } catch {
      throw new FetchError("network", "페이지를 열지 못했어요. 사이트가 봇 접속을 막았거나 응답이 너무 느려요.");
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) break;
      current = await assertPublicUrl(new URL(loc, current).toString());
      continue;
    }
    if (!res.ok) throw new FetchError(`status ${res.status}`, statusMessageKo(res.status, current.hostname));
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/.test(type)) throw new FetchError("not html", "HTML 페이지가 아니에요.");
    const reader = res.body?.getReader();
    if (!reader) throw new FetchError("no body", "페이지 내용이 비어 있어요.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    const html = new TextDecoder("utf-8").decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
    return { html, finalUrl: current.toString() };
  }
  throw new FetchError("redirects", "리다이렉트가 너무 많아요.");
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

const NAV_LABEL =
  /^(privacy( policy)?|terms( of (service|use))?|cookies?( policy| settings)?|log ?in|sign ?in|sign ?up|get started|contact( us)?|about( us)?|blog|careers|jobs|pricing|docs|documentation|status|support|help|home|press|legal|changelog|faq|community|enterprise|resources|solutions|products?|features|customers)$/i;

const BLOCK_TAGS = new Set([
  "p", "div", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "br", "section", "article", "header", "footer",
  "nav", "main", "aside", "td", "th", "tr", "table", "dd", "dt", "dl", "blockquote", "figcaption", "button", "label",
]);

interface DomNode {
  type: string;
  name?: string;
  data?: string;
  children?: DomNode[];
}

/** 요소 안의 글자를 문서 순서대로 모은다. 블록 요소 경계에만 공백을 넣어서 메뉴 글자가 한 덩어리로 붙지 않게 한다 */
function spacedText(_$: cheerio.CheerioAPI, el: unknown): string {
  const parts: string[] = [];
  const walk = (node: DomNode) => {
    if (node.type === "text") {
      parts.push(node.data ?? "");
      return;
    }
    const block = node.name ? BLOCK_TAGS.has(node.name) : false;
    if (block) parts.push(" ");
    for (const c of node.children ?? []) walk(c);
    if (block) parts.push(" ");
  };
  for (const c of (el as DomNode).children ?? []) walk(c);
  return clean(parts.join(""));
}

/** 설명문에서 첫 문장(또는 적당한 길이)만. "and the"처럼 끝이 잘린 꼬리는 지운다 */
export function firstSentence(text: string, max = 140): string {
  const t = clean(text);
  const sentence = t.split(/(?<=[.!?])\s+/)[0] ?? t;
  let out = sentence.length <= max ? sentence : truncateWords(sentence, max);
  out = out.replace(/[\s,;:–—-]+$/, "");
  for (let i = 0; i < 3; i++) out = out.replace(/\s+(and|or|the|a|an|of|for|to|with|where|which|that|in|on|by)$/i, "");
  return out.replace(/[.]$/, "");
}

export function extractPage(html: string, url: string, finalUrl = url): PageExtract {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe, template").remove();
  const meta = (sel: string) => clean($(sel).attr("content") ?? "");
  const rawTitle = meta('meta[property="og:title"]') || meta('meta[name="twitter:title"]') || clean($("title").first().text());
  const siteName = meta('meta[property="og:site_name"]') || meta('meta[name="application-name"]');
  const description =
    meta('meta[property="og:description"]') || meta('meta[name="description"]') || meta('meta[name="twitter:description"]');

  // 단계·가격 추정용 전체 글자는 메뉴를 지우기 전에 모은다 ("Join the beta" 버튼이 폼 안에 있는 경우가 많다)
  const bodyEl = $("body")[0];
  const fullText = bodyEl ? spacedText($, bodyEl).slice(0, 20000) : "";
  $("nav, header nav, footer, [role=navigation], [aria-hidden=true], dialog, form").remove();
  const headings: string[] = [];
  $("h1, h2, h3").each((_, el) => {
    const t = spacedText($, el);
    if (t && t.length <= 140 && !NAV_LABEL.test(t) && !headings.includes(t)) headings.push(t);
  });
  const bullets: string[] = [];
  $("li").each((_, el) => {
    const li = $(el);
    if (li.find("ul, ol").length) return; // 메뉴 묶음
    if (li.find("a").length >= 2) return;
    const t = spacedText($, el);
    const linkText = clean(li.find("a").first().text());
    if (linkText && linkText === t) return; // 링크 하나뿐인 메뉴 항목
    if (NAV_LABEL.test(t) || /^[A-Z0-9 &/-]{6,}$/.test(t)) return;
    const n = t.split(" ").length;
    if (n >= 3 && n <= 18 && !bullets.includes(t)) bullets.push(t);
  });
  const paragraphs: string[] = [];
  $("p").each((_, el) => {
    const t = spacedText($, el);
    if (t.split(" ").length >= 6 && !paragraphs.includes(t)) paragraphs.push(t);
  });
  const text = fullText;
  return {
    url,
    finalUrl,
    title: rawTitle,
    description,
    siteName,
    headings: headings.slice(0, 20),
    bullets: bullets.slice(0, 30),
    paragraphs: paragraphs.slice(0, 20),
    text,
    lang: ($("html").attr("lang") ?? "").toLowerCase() || (hasHangul(text.slice(0, 2000)) ? "ko" : "en"),
  };
}

const CATEGORY_RULES: [string, RegExp][] = [
  ["developer tool", /\b(api|sdk|cli|developers?|github|git|commits?|deploy|devops|debug|changelog|ide|terminal|repo|programming|engineers?|code|coding)\b/i],
  ["AI tool", /\b(ai|gpt|llm|chatbot|agents?|machine learning|openai|claude|prompt)\b/i],
  ["productivity app", /\b(productivity|to-?do|tasks?|notes|focus|calendar|habits?|workflow|planner)\b/i],
  ["design tool", /\b(design|figma|ui|ux|mockups?|fonts?|icons?|illustrations?)\b/i],
  ["mobile app", /\b(ios|android|iphone|app store|play store|mobile app)\b/i],
  ["game", /\b(game|games|gaming|steam|unity|godot)\b/i],
  ["marketing tool", /\b(marketing|seo|social media|ads|growth|newsletter|email campaigns?)\b/i],
  ["e-commerce tool", /\b(shop|store|e-?commerce|shopify|checkout|products?)\b/i],
  ["education app", /\b(learn|learning|course|students?|teachers?|language|study|quiz|flashcards?)\b/i],
  ["finance app", /\b(finance|budget|invoices?|money|expenses?|accounting|tax)\b/i],
  ["health app", /\b(fitness|health|workouts?|sleep|meditation|nutrition)\b/i],
  ["browser extension", /\b(chrome extension|browser extension|extension for chrome|firefox add-on)\b/i],
  ["SaaS", /\b(saas|subscription|b2b|dashboard|crm|analytics|teams?)\b/i],
];

const AUDIENCE_RE = /\bfor ((?:indie |solo |small |busy |remote |freelance |busy )?(?:developers|devs|designers|teams|freelancers|creators|students|teachers|founders|marketers|writers|startups|small businesses|agencies|makers|engineers|parents|musicians|podcasters|streamers|recruiters|researchers|sellers|shop owners))\b/gi;

function guessStage(text: string): ProductStage {
  if (/\b(public beta|in beta|beta)\b/i.test(text)) return "beta";
  if (/\b(coming soon|waitlist|join the waitlist|early access)\b/i.test(text)) return "idea";
  if (/\b(pricing|customers|trusted by|get started)\b/i.test(text)) return "launched";
  return "unknown";
}

function guessPricing(text: string): string {
  const price = text.match(/\$\s?\d+(?:\.\d{2})?\s?(?:\/\s?(?:month|mo|year|yr)|per month|a month)/i)?.[0];
  const free = /\bfree\b/i.test(text);
  if (price && free) return `free plan available, paid from ${price.replace(/\s+/g, "")}`;
  if (price) return `from ${price.replace(/\s+/g, "")}`;
  if (/\bopen[- ]source\b/i.test(text) && free) return "free and open source";
  if (free) return "free";
  return "";
}

function guessName(page: PageExtract): string {
  if (page.siteName) return page.siteName;
  const t = page.title.split(/\s[|–—:-]\s/)[0]?.trim();
  if (t && t.length <= 30) return t;
  const host = (() => {
    try {
      return new URL(page.finalUrl).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  const base = host.split(".")[0] ?? "";
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "My product";
}

export function heuristicProfile(page: PageExtract): ProductProfile {
  const all = [page.title, page.description, ...page.headings, ...page.paragraphs.slice(0, 6), ...page.bullets.slice(0, 10)].join("\n");
  const name = guessName(page);
  const oneLinerSrc = page.description || page.headings[0] || page.title;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const oneLiner = firstSentence(oneLinerSrc.replace(new RegExp(`^${escapedName}\\s*(?:is\\s+|[:–—-]\\s*)`, "i"), ""));
  const category = CATEGORY_RULES.find(([, re]) => re.test(all))?.[0] ?? "web app";
  const audience = [...new Set([...all.matchAll(AUDIENCE_RE)].map((m) => m[1].toLowerCase()))].slice(0, 3);
  const problemLines = [...page.headings, ...page.paragraphs]
    .filter((t) => /\b(tired of|no more|stop|without|hate|waste|manual(?:ly)?|by hand|pain|struggle|instead of)\b/i.test(t))
    .slice(0, 2)
    .map((t) => truncateWords(t, 110));
  const features = page.bullets
    .filter((b) => !NAV_LABEL.test(b) && !/©|all rights reserved/i.test(b))
    .slice(0, 4)
    .map((b) => truncateWords(b, 90));
  const featureFallback = page.headings.slice(1, 4).filter((h) => h.split(" ").length >= 3);
  const kw = new Map<string, number>();
  for (const w of words([page.title, page.description, ...page.headings].join(" "))) {
    if (w.length < 4 || STOPWORDS.has(w)) continue;
    kw.set(w, (kw.get(w) ?? 0) + 1);
  }
  const keywords = [...kw.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);

  return {
    url: page.finalUrl || page.url,
    name,
    oneLiner,
    oneLinerKo: hasHangul(oneLiner) ? oneLiner : undefined,
    category,
    audience,
    problems: problemLines,
    features: features.length ? features : featureFallback,
    pricing: guessPricing(`${all}\n${page.text.slice(0, 8000)}`),
    stage: guessStage(`${all}\n${page.text.slice(0, 8000)}`),
    keywords,
    source: "live",
    extractedBy: "heuristic",
  };
}

/** 직접 입력한 설명으로 프로필 만들기 (URL이 막혔을 때) */
export function manualProfile(input: { url?: string; name: string; description: string }): ProductProfile {
  const fakePage: PageExtract = {
    url: input.url ?? "",
    finalUrl: input.url ?? "",
    title: input.name,
    description: input.description.split(/\n/)[0] ?? "",
    siteName: input.name,
    headings: [],
    bullets: input.description
      .split(/\n/)
      .slice(1)
      .map((l) => l.replace(/^[-*•]\s*/, "").trim())
      .filter((l) => l.split(" ").length >= 2),
    paragraphs: [input.description],
    text: input.description,
    lang: hasHangul(input.description) ? "ko" : "en",
  };
  return { ...heuristicProfile(fakePage), name: input.name, source: "manual" };
}

/** 자바스크립트로 그리는 페이지처럼 서버가 받은 HTML에 내용이 거의 없는 경우 */
export function isEmptyPage(page: PageExtract): boolean {
  const words = [page.title, page.description, ...page.headings, ...page.paragraphs].join(" ").trim().split(/\s+/).filter(Boolean);
  return words.length < 4;
}

/** LLM에 넘길 페이지 요약 텍스트 */
export function pageDigest(page: PageExtract, maxChars = 9000): string {
  const parts = [
    `URL: ${page.finalUrl}`,
    `Title: ${page.title}`,
    page.siteName ? `Site name: ${page.siteName}` : "",
    page.description ? `Meta description: ${page.description}` : "",
    page.headings.length ? `Headings:\n- ${page.headings.join("\n- ")}` : "",
    page.bullets.length ? `List items:\n- ${page.bullets.slice(0, 20).join("\n- ")}` : "",
    page.paragraphs.length ? `Paragraphs:\n${page.paragraphs.slice(0, 12).join("\n")}` : "",
  ].filter(Boolean);
  return parts.join("\n\n").slice(0, maxChars);
}
