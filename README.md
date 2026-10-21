# Lurk — 올리기 전에, 그 동네 글부터

제품 URL을 넣으면 Reddit, X, Hacker News에서 지금 반응 좋은 글의 패턴과 말투를 분석해, 그 커뮤니티에 맞는 게시글 초안과 쇼츠 대본을 만들어 주는 웹 서비스 데모입니다. 마케팅 예산 없는 1인 창업가가 해외 커뮤니티에 글을 올렸다가 광고로 찍혀 지워지는 일을 줄이는 게 목표입니다.

- **현지 가이드**: 잘 되는 글 유형, 제목 길이와 대소문자, 말투, 상위 25% 글과 나머지의 차이, 현지 표현(한국어 풀이), 반응 좋은 업로드 시간(한국 시간), 홍보 규칙과 AI 글 규칙
- **초안**: 커뮤니티 규칙에 맞춰 각도가 달라집니다(홍보 가능 / 요일 제한 / 정기 스레드만 / 금지). AI가 쓴 글을 금지하는 곳(Hacker News 등)에서는 대신 쓰지 않고 뼈대만 줍니다
- **실시간 점검 편집기**: 고칠 때마다 광고 냄새 점수, 어울림 점수, 직접 채울 칸, 빨간 펜 메모가 바뀝니다
- **쇼츠 대본**: 같은 분석으로 30/45/60초 세로 영상 대본
- **정직이 기본값**: 만든 사람 공개 문구, 모르는 사실은 [채울 칸], 자동 게시 없음

## 문서

- [기획서](docs/PLAN.md): 문제, 타깃, 경쟁, 기능 범위, 데이터 정책(2026년 10월 기준), 비용, 수익 모델, 리스크, 로드맵
- [구현 구상도](docs/ARCHITECTURE.md): 시스템 구조, 요청 흐름, API, 데이터 모델, 알고리즘, 보안, 배포
- [인수인계](docs/HANDOFF.md): 지금 상태, 무엇이 실제고 무엇이 샘플인지, 다음 할 일

> 먼저 볼 것: Reddit은 신규 공개 API 신청을 **2026년 10월 31일**에 마감하고, 2027년 3월에 남은 공개 API를 닫습니다. 실서비스를 생각한다면 기획서 0장을 먼저 읽어 주세요.

## 바로 실행

```bash
npm install
npm run dev
```

- http://localhost:3000 — 첫 화면
- http://localhost:3000/studio?sample=1 — 가상 제품 Shiplog로 전체 결과 보기
- http://localhost:3000/blueprint — 기획과 구조 요약

키가 하나도 없어도 동작합니다(템플릿 모드 + Hacker News 실시간 + 나머지는 샘플 데이터).

## Vercel 배포

1. Vercel에서 이 저장소를 Import (Next.js, 설정 그대로)
2. 필요하면 환경 변수 추가 → [.env.example](.env.example)
   - `ANTHROPIC_API_KEY`: Claude로 가이드, 초안, 쇼츠 작성 (기본 모델 `claude-sonnet-5-5`)
   - `ACCESS_CODE`: 공개 배포에서 LLM 키를 보호하려면 꼭 설정
   - `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET`: 승인받은 Reddit 앱
   - `X_BEARER_TOKEN`: X 최근 검색(호출마다 과금)
3. 배포 후 `/api/health`로 연결 상태 확인

Vercel Hobby(무료)는 비상업용입니다. 유료화하면 Pro가 필요합니다.

## 개발

```bash
npm test          # vitest 62개: 채점기, 규칙 해석, 템플릿, 소스 변환, LLM 응답 처리, API
npm run lint
npm run build
```

기술: Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS 4, zod, cheerio. 글꼴은 IBM Plex Sans KR, IBM Plex Serif, Nanum Pen Script(@fontsource로 자체 호스팅).

## 데이터 출처 표시

화면의 모든 분석에는 출처가 붙습니다: **실시간 수집**, **샘플(합성) 데이터**, **붙여 넣은 글**. 샘플 글과 규칙은 데모용으로 직접 쓴 합성 데이터이며 실제 게시물이 아닙니다.
