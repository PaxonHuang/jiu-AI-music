import { NextRequest, NextResponse } from 'next/server';
import { loadCredentials } from '@/lib/volcengine/sign';
import { submitGenBGMForTime, submitGenSongForTime, VolcApiError } from '@/lib/volcengine/gensong';

export const runtime = 'nodejs';

type Track = 'vocal' | 'instrumental';

interface CreateMusicRequest {
  track: Track;
  text?: string;
  lyrics?: string;
  prompt?: string;
  duration?: number;
  genre?: string;
  mood?: string;
  gender?: 'Female' | 'Male';
  timbre?: string;
  modelVersion?: 'v4.0' | 'v4.3' | 'v5.0';
  lang?: string;
  vodFormat?: 'wav' | 'mp3';
  callbackUrl?: string;
}

function badRequest(message: string) {
  return NextResponse.json({ error: 'bad_request', message }, { status: 400 });
}

function birdTired(error: { code: number; message: string; action: string }) {
  return NextResponse.json(
    {
      error: 'bird_tired',
      message: '小鸟累了，请换参数重试',
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

  let credentials;
  try {
    credentials = loadCredentials();
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
      const submit = await submitGenBGMForTime(
        {
          text,
          duration: body.duration,
          callbackUrl: body.callbackUrl,
          enableInputRewrite: false,
        },
        credentials,
      );
      return NextResponse.json({
        taskId: submit.taskId,
        predictedWaitTime: submit.predictedWaitTime,
        track: body.track,
      });
    }

    const lyrics = body.lyrics?.trim();
    const prompt = body.prompt?.trim();
    if (!lyrics && !prompt) {
      return badRequest('vocal track requires Lyrics or Prompt');
    }
    const submit = await submitGenSongForTime(
      {
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
      },
      credentials,
    );
    return NextResponse.json({
      taskId: submit.taskId,
      predictedWaitTime: submit.predictedWaitTime,
      track: body.track,
    });
  } catch (err) {
    if (err instanceof VolcApiError) {
      return birdTired({ code: err.code, message: err.message, action: err.action });
    }
    return NextResponse.json(
      { error: 'internal', message: (err as Error).message },
      { status: 500 },
    );
  }
}
