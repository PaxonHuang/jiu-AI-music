# 啾 (Jiu) — AI 音乐创编 Web App

移动端优先的儿童音乐教育与 AI 辅助创编 Web 应用。基于 Next.js 15 App Router + OpenNext Cloudflare Workers，纯前端运行 + Server-side BFF（无独立后端服务）。

## 四大模块

| 模块 | 路由 | 说明 |
|------|------|------|
| 🐦 **图鉴** | `/collection` | 鸟类图鉴，绒羽/怪羽/暗羽收集与解锁系统 |
| 🎓 **学院** | `/academy` | **9 关**音乐闯关（听→节奏→旋律，3 阶段） |
| 🎨 **工坊** | `/workshop` | AI 音乐生成（Volcengine BFF + R2 持久化） |
| 🌟 **社区** | `/community` | 作品列表分享与点赞 |

## 学院关卡结构

| 阶段 | 关卡 | 玩法 | 奖励 |
|------|------|------|------|
| 👂 第一阶段 · 听的世界 | 1-1 声音电梯 / 1-2 声音接力 / 1-3 声音天平 | 听音辨高、声音传递、音量平衡 | 绒羽 |
| 🥁 第二阶段 · 节奏魔法 | 2-1 心跳鼓手 / 2-2 音符赛跑 / 2-3 节奏拼图 | 节拍跟打、节奏记忆、旋律拼图 | 怪羽 |
| ✨ 第三阶段 · 旋律星图 | 3-1 音符小镇 / 3-2 音准爬塔 / 3-3 音符找家 | 视唱练耳、音准纠正、识谱找音 | 暗羽 |

> 奖励规则：首次通关奖励 +1；完美通关额外 +1；重复通关 +1（不叠加首次/完美）。详见 `jiu-app/lib/constants.ts` 的 `LEVELS.rewardType` 映射。

## 快速开始

```bash
cd jiu-app
npm install
npm run dev      # → http://localhost:3000
npm run build    # 生产构建（OpenNext → .open-next/）
npm run lint     # ESLint
```

### 跑单元测试

项目没有接 vitest/jest，单元测试用 Node 自带的 test runner：

```bash
node --experimental-strip-types --no-warnings --test \
  jiu-app/lib/volcengine/sign.test.ts \
  jiu-app/lib/volcengine/gensong.test.ts \
  jiu-app/lib/rewards.test.ts
```

## 技术栈

- **框架**: Next.js 15 (App Router, `'use client'` 页面)
- **部署**: OpenNext + Cloudflare Workers + Pages + R2
- **状态管理**: Zustand 5 (单 store，localStorage 持久化)
- **音频**: 纯 Web Audio API（OscillatorNode, AnalyserNode, autocorrelation 音高检测）
- **AI 音乐**: Volcengine Imagination 服务（GenBGMForTime / GenSongForTime / QuerySong），BFF 在 Worker 内签名
- **动画**: Framer Motion
- **拖拽**: @dnd-kit/core（节奏拼图、音符找家）
- **样式**: Tailwind CSS 4 + CSS Modules（`academy.module.css`）
- **语音**: Web Speech API（中文 TTS + 语音识别）

## 工坊 BFF（Volcengine 集成）

- **提交** `POST /api/music/create`，body：`{ track: 'instrumental' | 'vocal', prompt?, lyrics?, ... }`
- **轮询** `GET /api/music/status/[taskId]`，返回 `{ status, progress, audioUrl, duration, persisted }`
- **音频流** `GET /api/music/audio/[taskId]`
- **持久化**: 任务成功后下载 `AudioUrl` 上传到 R2 `jiu-music-audio` 桶，前端通过 `/api/music/audio/[taskId]` 长期播放
- **签名**: HMAC-SHA256 V4，**`kDatePrefix` 为空字符串**（不是 `VOLC`），`UNSIGNABLE_HEADERS` 仅 6 项
- **凭据**: `VOLC_ACCESS_KEY` / `VOLC_SECRET_KEY` 写入 `jiu-app/.dev.vars`（**已在 `.gitignore`**，严禁提交）

### 关键事实（已知踩坑）

| 项 | 正确值 | 错误猜测 |
|---|---|---|
| Service | `imagination` | ❌ `music` / `audio` / `cv` / `gensong` |
| BGM 提交字段 | `Text` | ❌ `Prompt` / `Lyrics` |
| 状态查询 Action | `QuerySong`（body `{TaskID}`） | ❌ `GetTask` / `QueryTask` |
| Version | `2024-08-12` | — |
| Region | `cn-beijing` | — |
| kDatePrefix | `""` | ❌ `"VOLC"` |
| UNSIGNABLE_HEADERS | 6 项：`authorization` / `content-type` / `content-length` / `user-agent` / `presigned-expires` / `expect` | ❌ 30+ 项白名单 |
| GenBGM Genre | `[]string` 数组 | ❌ 单字符串 |
| 响应字段命名 | `Status` / `TaskID` / `SongDetail`（PascalCase） | — |

## 设计约束

- 移动端优先，375px 宽度，`max-w-lg mx-auto`
- 全中文 UI
- 主题色: `#FF9F43`（橙）/ `#FFF8F0`（背景）/ `#54A0FF`（蓝）

## 仓库与分支约定

- **主开发分支**: `main`（GitHub + Gitee 双远程，但**两边上游无共同祖先**）
- **GitHub**: `https://github.com/PaxonHuang/jiu-AI-music`
- **Gitee 原仓**: `https://gitee.com/huang-welsion/jiu-ai-music`（协作者 `huang-welsion` 拥有，本地身份 `PaxonHuang` 无 push 权限）
- **Gitee Fork**: `https://gitee.com/PaxonHuang/jiu-ai-music`（本地 `origin` 指向这里，PR 都从 fork → 原仓）
- **当前 PR 分支**: `feat/workshop-volcengine-and-rewards`

⚠️ **Gitee 改名不会迁移仓库**：账号从 `chouyougongchang233` 改名为 `PaxonHuang` 后，旧 username 下的仓库仍归 `huang-welsion` 所有；新 username 没有该仓库的 push 权限。要向旧仓库推代码，必须先 fork（`POST /api/v5/repos/{owner}/{repo}/forks`），从 fork 开 PR。

## 项目文档

`jiu-project/` 包含详细规划文档（可行性分析、技术规格、架构设计、MVP 范围）。

## 许可证

MIT