// LLM 없이 쓰는 초안 생성기. 커뮤니티 통계(제목 길이, 대소문자, 링크 문화, 규칙)에 맞춰 문장을 고른다.
// 원칙: 모르는 사실은 지어내지 않고 [대괄호] 칸으로 남긴다. 제품을 말할 땐 만든 사람이라고 밝힌다.

import type { Angle, CommunityRef, CommunityStats, Draft, ProductProfile, RulesAnalysis } from "../types";
import { applyTitleCase, hasHangul, wordCount } from "../text";
import {
  categoryNoun,
  itSentence,
  lcFirst,
  painGerund,
  parseOneLiner,
  phraseCuts,
  pickByLength,
  stripEndPunct,
  ucFirst,
  withArticle,
} from "./english";

export const ANGLE_KO: Record<Angle, string> = {
  story: "만든 이야기",
  feedback: "피드백 요청",
  lesson: "경험담",
  thread: "정기 스레드용 소개",
  question: "질문으로 참여",
  link: "링크 + 첫 댓글",
};

interface Ctx {
  profile: ProductProfile;
  ref: CommunityRef;
  stats: CommunityStats;
  rules: RulesAnalysis;
}

interface Para {
  text: string;
  roleKo: string;
  priority: number; // 낮을수록 먼저 뺀다
}

function slots(p: ProductProfile) {
  const name = p.name.trim() || "[제품 이름]";
  const englishOneLiner = p.oneLiner && !hasHangul(p.oneLiner) ? p.oneLiner : "";
  const oneLiner = englishOneLiner || "[영어 한 줄 소개 — 예: turns your git commits into release notes]";
  const parsed = englishOneLiner ? parseOneLiner(englishOneLiner, name) : {};
  const noun = categoryNoun(p.category || "");
  const pains = p.problems.filter((x) => x && !hasHangul(x));
  const pain = pains[0] ? painGerund(pains[0]) : "[어떤 불편이었는지 — 예: writing release notes by hand]";
  const audience = p.audience.find((a) => a && !hasHangul(a)) ?? "[누구를 위한 건지 — 예: indie developers]";
  const features = p.features
    .filter((f) => f && !hasHangul(f))
    .slice(0, 3)
    .map((f) => ucFirst(stripEndPunct(f)));
  const it = englishOneLiner ? itSentence(englishOneLiner, name) : `It ${oneLiner}.`;
  const verbCuts = parsed.verbPhrase ? phraseCuts(parsed.verbPhrase) : [];
  const whats = verbCuts.length
    ? verbCuts.map((v) => `a small ${noun} that ${v}`)
    : [withArticle(lcFirst(parsed.nounPhrase ?? "[무엇을 만들었는지]"))];
  const pricing =
    p.pricing && !hasHangul(p.pricing) ? `It's ${lcFirst(stripEndPunct(p.pricing))}.` : "[가격: 무료인지 유료인지 한 문장으로]";
  const stage =
    p.stage === "beta"
      ? "It's still in beta, so expect rough edges."
      : p.stage === "idea"
        ? "It's an early prototype."
        : "";
  const url = p.url || "[제품 링크]";
  return { name, oneLiner, parsed, noun, pain, audience, features, it, verbCuts, whats, pricing, stage, url };
}

function fitLength(paras: Para[], maxWords: number, minKeep: number): Para[] {
  const kept = [...paras];
  const total = () => kept.reduce((a, p) => a + wordCount(p.text), 0);
  while (total() > maxWords && kept.length > minKeep) {
    let idx = -1;
    let lowest = Infinity;
    kept.forEach((p, i) => {
      if (p.priority < lowest) {
        lowest = p.priority;
        idx = i;
      }
    });
    if (idx < 0 || lowest >= 9) break;
    kept.splice(idx, 1);
  }
  return kept;
}

