// 데모용 합성 데이터. 실제 게시물이나 실제 규칙을 옮긴 것이 아니다.
// 각 커뮤니티에서 흔히 보이는 글 모양(유형, 길이, 말투, 반응 차이)을 흉내 내서 직접 쓴 글이다.
// 실시간 수집이 안 될 때(키 없음, 차단, 네트워크 오류)만 쓰이고, 화면에 "샘플"이라고 표시된다.

import type { CollectResult, CommunityRef, CommunityRule, Post } from "../types";
import { SHOW_HN_RULES } from "../sources/hn";
import { X_RULES } from "../sources/x";

interface Seed {
  t: string; // 제목 (X는 빈 문자열)
  b?: string; // 본문
  s: number; // 점수(업보트·좋아요·포인트)
  c: number; // 댓글
  r?: number; // 리트윗+인용
  d: number; // UTC 요일 0=일
  h: number; // UTC 시
  w?: number; // 몇 주 전
  f?: string; // 플레어
  m?: Post["media"];
}

interface SampleCommunity {
  ref: CommunityRef;
  about: { title: string; description: string; members?: number };
  rules: CommunityRule[];
  seeds: Seed[];
}

const SIDEPROJECT: SampleCommunity = {
  ref: { platform: "reddit", id: "SideProject", label: "r/SideProject" },
  about: {
    title: "Side Project",
    description: "A place to share your side projects, get feedback and find your first users.",
  },
  rules: [
    { title: "Be respectful", description: "Constructive criticism is welcome. Personal attacks are not." },
    {
      title: "Self-promotion with substance",
      description:
        "Sharing your own project is the point of this sub. Explain what it is, why you built it and what feedback you want. Link-only posts will be removed.",
    },
    { title: "No spam", description: "Don't post the same project more than once a week. No referral or affiliate links." },
    { title: "No low-effort AI content", description: "Posts that are obviously AI-generated marketing copy may be removed." },
  ],
  seeds: [
    {
      t: "I built a tiny app that tells you which subscriptions you forgot about",
      b: "Last month I found out I'd been paying for 3 apps I hadn't opened since 2023. About $40 a month, gone, for nothing.\n\nSo I spent a few weekends building a small thing that reads your bank export (just a CSV, nothing connected to your bank) and flags recurring charges. It groups them by merchant, shows when each one renews, and links to the cancel page when it can find one.\n\nIt's rough but it works. No account needed, and everything stays in your browser, so I never see your data.\n\nWhat would make you actually trust something like this with your statements?",
      s: 1240, c: 186, d: 2, h: 15, m: "image",
    },
    {
      t: "After 8 months of nights and weekends, my habit tracker finally has its first 100 users",
      b: "Not a big number, I know. But a year ago I had zero shipped projects and a folder full of half-finished repos.\n\nThe app itself is simple: one habit per screen, a streak, and a short weekly note. I kept almost every feature request out, which was harder than building anything.\n\nWhat worked: posting progress here, replying to every comment, and cutting 70% of the features I planned.\nWhat didn't: my Product Hunt launch (12 upvotes lol).\n\nHappy to answer questions if anyone's earlier in the journey.",
      s: 980, c: 143, d: 3, h: 14,
    },
    {
      t: "Roast my landing page. I can't tell if it explains what the product does",
      b: "I've been staring at it for too long. It's a tool that turns meeting notes into a to-do list for each person. My friends say 'looks nice' which tells me nothing.\n\nBe brutal. What's confusing in the first 5 seconds?\n\nLink in the comments.",
      s: 640, c: 212, d: 4, h: 16,
    },
    {
      t: "I made a browser extension that blurs YouTube recommendations until you finish your to-do list",
      b: "Mostly built it for myself because I kept 'just checking one video'. Then my roommate wanted it, then her coworkers.\n\nThe trick that made it stick: it doesn't block YouTube. It hides the sidebar and home feed until you tick off your tasks for the day. Search still works if you actually need a video.\n\nIt's free and open source. Took about 3 weeks, mostly fighting with YouTube's DOM changes.\n\nWould you use this or is it too annoying?",
      s: 870, c: 97, d: 1, h: 13, m: "video",
    },
    {
      t: "My side project made $0 for 6 months. Here's what I changed",
      b: "Short version: I was building for 'everyone'. My landing page said 'for freelancers, agencies and teams' and nobody felt it was for them.\n\nOnce I picked one group (freelance translators) and talked to 14 of them, I learned their real problem was tracking word counts across clients, not invoicing. I rewrote the onboarding around that in a weekend and got my first 3 paying users that month.\n\nNot life-changing money but it finally feels real. Anyone else stuck in the 'nobody pays' phase? What got you out?",
      s: 1110, c: 164, d: 2, h: 17, w: 1,
    },
    {
      t: "Built a weather app that only tells you one thing: do you need a jacket",
      b: "That's it. One screen, yes or no. I got tired of reading 14-day forecasts to answer a simple question.\n\nTook a weekend, uses a free weather API. Curious if people find this useful or if I'm the only lazy one.",
      s: 520, c: 88, d: 6, h: 15, m: "image",
    },
    {
      t: "Is it worth adding user accounts to a free tool?",
      b: "My little PDF merger gets ~200 visitors a day. People keep asking to save their history, but adding auth feels like a whole new project. How did you decide when to add accounts?",
      s: 180, c: 61, d: 5, h: 18,
    },
    {
      t: "I rebuilt my portfolio site 5 times this year. This one finally stuck",
      b: "Main lesson: stop picking a framework first and write the content first. Plain HTML this time. Loads in 0.3s.\n\nOpen to feedback on the project section, it still feels long.",
      s: 260, c: 40, d: 0, h: 20, m: "image",
    },
    {
      t: "🚀 Introducing TaskFlow AI — the ultimate productivity platform for teams!",
      b: "TaskFlow AI is a revolutionary, AI-powered platform that helps teams supercharge their productivity. ✨ Seamless integrations, powerful analytics and much more!\n\nSign up now and get 50% off: https://taskflow-ai.example/?utm_source=reddit",
      s: 3, c: 4, d: 3, h: 9,
    },
    {
      t: "Check out my new app!!",
      b: "It's the best todo app ever made. Download now: https://todo-best.example/app",
      s: 1, c: 2, d: 1, h: 7, w: 1,
    },
    {
      t: "I turned my grandma's recipe cards into a tiny searchable website",
      b: "She has around 300 handwritten cards. I scanned them, ran OCR, and fixed the mistakes by hand over two months (OCR does not like cursive).\n\nThe hardest part was search. Her spelling of ingredients changes from card to card, so I added a small synonym list. Her 'catsup' is my 'ketchup'.\n\nNo ads, no login. It's just for the family but I figured some of you might like the build. Stack is plain Astro and a JSON file.\n\nWhat would you add for the next version?",
      s: 2100, c: 245, d: 0, h: 16, m: "image",
    },
    {
      t: "What's your process for validating an idea before writing code?",
      b: "I always start building first and regret it. Do you do landing pages, interviews, something else?",
      s: 340, c: 127, d: 2, h: 12, w: 1,
    },
    {
      t: "Made a free tool to check if your app name is taken across app stores, domains and socials",
      b: "Naming is the worst part of every side project for me. This checks the App Store, Play Store, .com/.io/.app and a few socials in one go.\n\nIt also flags names that are one letter away from a big brand, because I got a scary email about that once.\n\nIt's free, no signup. I'm the dev, so happy to hear what's broken.",
      s: 760, c: 92, d: 4, h: 14, w: 1,
    },
    {
      t: "Two years, three pivots, one tiny SaaS: what I'd do differently",
      b: "1. Talk to users before writing the pricing page, not after.\n2. Don't build integrations nobody asked for.\n3. Charge earlier. My first paying customer came the week I added a price.\n4. Write the docs before the feature. If I can't explain it in two sentences, nobody will use it.\n\nIt's an uptime checker for small agencies, around 40 paying customers now. I'm the solo dev, so ask me anything about the boring parts too.",
      s: 1450, c: 198, d: 3, h: 15, w: 1,
    },
    {
      t: "Looking for feedback on my language-learning flashcard app",
      b: "It builds cards from sentences you highlight while reading. Still in beta, free for now. I'd love to know if the review screen makes sense. Beta testers say it's confusing but can't say why.",
      s: 150, c: 33, d: 5, h: 10,
    },
    {
      t: "We are excited to announce the launch of our new platform",
      b: "Our innovative solution empowers creators to leverage cutting-edge tools. Visit our website to learn more and join the waitlist today!",
      s: 2, c: 1, d: 4, h: 8,
    },
    {
      t: "I made a CLI that renames thousands of photos by the date they were actually taken",
      b: "My phone backups were a mess of IMG_4821 files. This reads EXIF dates and renames them in one go, with a dry-run mode so you don't destroy anything.\n\nWritten in Go, open source. Feedback on the flags welcome, naming things is hard.",
      s: 430, c: 51, d: 1, h: 16,
    },
    {
      t: "Day 30 of building a meal planner for people who hate meal planning",
      b: "Quick update: added grocery lists, removed the calorie stuff nobody used. 37 people tried it this week. What's one thing that makes you quit a meal planning app?",
      s: 95, c: 22, d: 6, h: 18, w: 1,
    },
  ],
};

