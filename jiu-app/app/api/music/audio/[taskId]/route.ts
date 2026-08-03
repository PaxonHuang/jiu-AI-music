import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

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

  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = getCloudflareContext();
    const bucket = (ctx?.env as { MUSIC_BUCKET?: { get: (key: string) => Promise<unknown> } })?.MUSIC_BUCKET;
    if (!bucket) {
      return NextResponse.json(
        { error: 'not_configured', message: 'R2 bucket is not configured' },
        { status: 503 },
      );
    }

    // The most recent song for this taskId is the most recently written — we
    // accept a query param `path` to disambiguate when multiple exist.
    const url = new URL(_req.url);
    const specificPath = url.searchParams.get('path');
    const key = specificPath ?? `${taskId}.wav`;

    const object = (await bucket.get(key)) as { body?: ReadableStream | null; httpMetadata?: { contentType?: string } } | null;
    if (!object || !object.body) {
      return NextResponse.json(
        { error: 'not_found', message: `No audio stored for taskId ${taskId}` },
        { status: 404 },
      );
    }

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType ?? 'audio/wav');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return new Response(object.body as ReadableStream, { headers });
  } catch (err) {
    return NextResponse.json(
      { error: 'internal', message: (err as Error).message },
      { status: 500 },
    );
  }
}