function titleTarget(stats: CommunityStats) {
  const target = stats.n >= 5 ? stats.title.chars.median : 60;
  const max = stats.n >= 5 ? stats.title.chars.p75 + 6 : 90;
  return { target, max };
}

function finishTitle(title: string, ctx: Ctx, keep: string[]): string {
  const style = ctx.stats.title.caseShare >= 0.45 ? ctx.stats.title.caseStyle : "sentence";
  return applyTitleCase(title, style, keep);
}

function bestFlair(ctx: Ctx): string | undefined {
  const f = ctx.stats.flairs.find((x) => x.showcaseShare >= 0.5) ?? (ctx.rules.flairRequired ? ctx.stats.flairs[0] : undefined);
  if (f) return f.text;
  return ctx.rules.flairRequired ? "[플레어 선택 필요]" : undefined;
}

function timingNote(ctx: Ctx, promo: boolean): string {
  if (promo && ctx.rules.promoDaysNoteKo) return `홍보가 허용되는 시간: ${ctx.rules.promoDaysNoteKo}`;
  return `반응 좋은 시간대: ${ctx.stats.timing.bestLabelKo}`;
}

function why(ctx: Ctx, title: string, extra: string[]): string[] {
  const { stats } = ctx;
  const out: string[] = [];
  if (title && stats.n >= 5 && ctx.ref.platform !== "x") {
    out.push(`제목 ${title.length}자 — 이 동네 상위권 ${stats.title.chars.p25}~${stats.title.chars.p75}자에 맞췄어요`);
  }
  out.push(...extra);
  if (stats.body.endsWithQuestionRate >= 0.4) {
    out.push(`질문으로 끝내요 — 이 동네 글 ${Math.round(stats.body.endsWithQuestionRate * 100)}%가 질문으로 끝나요`);
  }
  return out.slice(0, 4);
}

function draft(id: string, angle: Angle, title: string, paras: Para[], extra: Partial<Draft>): Draft {
  return {
    id,
    angle,
    angleKo: ANGLE_KO[angle],
    title,
    body: paras.map((p) => p.text).join("\n\n"),
    glossKo: paras.map((p) => p.roleKo),
    glossKind: "roles",
    mode: "draft",
    whyKo: [],
    ...extra,
  };
}

