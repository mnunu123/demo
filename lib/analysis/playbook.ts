// LLM 없이 통계만으로 만드는 "현지 가이드". LLM이 연결되면 이 내용을 바탕으로 더 다듬는다.

import type { Archetype, CommunityRef, CommunityStats, Playbook, RulesAnalysis } from "../types";
import { TITLE_CASE_KO } from "../text";
import { ARCHETYPE_KO } from "./features";

const pct = (x: number) => `${Math.round(x * 100)}%`;

const FORMULAS: Partial<Record<Archetype, string>> = {
  showcase: "I built [무엇을] to [어떤 불편을 없애려고]",
  feedback: "Would you use [무엇]? Looking for honest feedback",
  milestone: "[실제 숫자] [지표] in [기간]: what worked",
  lesson: "What I learned from [직접 겪은 일]",
  guide: "How I [이룬 결과] (step by step)",
  question: "How do you [하는 일] without [불편]?",
  discussion: "Is it just me, or [관찰한 것]?",
  other: "[구체적인 상황] + [질문]",
};

const REGISTER_KO = {
  casual: "축약형(I'm, don't)을 자주 쓰는 편한 구어체",
  neutral: "담백한 설명체",
  formal: "격식 있는 문어체",
};

export function heuristicPlaybook(ref: CommunityRef, stats: CommunityStats, rules: RulesAnalysis): Playbook {
  const label = ref.label;
  const byShare = stats.archetypes.find((a) => a.type !== "other") ?? stats.archetypes[0];
  const minCount = stats.n >= 15 ? 3 : 2;
  const byPerf = [...stats.archetypes]
    .filter((a) => a.count >= minCount && a.type !== "other")
    .sort((a, b) => b.performance - a.performance)[0];

  // 한눈에 보는 분위기
  const v: string[] = [];
  if (byShare && byPerf && byShare.type === byPerf.type) {
    v.push(`${label}에서는 '${byShare.labelKo}' 글이 가장 많고 반응도 가장 좋아요.`);
  } else if (byShare && byPerf) {
    v.push(`${label}에서는 '${byShare.labelKo}' 글이 가장 많지만, 반응은 '${byPerf.labelKo}' 글이 더 좋아요.`);
  }
  if (ref.platform === "x") {
    v.push(`첫 줄은 보통 ${stats.title.chars.p25}~${stats.title.chars.p75}자로 짧게 끊어요.`);
  } else {
    const q = stats.title.questionRate >= 0.3 ? `, 질문형 제목이 ${pct(stats.title.questionRate)}` : "";
    v.push(`제목은 보통 ${stats.title.chars.p25}~${stats.title.chars.p75}자, ${TITLE_CASE_KO[stats.title.caseStyle]}${q}.`);
  }
  const emoji =
    stats.tone.emojiPerPost < 0.2 ? ", 이모지는 거의 안 써요" : stats.tone.emojiPerPost >= 1 ? ", 이모지를 꽤 써요" : "";
  v.push(`말투는 ${REGISTER_KO[stats.tone.register]}${emoji}.`);

  // 하면 좋은 것
  const doKo: string[] = [];
  for (const l of stats.lifts) {
    if (l.topRate <= l.restRate) continue;
    const evidence = `(상위 25% 글 ${pct(l.topRate)}, 나머지 ${pct(l.restRate)})`;
    switch (l.key) {
      case "firstPerson":
        doKo.push(`제목을 'I built…', 'My…'처럼 1인칭으로 시작하세요 ${evidence}`);
        break;
      case "endsQuestion":
        doKo.push(`글 끝을 구체적인 질문 하나로 마무리하세요 ${evidence}`);
        break;
      case "number":
        doKo.push(`제목에 실제 숫자(기간, 사용자 수 등)를 넣으세요 ${evidence}`);
        break;
      case "list":
        doKo.push(`기능이나 배운 점은 짧은 목록으로 정리하세요 ${evidence}`);
        break;
      case "disclosure":
        doKo.push(`만든 사람이라는 걸 앞쪽에서 밝히세요 ${evidence}`);
        break;
      case "question":
        doKo.push(`제목을 질문형으로 써 보세요 ${evidence}`);
        break;
      case "long":
        doKo.push(`본문을 충분히 길게, 과정과 맥락을 담아 쓰세요 ${evidence}`);
        break;
      case "emoji":
        doKo.push(`이모지를 조금 섞어도 괜찮은 곳이에요 ${evidence}`);
        break;
      case "link":
        doKo.push(`본문에 링크를 넣는 글이 오히려 반응이 좋아요 ${evidence}`);
        break;
      case "bracket":
        doKo.push(`제목 앞에 [말머리]를 다는 글이 반응이 좋아요 ${evidence}`);
        break;
    }
  }
  if (ref.platform !== "x") doKo.push(`제목 길이는 ${stats.title.chars.p25}~${stats.title.chars.p75}자 사이로 맞추세요`);
  if (stats.body.words.median > 0 && ref.platform !== "x")
    doKo.push(`본문은 ${stats.body.words.p25}~${stats.body.words.p75}단어 정도가 이 동네 평균이에요`);
  if (stats.tone.register === "casual") doKo.push("I'm, don't, it's 같은 축약형을 써서 말하듯이 쓰세요");

  // 하지 말아야 할 것
  const dontKo: string[] = [];
  if (stats.adSmell.correlation !== null && stats.adSmell.correlation <= -0.2)
    dontKo.push(`홍보 문구가 많을수록 반응이 떨어져요 (광고 냄새와 반응의 순위 상관 ${stats.adSmell.correlation})`);
  dontKo.push("revolutionary, game-changer 같은 과장 표현과 'Sign up now' 같은 가입 권유");
  if (stats.tone.emojiPerPost < 0.3) dontKo.push("🚀🔥 같은 런칭 이모지");
  if (stats.tone.exclamationsPerPost < 0.5) dontKo.push("느낌표 여러 개");
  for (const l of stats.lifts) {
    if (l.topRate >= l.restRate) continue;
    if (l.key === "link") dontKo.push(`본문에 링크부터 넣기 (상위 25% 글 ${pct(l.topRate)}, 나머지 ${pct(l.restRate)}) — 링크는 끝이나 첫 댓글로`);
    if (l.key === "emoji") dontKo.push(`이모지 섞기 (상위 25% 글 ${pct(l.topRate)}, 나머지 ${pct(l.restRate)})`);
  }
  if (ref.platform !== "x" && stats.tone.hashtagsPerPost < 0.1) dontKo.push("해시태그 달기");
  if (rules.selfPromo.policy === "restricted") dontKo.push("제품 링크 걸기 — 이곳은 경험담과 질문만 받아요");
  if (rules.aiContent.level === "banned") dontKo.push("AI가 쓴 글 올리기 — 규칙으로 금지돼 있어요. 직접 쓰세요");
  else if (rules.aiContent.level === "limited") dontKo.push("AI 초안을 고치지 않고 그대로 올리기 — 성의 없는 AI 글은 지워져요");

  // 추천 접근
  let bestAngleKo: string;
  if (rules.selfPromo.policy === "restricted") {
    bestAngleKo = "제품 소개 대신 '경험담' 글로 접근하세요. 제품 이야기는 정해진 홍보 스레드가 있다면 그곳에만 짧게.";
  } else if (rules.selfPromo.policy === "conditional" && rules.promoDays.length) {
    bestAngleKo = `홍보가 허용되는 날(${rules.promoDaysNoteKo})에 '만든 이야기'로 올리고, 다른 날에는 경험담이나 질문으로 참여하세요.`;
  } else if (rules.selfPromo.policy === "conditional") {
    bestAngleKo = "제품 소개는 정기 스레드에 짧게 올리고, 본 게시판에는 경험담이나 질문 글로 참여하세요.";
  } else if (ref.platform === "hn") {
    bestAngleKo =
      "Show HN 글 하나로 승부해요. 제목은 '이름 – 하는 일'로 담백하게, 본문에는 왜 만들었는지와 어떻게 동작하는지, 아직 부족한 점을 쓰세요.";
  } else if (byPerf) {
    bestAngleKo = `'${byPerf.labelKo}' 형식이 반응이 가장 좋아요 (평균의 ${byPerf.performance}배). 이 형식으로 쓴 초안부터 다듬어 보세요.`;
  } else {
    bestAngleKo = "'만든 이야기' 초안부터 다듬어 보세요.";
  }

  // 제목 공식: 반응 좋은 유형 3개 + 실제 예시
  const ranked = [...stats.archetypes]
    .filter((a) => a.type !== "other")
    .sort((a, b) => b.performance * Math.sqrt(b.share) - a.performance * Math.sqrt(a.share))
    .slice(0, 3);
  const titleFormulas = ranked.map((a) => {
    const example = stats.examples.find((e) => e.type === a.type)?.title ?? "";
    const pattern =
      ref.platform === "hn" && a.type === "showcase"
        ? "Show HN: [이름] – [무엇을 하는지 담백하게]"
        : ref.platform === "x" && a.type === "milestone"
          ? "[실제 숫자] in [기간]. Here's what I learned:"
          : (FORMULAS[a.type] ?? "");
    return { labelKo: ARCHETYPE_KO[a.type], pattern, example };
  });

  const removalRisksKo: string[] = [];
  if (rules.selfPromo.policy !== "allowed") removalRisksKo.push(rules.selfPromo.noteKo);
  if (rules.aiContent.level === "banned") removalRisksKo.push("AI가 쓴 글을 금지해요. 걸리면 삭제되거나 차단될 수 있어요");
  else if (rules.aiContent.level === "limited") removalRisksKo.push("성의 없는 AI 글은 지워요");
  if (rules.flairRequired) removalRisksKo.push("플레어 없이 올리면 지워질 수 있어요");
  if (ref.platform === "reddit")
    removalRisksKo.push("새 계정이나 카르마가 낮은 계정은 자동으로 걸러지는 곳이 많아요. 평소에 댓글로 먼저 참여해 두세요");
  if (ref.platform === "hn") removalRisksKo.push("가입해야만 써 볼 수 있으면 Show HN 취지에 맞지 않아요. 체험 경로를 열어 두세요");
  if (ref.platform === "x") removalRisksKo.push("같은 링크와 문구를 여러 번 반복하면 스팸으로 분류될 수 있어요");

  return {
    vibeKo: v.join(" "),
    doKo: doKo.slice(0, 6),
    dontKo: dontKo.slice(0, 6),
    titleFormulas,
    bestAngleKo,
    removalRisksKo,
    engine: "heuristic",
  };
}
