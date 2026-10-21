// 커뮤니티 후보 목록. 설명은 각 커뮤니티의 주제만 적었다. 홍보 규칙은 수집할 때 실제 규칙을 읽어서 판단한다.

import type { CommunityRef, CommunitySuggestion, Platform, ProductProfile } from "./types";
import { hasSample } from "./fixtures/communities";
import { words } from "./text";

interface Entry extends CommunityRef {
  topicKo: string;
  tags: string[];
}

const R = (id: string, topicKo: string, tags: string[]): Entry => ({ platform: "reddit", id, label: `r/${id}`, topicKo, tags });

export const DIRECTORY: Entry[] = [
  R("SideProject", "사이드 프로젝트를 공유하고 피드백을 받는 곳", ["any", "launch", "feedback", "app", "web", "tool", "developer"]),
  R("SaaS", "SaaS를 만드는 사람들이 매출, 마케팅, 운영 경험을 나누는 곳", ["saas", "b2b", "subscription", "startup", "founder", "pricing"]),
  R("webdev", "웹 개발자 커뮤니티", ["web", "developer", "frontend", "javascript", "css", "devtool", "tool"]),
  R("startups", "창업 과정의 고민과 경험을 나누는 곳", ["startup", "founder", "business", "fundraising"]),
  R("indiehackers", "1인 또는 소규모 창업자들의 서브레딧", ["founder", "saas", "solo", "bootstrap", "any"]),
  R("Entrepreneur", "창업 전반을 다루는 큰 커뮤니티", ["business", "founder", "ecommerce", "smallbusiness"]),
  R("selfhosted", "직접 서버에 설치해 쓰는 소프트웨어 이야기", ["selfhosted", "opensource", "docker", "homelab", "privacy", "devtool"]),
  R("opensource", "오픈소스 프로젝트 이야기", ["opensource", "github", "developer", "library"]),
  R("programming", "프로그래밍 전반 기술 토론", ["developer", "programming", "code"]),
  R("javascript", "자바스크립트 개발자 커뮤니티", ["javascript", "node", "frontend", "web"]),
  R("reactjs", "리액트 개발자 커뮤니티", ["react", "javascript", "frontend"]),
  R("Python", "파이썬 개발자 커뮤니티", ["python", "developer", "data"]),
  R("productivity", "생산성 도구와 방법", ["productivity", "notes", "todo", "focus", "habit", "calendar"]),
  R("Notion", "노션 사용자 커뮤니티", ["notion", "templates", "productivity"]),
  R("ObsidianMD", "옵시디언(메모 앱) 사용자 커뮤니티", ["obsidian", "notes", "markdown", "pkm"]),
  R("iOSProgramming", "iOS 앱 개발자 커뮤니티", ["ios", "swift", "mobile", "app"]),
  R("androiddev", "안드로이드 개발자 커뮤니티", ["android", "kotlin", "mobile", "app"]),
  R("gamedev", "게임 개발자 커뮤니티", ["game", "gamedev", "unity", "godot"]),
  R("IndieDev", "인디 게임과 인디 개발자 커뮤니티", ["game", "indie"]),
  R("LocalLLaMA", "로컬 LLM과 오픈 모델 커뮤니티", ["ai", "llm", "opensource", "local"]),
  R("MachineLearning", "머신러닝 연구와 프로젝트 이야기", ["ai", "ml", "research", "data"]),
  R("nocode", "노코드 도구 커뮤니티", ["nocode", "automation", "tool"]),
  R("web_design", "웹 디자인 이야기", ["design", "ui", "web", "css"]),
  R("marketing", "마케팅 실무 이야기", ["marketing", "seo", "growth", "ads"]),
  R("smallbusiness", "작은 사업체 운영 이야기", ["smallbusiness", "ecommerce", "local", "b2b"]),
  R("freelance", "프리랜서 커뮤니티", ["freelance", "invoice", "clients"]),
  R("languagelearning", "외국어 학습 커뮤니티", ["language", "learning", "education"]),
  R("macapps", "맥 앱 이야기", ["mac", "macos", "app"]),
  R("chrome_extensions", "크롬 확장 프로그램 이야기", ["chrome", "extension", "browser"]),
  R("alphaandbetausers", "베타 테스터를 구하는 곳", ["beta", "feedback", "launch", "any"]),
  {
    platform: "x",
    id: "buildinpublic",
    label: "X #buildinpublic",
    query: "#buildinpublic",
    topicKo: "만드는 과정을 공개하는 창업자들이 쓰는 해시태그",
    tags: ["any", "founder", "launch", "saas"],
  },
  {
    platform: "x",
    id: "indiehackers",
    label: "X #indiehackers",
    query: "#indiehackers",
    topicKo: "1인 또는 소규모 창업자 해시태그",
    tags: ["founder", "saas", "solo"],
  },
  {
    platform: "x",
    id: "webdev",
    label: "X #webdev",
    query: "#webdev",
    topicKo: "웹 개발자 해시태그",
    tags: ["web", "developer", "frontend", "devtool"],
  },
  {
    platform: "x",
    id: "aitools",
    label: "X AI 빌더",
    query: "(#AI OR #LLM) (built OR shipped OR launched)",
    topicKo: "AI 도구를 만들고 공개하는 사람들",
    tags: ["ai", "llm", "tool"],
  },
  {
    platform: "hn",
    id: "show_hn",
    label: "Show HN",
    topicKo: "Hacker News에서 직접 만든 것을 보여 주는 게시판",
    tags: ["any", "developer", "devtool", "opensource", "ai", "tool", "web", "saas"],
  },
];

