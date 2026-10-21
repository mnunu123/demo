// LLM 없이 쓰는 쇼츠 대본. 커뮤니티에서 잘 되는 첫 문장 패턴(1인칭, POV, 문제 제기)을 빌려 온다.

import type { CommunityAnalysis, ProductProfile, ShortsScene, ShortsScript } from "../types";
import { hasHangul } from "../text";
import { itSentence, lcFirst, painGerund, stripEndPunct, ucFirst } from "./english";

function painCore(p: ProductProfile): string | null {
  const raw = p.problems.find((x) => x && !hasHangul(x));
  if (!raw) return null;
  return painGerund(raw)
    .replace(/\s+(?:every|each)\s+(?:day|week|month|time|morning|night|friday|monday|sprint|release)\b.*$/i, "")
    .replace(/\s+(?:again and again|all the time|over and over)$/i, "");
}

export function templateShorts(
  profile: ProductProfile,
  analyses: CommunityAnalysis[],
  options: { format?: ShortsScript["format"]; seconds?: number } = {},
): ShortsScript {
  const format = options.format ?? "shorts";
  const seconds = options.seconds === 45 || options.seconds === 60 ? options.seconds : 30;
  const name = profile.name || "[제품 이름]";
  const pain = painCore(profile) ?? "[겪은 불편 — 예: writing release notes by hand]";
  const it = profile.oneLiner && !hasHangul(profile.oneLiner) ? itSentence(profile.oneLiner, name) : "[무엇을 하는지 한 문장]";
  const features = profile.features.filter((f) => f && !hasHangul(f)).map((f) => stripEndPunct(f));
  const f1 = features[0] ? ucFirst(features[0]) : "[핵심 기능 1]";
  const f2 = features[1] ? ucFirst(features[1]) : "[핵심 기능 2]";
  const status = [profile.stage === "beta" ? "It's in beta" : "", profile.pricing && !hasHangul(profile.pricing) ? `it's ${lcFirst(stripEndPunct(profile.pricing))}` : ""]
    .filter(Boolean)
    .join(" and ");
  const firstPersonShare = analyses.length
    ? analyses.reduce((a, x) => a + x.stats.title.firstPersonRate, 0) / analyses.length
    : 0.5;

  const hooks = [
    { text: `POV: you're ${pain} again.`, whyKo: "POV 형식은 보는 사람을 바로 그 상황에 넣어요. 쇼츠 첫 3초에 흔한 패턴이에요" },
    { text: `Stop ${pain}.`, whyKo: "짧은 명령형이라 스크롤을 멈추게 해요. 대신 바로 다음 장면에서 이유를 보여 줘야 해요" },
    {
      text: `I got tired of ${pain}, so I built this.`,
      whyKo:
        firstPersonShare >= 0.4
          ? `고른 커뮤니티 상위글의 ${Math.round(firstPersonShare * 100)}%가 1인칭으로 시작해요. 같은 말투예요`
          : "만든 사람의 1인칭 이야기라 광고 느낌이 덜해요",
    },
  ];

  const scenes: ShortsScene[] = [];
  const push = (len: number, s: Omit<ShortsScene, "start" | "end">) => {
    const start = scenes.length ? scenes[scenes.length - 1].end : 0;
    scenes.push({ start, end: start + len, ...s });
  };
  const ask = status ? `${ucFirst(status)}. Tell me what's missing.` : "Tell me what's missing.";

  push(3, {
    visualKo: "얼굴이나 화면 위에 큰 자막으로 훅 한 줄. 첫 프레임부터 글자가 보여야 해요",
    onScreen: hooks[0].text.replace(/\.$/, ""),
    voiceover: hooks[0].text,
    voiceoverKo: "훅: 지금 겪는 불편을 한 문장으로",
  });
  push(seconds === 30 ? 5 : 7, {
    visualKo: "불편한 현재 방식을 실제 화면으로 보여 주기 (손으로 하는 장면, 복잡한 화면 등)",
    onScreen: "The old way",
    voiceover: `This is how I used to do it. [옛날 방식이 얼마나 번거로웠는지 한 문장]`,
    voiceoverKo: "문제: 예전 방식이 왜 번거로웠는지 (직접 겪은 일로)",
  });
  push(seconds === 30 ? 10 : 12, {
    visualKo: "제품 화면 녹화. 클릭은 천천히, 결과가 나오는 순간을 확대",
    onScreen: `${name} does it for you`,
    voiceover: `So I built ${name}. ${it}`,
    voiceoverKo: "해결: 무엇을 만들었고 무엇을 하는지",
  });
  if (seconds >= 45) {
    push(10, {
      visualKo: "기능 두 개를 연달아 보여 주기. 장면마다 자막 한 줄",
      onScreen: f1,
      voiceover: `${f1}. ${f2}.`,
      voiceoverKo: "기능: 지금 실제로 되는 것 두 가지",
    });
  }
  push(seconds === 30 ? 7 : 8, {
    visualKo: "사용 전과 후를 나란히 보여 주는 화면. 실제 수치가 없으면 숫자 대신 화면 비교로",
    onScreen: "[결과 한 줄 — 실제 값만]",
    voiceover: "[실제로 달라진 점 — 예: 얼마나 시간이 줄었는지. 모르면 이 문장은 빼기]",
    voiceoverKo: "결과: 지어내지 말고 실제로 확인한 것만",
  });
  if (seconds === 60) {
    push(10, {
      visualKo: "만든 사람이 직접 말하는 장면. 아직 부족한 점을 솔직하게",
      onScreen: "Still early",
      voiceover: "It's not perfect yet. [아직 부족한 점 한 가지].",
      voiceoverKo: "한계: 솔직하게 말하면 댓글이 우호적이에요",
    });
  }
  const used = scenes[scenes.length - 1].end;
  push(Math.max(3, seconds - used), {
    visualKo: "마지막 장면: 제품 이름과 질문 자막. 링크는 고정 댓글이나 프로필에",
    onScreen: "What would you add?",
    voiceover: ask,
    voiceoverKo: "마무리: 상태와 가격 한 줄 + 피드백 질문",
  });

  const hashtags = ["#buildinpublic", "#indiehackers", "#sideproject"];
  const cat = profile.category.toLowerCase();
  if (/developer|devtool|code/.test(cat)) hashtags.push("#devtools");
  else if (/productivity/.test(cat)) hashtags.push("#productivity");
  else if (/ai/.test(cat)) hashtags.push("#aitools");
  if (format === "shorts") hashtags.push("#shorts");

  return {
    format,
    seconds,
    title: `I got tired of ${pain}, so I built ${name}`,
    hooks,
    scenes,
    caption: `I got tired of ${pain}, so I built ${name}. ${status ? `${ucFirst(status)}. ` : ""}What would you add?`,
    hashtags: hashtags.slice(0, 5),
    checklistKo: [
      "첫 3초 안에 문제를 화면과 자막으로 동시에 보여 주기",
      "자막은 한 화면에 한 줄, 5~7단어",
      "세로(9:16)로 녹화하고, 커서는 천천히 움직이기",
      "실제 숫자가 없으면 결과 장면은 사용 전과 후 화면 비교로 대신하기",
      "가능하면 직접 녹음하기. 만든 사람 목소리가 광고 느낌을 줄여요",
      "마지막은 질문 하나. 달린 댓글이 다음 영상 소재가 돼요",
    ],
    engine: "template",
  };
}
