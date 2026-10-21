import type { Session } from "./Studio";

/** 결과 전체를 마크다운 한 파일로. 고친 내용이 있으면 고친 글을 쓴다. */
export function exportMarkdown(s: Session): string {
  const out: string[] = [];
  out.push(`# ${s.profile.name} — 커뮤니티별 초안`, "");
  out.push(`- 제품: ${s.profile.url}`, `- 한 줄 소개: ${s.profile.oneLiner}`, `- 만든 시각: ${new Date().toLocaleString("ko-KR")}`, "");
  out.push("> [대괄호] 칸은 직접 채워야 하는 부분이에요. 올리기 전에 모두 실제 내용으로 바꿔 주세요.", "");

  for (const k of s.order) {
    const a = s.analyses[k];
    const r = s.results[k];
    if (!a || !r) continue;
    out.push(`## ${a.community.label}`, "");
    out.push(`데이터: ${a.source === "live" ? "실시간 수집" : a.source === "sample" ? "샘플(합성)" : "붙여 넣은 글"}, 글 ${a.stats.n}개`, "");
    out.push(`**분위기** ${a.playbook.vibeKo}`, "");
    out.push(`**추천 접근** ${a.playbook.bestAngleKo}`, "");
    out.push(`**홍보 규칙** ${a.rules.selfPromo.labelKo}: ${a.rules.selfPromo.noteKo}`, "");
    if (a.rules.promoDaysNoteKo) out.push(`**홍보 가능한 시간** ${a.rules.promoDaysNoteKo}`, "");
    out.push(`**반응 좋은 시간** ${a.stats.timing.bestLabelKo}`, "");
    for (const d of r.drafts) {
      const e = s.edits[d.id] ?? { title: d.title, body: d.body, thread: d.thread, firstComment: d.firstComment };
      out.push(`### ${d.angleKo}`, "");
      if (e.title) out.push(`**제목** ${e.title}`, "");
      if (e.thread?.length) {
        e.thread.forEach((t, i) => out.push(`**트윗 ${i + 1}**`, "", t, ""));
      } else if (e.body) {
        out.push(e.body, "");
      }
      if (e.firstComment) out.push("**첫 댓글**", "", e.firstComment, "");
      if (d.postTimingKo) out.push(`_${d.postTimingKo}_`, "");
    }
  }

  if (s.shorts) {
    const sh = s.shorts;
    out.push("## 쇼츠 대본", "", `${sh.title} (${sh.seconds}초, ${sh.format})`, "");
    out.push("**첫 3초 후보**", ...sh.hooks.map((h) => `- ${h.text} — ${h.whyKo}`), "");
    for (const sc of sh.scenes) {
      out.push(`- **${sc.start}–${sc.end}초** 자막: ${sc.onScreen}`, `  - 내레이션: ${sc.voiceover}`, `  - 화면: ${sc.visualKo}`);
    }
    out.push("", `**캡션** ${sh.caption}`, "", sh.hashtags.join(" "), "");
  }
  return out.join("\n");
}
