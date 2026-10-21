import { describe, expect, it } from "vitest";
import { scoreAdSmell } from "@/lib/analysis/adsmell";
import { classifyArchetype } from "@/lib/analysis/features";
import { analyzeRules } from "@/lib/analysis/rules";
import { scoreFit } from "@/lib/analysis/fit";
import { analyzeCommunity } from "@/lib/analysis/community";
import { usDayToKstWindow } from "@/lib/analysis/timing";
import { getSample, SAMPLE_REFS } from "@/lib/fixtures/communities";
import { applyTitleCase, detectTitleCase } from "@/lib/text";

describe("광고 냄새 점수", () => {
  it("전형적인 광고 문장은 높게 나온다", () => {
    const r = scoreAdSmell({
      body: "🚀 Introducing Shiplog — the revolutionary AI-powered changelog tool every developer needs! Sign up now!!",
      platform: "reddit",
    });
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.band === "promo" || r.band === "danger").toBe(true);
    expect(r.hits.map((h) => h.kind)).toEqual(expect.arrayContaining(["emoji", "corporate", "hype", "cta", "exclaim"]));
  });

  it("경험담 + 질문 + 공개는 낮게 나온다", () => {
    const r = scoreAdSmell({
      title: "I built a small tool that drafts release notes from commits",
      body: "I got tired of writing release notes by hand, so I built this. It's free while in beta. Would you use something like this?",
      platform: "reddit",
    });
    expect(r.score).toBeLessThan(15);
    expect(r.goodSignalsKo.length).toBeGreaterThanOrEqual(2);
  });

  it("'No signup'이나 '500 upvotes'는 판매 문구로 잡지 않는다", () => {
    const r = scoreAdSmell({ body: "No signup needed. This post got 500 upvotes last time, which surprised me.", platform: "hn" });
    expect(r.hits.filter((h) => h.kind === "cta")).toHaveLength(0);
  });

  it("README 같은 약어는 대문자 강조로 보지 않는다", () => {
    const r = scoreAdSmell({ body: "Benchmarks are in the README and the API docs. This is HUGE news!", platform: "hn" });
    expect(r.hits.filter((h) => h.kind === "caps").map((h) => h.text)).toEqual(["HUGE"]);
  });

  it("하이라이트 위치가 원문 글자와 맞는다", () => {
    const body = "Our cutting-edge platform will skyrocket your sales. Sign up now!";
    const r = scoreAdSmell({ body, platform: "reddit" });
    for (const h of r.hits) expect(body.slice(h.start, h.end)).toBe(h.text);
  });

  it("[채울 칸] 안의 글자는 점수에 넣지 않는다", () => {
    const a = scoreAdSmell({ body: "I built it. [revolutionary game-changer!!! sign up now]", platform: "reddit" });
    expect(a.hits).toHaveLength(0);
  });
});

describe("글 유형 분류", () => {
  it.each([
    ["I built a tiny app that tracks subscriptions", "showcase"],
    ["Made a free tool to check app names", "showcase"],
    ["Show HN: Pebble – A self-hosted RSS reader", "showcase"],
    ["We hit $10k MRR. Here's our breakdown", "milestone"],
    ["Our churn dropped from 9% to 4% after one change", "milestone"],
    ["Roast my landing page", "feedback"],
    ["Would you use a tool that writes changelogs?", "feedback"],
    ["Lessons from shutting down my SaaS after 2 years", "lesson"],
    ["How we hired our first engineer without a recruiter", "guide"],
    ["Is it just me or are job posts getting worse?", "discussion"],
    ["What's your go-to stack for client sites?", "question"],
  ])("%s → %s", (title, expected) => {
    expect(classifyArchetype(title, "", title.startsWith("Show HN") ? "hn" : "reddit")).toBe(expected);
  });
});

describe("제목 대소문자", () => {
  it("판별", () => {
    expect(detectTitleCase("I built a small tool for GitHub users")).toBe("sentence");
    expect(detectTitleCase("How I Built A Tool That Writes Changelogs")).toBe("title");
    expect(detectTitleCase("just shipped dark mode")).toBe("lower");
    expect(detectTitleCase("$0 to $4.2k MRR in 11 months, bootstrapped")).toBe("sentence");
  });
  it("적용할 때 제품 이름과 약어는 그대로 둔다", () => {
    expect(applyTitleCase("i built Shiplog for API docs", "sentence", ["Shiplog"])).toBe("I built Shiplog for API docs");
    expect(applyTitleCase("I built a tool for indie devs", "title")).toBe("I Built a Tool for Indie Devs");
  });
});

