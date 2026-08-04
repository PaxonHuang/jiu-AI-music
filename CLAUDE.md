# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

"啾" (Jiu) — a mobile-first Web App for children's music education and AI-assisted music creation. The app has four modules:

- **图鉴 (Collection)** `/collection` — Bird encyclopedia with unlock/fragment progression system
- **学院 (Academy)** `/academy` — **9 levels** in 3 stages (Listening → Rhythm → Melody) with SVG countryside map
- **工坊 (Workshop)** `/workshop` — AI music generation via Volcengine BFF (Cloudflare Worker) with R2 persistence
- **社区 (Community)** `/community` — Shared works list with likes

## Repo Structure

```
jiu-complete-package/                  # Git repo root
├── jiu-app/                           # Next.js app (all source)
│   ├── app/
│   │   ├── academy/                   # Academy map page + level/[id] route
│   │   ├── api/music/                 # BFF: create / status/[id] / audio/[id]
│   │   └── academy.module.css         # 868-line CSS Module (SVG map, animations)
│   ├── components/
│   │   ├── academy/                   # 6 map components + games/ (12 game files)
│   │   ├── collection/                # BirdCard, BirdDetail
│   │   ├── layout/                    # BottomNav, BirdCompanion
│   │   └── shared/                    # FragmentDrop, Onboarding
│   ├── lib/
│   │   ├── constants.ts               # Birds, levels, strings
│   │   ├── rewards.test.ts            # Stage→fragment regression
│   │   └── volcengine/                # sign.ts + gensong.ts (+ *.test.ts)
│   ├── stores/globalStore.ts          # Zustand single store
│   └── wrangler.jsonc                 # OpenNext Cloudflare config
├── doc/                               # Gitignored PDFs (啾工坊 PRD in `doc/啾工坊 产品需求文档.pdf`)
├── .remember/                         # Per-project handoff memory (root, not jiu-app/)
└── CLAUDE.md                          # This file
```

## Commands

```bash
# All commands run from jiu-app/
npm run dev       # dev server at http://localhost:3000
npm run build     # production build (OpenNext → .open-next/)
npm run start     # serve production build
npm run lint      # ESLint

# Unit tests (no test framework — use Node's test runner with strip-types)
node --experimental-strip-types --no-warnings --test \
  jiu-app/lib/volcengine/sign.test.ts \
  jiu-app/lib/volcengine/gensong.test.ts \
  jiu-app/lib/rewards.test.ts
```

## Architecture

**Single-store Zustand app** — all state lives in `stores/globalStore.ts` and is persisted to `localStorage` (`jiu_state` key). The store is the single source of truth for: user ID (device UUID), fragments (绒羽/怪羽/暗羽), unlocked birds, academy progress, and current bird companion.

**App Router layout** — `app/layout.tsx` wraps every page with `BottomNav`, `BirdCompanion` (floating chat with speech synthesis/recognition), and `Onboarding`. Pages are `'use client'` components. `/` immediately redirects to `/collection`.

**Academy level routing** — dynamic route `app/academy/level/[id]/page.tsx` dispatches to level components by ID (1=SoundElevator through 9=NoteHome). Levels follow a 3-phase lifecycle: **Preparation** → **Game** → **Result** (with 3-star scoring). Every game component implements the `AcademyGameProps` interface (`onComplete(score)`, `onMistake()`, `simpleMode`).

**OpenNext Cloudflare BFF** — the `/api/music/*` routes run as Cloudflare Workers via OpenNext. The BFF signs Volcengine requests server-side using `lib/volcengine/sign.ts` so AK/SK never reach the browser. Audio is downloaded from `AudioUrl` and uploaded to R2 for permanent storage. Access bindings via `getCloudflareContext()`.

**Key libraries and why:**
- Web Audio API (native) — all audio (no Tone.js dependency; `tone` in package.json is unused)
- `@dnd-kit/core` — drag-and-drop for rhythm puzzle (2-3) and note placement (3-3) games
- `framer-motion` — all animations (AnimatePresence for modals/transitions)
- `zustand` — state (no Redux, no context providers)

**Bird/fragment system** — `lib/constants.ts` defines the `BIRDS` array (9 birds), `LEVELS` (9 academy levels), and `FRAGMENT_TYPES`. Birds unlock via fragment thresholds. Stage→fragment mapping is enforced by `LEVELS[i].rewardType` and verified by `lib/rewards.test.ts`. Fragment types are: `'绒羽' | '怪羽' | '暗羽'`.

**9 Academy levels** (rewards are stage-specific, not all 绒羽):

| Stage | Levels | Game Component | Reward |
|-------|--------|---------------|--------|
| 1. Listening (听) | 1-1 SoundElevator / 1-2 SoundRelay / 1-3 SoundBalance | 声音电梯/接力/天平 | 绒羽 |
| 2. Rhythm (节奏) | 2-1 HeartbeatDrummer / 2-2 NoteRace / 2-3 RhythmPuzzle | 心跳鼓手/赛跑/拼图 | 怪羽 |
| 3. Melody (旋律) | 3-1 NoteTown / 3-2 PitchTower / 3-3 NoteHome | 音符小镇/爬塔/找家 | 暗羽 |