const SAAS: SampleCommunity = {
  ref: { platform: "reddit", id: "SaaS", label: "r/SaaS" },
  about: {
    title: "SaaS",
    description: "Discussions about building, marketing and growing software-as-a-service businesses.",
  },
  rules: [
    {
      title: "No direct promotion",
      description:
        "Posts that only promote your product will be removed. Share your product in the weekly 'Share your SaaS' thread instead.",
    },
    { title: "Provide value", description: "Posts should start a discussion or share experience other founders can learn from." },
    { title: "No AI-generated posts", description: "Low-effort AI-written posts will be removed." },
    { title: "No affiliate links", description: "Affiliate and referral links are not allowed." },
  ],
  seeds: [
    {
      t: "$0 to $4.2k MRR in 11 months, bootstrapped. The boring stuff that actually worked",
      b: "No launch, no viral post. Just:\n\n- Cold emailing 20 agencies a day for the first 3 months\n- Fixing onboarding until activation went from 18% to 41%\n- Annual plans (cash flow saved me twice)\n- Killing two features that caused most support tickets\n\nChurn is still my biggest problem (around 6% monthly). If you've beaten churn at this stage, what moved the needle?",
      s: 890, c: 176, d: 2, h: 14,
    },
    {
      t: "What I learned after 40 customer interviews for a B2B tool nobody wanted",
      b: "I spent 3 months building before talking to anyone. Classic. Then I did 40 interviews over 6 weeks and learned the problem was real but the buyer wasn't who I thought.\n\nUsers loved it. Their managers wouldn't pay for it, because it saved the users time but didn't show up in any report the managers cared about.\n\nWhat I'd do differently:\n- Ask 'who signs the invoice?' in the first call, not the tenth\n- Interview the buyer and the user separately\n- Stop counting 'this is cool' as validation\n\nHas anyone sold a tool where the user and the buyer want different things? How did you handle it?",
      s: 1320, c: 203, d: 3, h: 15,
    },
    {
      t: "How are you handling pricing for usage-based AI features?",
      b: "Our LLM costs swing a lot per user. Flat pricing feels dangerous, usage pricing scares small customers. What did you end up doing? Credits? Caps? A fair-use clause?",
      s: 410, c: 158, d: 4, h: 16,
    },
    {
      t: "Our churn dropped from 9% to 4% after one change to the cancel flow",
      b: "We added a single question before cancel: 'What would have made you stay?' with 4 options and free text. No discounts, no guilt trip.\n\nTurns out 40% were leaving because of one missing export format. We shipped it in a week and emailed everyone who had picked that answer. Some came back.\n\nNot a trick, just listening at the right moment. Happy to share the exact flow if it helps.",
      s: 760, c: 121, d: 2, h: 16, w: 1,
    },
    {
      t: "Is anyone else finding Google Ads useless for niche B2B?",
      b: "Spent $1,800 over two months, got 3 trials and 0 paid. LinkedIn content is doing way better for free. What channels are working for you right now?",
      s: 280, c: 134, d: 1, h: 15,
    },
    {
      t: "How do you find your first 10 users when you have zero audience?",
      b: "Technical founder here, no network, no followers. Built a scheduling tool for physiotherapy clinics. Do I just start calling clinics? Feels awkward but maybe that's the answer.",
      s: 350, c: 142, d: 3, h: 13, w: 1,
    },
    {
      t: "Revolutionize your workflow with our AI-powered all-in-one SaaS platform 🚀",
      b: "Unlock seamless productivity! Our cutting-edge solution helps teams of all sizes. Start your free trial today 👉 https://flowly.example/?ref=reddit",
      s: 1, c: 3, d: 4, h: 7,
    },
    {
      t: "Lessons from shutting down my SaaS after 2 years",
      b: "It wasn't a dramatic failure. It made $900/month and needed 20 hours a week. I wasn't excited about it anymore and the market wasn't growing.\n\nI sold the customer list to a competitor for a small amount, gave everyone 60 days of notice and exported their data for them. Two customers emailed to say thanks, which honestly helped.\n\nThings I'd tell myself: pick a market that's growing, charge more from day one, and don't confuse 'some revenue' with 'a business'.",
      s: 1080, c: 167, d: 0, h: 17,
    },
    {
      t: "Annual vs monthly: what % of your customers pick annual?",
      b: "We're at 22% annual with a 2-months-free discount. Feels low? Curious what others see.",
      s: 190, c: 88, d: 5, h: 15,
    },
    {
      t: "We hit $10k MRR. Here's our exact acquisition breakdown",
      b: "Since people always ask:\n\n- SEO (comparison pages): 38%\n- Partner integrations listing: 27%\n- Referrals: 19%\n- Everything else: 16%\n\nNo paid ads. The comparison pages took the longest but compound the most. AMA about any of these.",
      s: 1520, c: 231, d: 2, h: 15, w: 1,
    },
    {
      t: "Excited to announce our Series A! 🎉",
      b: "We are thrilled to announce that we've raised $5M to transform how teams collaborate. Join us on this journey! Check it out: https://example.com",
      s: 12, c: 9, d: 1, h: 9,
    },
    {
      t: "How I got my first paying customer from a Reddit comment (not a post)",
      b: "I wasn't promoting anything. Someone asked how to automate invoice reminders and I explained how I did it, step by step. They messaged me asking if I'd sell it. That became the first version.\n\nHelping in comments beats posting links.",
      s: 940, c: 112, d: 4, h: 15,
    },
    {
      t: "What's your ICP and how did you figure it out?",
      b: "We have users from dentists to marketing agencies. I know we need to pick one. How did you decide? Revenue per customer, retention, how easy they were to reach?",
      s: 220, c: 96, d: 3, h: 17,
    },
    {
      t: "Founders who went from freelance to SaaS: was it worth it?",
      b: "Freelancing pays my bills well. The SaaS makes $600/mo. Part of me wants to go all in. Would love to hear from people who made the jump, good or bad.",
      s: 300, c: 119, d: 0, h: 14, w: 1,
    },
    {
      t: "The ultimate guide to scaling your SaaS to 7 figures!!",
      b: "Follow these 10 proven secrets to skyrocket your growth! Link in bio for the full course.",
      s: 4, c: 5, d: 6, h: 8,
    },
    {
      t: "PSA: check your Stripe failed payment settings, we were losing 3% MRR to card failures",
      b: "Smart retries were on, but dunning emails were off. Turned on reminder emails and the card updater and recovered most of it in a month. Takes 10 minutes, go check.",
      s: 670, c: 74, d: 1, h: 16,
    },
    {
      t: "Building in public is overrated (for B2B)",
      b: "My B2B customers don't care about my MRR tweets. They care about integrations and support response time. Maybe it works for indie consumer apps? Change my mind.",
      s: 430, c: 187, d: 4, h: 14, w: 1,
    },
    {
      t: "How much money did you spend before getting real traction?",
      b: "Domain, tools, ads, contractors... I'm at about $3k spent and 9 paying users. Trying to figure out if that's normal or if I'm burning money.",
      s: 160, c: 104, d: 5, h: 16, w: 1,
    },
  ],
};

