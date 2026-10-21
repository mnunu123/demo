import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mapRedditPost } from "@/lib/sources/reddit";
import { decodeHnHtml, mapHnHit } from "@/lib/sources/hn";
import { mapTweet } from "@/lib/sources/x";
import { parsePasted, parseRules } from "@/lib/sources/paste";
import { assertPublicUrl, cleanProductUrl, extractPage, firstSentence, heuristicProfile, isEmptyPage, statusMessageKo } from "@/lib/sources/product";
import { generateJSON } from "@/lib/llm/provider";
import { DraftsSchema, ProfileSchema } from "@/lib/llm/schemas";

describe("수집 결과 변환", () => {
  it("Reddit 게시물", () => {
    const p = mapRedditPost(
      {
        id: "abc",
        title: "I built a thing",
        selftext: "Body",
        score: 120,
        num_comments: 30,
        created_utc: 1760000000,
        permalink: "/r/SideProject/comments/abc/i_built_a_thing/",
        is_self: true,
        link_flair_text: "Showoff",
      },
      "SideProject",
    );
    expect(p).toMatchObject({ id: "t3_abc", score: 120, comments: 30, flair: "Showoff", media: "text" });
    expect(p.permalink).toBe("https://www.reddit.com/r/SideProject/comments/abc/i_built_a_thing/");
  });

  it("HN 본문 HTML 풀기", () => {
    expect(decodeHnHtml("Hi HN,<p>It&#x27;s &quot;fast&quot; &amp; small.<p><a href=\"https://x.dev\" rel=\"nofollow\">https://x.dev</a>")).toBe(
      'Hi HN,\n\nIt\'s "fast" & small.\n\nhttps://x.dev',
    );
    const p = mapHnHit({ objectID: "42", title: "Show HN: X", points: 50, num_comments: 9, created_at: "2026-10-01T12:00:00Z", story_text: "Hello" });
    expect(p).toMatchObject({ id: "hn_42", score: 50, comments: 9, body: "Hello", permalink: "https://news.ycombinator.com/item?id=42" });
  });

  it("X 트윗", () => {
    const p = mapTweet(
      { id: "9", text: "Day 3 of building\n\nshipped it", created_at: "2026-10-01T12:00:00Z", public_metrics: { like_count: 10, reply_count: 2, retweet_count: 3, quote_count: 1 } },
      "buildinpublic",
    );
    expect(p).toMatchObject({ title: "Day 3 of building", score: 10, comments: 2, shares: 4 });
  });

  it("붙여넣기: --- 구분, 점수 접두어, 규칙 줄", () => {
    const posts = parsePasted("1.2k | First title\nbody one\n---\nSecond title\n---\n  \n---\n15 | Third", { platform: "reddit", id: "p", label: "p" });
    expect(posts.map((p) => [p.title, p.score])).toEqual([
      ["First title", 1200],
      ["Second title", 0],
      ["Third", 15],
    ]);
    expect(posts[0].body).toBe("body one");
    expect(parseRules("1. No spam - Don't repost\n- Flair required")).toEqual([
      { title: "No spam", description: "Don't repost" },
      { title: "Flair required", description: "" },
    ]);
  });
});

