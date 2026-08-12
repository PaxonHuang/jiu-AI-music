import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Stream a generated song back from R2.
 *
 * Native <audio controls> in the community page needs three things to behave
 * like a normal audio file: a real `Content-Type` (not `application/json`),
 * a `Content-Length` (so the progress bar can show total time), and
 * `Accept-Ranges: bytes` support (so the user can scrub). Without those,
 * mobile browsers show the controls but refuse to play or seek.
 *
 * R2 already streams chunks — we only have to add the headers and respond
 * 206 Partial Content when the client sent a `Range` header.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  if (!taskId || !/^[A-Za-z0-9_-]{6,128}$/.test(taskId)) {
    return NextResponse.json(
      { error: 'bad_request', message: 'taskId looks malformed' },
      { status: 400 },
    );
  }

  let bucket: { get: (key: string) => Promise<unknown> } | undefined;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = getCloudflareContext();
    bucket = (ctx?.env as { MUSIC_BUCKET?: { get: (key: string) => Promise<unknown> } })
      ?.MUSIC_BUCKET;
  } catch {
    bucket = undefined;
  }
  if (!bucket) {
    return NextResponse.json(
      { error: 'not_configured', message: 'R2 bucket is not configured' },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const specificPath = url.searchParams.get('path');
  const key = specificPath ?? `${taskId}.wav`;

  type R2Object = {
    body?: ReadableStream<Uint8Array> | null;
    httpMetadata?: { contentType?: string };
    size?: number;
  };
  const object = (await bucket.get(key)) as R2Object | null;
  if (!object || !object.body) {
    return NextResponse.json(
      { error: 'not_found', message: `No audio stored for taskId ${taskId}` },
      { status: 404 },
    );
  }

  const totalSize = object.size ?? 0;
  const contentType = object.httpMetadata?.contentType ?? 'audio/wav';

  const range = req.headers.get('range');
  if (range && totalSize > 0) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      const startStr = match[1];
      const endStr = match[2];
      const start =
        startStr === '' ? Math.max(totalSize - Number(endStr || 0), 0) : Number(startStr);
      const end = endStr === '' ? totalSize - 1 : Math.min(Number(endStr), totalSize - 1);
      if (!Number.isNaN(start) && !Number.isNaN(end) && start <= end) {
        const sliced = sliceStream(object.body, start, end + 1);
        return new Response(sliced, {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(end - start + 1),
            'Content-Range': `bytes ${start}-${end}/${totalSize}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }
    }
  }

  return new Response(object.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(totalSize),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

/**
 * ReadableStream does not expose `.slice` in the standard TS lib we use, so
 * implement the byte-range filter manually: skip until `start`, then yield up
 * to `end - start` bytes. Works for any chunked source — the caller doesn't
 * need to know chunk boundaries.
 */
function sliceStream(
  source: ReadableStream<Uint8Array>,
  start: number,
  endExclusive: number,
): ReadableStream<Uint8Array> {
  let skipped = 0;
  let sent = 0;
  const reader = source.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        if (skipped + value.byteLength <= start) {
          skipped += value.byteLength;
          continue;
        }
        const chunkStart = Math.max(start - skipped, 0);
        const chunkEnd = Math.min(value.byteLength, endExclusive - skipped);
        const slice = value.subarray(chunkStart, chunkEnd);
        skipped += value.byteLength;
        sent += slice.byteLength;
        controller.enqueue(slice);
        if (sent >= endExclusive - start) {
          controller.close();
          try {
            await reader.cancel();
          } catch {
            // ignore — stream may already be released
          }
          return;
        }
      }
    },
  });
}