const WEBDEV: SampleCommunity = {
  ref: { platform: "reddit", id: "webdev", label: "r/webdev" },
  about: {
    title: "webdev",
    description: "A community dedicated to all things web development: front-end, back-end, and everything in between.",
  },
  rules: [
    {
      title: "Self-promotion only on Saturdays",
      description:
        "Posts promoting your own project, product or service are only allowed on Saturdays (Showoff Saturday) and must use the Showoff Saturday flair.",
    },
    { title: "No commercial promotion", description: "Ads, sales pitches and paid product promotion are not allowed on any day." },
    { title: "Be civil", description: "No personal attacks, harassment or gatekeeping." },
    { title: "No low-effort questions", description: "Search before asking. Questions must include what you tried." },
    { title: "Follow the 9:1 guideline", description: "Most of your activity here should be regular participation, not links to your own stuff." },
  ],
  seeds: [
    {
      t: "Am I the only one who misses when websites were just HTML files?",
      b: "Spent today debugging a hydration error on a page that shows three paragraphs of text. Three. Paragraphs. lol",
      s: 2400, c: 412, d: 3, h: 15,
    },
    {
      t: "I built a tiny CSS layout debugger that outlines every element on hover",
      b: "It's a bookmarklet, no install. Shows margin and padding like devtools but faster to toggle, and you can pin an element to compare spacing with its siblings. Open source, MIT.\n\nngl I mostly made it because I was tired of adding `* { outline: 1px solid red }` and forgetting to remove it. Feedback welcome, especially if it breaks on your site.",
      s: 1300, c: 96, d: 6, h: 16, f: "Showoff Saturday", m: "video",
    },
    {
      t: "What's your go-to stack for a small client site in 2026?",
      b: "Client wants a 6-page site they can edit themselves. I keep going back and forth between a static site with a headless CMS and just using WordPress. What are you all actually shipping these days?",
      s: 520, c: 388, d: 2, h: 14,
    },
    {
      t: "Finally understood CSS grid after 5 years of faking it with flexbox",
      b: "What made it click: thinking in tracks, not items. Wrote a short explainer with interactive examples if anyone's in the same boat (link in the comments, it's my blog, no ads).",
      s: 980, c: 120, d: 4, h: 13,
    },
    {
      t: "Showoff Saturday: a color palette generator that checks contrast as you pick",
      b: "Every palette tool I tried made pretty colors that fail WCAG. This one shows the contrast ratio live and suggests the nearest passing shade. Free, no account. I'm the dev, roast it.",
      s: 860, c: 74, d: 6, h: 15, f: "Showoff Saturday", m: "image", w: 1,
    },
    {
      t: "Our build went from 4 minutes to 40 seconds and the fix was embarrassing",
      b: "We were bundling the entire icon library. All 5,000 icons. On every page. tbh I'm a little proud and a little ashamed.",
      s: 1750, c: 203, d: 1, h: 16,
    },
    {
      t: "How do you deal with clients who want 'just one more small change'?",
      b: "Fixed price project, we're on revision 9. Every change is 'tiny'. How do you set boundaries without losing the client?",
      s: 640, c: 297, d: 5, h: 14,
    },
    {
      t: "Check out my new website builder!! 🔥🔥",
      b: "It's the best website builder, way better than the others. Sign up now: https://buildfast.example",
      s: 0, c: 6, d: 2, h: 9,
    },
    {
      t: "PSA: your 'accessible' modal probably isn't",
      b: "Things I keep seeing in code reviews:\n- focus isn't trapped\n- Escape doesn't close it\n- focus doesn't return to the button after closing\n- the background still scrolls\n\nNone of these are hard to fix. Please test with a keyboard once.",
      s: 1100, c: 88, d: 3, h: 17, w: 1,
    },
    {
      t: "Is it just me or are job postings asking for 10 frameworks for a junior role?",
      b: "Saw one today: React, Vue, Angular, Next, Nuxt, GraphQL, Docker, K8s, AWS and 'some design skills'. For 'junior'. lmao",
      s: 1900, c: 356, d: 4, h: 15, w: 1,
    },
    {
      t: "Made a free tool that converts Figma-exported SVGs into clean React components",
      b: "Strips the junk attributes, merges paths when it can and gives you a typed component. Runs locally, nothing uploaded. Would love to hear edge cases that break it.",
      s: 540, c: 49, d: 6, h: 18, f: "Showoff Saturday",
    },
    {
      t: "Introducing DevBoost Pro: the ultimate productivity suite for developers",
      b: "Supercharge your coding with our revolutionary all-in-one platform. Limited time offer: 40% off!",
      s: 1, c: 4, d: 1, h: 8,
    },
    {
      t: "What's one browser API you wish more people knew about?",
      b: "Mine is IntersectionObserver. Replaced so much scroll-listener spaghetti in our codebase. What's yours?",
      s: 720, c: 310, d: 0, h: 15,
    },
    {
      t: "TIL you can style the native date picker... kind of",
      b: "Spent an hour on it. You can change some colors and that's about it. Back to the custom component I go.",
      s: 310, c: 62, d: 2, h: 18, w: 1,
    },
    {
      t: "Rant: stop putting cookie banners on sites with zero tracking",
      b: "If you don't use non-essential cookies, you don't need the banner. Your users will thank you. Ok rant over.",
      s: 830, c: 144, d: 3, h: 13,
    },
    {
      t: "Self-taught, 2 years in, finally got my first dev job. Some honest notes",
      b: "1. Projects mattered more than certificates.\n2. Nobody cared which bootcamp.\n3. The take-home I did best on was the one I asked questions about first.\n\nIf you're grinding right now, keep going. It took me 140 applications.",
      s: 2200, c: 265, d: 1, h: 14, w: 1,
    },
    {
      t: "How are you handling auth in side projects without paying $25/month?",
      b: "Every hosted auth provider gets expensive fast. Are you rolling your own sessions, using a library, something else? Asking for my 3 users lol",
      s: 410, c: 223, d: 5, h: 17, w: 1,
    },
    {
      t: "I made a site that shows how long every npm package's install script takes",
      b: "Ran installs in a clean container for the top 2,000 packages, three times each, and kept the median. Some results surprised me, a couple of tiny utilities take longer than whole frameworks because of postinstall scripts.\n\nThe data's open and the method is in the repo. Would love a sanity check on the method before anyone quotes these numbers.",
      s: 1500, c: 131, d: 6, h: 14, f: "Showoff Saturday", w: 1,
    },
  ],
};

