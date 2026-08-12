// Ark(火山方舟)LLM 歌词生成 —— 工坊"AI 帮我写 / 续写"。
//
// 走 Bearer token 直调(不像音乐生成需要 V4 签名),密钥从 Worker secret
// 读取(本地 .dev.vars),不进浏览器。模型 ID 可用 ARK_MODEL 覆盖,默认
// doubao-seed 系列。所有失败都在调用方降级到本地模板,保证离线可用。

const ARK_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
// 该方舟账号实测可用(2026-08-10):
//   - doubao-seed-2-1-pro-260628  200 ✅(Seed 系当前旗舰,工坊写词默认)
//   - doubao-seed-2-0-pro-260215  200 ✅
//   - deepseek-v4-flash-ga-260731 200 ✅(上一版默认)
// 注意 doubao-seed-1-8-251228 在该账号返回 404(未开通,1.x 系疑似退役);
// 之后在方舟控制台开通后,可用 ARK_MODEL 环境变量切回。
const DEFAULT_MODEL = 'doubao-seed-2-1-pro-260628';

export interface GenerateLyricsInput {
  mode: 'write' | 'continue';
  /** write 模式的主题描述。 */
  theme?: string;
  /** continue 模式的已有歌词。 */
  existingLyrics?: string;
  genre?: string;
  mood?: string;
}

const SYSTEM_PROMPT =
  '你是一个给 6-12 岁孩子写中文儿童歌曲歌词的助手。要求：' +
  '1) 歌词简短好记，每句 5-10 个字，总共 6-10 行；' +
  '2) 内容阳光积极、贴近孩子的生活（小动物、四季、朋友、梦想）；' +
  '3) 用 [verse] 标主歌、[chorus] 标副歌，段落间空一行；' +
  '4) 只输出歌词正文，不要解释，不要引号。';

export async function generateLyrics(input: GenerateLyricsInput): Promise<string> {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) throw new Error('ARK_API_KEY is not configured');
  const model = process.env.ARK_MODEL || DEFAULT_MODEL;

  const theme = input.theme?.trim() || '一场闪闪发光的旅行';
  const style = [input.genre && `曲风：${input.genre}`, input.mood && `情绪：${input.mood}`]
    .filter(Boolean)
    .join('，');

  const userPrompt =
    input.mode === 'continue'
      ? `请接着下面这首孩子写的歌，自然地续写后半段（保持同样的童真风格，可加 [chorus] 副歌）：\n\n${input.existingLyrics ?? ''}`
      : `写一首关于「${theme}」的歌。${style ? `（${style}）` : ''}`;

  const response = await fetch(ARK_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.9,
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Ark ${response.status} ${detail.slice(0, 200)}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Ark returned empty content');
  }
  return content.trim();
}
