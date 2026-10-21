// LLM이 돌려줄 결과 모양. 같은 스키마로 요청(도구 스키마)과 검증(safeParse)을 함께 한다.

import { z } from "zod";

export const ProfileSchema = z.object({
  name: z.string().describe("Product name as written on the page"),
  oneLiner: z.string().describe("Plain English one-line description, no hype, under 110 characters. Prefer a verb phrase like 'Turns X into Y'."),
  oneLinerKo: z.string().describe("Same one-liner in natural Korean"),
  category: z.string().describe("Short category such as 'developer tool', 'productivity app', 'browser extension'"),
  audience: z.array(z.string()).max(3).describe("Who it is for, in English plural nouns, e.g. 'indie developers'"),
  problems: z
    .array(z.string())
    .max(3)
    .describe("Problems it removes, as lowercase English gerund phrases, e.g. 'writing release notes by hand'. Only what the page supports."),
  features: z.array(z.string()).max(4).describe("Concrete features stated on the page, short English phrases"),
  pricing: z.string().describe("Pricing as stated on the page in plain English, or empty string if not stated"),
  stage: z.enum(["idea", "beta", "launched", "unknown"]),
  keywords: z.array(z.string()).max(8),
});

export const PlaybookSchema = z.object({
  vibeKo: z.string().describe("2-3 Korean sentences describing the community's vibe and what performs well, grounded in the stats"),
  doKo: z.array(z.string()).max(6).describe("Korean do's, each citing the evidence (numbers from stats) when possible"),
  dontKo: z.array(z.string()).max(6).describe("Korean don'ts"),
  titleFormulas: z
    .array(z.object({ labelKo: z.string(), pattern: z.string(), example: z.string().describe("A real title from the examples, copied exactly") }))
    .max(3),
  bestAngleKo: z.string().describe("One or two Korean sentences: the best approach for THIS product in THIS community"),
  removalRisksKo: z.array(z.string()).max(5).describe("Korean list of what could get the post removed here"),
});

export const DraftsSchema = z.object({
  drafts: z
    .array(
      z.object({
        angle: z.enum(["story", "feedback", "lesson", "thread", "question", "link"]),
        title: z.string().describe("Post title. Empty string for X posts and for thread comments."),
        body: z.string().describe("Post body. For X, leave empty and use thread."),
        thread: z.array(z.string()).max(6).optional().describe("X only: tweets in order, each at most 280 characters"),
        firstComment: z.string().optional().describe("Optional first comment by the maker (e.g. where the link goes)"),
        whyKo: z.array(z.string()).max(4).describe("Korean: why this draft fits the community, citing stats"),
        translationKo: z.array(z.string()).describe("Korean translation, one entry per paragraph of body (or per tweet for X)"),
      }),
    )
    .min(1)
    .max(3),
});

export const ShortsSchema = z.object({
  title: z.string(),
  hooks: z.array(z.object({ text: z.string(), whyKo: z.string() })).min(2).max(3),
  scenes: z
    .array(
      z.object({
        start: z.number(),
        end: z.number(),
        visualKo: z.string().describe("Korean shooting direction for this shot"),
        onScreen: z.string().describe("On-screen caption in English, 3-8 words"),
        voiceover: z.string().describe("English voiceover line"),
        voiceoverKo: z.string().describe("Korean translation of the voiceover"),
      }),
    )
    .min(4)
    .max(9),
  caption: z.string(),
  hashtags: z.array(z.string()).max(6),
  checklistKo: z.array(z.string()).max(6),
});

export type ProfileOut = z.infer<typeof ProfileSchema>;
export type PlaybookOut = z.infer<typeof PlaybookSchema>;
export type DraftsOut = z.infer<typeof DraftsSchema>;
export type ShortsOut = z.infer<typeof ShortsSchema>;
