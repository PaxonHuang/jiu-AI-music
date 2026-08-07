import { NextRequest, NextResponse } from 'next/server';
import { selectMusicProvider } from '@/lib/workshop/provider';
import { MusicProviderError } from '@/lib/workshop/types';

export const runtime = 'nodejs';

type Track = 'vocal' | 'instrumental';

interface CreateMusicRequest {
  track: Track;
  text?: string;
  lyrics?: string;
  prompt?: string;
  duration?: number;
  /** Volcengine `Genre` field — already a Chinese label (e.g. "流行"). */
  genre?: string;
  /** Volcengine `Mood` field — already a Chinese label (e.g. "开心"). */
  mood?: string;
  gender?: 'Female' | 'Male';
  timbre?: string;
  /** Optional Chinese-labelled instrument names (max 2). Concat-into-TextPrompt by gensong.ts. */
  instruments?: string[];
  modelVersion?: 'v4.0' | 'v4.3' | 'v5.0';
  lang?: string;
  vodFormat?: 'wav' | 'mp3';
  callbackUrl?: string;
}

function badRequest(message: string) {
  return NextResponse.json({ error: 'bad_request', message }, { status: 400 });
}

function validateText(value: string, field: 'Lyrics' | 'Prompt') {
  const length = Array.from(value).length;
  if (length < 5) return `${field} must be at least 5 characters`;
  if (length > 2000) return `${field} must be at most 2000 characters`;
  return null;
}

function volcErrorMessage(code: number) {
  if ([300061, 300062].includes(code)) return '歌词可能涉及版权，请换一种表达再试';
  if ([300063, 300064].includes(code)) return '歌词里有不适合的内容，请修改后再试';
  if ([100010, 300065, 300066].includes(code)) return '歌词或歌曲设置不符合要求，请修改后再试';
  if ([200022, 200023, 400040].includes(code)) return '今天创作的小鸟有点忙，请稍后再试';
  if ([200020, 200021, 200024, 200028].includes(code)) return '音乐服务暂时未配置好，请联系管理员';
  return '小鸟累了，请稍后再试';
}

function birdTired(error: { code: number; message: string; action: string; requestId: string }) {
  return NextResponse.json(
    {
      error: 'bird_tired',
      message: volcErrorMessage(error.code),
      detail: error,
    },
    { status: 502 },
  );
}

export async function POST(req: NextRequest) {
  let body: CreateMusicRequest;
  try {
    body = (await req.json()) as CreateMusicRequest;
  } catch {
    return badRequest('JSON body required');
  }

  let provider;
  try {
    provider = selectMusicProvider();
  } catch (err) {
    return NextResponse.json(
      {
        error: 'missing_credentials',
        message: 'Volunteer cloud keys are not configured',
        detail: (err as Error).message,
      },
      { status: 500 },
    );
  }

  try {
    if (body.track === 'instrumental') {
      const text = body.text?.trim();
      if (!text) {
        return badRequest('instrumental track requires a Text description');
      }
      if (body.instruments && (!Array.isArray(body.instruments) || body.instruments.length > 2)) {
        return badRequest('at most two instruments are allowed');
      }
      const submit = await provider.createTask({
        track: 'instrumental',
        text,
        duration: body.duration,
        callbackUrl: body.callbackUrl,
        instruments: body.instruments,
      });
      return NextResponse.json({
        taskId: submit.taskId,
        predictedWaitTime: submit.predictedWaitTime,
        track: body.track,
        provider: provider.name,
      });
    }

    const lyrics = body.lyrics?.trim();
    const prompt = body.prompt?.trim();
    if (!lyrics && !prompt) {
      return badRequest('vocal track requires Lyrics or Prompt');
    }
    if (lyrics && validateText(lyrics, 'Lyrics')) return badRequest(validateText(lyrics, 'Lyrics')!);
    if (!lyrics && prompt && validateText(prompt, 'Prompt')) return badRequest(validateText(prompt, 'Prompt')!);
    if (body.gender && !['Female', 'Male'].includes(body.gender)) return badRequest('gender must be Female or Male');
    if (body.modelVersion && !['v4.0', 'v4.3', 'v5.0'].includes(body.modelVersion)) return badRequest('unsupported modelVersion');
    if (body.vodFormat && !['wav', 'mp3'].includes(body.vodFormat)) return badRequest('unsupported vodFormat');
    if (body.instruments && (!Array.isArray(body.instruments) || body.instruments.length > 2)) {
      return badRequest('at most two instruments are allowed');
    }
    const submit = await provider.createTask({
      track: 'vocal',
      lyrics,
      prompt,
      modelVersion: body.modelVersion,
      genre: body.genre,
      mood: body.mood,
      gender: body.gender,
      timbre: body.timbre,
      duration: body.duration,
      lang: body.lang,
      vodFormat: body.vodFormat,
      instruments: body.instruments,
    });
    return NextResponse.json({
      taskId: submit.taskId,
      predictedWaitTime: submit.predictedWaitTime,
      track: body.track,
      provider: provider.name,
    });
  } catch (err) {
    if (err instanceof MusicProviderError) {
      return birdTired({
        code: err.code,
        message: err.message,
        action: err.action,
        requestId: err.requestId,
      });
    }
    return NextResponse.json(
      { error: 'internal', message: (err as Error).message },
      { status: 500 },
    );
  }
}
