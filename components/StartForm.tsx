import Form from "next/form";
import Link from "next/link";
import type { Platform } from "@/lib/types";

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "reddit", label: "Reddit" },
  { id: "x", label: "X" },
  { id: "hn", label: "Hacker News" },
];

/** 첫 화면과 스튜디오가 함께 쓰는 시작 폼. GET 폼이라 자바스크립트가 없어도 동작한다. */
export function StartForm({ defaultUrl = "", compact = false }: { defaultUrl?: string; compact?: boolean }) {
  return (
    <Form action="/studio" className="w-full">
      <label htmlFor="start-url" className="mb-1.5 block text-[14px] font-medium text-ink-soft">
        제품 URL
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="start-url"
          name="url"
          type="text"
          inputMode="url"
          autoComplete="url"
          required
          defaultValue={defaultUrl}
          placeholder="https://내-제품.com"
          className="h-12 w-full min-w-0 rounded-md border border-rule-strong bg-sheet px-3.5 sm:flex-1 text-[16px] text-ink placeholder:text-ink-faint focus:border-blue focus:outline-none"
        />
        <button type="submit" className="h-12 shrink-0 rounded-md bg-blue px-5 text-[16px] font-bold text-sheet hover:brightness-110">
          분석 시작
        </button>
      </div>
      <fieldset className={compact ? "mt-2.5" : "mt-3.5"}>
        <legend className="sr-only">분석할 플랫폼</legend>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px]">
          {PLATFORMS.map((p) => (
            <label key={p.id} className="inline-flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" name="p" value={p.id} defaultChecked className="h-4 w-4 accent-[var(--blue)]" />
              {p.label}
            </label>
          ))}
          <Link href="/studio?sample=1" className="ml-auto text-blue underline-offset-4 hover:underline">
            샘플 제품으로 해 보기
          </Link>
        </div>
      </fieldset>
    </Form>
  );
}
