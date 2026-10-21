"use client";

import { useState } from "react";
import type { ShortsScript } from "@/lib/types";
import { Button, Chip, SectionTitle, cx } from "@/components/ui";
import { findPlaceholders } from "@/lib/analysis/fit";

function withFills(text: string) {
  const parts = findPlaceholders(text);
  if (!parts.length) return text;
  const out: (string | { fill: string })[] = [];
  let pos = 0;
  for (const p of parts) {
    if (p.start > pos) out.push(text.slice(pos, p.start));
    out.push({ fill: p.text });
    pos = p.end;
  }
  if (pos < text.length) out.push(text.slice(pos));
  return out.map((x, i) =>
    typeof x === "string" ? (
      <span key={i}>{x}</span>
    ) : (
      <span key={i} className="mark-fill px-0.5">
        {x.fill}
      </span>
    ),
  );
}

export function scriptToText(s: ShortsScript, hookIndex: number): string {
  const lines = [
    `${s.title} (${s.seconds}s, ${s.format})`,
    "",
    `HOOK: ${s.hooks[hookIndex]?.text ?? ""}`,
    "",
    ...s.scenes.map((sc) => `[${sc.start}-${sc.end}s] ${sc.onScreen}\nVO: ${sc.voiceover}\n화면: ${sc.visualKo}`),
    "",
    `CAPTION: ${s.caption}`,
    s.hashtags.join(" "),
  ];
  return lines.join("\n");
}

export function ShortsBoard({
  script,
  busy,
  onChange,
}: {
  script: ShortsScript | null;
  busy: boolean;
  onChange: (opts: { format: ShortsScript["format"]; seconds: number }) => void;
}) {
  const [hook, setHook] = useState(0);
  const [copied, setCopied] = useState(false);
  if (!script) {
    return <p className="text-ink-soft">{busy ? "쇼츠 대본을 쓰는 중이에요." : "쇼츠 대본이 아직 없어요."}</p>;
  }
  const scenes = script.scenes.map((s, i) => (i === 0 ? { ...s, onScreen: script.hooks[hook]?.text.replace(/\.$/, "") ?? s.onScreen, voiceover: script.hooks[hook]?.text ?? s.voiceover } : s));
  const shown = { ...script, scenes };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold leading-tight">쇼츠 대본</h2>
          <p className="mt-1 text-[13px] text-ink-soft">
            고른 커뮤니티 상위글의 말투와 첫 문장 패턴을 빌려 썼어요. {script.engine === "llm" ? "LLM이 쓴 대본이에요." : "템플릿으로 만든 대본이에요."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="형식과 길이">
          {(["shorts", "reels", "tiktok"] as const).map((f) => (
            <Button key={f} size="sm" variant={script.format === f ? "primary" : "quiet"} disabled={busy} onClick={() => onChange({ format: f, seconds: script.seconds })}>
              {f === "shorts" ? "YouTube Shorts" : f === "reels" ? "Reels" : "TikTok"}
            </Button>
          ))}
          {[30, 45, 60].map((sec) => (
            <Button key={sec} size="sm" variant={script.seconds === sec ? "primary" : "quiet"} disabled={busy} onClick={() => onChange({ format: script.format, seconds: sec })}>
              {sec}초
            </Button>
          ))}
        </div>
      </header>

      <section>
        <SectionTitle>첫 3초 (하나 고르세요)</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-3">
          {script.hooks.map((h, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setHook(i)}
              aria-pressed={hook === i}
              className={cx(
                "rounded-md border px-3 py-3 text-left transition-colors",
                hook === i ? "border-blue bg-blue-wash" : "border-rule bg-sheet hover:border-rule-strong",
              )}
            >
              <span className="block font-serif text-[16px] leading-snug">{withFills(h.text)}</span>
              <span className="mt-1 block text-[13px] text-ink-soft">{h.whyKo}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle aside={`${script.seconds}초, 세로 9:16`}>장면</SectionTitle>
        <ol className="sheet divide-y divide-rule">
          {shown.scenes.map((s, i) => (
            <li key={i} className="grid gap-3 px-4 py-4 sm:grid-cols-[4.5rem_1fr_1fr] sm:px-5">
              <div className="text-[13px] font-bold tabular-nums text-ink-soft">
                {s.start}–{s.end}초
              </div>
              <div>
                <div className="text-[12px] text-ink-faint">화면</div>
                <div className="text-[14px]">{s.visualKo}</div>
                <div className="mt-2 text-[12px] text-ink-faint">자막</div>
                <div className="font-serif text-[16px] font-semibold">{withFills(s.onScreen)}</div>
              </div>
              <div>
                <div className="text-[12px] text-ink-faint">내레이션</div>
                <div className="font-serif text-[15px]">{withFills(s.voiceover)}</div>
                <div className="mt-1 text-[13px] text-ink-soft">{s.voiceoverKo}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div>
          <SectionTitle>캡션과 해시태그</SectionTitle>
          <p className="font-serif text-[15px]">{withFills(script.caption)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {script.hashtags.map((h) => (
              <Chip key={h}>{h}</Chip>
            ))}
          </div>
        </div>
        <div>
          <SectionTitle>찍기 전에</SectionTitle>
          <ul className="space-y-1.5 text-[14px]">
            {script.checklistKo.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-ink-faint">□</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div>
        <Button
          variant="quiet"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(scriptToText(shown, hook));
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "복사됨" : "대본 전체 복사"}
        </Button>
      </div>
    </div>
  );
}