const TAG_WORDS: Record<string, string[]> = {
  developer: ["developer", "developers", "dev", "devs", "code", "coding", "engineer", "engineers", "programming", "api", "sdk", "cli"],
  devtool: ["git", "github", "commit", "commits", "changelog", "deploy", "debug", "ide", "terminal", "devops", "developer tool"],
  web: ["web", "website", "frontend", "css", "html", "browser"],
  saas: ["saas", "subscription", "b2b", "dashboard", "teams", "mrr"],
  ai: ["ai", "gpt", "llm", "model", "agent", "agents", "chatbot", "ml"],
  productivity: ["productivity", "todo", "to-do", "tasks", "focus", "habit", "habits", "calendar", "planner", "workflow"],
  notes: ["notes", "markdown", "notion", "obsidian", "pkm"],
  design: ["design", "figma", "ui", "ux", "fonts", "icons"],
  mobile: ["ios", "android", "iphone", "mobile"],
  game: ["game", "games", "gaming", "unity", "godot", "steam"],
  marketing: ["marketing", "seo", "social", "ads", "growth", "newsletter"],
  ecommerce: ["shop", "store", "ecommerce", "e-commerce", "shopify"],
  education: ["learn", "learning", "course", "students", "teachers", "study", "quiz", "flashcards"],
  language: ["language", "languages", "vocabulary", "english", "korean", "japanese"],
  freelance: ["freelance", "freelancers", "invoice", "invoices", "clients"],
  selfhosted: ["self-hosted", "selfhosted", "docker", "homelab", "privacy"],
  opensource: ["open-source", "opensource", "open", "mit", "github"],
  extension: ["extension", "chrome", "firefox"],
  mac: ["mac", "macos"],
  founder: ["founder", "founders", "startup", "indie", "solo", "bootstrapped", "makers"],
  startup: ["startup", "startups", "founder", "fundraising"],
  javascript: ["javascript", "typescript", "node", "react", "nextjs", "vue"],
  python: ["python", "django", "flask", "pandas"],
};

function productTags(p: ProductProfile): Set<string> {
  const text = [p.category, p.oneLiner, ...p.audience, ...p.problems, ...p.features, ...p.keywords].join(" ").toLowerCase();
  const ws = new Set(words(text));
  const tags = new Set<string>();
  for (const [tag, list] of Object.entries(TAG_WORDS)) {
    if (list.some((w) => (w.includes(" ") ? text.includes(w) : ws.has(w)))) tags.add(tag);
  }
  if (/tool/.test(p.category)) tags.add("tool");
  if (/app/.test(p.category)) tags.add("app");
  return tags;
}

export function suggestCommunities(
  profile: ProductProfile,
  platforms: Platform[],
  options: { preferSample?: boolean } = {},
): CommunitySuggestion[] {
  const tags = productTags(profile);
  const scored = DIRECTORY.filter((e) => platforms.includes(e.platform)).map((e) => {
    const overlap = e.tags.filter((t) => tags.has(t));
    let fit = (e.tags.includes("any") ? 35 : 15) + overlap.length * 14;
    const sample = hasSample(e);
    if (options.preferSample && sample) fit += 20;
    fit = Math.min(96, fit);
    const reasonKo = overlap.length
      ? `제품 키워드(${overlap.slice(0, 3).join(", ")})와 주제가 겹쳐요`
      : e.tags.includes("any")
        ? "어떤 제품이든 만든 것을 공유하는 곳이에요"
        : "주제가 조금 멀어요";
    return { platform: e.platform, id: e.id, label: e.label, query: e.query, topicKo: e.topicKo, reasonKo, fit, hasSample: sample };
  });
  return scored.sort((a, b) => b.fit - a.fit);
}

/** 기본으로 고를 커뮤니티: 레딧 3곳 + X 1곳 + HN 1곳 */
export function defaultSelection(sugs: CommunitySuggestion[], options: { onlySample?: boolean } = {}): CommunitySuggestion[] {
  const pool = options.onlySample ? sugs.filter((s) => s.hasSample) : sugs;
  const pick = (platform: Platform, n: number) => pool.filter((s) => s.platform === platform).slice(0, n);
  return [...pick("reddit", 3), ...pick("x", 1), ...pick("hn", 1)];
}
