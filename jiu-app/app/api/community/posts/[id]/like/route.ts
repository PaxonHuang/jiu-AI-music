import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/auth';
import { toggleLike } from '@/lib/server/community';

export const runtime = 'nodejs';

export async function POST(
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
      { error: 'unauthorized', message: '请先进入啾世界再点赞' },
      { status: 401 },
    );
  }

  try {
    const result = await toggleLike({ postId: id, userId: user.id });
    if (!result) {
      return NextResponse.json({ error: 'not_found', message: '作品不存在' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: 'internal', message: (err as Error).message },
      { status: 500 },
    );
  }
}