function redditDrafts(ctx: Ctx): Draft[] {
  const s = slots(ctx.profile);
  const { stats, rules } = ctx;
  const { target, max } = titleTarget(stats);
  const keep = [s.name];
  const policy = rules.selfPromo.policy;
  const hasDays = rules.promoDays.length > 0;
  const linkInBody = policy !== "restricted" && stats.body.linkRate >= 0.15;
  const maxWords = stats.n >= 5 && stats.body.words.p75 > 0 ? Math.max(45, Math.round(stats.body.words.p75 * 1.25)) : 180;
  const roast = stats.tone.lexicon.some((l) => l.term === "roast");
  const firstPersonTitles = stats.title.firstPersonRate >= 0.3;
  // 본문이 짧은 동네에서는 문장도 짧게
  const compact = maxWords < 80;

  const linkPara: Para = linkInBody
    ? { text: `Full disclosure: I'm the solo dev behind it. If you want to try it: ${s.url}`, roleKo: "공개: 만든 사람이라고 밝히고 링크", priority: 9 }
    : { text: "Full disclosure: I'm the solo dev behind it. Link's in the first comment.", roleKo: "공개: 만든 사람이라고 밝히고 링크 위치 안내", priority: 9 };
  const firstComment = linkInBody
    ? undefined
    : `Here's the link if you want to try it: ${s.url}\n\nHappy to answer anything about how it works.`;

  const make: Record<Angle, () => Draft> = {
    story: () => {
      const cands = [
        ...s.whats.map((w) => `I built ${w}`),
        `I got tired of ${s.pain}, so I built ${s.name}`,
        ...(firstPersonTitles ? [] : [`${s.name}: ${stripEndPunct(s.oneLiner)}`]),
      ];
      const title = finishTitle(pickByLength(cands, target, max), ctx, keep);
      const paras = fitLength(
        [
          {
            text: compact
              ? `I got tired of ${s.pain}.`
              : `I got tired of ${s.pain}. It was eating [얼마나 걸렸는지 — 예: an hour every Friday].`,
            roleKo: "문제: 직접 겪은 불편",
            priority: 10,
          },
          { text: `So I built ${s.name}. ${s.it}`, roleKo: "해결: 무엇을 만들었는지 한 문장", priority: 10 },
          s.features.length
            ? { text: `What it does right now:\n${s.features.map((f) => `- ${f}`).join("\n")}`, roleKo: "기능: 지금 되는 것만", priority: 4 }
            : { text: "[지금 되는 기능 2~3개를 짧은 목록으로]", roleKo: "기능: 지금 되는 것만", priority: 4 },
          { text: `${s.stage} ${s.pricing}`.trim(), roleKo: "상태: 베타 여부와 가격을 담백하게", priority: 3 },
          {
            text: compact
              ? "Would you use something like this, or is it a non-problem for you?"
              : `Honest question for ${s.audience}: would you use something like this, or is ${s.pain} not a big deal for you?`,
            roleKo: "질문: 댓글을 부르는 구체적인 질문",
            priority: 8,
          },
          linkPara,
        ],
        maxWords,
        4,
      );
      return draft(`${ctx.ref.id}-story`, "story", title, paras, {
        firstComment,
        flairSuggestion: bestFlair(ctx),
        postTimingKo: timingNote(ctx, true),
        whyKo: why(ctx, title, [
          firstPersonTitles ? "상위권처럼 'I built…' 1인칭으로 시작해요" : "제목에 이름과 하는 일을 담백하게 붙였어요",
          linkInBody ? "링크는 본문 맨 끝에 한 번만 넣었어요" : "이 동네는 본문 링크가 드물어서 링크를 첫 댓글로 뺐어요",
          hasDays ? `홍보 요일 규칙이 있어서 올릴 시간을 적어 뒀어요` : "",
        ].filter(Boolean)),
      });
    },
    feedback: () => {
      const shortest = s.whats[0];
      const cands = [
        ...s.whats.map((w) => `Would you use ${w}?`),
        `Looking for honest feedback on ${s.name}, ${shortest}`,
        ...(roast ? [`Roast my side project: ${s.name}, ${shortest}`] : []),
      ];
      const title = finishTitle(pickByLength(cands, target, max), ctx, keep);
      const paras = fitLength(
        [
          { text: `I've been working on ${s.name} for [기간 — 예: a few months]. ${s.it}`, roleKo: "맥락: 무엇을 만들고 있는지", priority: 10 },
          { text: `I built it because I kept ${s.pain}, and I'm trying to figure out if other ${s.audience} feel the same.`, roleKo: "이유: 왜 피드백이 필요한지", priority: 7 },
          {
            text: `Things I'd love honest answers on:\n1. Is ${s.pain} actually a problem for you?\n2. What would stop you from trying it?\n3. [특히 묻고 싶은 것 — 예: does the pricing make sense?]`,
            roleKo: "질문: 답하기 쉬운 구체적인 질문 3개",
            priority: 10,
          },
          linkPara,
        ],
        maxWords,
        3,
      );
      return draft(`${ctx.ref.id}-feedback`, "feedback", title, paras, {
        firstComment,
        flairSuggestion: bestFlair(ctx),
        postTimingKo: timingNote(ctx, true),
        whyKo: why(ctx, title, ["홍보 대신 질문을 앞세워서 광고 냄새가 적어요", "답하기 쉬운 번호 질문을 넣었어요"]),
      });
    },
    lesson: () => {
      const restricted = policy === "restricted" || (policy === "conditional" && !hasDays);
      const cands = [
        `What I learned building ${withArticle(s.noun)} for ${s.audience}`,
        `Lessons from building ${withArticle(s.noun)} as a solo dev`,
        ...(stats.title.numberRate >= 0.4 ? [`What [N] months of building ${withArticle(s.noun)} taught me`] : []),
      ];
      const title = finishTitle(pickByLength(cands, target, max), ctx, keep);
      const intro = restricted
        ? `I've spent [기간 — 예: the last 6 months] building ${withArticle(s.noun)} for ${s.audience}, and a few things surprised me.`
        : `I've been building ${s.name} for [기간 — 예: 6 months] as a solo dev. A few things I didn't expect:`;
      const paras: Para[] = [
        { text: intro, roleKo: "맥락: 무엇을 얼마나 해 왔는지", priority: 10 },
        {
          text: "1. [배운 점 1 — 실제로 겪은 일, 예: 아무도 안 쓴 기능]\n2. [배운 점 2 — 예: 가격을 바꾸고 생긴 일]\n3. [배운 점 3 — 예: 첫 사용자 10명을 데려온 방법]",
          roleKo: "본론: 직접 겪은 교훈 (지어내지 말고 채우기)",
          priority: 10,
        },
        { text: "What would you add to this list?", roleKo: "질문: 다른 사람 경험을 묻기", priority: 9 },
      ];
      if (!restricted) {
        paras.push({
          text: `(For context, I'm the developer of ${s.name}. Not linking it here, happy to share if anyone asks.)`,
          roleKo: "공개: 만든 사람임을 밝히되 링크는 걸지 않음",
          priority: 9,
        });
      }
      return draft(`${ctx.ref.id}-lesson`, "lesson", title, paras, {
        postTimingKo: timingNote(ctx, false),
        whyKo: why(ctx, title, [
          restricted ? "홍보 제한이 있어서 제품 이름과 링크 없이 썼어요" : "제품보다 경험을 앞세운 글이라 홍보 요일과 상관없이 올릴 수 있어요",
          "교훈 칸은 직접 겪은 일로 채워야 해요. 지어낸 경험은 금방 티가 나요",
        ]),
      });
    },
    thread: () => {
      const paras: Para[] = [
        { text: `${s.name}: ${stripEndPunct(s.oneLiner)}.`, roleKo: "한 줄 소개", priority: 10 },
        {
          text: [
            `Who it's for: ${s.audience}`,
            s.features.length ? `What it does: ${s.features.slice(0, 2).map(lcFirst).join("; ")}` : "What it does: [핵심 기능 2개]",
            `Where it's at: ${[s.stage, s.pricing].filter(Boolean).join(" ")}`,
          ].join("\n"),
          roleKo: "대상, 기능, 상태를 세 줄로",
          priority: 10,
        },
        { text: `I'd love feedback on [특히 묻고 싶은 것]. ${s.url}`, roleKo: "피드백 요청과 링크", priority: 10 },
        { text: "(I'm the developer.)", roleKo: "공개", priority: 10 },
      ];
      return draft(`${ctx.ref.id}-thread`, "thread", "", paras, {
        postTimingKo: "본 게시판이 아니라 정기 홍보 스레드에 댓글로 올리세요",
        whyKo: ["이 커뮤니티는 제품 소개를 정기 스레드에서만 받아요", "스레드 댓글은 짧을수록 많이 읽혀요"],
      });
    },
    question: () => {
      const title = finishTitle(
        pickByLength([`How do you all deal with ${s.pain}?`, `How are you handling ${s.pain} these days?`], target, max),
        ctx,
        keep,
      );
      const paras: Para[] = [
        {
          text: `Genuinely curious how others handle this. I've been ${s.pain} and it takes me [걸리는 시간 — 예: about an hour each time].`,
          roleKo: "상황: 내가 겪는 불편",
          priority: 10,
        },
        { text: "I tried [시도해 본 방법] but [왜 별로였는지].", roleKo: "시도: 해 본 것과 실패한 이유", priority: 8 },
        { text: "What's your setup? Any tools or habits that actually stuck?", roleKo: "질문: 다른 사람 방법 묻기", priority: 10 },
      ];
      return draft(`${ctx.ref.id}-question`, "question", title, paras, {
        postTimingKo: timingNote(ctx, false),
        whyKo: why(ctx, title, [
          "제품 이야기 없이 같은 불편을 겪는 사람을 찾는 글이에요",
          "댓글에서 누가 물어보면 그때 만든 사람이라고 밝히고 소개하세요",
        ]),
      });
    },
    link: () => make.story(),
  };

  let angles: Angle[];
  if (policy === "restricted") angles = ["lesson", "question"];
  else if (policy === "conditional" && !hasDays) angles = ["thread", "lesson", "question"];
  else angles = ["story", "feedback", "lesson"];
  return angles.map((a) => make[a]());
}

