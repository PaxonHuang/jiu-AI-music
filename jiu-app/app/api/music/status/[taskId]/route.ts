import { NextRequest, NextResponse } from 'next/server';
import { selectMusicProvider } from '@/lib/workshop/provider';
import { MusicProviderError } from '@/lib/workshop/types';
import { persistAudioToR2 } from '@/lib/volcengine/r2';

export const runtime = 'nodejs';

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  if (!taskId || !/^[A-Za-z0-9_-]{6,128}$/.test(taskId)) {
    return NextResponse.json(
      { error: 'bad_request', message: 'taskId looks malformed' },
      { status: 400 },
    );
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
    const result = await provider.getTask(taskId);

    let audioUrl = result.audioUrl;
    let persisted = false;
    if (result.status === 'success' && result.audioUrl) {
      // Try to persist to R2 if the binding is configured. We resolve the
      // binding lazily so the route works in local dev without R2.
      let r2Bucket: unknown = undefined;
      try {
        const { getCloudflareContext } = await import('@opennextjs/cloudflare');
        const ctx = getCloudflareContext();
        r2Bucket = (ctx?.env as { MUSIC_BUCKET?: unknown })?.MUSIC_BUCKET;
      } catch {
        r2Bucket = undefined;
      }
      const persistedAudio = await persistAudioToR2(
        r2Bucket as never,
        result.audioUrl,
        taskId,
      );
      audioUrl = persistedAudio.url;
      persisted = persistedAudio.persisted;
    }

    return NextResponse.json({
      taskId: result.taskId,
      status: result.status,
      progress: result.progress,
      audioUrl,
      duration: result.duration,
      lyrics: result.lyrics,
      failureReason: result.failure
        ? { code: result.failure.code, msg: result.failure.message }
        : null,
      persisted,
      provider: provider.name,
    });
  } catch (err) {
    if (err instanceof MusicProviderError) {
      return birdTired({ code: err.code, message: err.message, action: err.action });
    }
    return NextResponse.json(
      { error: 'internal', message: (err as Error).message },
      { status: 500 },
    );
  }
}
