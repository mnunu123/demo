import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { DataSource, PromoPolicy } from "@/lib/types";

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "quiet" | "ghost"; size?: "sm" | "md" };

export function Button({ variant = "quiet", size = "md", className, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-10 px-4 text-[15px]",
        variant === "primary" && "bg-blue text-sheet hover:brightness-110",
        variant === "quiet" && "border border-rule-strong bg-sheet text-ink hover:border-ink-faint",
        variant === "ghost" && "text-ink-soft hover:bg-rule/50 hover:text-ink",
        className,
      )}
    />
  );
}

const SOURCE_TEXT: Record<DataSource, string> = {
  live: "실시간 수집",
  sample: "샘플(합성) 데이터",
  pasted: "붙여 넣은 글",
};

export function SourceBadge({ source }: { source: DataSource }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium",
        source === "live" && "bg-good-wash text-good",
        source === "sample" && "bg-hilite-wash text-ink",
        source === "pasted" && "bg-blue-wash text-blue",
      )}
    >
      <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", source === "live" ? "bg-good" : source === "sample" ? "bg-ink-soft" : "bg-blue")} />
      {SOURCE_TEXT[source]}
    </span>
  );
}

const STAMP_STYLE: Record<PromoPolicy, string> = {
  allowed: "border-good text-good",
  conditional: "border-blue text-blue",
  restricted: "border-redpen text-redpen",
  unknown: "border-ink-faint text-ink-soft",
};

/** 홍보 규칙 도장 */
export function PolicyStamp({ policy, label }: { policy: PromoPolicy; label: string }) {
  return (
    <span
      className={cx(
        "inline-block -rotate-2 rounded-[3px] border-2 px-2 py-0.5 text-[13px] font-bold tracking-tight",
        STAMP_STYLE[policy],
      )}
    >
      {label}
    </span>
  );
}

export function Chip({ children, tone = "plain", title }: { children: ReactNode; tone?: "plain" | "local" | "ad" | "fill"; title?: string }) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[13px]",
        tone === "plain" && "bg-rule/60 text-ink",
        tone === "local" && "mark-local text-ink",
        tone === "ad" && "mark-ad text-ink",
        tone === "fill" && "mark-fill",
      )}
    >
      {children}
    </span>
  );
}

/** 0~100 눈금. value는 이 글, baseline은 이 동네 상위권 중간값 */
export function Scale({
  value,
  baseline,
  tone,
  label,
}: {
  value: number;
  baseline?: number;
  tone: "red" | "green";
  label: string;
}) {
  return (
    <div className="relative h-2 w-full rounded-full bg-rule" role="img" aria-label={label}>
      <div
        className={cx("absolute inset-y-0 left-0 rounded-full", tone === "red" ? "bg-redpen" : "bg-good")}
        style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
      />
      {baseline !== undefined && (
        <div
          className="absolute -top-1 h-4 w-0.5 bg-ink"
          style={{ left: `calc(${Math.min(100, Math.max(0, baseline))}% - 1px)` }}
          title="이 동네 상위권 중간값"
        />
      )}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h3 className="text-[15px] font-bold text-ink">{children}</h3>
      {aside && <div className="text-[13px] text-ink-soft">{aside}</div>}
    </div>
  );
}