describe("규칙 해석", () => {
  it("요일 제한 → 조건부, 한국 시간 창", () => {
    const r = analyzeRules(
      [{ title: "Self-promotion only on Saturdays", description: "Promote your project only on Saturday with the Showoff flair. Flair is required." }],
      "reddit",
    );
    expect(r.selfPromo.policy).toBe("conditional");
    expect(r.promoDays).toEqual(["saturday"]);
    expect(r.promoDaysNoteKo).toContain("토요일");
    expect(r.flairRequired).toBe(true);
  });
  it("명시적 금지 → 금지", () => {
    const r = analyzeRules([{ title: "No self-promotion", description: "Self-promotion is not allowed." }], "reddit");
    expect(r.selfPromo.policy).toBe("restricted");
  });
  it("'No spam'만 있는 곳을 홍보 금지로 보지 않는다", () => {
    const r = analyzeRules([{ title: "No spam", description: "Don't post the same thing twice." }], "reddit", "A place to share your side projects");
    expect(r.selfPromo.policy).toBe("allowed");
  });
  it("AI 글 금지와 제한을 구분한다", () => {
    expect(analyzeRules([{ title: "No AI-generated posts", description: "AI-written posts will be removed." }], "reddit").aiContent.level).toBe("banned");
    expect(analyzeRules([{ title: "No low-effort AI", description: "Low-effort AI content may be removed." }], "reddit").aiContent.level).toBe("limited");
  });
  it("미국 요일 → 한국 시간", () => {
    expect(usDayToKstWindow("Saturday")).toBe("한국 시간 토요일 오후 5시 ~ 일요일 오전 9시");
  });
});

describe("샘플 커뮤니티 분석", () => {
  const expected: Record<string, { policy: string; ai: string }> = {
    "r/SideProject": { policy: "allowed", ai: "limited" },
    "r/SaaS": { policy: "conditional", ai: "limited" },
    "r/webdev": { policy: "conditional", ai: "none" },
    "r/startups": { policy: "conditional", ai: "banned" },
    "X #buildinpublic": { policy: "allowed", ai: "none" },
    "Show HN": { policy: "allowed", ai: "banned" },
  };

  for (const ref of SAMPLE_REFS) {
    it(ref.label, () => {
      const s = getSample(ref, new Date("2026-10-21T00:00:00Z"))!;
      const stats = analyzeCommunity(s.posts, ref.platform);
      const rules = analyzeRules(s.rules, ref.platform, s.about?.description);
      expect(stats.n).toBeGreaterThanOrEqual(15);
      expect(rules.selfPromo.policy).toBe(expected[ref.label].policy);
      expect(rules.aiContent.level).toBe(expected[ref.label].ai);
      // 광고 같은 글일수록 반응이 낮게 나오도록 만든 샘플이다
      expect(stats.adSmell.correlation ?? 0).toBeLessThan(0);
      expect(stats.topPosts[0].adSmell).toBeLessThan(30);
      expect(stats.timing.bestLabelKo).toMatch(/시/);
    });
  }

  it("같은 입력이면 같은 결과 (결정적)", () => {
    const s = getSample(SAMPLE_REFS[0], new Date("2026-10-21T00:00:00Z"))!;
    expect(JSON.stringify(analyzeCommunity(s.posts, "reddit"))).toBe(JSON.stringify(analyzeCommunity(s.posts, "reddit")));
  });
});

describe("어울림 점수", () => {
  const s = getSample({ platform: "hn", id: "show_hn" }, new Date("2026-10-21T00:00:00Z"))!;
  const stats = analyzeCommunity(s.posts, "hn");
  it("Show HN 제목 형식과 80자 제한을 본다", () => {
    const ok = scoreFit({ title: "Show HN: Shiplog – Turns git commits into release notes", body: "Hi HN, I built this because...", platform: "hn", stats });
    expect(ok.checks.find((c) => c.key === "hnTitle")?.ok).toBe(true);
    const bad = scoreFit({ title: "Shiplog: the BEST changelog tool!!!", body: "x", platform: "hn", stats });
    expect(bad.checks.find((c) => c.key === "hnTitle")?.ok).toBe(false);
  });
  it("제품 이름을 쓰면서 만든 사람이라고 안 밝히면 표시한다", () => {
    const r = scoreFit({ title: "Show HN: Shiplog – notes", body: "Shiplog turns commits into notes.", platform: "hn", stats, productName: "Shiplog" });
    expect(r.checks.find((c) => c.key === "disclosure")?.ok).toBe(false);
  });
  it("채울 칸을 센다", () => {
    const r = scoreFit({ title: "x", body: "It took [기간] and [숫자] users. See [docs](https://x.dev)", platform: "hn", stats });
    expect(r.placeholders).toEqual(["[기간]", "[숫자]"]);
  });
});
