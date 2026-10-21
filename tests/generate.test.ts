import { describe, expect, it } from "vitest";
import { analyzeCommunity } from "@/lib/analysis/community";
import { analyzeRules } from "@/lib/analysis/rules";
import { DISCLOSURE_RE, scoreAdSmell } from "@/lib/analysis/adsmell";
import { getSample, SAMPLE_REFS } from "@/lib/fixtures/communities";
import { SAMPLE_PRODUCT } from "@/lib/fixtures/sample-product";
import { templateDrafts } from "@/lib/generate/templates";
import { templateShorts } from "@/lib/generate/shorts";
import { itSentence, painGerund, parseOneLiner, phraseCuts, thirdPerson } from "@/lib/generate/english";
import type { CommunityAnalysis, ProductProfile } from "@/lib/types";
import { heuristicPlaybook } from "@/lib/analysis/playbook";

const NOW = new Date("2026-10-21T00:00:00Z");

function ctxFor(id: string, platform: "reddit" | "x" | "hn", profile: ProductProfile = SAMPLE_PRODUCT) {
  const s = getSample({ platform, id }, NOW)!;
  const stats = analyzeCommunity(s.posts, platform);
  const rules = analyzeRules(s.rules, platform, s.about?.description);
  return { profile, ref: s.community, stats, rules };
}

describe("영어 도우미", () => {
  it("동사 활용과 한 줄 소개 해석", () => {
    expect(thirdPerson("turn")).toBe("turns");
    expect(thirdPerson("fix")).toBe("fixes");
    expect(thirdPerson("copy")).toBe("copies");
    expect(parseOneLiner("Turn commits into notes", "X").verbPhrase).toBe("turns commits into notes");
    expect(parseOneLiner("Shiplog turns commits into notes", "Shiplog").verbPhrase).toBe("turns commits into notes");
    expect(itSentence("AI changelog generator for indie devs", "X")).toBe("It's an AI changelog generator for indie devs.");
    expect(painGerund("Messy release notes")).toBe("dealing with messy release notes");
  });
  it("목적어 앞에서는 자르지 않는다", () => {
    expect(phraseCuts("turns your git commits into release notes people actually read")).toEqual([
      "turns your git commits into release notes",
      "turns your git commits into release notes people actually read",
    ]);
  });
});

describe("템플릿 초안", () => {
  it("r/SideProject: 이야기·피드백·경험담, 만든 사람 공개, 광고 냄새 낮음", () => {
    const drafts = templateDrafts(ctxFor("SideProject", "reddit"));
    expect(drafts.map((d) => d.angle)).toEqual(["story", "feedback", "lesson"]);
    for (const d of drafts) {
      expect(d.mode).toBe("draft");
      expect(scoreAdSmell({ title: d.title, body: d.body, platform: "reddit" }).score).toBeLessThan(25);
      if (d.body.includes("Shiplog")) expect(DISCLOSURE_RE.test(d.body)).toBe(true);
    }
    // 본문 링크가 드문 곳이라 링크는 첫 댓글로
    expect(drafts[0].body).not.toContain("https://");
    expect(drafts[0].firstComment).toContain("https://shiplog.example");
  });

  it("정기 스레드만 허용하는 곳은 스레드 댓글 + 링크 없는 글", () => {
    const drafts = templateDrafts(ctxFor("SaaS", "reddit"));
    expect(drafts.map((d) => d.angle)).toEqual(["thread", "lesson", "question"]);
    expect(drafts[1].body).not.toContain("Shiplog");
    expect(drafts[2].body).not.toContain("Shiplog");
  });

  it("AI 글 금지 커뮤니티는 뼈대만 준다", () => {
    for (const [id, platform] of [
      ["show_hn", "hn"],
      ["startups", "reddit"],
    ] as const) {
      const drafts = templateDrafts(ctxFor(id, platform));
      expect(drafts.length).toBeGreaterThan(0);
      for (const d of drafts) {
        expect(d.mode).toBe("outline");
        // 영어 완성 문장 대신 채울 칸이 대부분이어야 한다
        expect((d.body || d.firstComment || "").match(/\[[^\]]+\]/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("X 트윗은 모두 280자 이내", () => {
    for (const d of templateDrafts(ctxFor("buildinpublic", "x"))) {
      for (const t of d.thread ?? []) expect([...t].length).toBeLessThanOrEqual(280);
    }
  });

  it("없는 숫자를 지어내지 않는다 (제품 정보에 있는 숫자만 쓴다)", () => {
    const allowed = new Set(["9", "1", "2", "3", "4", "10", "6", "30", "280", "80"]);
    for (const ref of SAMPLE_REFS) {
      const drafts = templateDrafts(ctxFor(ref.id, ref.platform));
      for (const d of drafts) {
        const text = `${d.title}\n${d.body}\n${d.firstComment ?? ""}`.replace(/\[[^\]]*\]/g, "");
        for (const n of text.match(/\d+/g) ?? []) expect(allowed.has(n), `${ref.label}: ${n} in ${text}`).toBe(true);
      }
    }
  });

  it("한국어 제품 정보만 있으면 영어 문장 대신 채울 칸을 남긴다", () => {
    const ko: ProductProfile = {
      ...SAMPLE_PRODUCT,
      oneLiner: "커밋으로 릴리스 노트를 써 주는 도구",
      problems: ["매주 릴리스 노트를 손으로 쓰는 일"],
      features: ["깃허브 연동"],
      audience: ["개발자"],
    };
    const d = templateDrafts(ctxFor("SideProject", "reddit", ko))[0];
    expect(d.body).not.toMatch(/[가-힣]+ 노트를 손으로/);
    expect(d.body).toContain("[");
  });
});

describe("쇼츠 템플릿", () => {
  it("장면이 0초부터 끝까지 빈틈없이 이어진다", () => {
    const analyses = SAMPLE_REFS.map((ref) => {
      const c = ctxFor(ref.id, ref.platform);
      return { community: ref, stats: c.stats, rules: c.rules, playbook: heuristicPlaybook(ref, c.stats, c.rules) } as unknown as CommunityAnalysis;
    });
    for (const seconds of [30, 45, 60]) {
      const s = templateShorts(SAMPLE_PRODUCT, analyses, { seconds });
      expect(s.scenes[0].start).toBe(0);
      expect(s.scenes.at(-1)!.end).toBe(seconds);
      for (let i = 1; i < s.scenes.length; i++) expect(s.scenes[i].start).toBe(s.scenes[i - 1].end);
      expect(s.hooks).toHaveLength(3);
    }
  });
});
