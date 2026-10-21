import type { ProductProfile } from "../types";

// 체험용 가상 제품. .example 도메인은 실제로 존재할 수 없는 예약 도메인이다(RFC 2606).
export const SAMPLE_PRODUCT_URL = "https://shiplog.example";

export const SAMPLE_PRODUCT: ProductProfile = {
  url: SAMPLE_PRODUCT_URL,
  name: "Shiplog",
  oneLiner: "Turns your git commits into release notes people actually read",
  oneLinerKo: "git 커밋을 사람들이 실제로 읽는 릴리스 노트로 바꿔 주는 도구",
  category: "developer tool",
  audience: ["indie developers", "small product teams"],
  problems: ["writing release notes by hand every week", "users never noticing new features"],
  features: [
    "drafts release notes from merged PRs and commit messages",
    "groups changes into new features, fixes and improvements",
    "publishes a hosted changelog page and an in-app widget",
  ],
  pricing: "free for one project, $9/month after that",
  stage: "beta",
  keywords: ["changelog", "release notes", "git", "github", "developer tool", "saas", "web"],
  source: "sample",
  extractedBy: "sample",
};

export function isSampleUrl(url: string): boolean {
  try {
    const u = new URL(url.includes("://") ? url : `https://${url}`);
    return u.hostname === "shiplog.example" || u.hostname.endsWith(".shiplog.example");
  } catch {
    return false;
  }
}
