"use client";

import { useRef, type KeyboardEvent } from "react";
import { cx } from "@/components/ui";
import { toSegments, type Mark } from "@/lib/client/marks";

const MARK_CLASS = { ad: "mark-ad", local: "mark-local", fill: "mark-fill" } as const;

/** 글자는 textarea가 그리고, 교정 표시는 같은 글자를 투명하게 깐 뒤쪽 레이어가 그린다 */
export function MarkedField({
  value,
  onChange,
  marks,
  label,
  singleLine = false,
  className,
  placeholder,
  fieldRef,
}: {
  value: string;
  onChange: (v: string) => void;
  marks: Mark[];
  label: string;
  singleLine?: boolean;
  className?: string;
  placeholder?: string;
  fieldRef?: (el: HTMLTextAreaElement | null) => void;
}) {
  const local = useRef<HTMLTextAreaElement | null>(null);
  const segments = toSegments(value, marks);
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (singleLine && e.key === "Enter") e.preventDefault();
  };
  return (
    <div className={cx("editor", className)}>
      <div aria-hidden className="editor-layer">
        {segments.map((s, i) =>
          s.kind ? (
            <mark key={i} className={MARK_CLASS[s.kind]}>
              {s.text}
            </mark>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
        {value.length === 0 && placeholder ? <span>{placeholder}</span> : null}
        {"​"}
      </div>
      <textarea
        ref={(el) => {
          local.current = el;
          fieldRef?.(el);
        }}
        aria-label={label}
        className="editor-input placeholder:text-ink-faint"
        value={value}
        placeholder={placeholder}
        spellCheck
        onKeyDown={onKeyDown}
        onChange={(e) => onChange(singleLine ? e.target.value.replace(/\n/g, " ") : e.target.value)}
      />
    </div>
  );
}