const STARTUPS: SampleCommunity = {
  ref: { platform: "reddit", id: "startups", label: "r/startups" },
  about: { title: "Startups", description: "A community for founders to discuss the challenges of building a startup." },
  rules: [
    {
      title: "No self-promotion",
      description: "Do not promote your company, product or service. Use the monthly 'Share Your Startup' thread for that.",
    },
    { title: "Ask specific questions", description: "Vague questions will be removed. Include context about your stage and situation." },
    { title: "No AI-generated content", description: "AI-written posts and comments will be removed." },
    { title: "No solicitation", description: "No requests for investment, cofounders or customers outside the designated threads." },
  ],
  seeds: [
    {
      t: "What's the most underrated skill for a first-time founder?",
      b: "Not talking about coding or sales. Something smaller. For me it's writing clearly. Every investor update, job post and customer email got easier once I worked on it.",
      s: 980, c: 412, d: 2, h: 14,
    },
    {
      t: "We ran out of money 3 weeks before our seed closed. Here's how we survived",
      b: "Our lead investor's fund had a delay and the wire got pushed. We had payroll in 3 weeks and about half of it in the bank.\n\n1. Told the team the truth the same day.\n2. Asked our two biggest customers to prepay annual contracts. One said yes.\n3. Founders took no salary for 2 months.\n\nThe seed closed. I don't recommend the experience, but telling the team early was the best call we made.",
      s: 1650, c: 233, d: 3, h: 15,
    },
    {
      t: "How do you tell a cofounder it isn't working?",
      b: "We've been at it 14 months. He's great at product but avoids every hard conversation. I don't want to blow up the company but I can't keep carrying sales alone. Has anyone done this well?",
      s: 720, c: 301, d: 4, h: 16,
    },
    {
      t: "Lessons from 100 cold emails to enterprise buyers",
      b: "- Short beats clever. Under 90 words got about 3x the replies.\n- Mention one specific thing about their company or don't bother.\n- 'Not now' is the most common answer, and it's useful. Follow up in 3 months.\n\n8 meetings, 1 pilot. Better than I expected honestly.",
      s: 1210, c: 144, d: 2, h: 16, w: 1,
    },
    {
      t: "Check out our startup, we're changing the game 🚀",
      b: "Our revolutionary platform is the future of work. Sign up now for early access! https://gamechanger.example",
      s: 0, c: 3, d: 1, h: 9,
    },
    {
      t: "Is it a red flag if an investor asks for a board seat at pre-seed?",
      b: "First check, $250k, and they want a board seat. Everyone online says no, but they're the only investor who's moved fast. What would you do?",
      s: 430, c: 198, d: 5, h: 15,
    },
    {
      t: "I quit my job to work on my startup full time. 6 months later, here's the honest picture",
      b: "Revenue: $2.1k/month. Savings: 8 months left. Mental health: better than at my old job, worse than I expected.\n\nWhat surprised me: I'm not short on time, I'm short on decisions I'm confident about. With a job, someone else decided what mattered. Now every week I pick, and half the time I pick wrong.\n\nThe hardest part isn't the work, it's not knowing if you're wasting your time. Anyone else in the 6-12 month zone? How do you decide what to work on each week?",
      s: 1880, c: 287, d: 0, h: 16,
    },
    {
      t: "Unpopular opinion: most startups don't need a pitch deck until they have revenue",
      b: "Spend the time talking to customers. A deck with no traction is a design exercise.",
      s: 640, c: 220, d: 3, h: 13, w: 1,
    },
    {
      t: "Excited to share our new AI platform with this amazing community!",
      b: "We're thrilled to introduce our cutting-edge solution. Visit our website!",
      s: 1, c: 2, d: 4, h: 8,
    },
    {
      t: "What did you do in the first 30 days after launch?",
      b: "We launched last week to basically silence. Trying to plan the next month. What actually helped you get early traction?",
      s: 310, c: 176, d: 2, h: 18,
    },
    {
      t: "How we hired our first engineer without a recruiter (or much money)",
      b: "Posted a very specific job description in 4 niche communities, paid for the take-home, and was honest about the risk. 60 applicants, 5 interviews, 1 great hire.\n\nThe honesty part mattered more than salary, surprisingly.",
      s: 870, c: 109, d: 1, h: 15, w: 1,
    },
    {
      t: "Is anyone else exhausted by 'AI startup' pitches that are just wrappers?",
      b: "Went to a demo day, 9 of 12 pitches were a prompt and a UI. Not hating, just wondering how any of these defend themselves in a year.",
      s: 1340, c: 356, d: 4, h: 15, w: 1,
    },
    {
      t: "What's a mistake you made that cost you more than money?",
      b: "Mine: hiring a friend for a role neither of us understood. Lost the friendship for two years.",
      s: 760, c: 290, d: 6, h: 16,
    },
    {
      t: "Our startup failed. Here's the post-mortem nobody asked for",
      b: "Short version: we built for a problem people had once a year. Nobody remembers to pay for something they need once a year. We should have noticed after the first 20 interviews.",
      s: 1430, c: 198, d: 0, h: 14, w: 1,
    },
    {
      t: "Founders with kids: how do you actually make the time?",
      b: "Two kids under 5, full-time job, startup at night. Something has to give. Curious what your week looks like.",
      s: 520, c: 241, d: 3, h: 17,
    },
    {
      t: "Free tool to find investors, use code STARTUP for 30% off premium",
      b: "Our database has 10,000+ investors. Limited time deal! https://investorfinder.example?utm_source=reddit",
      s: 0, c: 1, d: 5, h: 9,
    },
  ],
};