const X_MAX = 280;
const len = (t: string) => [...t].length;

function xDrafts(ctx: Ctx): Draft[] {
  const s = slots(ctx.profile);
  const { stats } = ctx;
  const threadEmoji = stats.tone.lexicon.some((l) => l.term === "🧵") || stats.tone.emojiPerPost >= 0.5;
  const lower = stats.title.caseStyle === "lower" && stats.title.caseShare >= 0.5;
  const tidy = (t: string) => (lower ? t.replace(/(^|\n)([A-Z])(?=[a-z])/g, (_, a, b) => a + b.toLowerCase()) : t);
  const hashtag = ctx.ref.query?.startsWith("#") ? ctx.ref.query.split(/\s/)[0] : "";

  // 스레드
  let feats = s.features.map((f) => `→ ${lcFirst(f)}`);
  let t2 = `${s.it}\n\n${feats.join("\n")}`;
  while (len(t2) > X_MAX && feats.length > 1) {
    feats = feats.slice(0, -1);
    t2 = `${s.it}\n\n${feats.join("\n")}`;
  }
  const thread = [
    `I got tired of ${s.pain}.\n\nSo I built ${s.name}. Here's what it does${threadEmoji ? " 🧵" : ":"}`,
    t2,
    `[데모 GIF나 스크린샷 첨부]\n\n${[s.stage, s.pricing].filter(Boolean).join(" ")}`,
    `Still early, so feedback is gold.\n\nWhat would make this useful for you?\n\n${s.url}`,
  ].map(tidy);

  const update = tidy(
    `Building ${s.name} in public, week [N].\n\nWhat I learned:\n- [배운 점 1]\n- [배운 점 2]\n- [배운 점 3]\n\nNext up: [다음에 할 일]${hashtag ? `\n\n${hashtag}` : ""}`,
  );

  const short = s.verbCuts[0] ? `it ${s.verbCuts[0]}` : lcFirst(stripEndPunct(s.oneLiner));
  let ask = `Built a small ${s.noun} for ${s.audience}: ${short}.\n\n[30초 데모 영상]\n\nWould you use this? Honest takes welcome.`;
  if (len(ask) > X_MAX) ask = `Built a small ${s.noun}: ${short}.\n\n[30초 데모 영상]\n\nWould you use this?`;
  ask = tidy(ask);

  const roles = ["훅: 겪은 불편 + 만들었다는 사실", "무엇을 하는지 + 기능 화살표 목록", "데모 이미지 + 상태와 가격", "피드백 질문 + 링크"];
  return [
    {
      id: `${ctx.ref.id}-story`,
      angle: "story",
      angleKo: "만든 이야기 (스레드)",
      title: "",
      body: thread.join("\n\n"),
      thread,
      glossKo: roles,
      glossKind: "roles",
      mode: "draft",
      postTimingKo: timingNote(ctx, false),
      whyKo: [
        "첫 트윗은 불편 한 줄로 시작해 다음 트윗을 열게 만들어요",
        "링크는 마지막 트윗에만 넣었어요. 첫 트윗 링크는 노출이 줄어든다는 말이 많아요",
        threadEmoji ? "이 동네는 스레드 표시(🧵)를 흔히 써요" : "이모지 없이 담백하게 썼어요",
      ],
    },
    {
      id: `${ctx.ref.id}-lesson`,
      angle: "lesson",
      angleKo: "만드는 과정 공유",
      title: "",
      body: update,
      thread: [update],
      glossKo: ["주차 + 배운 점 목록 + 다음 계획 (숫자와 교훈은 실제 값으로)"],
      glossKind: "roles",
      mode: "draft",
      postTimingKo: timingNote(ctx, false),
      whyKo: [
        "이 동네 상위권은 숫자와 과정을 짧게 공유하는 글이 많아요",
        "배운 점은 직접 겪은 일로만 채우세요",
        hashtag ? `해시태그는 ${hashtag} 하나만 붙였어요` : "해시태그는 붙이지 않았어요",
      ],
    },
    {
      id: `${ctx.ref.id}-feedback`,
      angle: "feedback",
      angleKo: "피드백 요청",
      title: "",
      body: ask,
      thread: [ask],
      glossKo: ["무엇을 누구를 위해 만들었는지 + 데모 + 질문"],
      glossKind: "roles",
      mode: "draft",
      postTimingKo: timingNote(ctx, false),
      whyKo: ["무엇을 만들었는지, 데모, 질문을 한 트윗에 담았어요", "링크 대신 데모 영상을 붙이고, 관심 있는 사람에게 답글로 링크를 주세요"],
    },
  ];
}

