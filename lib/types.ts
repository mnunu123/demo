// 앱 전체에서 쓰는 데이터 모양. 서버(API)와 브라우저가 같은 타입을 공유한다.

export type Platform = "reddit" | "x" | "hn";

/** 데이터가 어디서 왔는지. 화면에서 항상 이 값을 보여 준다. */
export type DataSource = "live" | "sample" | "pasted";

export type ProductStage = "idea" | "beta" | "launched" | "unknown";

export interface ProductProfile {
  url: string;
  name: string;
  /** 영어 한 줄 소개 (커뮤니티 글에 들어간다) */
  oneLiner: string;
  /** 한국어 한 줄 소개 (화면 설명용, 없을 수 있음) */
  oneLinerKo?: string;
  category: string;
  /** 누가 쓰는지. 예: "indie developers" */
  audience: string[];
  /** 해결하는 불편. 가능하면 ~ing 형태: "writing release notes by hand" */
  problems: string[];
  features: string[];
  pricing: string;
  stage: ProductStage;
  keywords: string[];
  source: "live" | "sample" | "manual";
  extractedBy: "llm" | "heuristic" | "sample";
}

export interface CommunityRef {
  platform: Platform;
  /** reddit: 서브레딧 이름, x: 검색 키(해시태그), hn: "show_hn" */
  id: string;
  label: string;
  /** X·HN 검색어 */
  query?: string;
}

export type PromoPolicy = "allowed" | "conditional" | "restricted" | "unknown";

export interface CommunitySuggestion extends CommunityRef {
  reasonKo: string;
  topicKo: string;
  fit: number;
  hasSample: boolean;
}

export interface Post {
  id: string;
  platform: Platform;
  community: string;
  /** X는 제목이 없어서 첫 줄을 제목처럼 쓴다 */
  title: string;
  body: string;
  permalink?: string;
  externalUrl?: string;
  score: number;
  comments: number;
  shares?: number;
  createdAt: string;
  flair?: string;
  media?: "text" | "link" | "image" | "video";
}

export interface CommunityRule {
  title: string;
  description: string;
}

export interface CollectResult {
  community: CommunityRef;
  about?: { title?: string; description?: string; members?: number };
  posts: Post[];
  rules: CommunityRule[];
  source: DataSource;
  fetchedAt: string;
  noticeKo?: string;
}

export type Archetype =
  | "showcase"
  | "feedback"
  | "milestone"
  | "lesson"
  | "guide"
  | "question"
  | "discussion"
  | "other";

export type TitleCase = "sentence" | "title" | "lower" | "upper" | "mixed";

export interface AdSmellHit {
  field: "title" | "body";
  start: number;
  end: number;
  text: string;
  kind:
    | "hype"
    | "cta"
    | "corporate"
    | "emoji"
    | "exclaim"
    | "caps"
    | "hashtag"
    | "link"
    | "superlative";
  weight: number;
  noteKo: string;
  fixKo: string;
}

export interface AdSmellResult {
  score: number;
  band: "native" | "light" | "promo" | "danger";
  hits: AdSmellHit[];
  /** 점수를 낮춰 준 좋은 신호 (질문, 경험담, 공개 문구 등) */
  goodSignalsKo: string[];
}

export interface PostFeatures {
  titleChars: number;
  titleWords: number;
  titleCase: TitleCase;
  isQuestion: boolean;
  hasNumber: boolean;
  firstPerson: boolean;
  hasBracketTag: boolean;
  emojiCount: number;
  exclamations: number;
  bodyWords: number;
  bodyParagraphs: number;
  hasList: boolean;
  linkCount: number;
  linkInOpening: boolean;
  endsWithQuestion: boolean;
  contractionsPer100: number;
  slang: string[];
  hashtags: number;
  disclosure: boolean;
  avgSentenceWords: number;
  archetype: Archetype;
  adSmell: number;
  weekdayUtc: number;
  hourUtc: number;
  engagement: number;
}

export interface Range {
  p25: number;
  median: number;
  p75: number;
}

export interface FeatureLift {
  key: string;
  labelKo: string;
  topRate: number;
  restRate: number;
}

export interface ArchetypeShare {
  type: Archetype;
  labelKo: string;
  share: number;
  /** 이 유형의 평균 반응 / 전체 평균 반응 */
  performance: number;
  count: number;
}

export interface LexiconHit {
  term: string;
  glossKo: string;
  count: number;
}

export interface TimeBlock {
  /** 한국 시간 기준 시작 시각 (0, 3, 6 ... 21) */
  startHourKst: number;
  share: number;
}

