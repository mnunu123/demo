import type { Metadata } from "next";
import { Suspense } from "react";
import Studio from "@/components/studio/Studio";

export const metadata: Metadata = { title: "스튜디오 — Lurk" };

export default function StudioPage() {
  return (
    <Suspense fallback={<div className="px-6 py-16 text-ink-soft">불러오는 중</div>}>
      <Studio />
    </Suspense>
  );
}