**Adaptive difficulty** — after 3 consecutive mistakes, `simpleMode` is triggered automatically (simplified game parameters).

**Audio engine** — `components/academy/games/audio.ts` provides pitch detection (optimized autocorrelation), oscillator utilities, and microphone access via pure Web Audio API.

## Volcengine Integration (workshop BFF)

| Field | Correct Value | Common wrong guess |
|-------|---------------|-------------------|
| Service | `imagination` | ❌ `music` / `audio` / `cv` / `gensong` |
| Action (submit BGM) | `GenBGMForTime` with `Text` field | ❌ `Prompt` / `Lyrics` |
| Action (submit vocal) | `GenSongForTime` with `Lyrics`+`Prompt`+`ModelVersion`+`Genre`+`Mood`+`Gender` | — |
| Action (poll) | `QuerySong` with `{TaskID}` body | ❌ `GetTask` / `QueryTask` |
| Version | `2024-08-12` | — |
| Region | `cn-beijing` | — |
| Signing `kDatePrefix` | `""` (empty string) | ❌ `"VOLC"` |
| `UNSIGNABLE_HEADERS` | exactly 6: `authorization` / `content-type` / `content-length` / `user-agent` / `presigned-expires` / `expect` | ❌ 30+ header whitelist |
| `GenBGM.Genre` | `[]string` array | ❌ single string |
| Response field names | PascalCase: `Status` / `TaskID` / `SongDetail` | — |
| Status codes | 0=pending / 1=running / 2=success / 3=failed | — |

**Sign test verifies**: 12/12 unit tests pass for `sign.ts` (4) + `gensong.ts` (7) + `rewards.test.ts` (1, currently more cases — re-count before claiming).

## Secrets & Environment

- `jiu-app/.dev.vars` holds `VOLC_ACCESS_KEY` / `VOLC_SECRET_KEY` / `ARK_API_KEY` / `ARK_API_KEY_ID` / `VOLC_ACCOUNT_ID`.
- **Both root `.gitignore` and `jiu-app/.gitignore` already list `.dev.vars`** — do not remove. If a `git status` shows `.dev.vars` untracked, immediately re-add the ignore rule before any commit.
- In production, these become Worker secrets (set via `wrangler secret put` — never commit them).

## Git Remotes & Branches

- `github` → `https://github.com/PaxonHuang/jiu-AI-music` (push branches directly with `git push github <branch>`)
- `origin` → `https://gitee.com/PaxonHuang/jiu-ai-music` (this is a **fork** of `huang-welsion/jiu-ai-music`)
- PRs to Gitee go from `origin:feat/*` → `huang-welsion:main` (use the Gitee REST API `POST /repos/huang-welsion/jiu-ai-music/pulls` with `head: "PaxonHuang:<branch>"`)

⚠️ **Gitee username rename does NOT migrate repos.** Account was renamed `chouyougongchang233` → `PaxonHuang`, but the repo `huang-welsion/jiu-ai-music` still belongs to the old `huang-welsion` namespace (a separate user_id). Token bound to `PaxonHuang` has `push: false` on the original. Workaround: fork via API, push to fork, open PR fork→original.

⚠️ **GitHub and Gitee `main` have unrelated histories.** Don't `git pull` from one and try to merge into the other. Always push as a new branch and let PR do the merge.

## Design Constraints

- Mobile-only at 375px, `max-w-lg mx-auto` in layout
- No separate backend — BFF lives in the Worker
- Chinese UI throughout; all string constants in `lib/constants.ts`
- Tailwind CSS 4 with `@tailwindcss/postcss`; theme colors: `#FF9F43` (primary orange), `#FFF8F0` (bg), `#54A0FF` (secondary blue)

## Project Docs

`doc/` (gitignored) holds the canonical 啾工坊 产品需求文档 PDF — read that for the authoritative spec.

## Common mistakes to avoid

1. **Don't use a bulk `sed` to change `rewardType: '绒羽'` for many levels.** The reward is stage-specific; per-stage edit is faster and correct.
2. **Don't use TypeScript parameter properties (`constructor(public readonly x: number)`) in Node `--experimental-strip-types`** — strip-types mode rejects them. Use explicit field declarations.
3. **Don't trust the Gitee API `permission` field at face value** — it can lie about whether a token can push (e.g., returns `push: false` for renamed-account mismatch even though the underlying physical user is the same).
4. **Don't read a memory file just to verify before recommending.** Recalled memories are background context from a prior session; if a file/function/flag is named, verify it still exists.
5. **Don't use `git push --force`.** If push is rejected because remote advanced, stop and ask.
6. **Don't paste a Personal Access Token into output.** Use env vars or `git -c url...` rewrites; the token only needs to live in a single shell invocation.