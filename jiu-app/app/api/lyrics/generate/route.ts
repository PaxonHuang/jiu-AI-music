import { NextRequest, NextResponse } from 'next/server';
import { generateLyrics } from '@/lib/workshop/lyrics';

export const runtime = 'nodejs';

// 工坊 AI 写词 / 续写。调用方在失败时降级到本地模板,所以这里失败也返回
// 可读错误而不是让整个工坊不可用。
export async function POST(req: NextRequest) {
  let body: { mode?: unknown; theme?: unknown; lyrics?: unknown; genre?: unknown; mood?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'bad_request', message: 'JSON body required' }, { status: 400 });
  }

  const mode = body.mode === 'continue' ? 'continue' : 'write';
  const theme = typeof body.theme === 'string' ? body.theme.slice(0, 200) : undefined;
  const existingLyrics = typeof body.lyrics === 'string' ? body.lyrics.slice(0, 1200) : undefined;

  if (mode === 'continue' && !existingLyrics?.trim()) {
    return NextResponse.json(
      { error: 'bad_request', message: 'continue 模式需要已有歌词' },
      { status: 400 },
    );
  }

  try {
    const lyrics = await generateLyrics({
      mode,
      theme,
      existingLyrics,
      genre: typeof body.genre === 'string' ? body.genre : undefined,
      mood: typeof body.mood === 'string' ? body.mood : undefined,
    });
    return NextResponse.json({ lyrics });
  } catch (err) {
    return NextResponse.json(
      { error: 'internal', message: (err as Error).message },
      { status: 502 },
    );
  }
}
