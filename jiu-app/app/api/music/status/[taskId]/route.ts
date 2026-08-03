import { NextRequest, NextResponse } from 'next/server';
import { loadCredentials } from '@/lib/volcengine/sign';
import {
  querySong,
  VolcApiError,
  STATUS_PENDING,
  STATUS_RUNNING,
  STATUS_SUCCESS,
  STATUS_FAILED,
} from '@/lib/volcengine/gensong';
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
    const result = await querySong(taskId, credentials);
    const statusMap: Record<number, string> = {
      [STATUS_PENDING]: 'pending',
      [STATUS_RUNNING]: 'running',
      [STATUS_SUCCESS]: 'success',
      [STATUS_FAILED]: 'failed',
    };

    let audioUrl: string | undefined;
    let persisted = false;
    if (result.status === STATUS_SUCCESS && result.audioUrl) {
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
    const failureReason =
      result.status === STATUS_FAILED && result.failureReason
        ? { code: result.failureReason.code, msg: result.failureReason.msg }
        : null;

    return NextResponse.json({
      taskId: result.taskId,
      status: statusMap[result.status] ?? 'unknown',
      progress: result.progress,
      audioUrl,
      duration: result.duration,
      lyrics: result.lyrics,
      failureReason,
      persisted,
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