function hnDrafts(ctx: Ctx): Draft[] {
  const s = slots(ctx.profile);
  const base = `Show HN: ${s.name} – `;
  const descs = s.verbCuts.length ? s.verbCuts.map((v) => ucFirst(v)) : [ucFirst(stripEndPunct(s.oneLiner))];
  const titles = descs.map((d) => base + d);
  const title = titles.filter((t) => t.length <= 80).sort((a, b) => b.length - a.length)[0] ?? titles[0].slice(0, 80);
  const pricing = s.pricing.replace(/^It's /, "It's ");

  const paras: Para[] = [
    { text: "Hi HN,", roleKo: "인사 (HN에서 흔한 시작)", priority: 10 },
    {
      text: `I built ${s.name} because I kept ${s.pain} and nothing I tried fit [기존 도구가 맞지 않았던 이유].`,
      roleKo: "왜 만들었는지",
      priority: 10,
    },
    {
      text: `${s.it} Under the hood: [어떻게 동작하는지 2~3문장 — HN은 구현 이야기를 좋아해요].`,
      roleKo: "무엇을, 어떻게 하는지 (기술 설명)",
      priority: 10,
    },
    {
      text: `What works today: ${s.features.length ? s.features.slice(0, 2).map(lcFirst).join(", ") : "[지금 되는 기능]"}. Known limitations: [솔직한 한계 1~2개].`,
      roleKo: "되는 것과 한계를 솔직하게",
      priority: 10,
    },
    {
      text: `${pricing} You can try it at ${s.url} [가입 없이 써 볼 수 있으면 "no signup needed"라고 적기].`,
      roleKo: "가격과 체험 방법",
      priority: 10,
    },
    { text: "I'd appreciate feedback, especially on [특히 의견을 듣고 싶은 부분].", roleKo: "구체적인 피드백 요청", priority: 10 },
  ];
  const comment = [
    `Hi HN, I'm the developer. Some context: I built ${s.name} because I kept ${s.pain}.`,
    `${s.it} Under the hood: [어떻게 동작하는지 2~3문장].`,
    "Known limitations: [솔직한 한계]. I'd love feedback on [특히 묻고 싶은 부분], and I'm around to answer questions.",
  ].join("\n\n");

  return [
    {
      ...draft(`${ctx.ref.id}-story`, "story", title, paras, {}),
      angleKo: "Show HN 글 (본문형)",
      postTimingKo: timingNote(ctx, false),
      whyKo: [
        `제목 ${title.length}자 — 'Show HN: 이름 – 하는 일' 형식, 80자 이내`,
        "과장 없이 무엇을 하는지만 적었어요",
        "만든 이유, 동작 방식, 한계를 솔직하게 쓰는 게 HN 문화예요",
      ],
    },
    {
      id: `${ctx.ref.id}-link`,
      angle: "link",
      angleKo: "Show HN 링크 + 첫 댓글",
      title,
      body: "",
      firstComment: comment,
      glossKo: ["URL 칸에 제품 주소를 넣고, 본문은 비워 둔 채 바로 첫 댓글로 맥락을 남겨요"],
      glossKind: "roles",
      mode: "draft",
      postTimingKo: timingNote(ctx, false),
      whyKo: ["링크로 올리고 첫 댓글에 맥락을 적는 방식도 흔해요", "올린 뒤 몇 시간은 댓글에 바로 답할 수 있을 때 올리세요"],
    },
  ];
}

// AI가 쓴 글을 금지하는 곳(HN, 일부 서브레딧): 대신 쓰지 않고 상위글 분석으로 뼈대만 준다.
function outlineDrafts(ctx: Ctx, angles: Angle[]): Draft[] {
  const s = slots(ctx.profile);
  const { stats, rules } = ctx;
  const evidence = rules.aiContent.evidence[0] ?? (ctx.ref.platform === "hn" ? "No generated text" : "AI 금지 규칙");
  const lenNote = stats.n >= 5 ? `${stats.title.chars.p25}~${stats.title.chars.p75}자` : "60자 안팎";
  const painEx = s.pain.startsWith("[") ? "" : ` — 예) ${s.pain}`;
  const common = [`규칙 "${evidence}" 때문에 대신 쓰지 않고 뼈대만 드려요`, "직접 쓴 문장은 편집기에서 바로 점검해 드려요"];

  const sections: Record<Angle, { title: string; parts: { text: string; roleKo: string }[] }> = {
    story: {
      title:
        ctx.ref.platform === "hn"
          ? `Show HN: ${s.name} – [무엇을 하는지 영어로 담백하게, 전체 80자 이내]`
          : `[영어 제목 — 'I built…'처럼 1인칭, ${lenNote}]`,
      parts:
        ctx.ref.platform === "hn"
          ? [
              { text: `[인사와 만든 이유: 직접 겪은 문제를 2~3문장${painEx}]`, roleKo: "HN은 왜 만들었는지부터 읽어요" },
              { text: "[무엇을 하는지 한 문장 + 어떻게 동작하는지 기술 설명 2~3문장]", roleKo: "구현 이야기가 가장 반응이 좋아요" },
              { text: "[지금 되는 것과 아직 부족한 점을 솔직하게]", roleKo: "한계를 먼저 말하면 공격적인 댓글이 줄어요" },
              { text: `[가격과 체험 방법 — 가입 없이 써 볼 수 있으면 그렇게. 링크: ${s.url}]`, roleKo: "가입 장벽은 Show HN 규칙에서 피하라고 해요" },
              { text: "[특히 의견을 듣고 싶은 것 한 가지]", roleKo: "질문이 구체적일수록 좋은 댓글이 달려요" },
            ]
          : [
              { text: `[겪은 불편 1~2문장${painEx}]`, roleKo: "문제부터" },
              { text: `[무엇을 만들었는지 한 문장 — 만든 사람이라고 밝히기]`, roleKo: "해결과 공개" },
              { text: "[댓글을 부르는 구체적인 질문 하나]", roleKo: "질문으로 끝내기" },
            ],
    },
    link: {
      title: `Show HN: ${s.name} – [무엇을 하는지 영어로 담백하게, 전체 80자 이내]`,
      parts: [{ text: "[첫 댓글: 만든 사람이라고 밝히고, 만든 이유와 동작 방식, 한계를 짧게. 질문을 받을 수 있을 때 올리기]", roleKo: "링크로 올리고 맥락은 첫 댓글에" }],
    },
    thread: {
      title: "",
      parts: [
        { text: `[${s.name}: 무엇을 하는지 영어 한 문장]`, roleKo: "한 줄 소개" },
        { text: "[누구를 위한 건지 / 지금 상태와 가격]", roleKo: "대상과 상태" },
        { text: `[듣고 싶은 피드백 한 가지] ${s.url}`, roleKo: "피드백 요청과 링크" },
        { text: "[만든 사람이라고 밝히는 한 줄]", roleKo: "공개" },
      ],
    },
    lesson: {
      title: `[영어 제목 — 겪은 일에서 나온 교훈, ${lenNote}]`,
      parts: [
        { text: "[무엇을 얼마나 해 왔는지 1~2문장 — 제품 이름과 링크는 빼기]", roleKo: "맥락" },
        { text: "1. [배운 점 1 — 실제로 겪은 일]\n2. [배운 점 2]\n3. [배운 점 3]", roleKo: "본론: 교훈 목록" },
        { text: "[다른 사람 경험을 묻는 질문 한 문장]", roleKo: "질문으로 끝내기" },
      ],
    },
    question: {
      title: `[영어 질문 제목 — 같은 불편을 겪는 사람을 찾는 질문, ${lenNote}]`,
      parts: [
        { text: `[내가 겪는 불편 1~2문장${painEx} — 제품 이야기는 빼기]`, roleKo: "상황" },
        { text: "[시도해 본 방법과 왜 별로였는지]", roleKo: "시도" },
        { text: "[다른 사람은 어떻게 하는지 묻는 질문]", roleKo: "질문" },
      ],
    },
    feedback: {
      title: `[영어 제목 — 피드백 부탁, ${lenNote}]`,
      parts: [
        { text: "[무엇을 만들고 있는지 1~2문장 — 만든 사람이라고 밝히기]", roleKo: "맥락" },
        { text: "[답하기 쉬운 질문 2~3개, 번호로]", roleKo: "질문" },
      ],
    },
  };

  return angles.map((angle) => {
    const sec = sections[angle];
    const isLink = angle === "link";
    return {
      id: `${ctx.ref.id}-${angle}-outline`,
      angle,
      angleKo: `${ANGLE_KO[angle]} (직접 쓰기)`,
      title: sec.title,
      body: isLink ? "" : sec.parts.map((p) => p.text).join("\n\n"),
      firstComment: isLink ? sec.parts[0].text : undefined,
      glossKo: sec.parts.map((p) => p.roleKo),
      glossKind: "roles" as const,
      mode: "outline" as const,
      postTimingKo: angle === "thread" ? "본 게시판이 아니라 정기 홍보 스레드에 댓글로 올리세요" : timingNote(ctx, angle === "story"),
      whyKo: common,
    };
  });
}

export function templateDrafts(ctx: Ctx): Draft[] {
  const drafts = ctx.ref.platform === "x" ? xDrafts(ctx) : ctx.ref.platform === "hn" ? hnDrafts(ctx) : redditDrafts(ctx);
  if (ctx.rules.aiContent.level === "banned") return outlineDrafts(ctx, drafts.map((d) => d.angle));
  if (ctx.rules.aiContent.level === "limited") {
    return drafts.map((d) => ({ ...d, whyKo: [...d.whyKo.slice(0, 3), "성의 없는 AI 글을 지우는 곳이에요. 자기 경험과 말투로 꼭 다시 쓰세요"] }));
  }
  return drafts;
}
