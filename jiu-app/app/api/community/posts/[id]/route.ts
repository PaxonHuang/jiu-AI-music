import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/auth';
import { deletePost } from '@/lib/server/community';

export const runtime = 'nodejs';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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
      { error: 'unauthorized', message: '请先进入啾世界再操作' },
      { status: 401 },
    );
  }

  try {
    const deleted = await deletePost({ postId: id, userId: user.id });
    if (!deleted) {
      return NextResponse.json(
        { error: 'not_found', message: '帖子不存在或不是你的' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: 'internal', message: (err as Error).message },
      { status: 500 },
    );
  }
}
