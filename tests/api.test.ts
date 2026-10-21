import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as productPOST } from "@/app/api/product/route";
import { POST as communitiesPOST } from "@/app/api/communities/route";
import { POST as collectPOST } from "@/app/api/collect/route";
import { POST as analyzePOST } from "@/app/api/analyze/route";
import { POST as generatePOST } from "@/app/api/generate/route";
import { POST as shortsPOST } from "@/app/api/shorts/route";
import type { CollectResult, CommunityAnalysis, CommunitySuggestion, GenerateResult, ProductProfile } from "@/lib/types";

const req = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

async function call<T>(handler: (r: Request) => Promise<Response>, body: unknown, headers?: Record<string, string>) {
  const res = await handler(req(body, headers));
  return { status: res.status, data: (await res.json()) as T };
}

async function samplePipeline() {
  const { data: p } = await call<{ profile: ProductProfile }>(productPOST, { url: "https://shiplog.example" });
  const { data: c } = await call<{ suggestions: CommunitySuggestion[]; selected: string[] }>(communitiesPOST, {
    profile: p.profile,
    platforms: ["reddit", "x", "hn"],
  });
  const refs = c.selected.map((k) => c.suggestions.find((s) => `${s.platform}:${s.id}` === k)!);
  const analyses: CommunityAnalysis[] = [];
  for (const s of refs) {
    const { data: col } = await call<CollectResult>(collectPOST, { community: { platform: s.platform, id: s.id, label: s.label, query: s.query }, preferSample: true });
    const { data: a } = await call<CommunityAnalysis>(analyzePOST, { collected: col, profile: p.profile });
    analyses.push(a);
  }
  return { profile: p.profile, analyses, selected: c.selected };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("API (키 없음, 샘플)", () => {
  it("샘플 제품 전체 흐름", async () => {
    const { profile, analyses, selected } = await samplePipeline();
    expect(profile.name).toBe("Shiplog");
    expect(selected).toHaveLength(5);
    expect(analyses.every((a) => a.source === "sample" && a.stats.n > 10)).toBe(true);
    for (const a of analyses) {
      const { status, data } = await call<GenerateResult>(generatePOST, { profile, analysis: a });
      expect(status).toBe(200);
      expect(data.engine).toBe("template");
      expect(data.drafts.length).toBeGreaterThan(0);
    }
    const { status, data } = await call<{ script: { scenes: unknown[] } }>(shortsPOST, { profile, analyses });
    expect(status).toBe(200);
    expect(data.script.scenes.length).toBeGreaterThanOrEqual(4);
  });

  it("잘못된 요청은 한국어 오류", async () => {
    const r = await call<{ error: string }>(productPOST, {});
    expect(r.status).toBe(400);
    expect(r.data.error).toMatch(/URL/);
    const bad = await call<{ error: string }>(collectPOST, { community: { platform: "reddit", id: "../etc", label: "x" } });
    expect(bad.status).toBe(400);
  });

  it("내부 주소 URL은 열지 않고 직접 설명을 요청한다", async () => {
    const r = await call<{ error: string; needManual: boolean }>(productPOST, { url: "http://192.168.0.1/" });
    expect(r.status).toBe(422);
    expect(r.data.needManual).toBe(true);
  });

  it("사이트가 429로 막으면 이유를 설명하고 직접 설명을 요청한다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Too Many Requests", { status: 429 })));
    const r = await call<{ error: string; needManual: boolean }>(productPOST, { url: "http://93.184.215.14/products/1?NaPm=abc" });
    expect(r.status).toBe(422);
    expect(r.data.needManual).toBe(true);
    expect(r.data.error).toMatch(/429/);
  });

  it("직접 설명으로 만든 프로필의 링크에는 추적 꼬리표가 없다", async () => {
    const r = await call<{ profile: ProductProfile }>(productPOST, {
      url: "https://smartstore.naver.com/fresys/products/13523554387?site_preference=device&NaPm=ct%3Dx",
      manual: { name: "Fresys", description: "Fresh salad delivered every morning\n- picked the same day\n- no plastic packaging" },
    });
    expect(r.status).toBe(200);
    expect(r.data.profile.url).toBe("https://smartstore.naver.com/fresys/products/13523554387");
  });

  it("붙여넣기 수집", async () => {
    const r = await call<CollectResult>(collectPOST, {
      community: { platform: "reddit", id: "pasted-selfhosted", label: "r/selfhosted" },
      pasted: { posts: "10 | A\nbody\n---\n20 | B\n---\n30 | C", rules: "No self-promotion - Use the weekly thread" },
    });
    expect(r.status).toBe(200);
    expect(r.data.source).toBe("pasted");
    expect(r.data.posts).toHaveLength(3);
  });
});

describe("API (Claude 연결, 가짜 응답)", () => {
  it("초안 생성 결과를 화면 모양으로 바꾸고, X는 스레드로 받는다", async () => {
    const { profile, analyses } = await samplePipeline();
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    const xAnalysis = analyses.find((a) => a.community.platform === "x")!;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        expect(body.model).toBe("claude-sonnet-5-5");
        expect(body.system).toContain("Never invent facts");
        return Response.json({
          stop_reason: "tool_use",
          content: [
            {
              type: "tool_use",
              name: "write_drafts",
              input: {
                drafts: [
                  {
                    angle: "story",
                    title: "",
                    body: "",
                    thread: ["I got tired of writing release notes by hand.\n\nSo I built Shiplog.", "It turns commits into notes.\n\nhttps://shiplog.example"],
                    whyKo: ["짧게 끊었어요"],
                    translationKo: ["손으로 쓰기 지겨웠어요", "커밋을 노트로 바꿔요"],
                  },
                ],
              },
            },
          ],
        });
      }),
    );
    const { data } = await call<GenerateResult>(generatePOST, { profile, analysis: xAnalysis });
    expect(data.engine).toBe("llm");
    expect(data.drafts[0].thread).toHaveLength(2);
    expect(data.drafts[0].glossKind).toBe("translation");
    expect(data.drafts[0].body).toContain("So I built Shiplog.");
  });

  it("AI 글 금지 커뮤니티에서는 LLM이 있어도 대신 쓰지 않는다", async () => {
    const { profile, analyses } = await samplePipeline();
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const hn = analyses.find((a) => a.community.platform === "hn")!;
    const { data } = await call<GenerateResult>(generatePOST, { profile, analysis: hn });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(data.drafts.every((d) => d.mode === "outline")).toBe(true);
  });

  it("LLM이 실패하면 템플릿으로 대체하고 이유를 알린다", async () => {
    const { profile, analyses } = await samplePipeline();
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("overloaded", { status: 529 })));
    const { data } = await call<GenerateResult>(generatePOST, { profile, analysis: analyses[0] });
    expect(data.engine).toBe("template");
    expect(data.noticeKo).toMatch(/529/);
  });

  it("ACCESS_CODE가 있으면 코드 없는 요청은 템플릿 모드", async () => {
    const { profile, analyses } = await samplePipeline();
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("ACCESS_CODE", "letmein");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { data } = await call<GenerateResult>(generatePOST, { profile, analysis: analyses[0] });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(data.engine).toBe("template");
    expect(data.noticeKo).toMatch(/접근 코드/);
  });
});
