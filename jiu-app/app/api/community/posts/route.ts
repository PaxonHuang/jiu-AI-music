import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/auth';
import { clampLimit, createPost, listPosts } from '@/lib/server/community';

export const runtime = 'nodejs';

const MAX_BODY_LENGTH = 500;

export async function GET(req: NextRequest) {
  try {
    // Anonymous reads are allowed; a viewer is only needed to mark `liked`
    // or to scope `mine` to the caller.
    const user = await getSessionUser(req);
    const limit = clampLimit(req.nextUrl.searchParams.get('limit'));
    const mine = req.nextUrl.searchParams.get('mine') === '1';
    const posts = await listPosts({
      limit,
      viewerId: user?.id ?? null,
      authorId: mine ? user?.id ?? null : null,
    });
    return NextResponse.json({ posts });
  } catch (err) {
    return NextResponse.json(
      { error: 'internal', message: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await getSessionUser(req);
  } catch (err) {
    return NextResponse.json(
      { error: 'internal', message: (err as Error).message },
      { status: 500 },
    );
  }
  if (!user) {
    return NextResponse.json(
      { error: 'unauthorized', message: '请先进入啾世界再发布作品' },
      { status: 401 },
    );
  }

  let payload: { body?: unknown; taskId?: unknown };
  try {
    payload = (await req.json()) as { body?: unknown; taskId?: unknown };
  } catch {
    return NextResponse.json({ error: 'bad_request', message: 'JSON body required' }, { status: 400 });
  }

  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  if (Array.from(body).length > MAX_BODY_LENGTH) {
    return NextResponse.json(
      { error: 'bad_request', message: `说明最多 ${MAX_BODY_LENGTH} 个字` },
      { status: 400 },
    );
  }

  const taskId = typeof payload.taskId === 'string' ? payload.taskId.trim() : '';
  if (taskId && !/^[A-Za-z0-9_-]{6,128}$/.test(taskId)) {
    return NextResponse.json({ error: 'bad_request', message: 'taskId looks malformed' }, { status: 400 });
  }
  if (!body && !taskId) {
    return NextResponse.json(
      { error: 'bad_request', message: '发布内容不能为空' },
      { status: 400 },
    );
  }

  try {
    const post = await createPost({ userId: user.id, body, taskId: taskId || null });
    return NextResponse.json({ post }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: 'internal', message: (err as Error).message },
      { status: 500 },
    );
  }
}
