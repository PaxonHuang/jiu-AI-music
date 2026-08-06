// R2 helper: copy a remote audio URL into a Cloudflare R2 bucket so the
// generated song URL becomes permanent (Volcengine signed URLs expire after
// up to 1 year). When an R2 binding is not configured, callers should fall
// back to the original audioUrl.

interface R2BucketLike {
  put(key: string, value: ReadableStream | ArrayBuffer | string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
}

interface R2Binding {
  get(key: string): Promise<{ body?: ReadableStream; httpMetadata?: { contentType?: string } } | null>;
  put(key: string, value: ReadableStream | ArrayBuffer | string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
}

export async function persistAudioToR2(
  bucket: R2Binding | null | undefined,
  audioUrl: string,
  taskId: string,
): Promise<{ url: string; persisted: boolean }> {
  if (!bucket) {
    return { url: audioUrl, persisted: false };
  }

  const key = `${taskId}.wav`;
  const existing = await bucket.get(key);
  if (existing) {
    return { url: `/api/music/audio/${encodeURIComponent(taskId)}`, persisted: true };
  }

  const resp = await fetch(audioUrl);
  if (!resp.ok) {
    throw new Error(`Failed to download audio: ${resp.status} ${resp.statusText}`);
  }

  const contentType = resp.headers.get('content-type') ?? 'audio/wav';
  await bucket.put(key, resp.body as ReadableStream, {
    httpMetadata: { contentType },
  });

  return { url: `/api/music/audio/${encodeURIComponent(taskId)}`, persisted: true };
}

// Type guard util for unexpected runtime cases.
export function isR2Binding(value: unknown): value is R2Binding {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as R2BucketLike).put === 'function' &&
    typeof (value as R2Binding).get === 'function'
  );
}
