import type { Metadata, Viewport } from "next";
import "@fontsource/ibm-plex-sans-kr/400.css";
import "@fontsource/ibm-plex-sans-kr/500.css";
import "@fontsource/ibm-plex-sans-kr/700.css";
import "@fontsource/ibm-plex-serif/400.css";
import "@fontsource/ibm-plex-serif/600.css";
import "@fontsource/nanum-pen-script/400.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lurk — 올리기 전에, 그 동네 글부터",
  description:
    "제품 URL을 넣으면 Reddit, X, Hacker News에서 지금 반응 좋은 글의 패턴과 말투를 분석해, 그 커뮤니티에 맞는 게시글과 쇼츠 대본을 만들어 주는 도구 (데모)",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef1f4" },
    { media: "(prefers-color-scheme: dark)", color: "#10161f" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