export interface TopPostSummary {
  id: string;
  title: string;
  excerpt: string;
  score: number;
  comments: number;
  archetype: Archetype;
  archetypeKo: string;
  adSmell: number;
  permalink?: string;
  createdAt: string;
  whyKo: string[];
}

export interface CommunityStats {
  n: number;
  engagement: { medianScore: number; medianComments: number; discussionRatio: number };
  title: {
    chars: Range;
    words: Range;
    questionRate: number;
    numberRate: number;
    firstPersonRate: number;
    bracketRate: number;
    caseStyle: TitleCase;
    caseShare: number;
    openers: { text: string; count: number }[];
  };
  body: {
    words: Range;
    listRate: number;
    linkRate: number;
    endsWithQuestionRate: number;
    emptyRate: number;
  };
  tone: {
    contractionsPer100: number;
    emojiPerPost: number;
    exclamationsPerPost: number;
    hashtagsPerPost: number;
    avgSentenceWords: number;
    register: "casual" | "neutral" | "formal";
    lexicon: LexiconHit[];
    disclosureRate: number;
  };
  archetypes: ArchetypeShare[];
  lifts: FeatureLift[];
  phrases: { text: string; count: number }[];
  timing: { blocks: TimeBlock[]; bestLabelKo: string; sampleSize: number };
  adSmell: { median: number; p75: number; correlation: number | null };
  topPosts: TopPostSummary[];
  /** 유형별로 반응이 가장 좋았던 실제 제목 */
  examples: { type: Archetype; title: string }[];
  /** 게시물에 달린 플레어(말머리)와 그중 '만든 것 공개' 글 비율 */
  flairs: { text: string; count: number; showcaseShare: number }[];
}

export interface RulesAnalysis {
  selfPromo: {
    policy: PromoPolicy;
    labelKo: string;
    evidence: string[];
    noteKo: string;
  };
  /** banned: AI가 쓴 글 금지(뼈대만 제공), limited: 성의 없는 AI 글 제한(직접 다듬기 권장) */
  aiContent: { level: "none" | "limited" | "banned"; evidence: string[] };
  flairRequired: boolean;
  linkNoteKo?: string;
  accountNoteKo?: string;
  promoDays: string[];
  promoDaysNoteKo?: string;
  titleNotesKo: string[];
  checklistKo: string[];
}

export interface Playbook {
  vibeKo: string;
  doKo: string[];
  dontKo: string[];
  titleFormulas: { labelKo: string; pattern: string; example: string }[];
  bestAngleKo: string;
  removalRisksKo: string[];
  engine: "llm" | "heuristic";
}

export interface CommunityAnalysis {
  community: CommunityRef;
  source: DataSource;
  fetchedAt: string;
  noticeKo?: string;
  about?: { title?: string; description?: string; members?: number };
  stats: CommunityStats;
  rules: RulesAnalysis;
  /** 원문 규칙 (초안 생성 때 다시 쓴다) */
  rulesRaw: CommunityRule[];
  playbook: Playbook;
}

export type Angle = "story" | "feedback" | "lesson" | "thread" | "question" | "link";

export interface Draft {
  id: string;
  angle: Angle;
  angleKo: string;
  title: string;
  body: string;
  /** X 스레드일 때 트윗 목록 (body는 합친 글) */
  thread?: string[];
  firstComment?: string;
  flairSuggestion?: string;
  whyKo: string[];
  /** 문단별 한국어 설명 또는 번역 */
  glossKo: string[];
  glossKind: "translation" | "roles";
  /** outline: AI 글 금지 커뮤니티용 뼈대 (직접 써야 함) */
  mode: "draft" | "outline";
  postTimingKo?: string;
}

export interface GenerateResult {
  community: CommunityRef;
  drafts: Draft[];
  engine: "llm" | "template";
  noticeKo?: string;
}

export interface ShortsScene {
  start: number;
  end: number;
  visualKo: string;
  onScreen: string;
  voiceover: string;
  voiceoverKo: string;
}

export interface ShortsScript {
  format: "shorts" | "reels" | "tiktok";
  seconds: number;
  title: string;
  hooks: { text: string; whyKo: string }[];
  scenes: ShortsScene[];
  caption: string;
  hashtags: string[];
  checklistKo: string[];
  engine: "llm" | "template";
}

export interface HealthInfo {
  llm: "anthropic" | "openai" | "none";
  model?: string;
  reddit: "oauth" | "public";
  x: boolean;
  hn: true;
  accessCodeRequired: boolean;
}