const BUILDINPUBLIC: SampleCommunity = {
  ref: { platform: "x", id: "buildinpublic", label: "X #buildinpublic", query: "#buildinpublic" },
  about: { title: "#buildinpublic", description: "Founders sharing progress, numbers and lessons while they build." },
  rules: X_RULES,
  seeds: [
    {
      t: "",
      b: "Day 112 of building in public:\n\n• $1,840 MRR\n• 61 paying customers\n• churn 3.1%\n\nbiggest win this week: cut onboarding from 7 steps to 3. activation up 22%.\n\nsmall steps, every day.",
      s: 1820, c: 143, r: 96, d: 2, h: 14, m: "image",
    },
    {
      t: "",
      b: "I almost quit last month.\n\n0 signups for 19 days straight.\n\nthen one person tweeted about it and I got 240 in a day.\n\nyou never know which day is the day.",
      s: 3400, c: 290, r: 410, d: 3, h: 15,
    },
    {
      t: "",
      b: "just shipped dark mode.\n\ntook 2 hours to build and 3 days to argue with myself about the exact shade of gray 🙃",
      s: 920, c: 88, r: 31, d: 4, h: 16, m: "image",
    },
    {
      t: "",
      b: "how I got my first 100 users with $0 marketing 🧵\n\n1/ I didn't launch. I found 30 people complaining about the problem on Reddit and replied with a free fix, no link.",
      s: 2600, c: 180, r: 520, d: 1, h: 15,
    },
    {
      t: "",
      b: "🚀🚀 Launching TODAY! The ultimate AI tool to 10x your productivity! 🔥 Sign up now 👉 link in bio #AI #startup #productivity #SaaS #tech",
      s: 14, c: 3, r: 2, d: 2, h: 8,
    },
    {
      t: "",
      b: "Unpopular opinion: you don't need a landing page to validate.\n\nYou need 10 conversations.",
      s: 1500, c: 210, r: 120, d: 5, h: 14, w: 1,
    },
    {
      t: "",
      b: "Revenue update for October:\n\n$612 → $1,094\n\nno ads. mostly from one YouTube video someone else made about the app.\n\nreply if you want the breakdown",
      s: 2100, c: 260, r: 140, d: 3, h: 16,
    },
    {
      t: "",
      b: "What's one tool you'd never give up as a solo founder?\n\nMine: a plain notes file with every customer conversation.",
      s: 680, c: 410, r: 40, d: 0, h: 15,
    },
    {
      t: "",
      b: "shipped a tiny feature nobody asked for.\n\n3 customers emailed to say it's their favorite thing in the app.\n\nlistening to users is good. so is building what you'd want yourself.",
      s: 840, c: 72, r: 38, d: 4, h: 14, w: 1,
    },
    {
      t: "",
      b: "Hey everyone! 👋 We're excited to announce our new platform that will revolutionize the way you work! Check it out! 🚀✨ #buildinpublic #startup",
      s: 22, c: 4, r: 3, d: 1, h: 9,
    },
    {
      t: "",
      b: "1 year ago I was a junior dev who'd never shipped anything.\n\ntoday my side project pays my rent.\n\nnot rich. just free. that's the goal.",
      s: 5200, c: 380, r: 690, d: 6, h: 16, m: "image",
    },
    {
      t: "",
      b: "Building a budgeting app for freelancers. week 6.\n\nwhat I've learned:\n- freelancers hate categories\n- they love 'how much can I spend this month'\n- nobody reads charts\n\nrebuilding the home screen around one number.",
      s: 760, c: 64, r: 52, d: 2, h: 16, w: 1,
    },
    {
      t: "",
      b: "my landing page converted at 0.8%.\n\nchanged the headline from what the product does to what the user gets.\n\nnow 3.4%.\n\nsame product. same traffic.",
      s: 2900, c: 150, r: 480, d: 3, h: 14, w: 1,
    },
    {
      t: "",
      b: "anyone else get weirdly nervous before hitting deploy on a Friday? asking for a friend (me)",
      s: 430, c: 120, r: 12, d: 5, h: 19,
    },
    {
      t: "",
      b: "Hit $5k MRR today 🎉\n\n14 months. solo. no funding.\n\nthank you to everyone who gave feedback when it was ugly.",
      s: 4100, c: 520, r: 230, d: 4, h: 15, m: "image",
    },
    {
      t: "",
      b: "things I'd tell myself before my first launch:\n\n1. nobody is watching, that's good\n2. launch is a Tuesday, not a finish line\n3. reply to every single comment\n4. charge from day one",
      s: 1900, c: 98, r: 350, d: 1, h: 14, w: 1,
    },
    {
      t: "",
      b: "Looking for 5 beta testers for a tool that turns support emails into FAQ pages.\n\nfree forever for beta folks. reply or DM 🙏",
      s: 210, c: 88, r: 14, d: 0, h: 17,
    },
    {
      t: "",
      b: "Our innovative AI-powered solution is now live. Don't miss out, limited time 50% off. #AI #SaaS #startup #growth",
      s: 9, c: 1, r: 1, d: 5, h: 8,
    },
  ],
};