describe("제품 페이지 추출", () => {
  const html = readFileSync(path.join(__dirname, "fixtures/product.html"), "utf8");
  const page = extractPage(html, "https://tallybird.example", "https://tallybird.example/");
  const profile = heuristicProfile(page);

  it("메뉴·법률 링크는 기능으로 보지 않는다", () => {
    expect(page.bullets).toContain("Sends reminder emails on a schedule you pick");
    expect(page.bullets.join(" ")).not.toMatch(/Log in|Privacy|Terms/);
  });
  it("프로필", () => {
    expect(profile.name).toBe("Tallybird");
    expect(profile.oneLiner).toBe("Tallybird sends polite payment reminders for your invoices, so freelancers stop chasing clients by email");
    expect(profile.audience).toEqual([]);
    expect(profile.pricing).toBe("free plan available, paid from $12/month");
    expect(profile.stage).toBe("beta");
    expect(profile.problems[0]).toMatch(/chasing late payments by hand|Tired of writing/);
    expect(profile.features.length).toBeGreaterThanOrEqual(3);
  });
  it("첫 문장 자르기는 꼬리말을 정리한다", () => {
    expect(firstSentence("A tool for developers, businesses, and the largest open source communities in the world to build software together", 60)).toBe(
      "A tool for developers, businesses, and the largest open",
    );
  });
  it("추적용 꼬리표를 지운다", () => {
    expect(
      cleanProductUrl(
        "https://smartstore.naver.com/fresys/products/13523554387?site_preference=device&NaPm=ct%3Dmvhk9teo%7Cci%3Dshopn",
      ),
    ).toBe("https://smartstore.naver.com/fresys/products/13523554387");
    expect(cleanProductUrl("https://a.dev/app?utm_source=x&plan=pro#top")).toBe("https://a.dev/app?plan=pro");
    expect(cleanProductUrl("a.dev")).toBe("https://a.dev/");
  });
  it("막힌 이유를 응답 코드로 설명한다", () => {
    expect(statusMessageKo(429, "smartstore.naver.com")).toMatch(/스마트스토어.*직접/);
    expect(statusMessageKo(403, "www.example.com")).toMatch(/example\.com.*403/);
    expect(statusMessageKo(404, "a.dev")).toMatch(/찾을 수 없어요/);
  });
  it("내용이 거의 없는 페이지(자바스크립트로 그리는 페이지)를 알아챈다", () => {
    expect(isEmptyPage(extractPage("<html><body><div id=root></div><script>app()</script></body></html>", "https://a.dev"))).toBe(true);
    expect(isEmptyPage(page)).toBe(false);
  });
  it("내부 주소는 막는다", async () => {
    await expect(assertPublicUrl("http://localhost:3000")).rejects.toThrow();
    await expect(assertPublicUrl("http://127.0.0.1")).rejects.toThrow();
    await expect(assertPublicUrl("http://10.0.0.5/admin")).rejects.toThrow();
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow();
    await expect(assertPublicUrl("http://[::1]/")).rejects.toThrow();
  });
});

describe("LLM 호출 (네트워크 없이 가짜 응답으로)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("Claude: 도구 강제 호출 결과를 스키마로 검증한다", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.tool_choice).toEqual({ type: "tool", name: "product_profile" });
      expect(body.tools[0].input_schema.type).toBe("object");
      expect(body.tools[0].input_schema.$schema).toBeUndefined();
      expect((init.headers as Record<string, string>)["anthropic-version"]).toBe("2023-06-01");
      return new Response(
        JSON.stringify({
          stop_reason: "tool_use",
          content: [
            {
              type: "tool_use",
              name: "product_profile",
              input: {
                name: "Tallybird",
                oneLiner: "Sends payment reminders for your invoices",
                oneLinerKo: "인보이스 결제 알림을 대신 보내 줘요",
                category: "finance app",
                audience: ["freelancers"],
                problems: ["chasing late payments by email"],
                features: ["scheduled reminder emails"],
                pricing: "free for 5 invoices a month, $12/month for Pro",
                stage: "beta",
                keywords: ["invoices"],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const out = await generateJSON({ system: "s", prompt: "p", schema: ProfileSchema, name: "product_profile", description: "d" });
    expect(out.name).toBe("Tallybird");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.anthropic.com/v1/messages");
  });

  it("OpenAI 호환: JSON 모드 응답을 읽는다", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "k");
    vi.stubEnv("OPENAI_MODEL", "some-model");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          choices: [{ message: { content: JSON.stringify({ drafts: [{ angle: "story", title: "t", body: "b", whyKo: ["w"], translationKo: ["번역"] }] }) } }],
        }),
      ),
    );
    const out = await generateJSON({ system: "s", prompt: "p", schema: DraftsSchema, name: "write_drafts", description: "d" });
    expect(out.drafts[0].title).toBe("t");
  });

  it("형식이 틀리면 오류를 낸다 (그러면 템플릿으로 넘어간다)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ content: [{ type: "tool_use", name: "product_profile", input: { name: 3 } }] })),
    );
    await expect(generateJSON({ system: "s", prompt: "p", schema: ProfileSchema, name: "product_profile", description: "d" })).rejects.toThrow(/schema/);
  });
});