const SHOW_HN: SampleCommunity = {
  ref: { platform: "hn", id: "show_hn", label: "Show HN" },
  about: { title: "Show HN", description: "Hacker News section for sharing something you've made." },
  rules: SHOW_HN_RULES,
  seeds: [
    {
      t: "Show HN: Pebble – A self-hosted, single-binary RSS reader written in Go",
      b: "Hi HN, I wanted an RSS reader that I could run on a $5 VPS without a database server. Pebble is a single Go binary with SQLite. It does full-text search, keyboard navigation and nothing else.\n\nIt's MIT licensed. Known limitations: no mobile app, and the OPML import is strict about malformed files.\n\nI'd appreciate feedback on the reading view, especially from people coming from Google Reader.",
      s: 612, c: 214, d: 2, h: 15,
    },
    {
      t: "Show HN: I made a tool that diffs two PDFs visually",
      b: "I review contracts for a small agency and kept missing changed clauses between versions. Text diffs didn't help because the PDFs came from different exports and the line breaks never matched.\n\nThis renders both PDFs and highlights text and layout differences side by side. It runs entirely in the browser via WebAssembly, so files never leave your machine.\n\nNo signup. Source is on GitHub. Scanned PDFs work poorly for now, since there's no OCR yet.",
      s: 430, c: 120, d: 3, h: 14,
    },
    {
      t: "Show HN: Tiny Postgres extension for fuzzy search on short strings",
      b: "We needed typo-tolerant search on product names (about 20 characters each) and our existing setup was too slow at our size. This uses a different index structure; benchmarks and the tradeoffs are in the README. It's not a general replacement for trigram search.",
      s: 280, c: 64, d: 4, h: 16,
    },
    {
      t: "Show HN: The revolutionary AI platform that will change how you code forever",
      b: "Supercharge your development! Sign up now for exclusive early access.",
      s: 3, c: 2, d: 1, h: 8,
    },
    {
      t: "Show HN: A keyboard-first spreadsheet that runs in the terminal",
      b: "I spend most of my day in the terminal and wanted to edit CSVs without leaving it. Vim-style bindings, formulas, and it streams files so it handles a few GB without loading everything into memory. Written in Rust.\n\nIt's early: formula support is basic, there's no undo history across sessions yet, and wide columns get truncated in ways I don't love.\n\nI'd like to hear which formulas people miss first.",
      s: 520, c: 176, d: 2, h: 16, w: 1,
    },
    {
      t: "Show HN: Open-source screen recorder that runs locally, no account",
      b: "Records screen and camera, trims, and exports MP4. No cloud, no account. I built it because my team's subscription price went up again and we mostly record 2-minute bug reports.\n\nIt's Electron for now, which I know is a sore point here; a native version is something I'd like to try once the feature set settles. Files are saved to a folder you choose, nothing is uploaded.\n\nFeedback on the trimming UI is very welcome.",
      s: 790, c: 251, d: 3, h: 15, w: 1,
    },
    {
      t: "Show HN: I built a site that explains every Unix command with a live example",
      b: "Paste a command and it breaks down each flag with a tiny sandboxed example you can edit. It covers around 300 commands so far. Looking for feedback on which explanations are wrong.",
      s: 340, c: 88, d: 4, h: 14,
    },
    {
      t: "Show HN: Best AI writing assistant ever – try it free!",
      b: "Our amazing tool writes everything for you. Check it out!",
      s: 1, c: 1, d: 5, h: 9,
    },
    {
      t: "Show HN: A 2KB library for accessible tooltips",
      b: "Handles keyboard focus, Escape to dismiss, and screen reader announcements. No dependencies. I wrote it after auditing a client site where every tooltip was mouse-only.",
      s: 210, c: 45, d: 6, h: 15,
    },
    {
      t: "Show HN: Mapping every public bench in my city with volunteers",
      b: "Started as a weekend project with my kids, now 40 volunteers and 2,300 benches. Data is CC-BY. The app is a simple PWA; the hard part was deduplicating submissions.",
      s: 380, c: 97, d: 0, h: 16,
    },
    {
      t: "Show HN: Self-hostable uptime monitor with status pages, in one Docker container",
      b: "Hi HN. It checks HTTP, TCP, DNS and cron heartbeats, sends alerts to email, Slack or webhooks, and serves public status pages. SQLite by default, Postgres optional.\n\nThis is my side project of 2 years. There's a paid hosted version, but the self-hosted one has every feature, and I don't plan to change that.\n\nThe part I'm least sure about is the alerting rules UI. If you run something like this in production, I'd love to hear what you'd expect there.",
      s: 460, c: 132, d: 1, h: 15, w: 1,
    },
    {
      t: "Show HN: I trained a small model to recognize bird species by song on a Raspberry Pi",
      b: "Around 40 local species, about 87% accuracy on my test set (which is small and probably biased toward my backyard). The model is 3MB. Code and training notes are on GitHub. Happy to answer questions about the data collection.",
      s: 640, c: 158, d: 2, h: 14,
    },
    {
      t: "Show HN: Write commit messages faster with this amazing VS Code extension!!!",
      b: "Download now from the marketplace. 5 stars!",
      s: 2, c: 0, d: 3, h: 8,
    },
    {
      t: "Show HN: A browser game where you build a CPU from logic gates",
      b: "Start with NAND, end with a working 8-bit CPU that runs a small program. Each level adds one component (adder, register, memory) and checks your circuit against test cases.\n\nIt's the course I wish I had in school. Free, no ads, progress is saved locally. The later levels are hard; I'm still tuning the difficulty curve and would appreciate hearing where people get stuck.",
      s: 1120, c: 302, d: 4, h: 15, w: 1,
    },
    {
      t: "Show HN: Plain-text accounting app with a web UI",
      b: "It reads and writes ledger-format files, so you can keep using your existing tools. The UI is for people (like my partner) who won't touch a terminal.",
      s: 190, c: 71, d: 5, h: 16,
    },
    {
      t: "Show HN: Turn any OpenAPI spec into a typed CLI",
      b: "Point it at a spec and get a CLI with completions and typed flags. Useful for internal APIs where nobody wants to write a client. The generated code is readable, not magic.",
      s: 300, c: 77, d: 6, h: 14, w: 1,
    },
  ],
};

const ALL: SampleCommunity[] = [SIDEPROJECT, SAAS, WEBDEV, STARTUPS, BUILDINPUBLIC, SHOW_HN];

function keyOf(ref: Pick<CommunityRef, "platform" | "id">): string {
  return `${ref.platform}:${ref.id.toLowerCase()}`;
}

const INDEX = new Map(ALL.map((c) => [keyOf(c.ref), c]));

export function hasSample(ref: Pick<CommunityRef, "platform" | "id">): boolean {
  return INDEX.has(keyOf(ref));
}

/** 요일·시간(UTC)을 유지한 채, 지금 기준 가장 최근 날짜로 바꾼다. 그래야 시간대 분석 결과가 항상 같다. */
function recentOccurrence(now: Date, weekday: number, hour: number, weeksBack: number): Date {
  const minute = (hour * 7 + weekday * 13) % 60;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute));
  d.setUTCDate(d.getUTCDate() - ((now.getUTCDay() - weekday + 7) % 7));
  if (d.getTime() > now.getTime()) d.setUTCDate(d.getUTCDate() - 7);
  d.setUTCDate(d.getUTCDate() - 7 * weeksBack);
  return d;
}

export function getSample(ref: Pick<CommunityRef, "platform" | "id">, now = new Date()): CollectResult | null {
  const c = INDEX.get(keyOf(ref));
  if (!c) return null;
  const posts: Post[] = c.seeds.map((s, i) => ({
    id: `sample-${c.ref.id}-${i + 1}`,
    platform: c.ref.platform,
    community: c.ref.id,
    title: c.ref.platform === "x" ? (s.b ?? "").split("\n")[0] : s.t,
    body: s.b ?? "",
    score: s.s,
    comments: s.c,
    shares: s.r,
    createdAt: recentOccurrence(now, s.d, s.h, s.w ?? 0).toISOString(),
    flair: s.f,
    media: s.m ?? (s.b ? "text" : "link"),
  }));
  return {
    community: c.ref,
    about: { title: c.about.title, description: c.about.description, members: c.about.members },
    posts,
    rules: c.rules,
    source: "sample",
    fetchedAt: now.toISOString(),
  };
}

export const SAMPLE_REFS: CommunityRef[] = ALL.map((c) => c.ref);
