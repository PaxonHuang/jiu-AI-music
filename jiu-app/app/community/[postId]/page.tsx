'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import {
  addComment as addMockComment,
  buildCommentTree,
  deleteComment as deleteMockComment,
  getCommentCount,
  getFavoriteCount,
  isFavoritedBy,
  toggleFavorite,
  useMockUser,
  type CommentNode,
} from '@/lib/client/mock-social';

interface Post {
  id: string;
  userId: string;
  authorName: string | null;
  authorAvatarUrl: string | null;
  body: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  audioUrl: string | null;
  taskId: string | null;
  liked: boolean;
}

type ReplyTarget = { id: string; userId: string; displayName: string } | null;

export default function CommunityPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const router = useRouter();
  const mockUser = useMockUser();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [replyTo, setReplyTo] = useState<ReplyTarget>(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);

  const postIdFromParams = useCallback(async () => (await params).postId, [params]);

  useEffect(() => {
    void (async () => {
      const postId = await postIdFromParams();
      try {
        const response = await fetch(`/api/community/posts/${postId}`);
        const payload = (await response.json()) as {
          post?: Post;
          message?: string;
        };
        if (!response.ok || !payload.post) {
          setError(payload.message ?? '帖子不存在');
          return;
        }
        setPost(payload.post);
        setComments(buildCommentTree(postId));
        setFavoriteCount(payload.post.id ? mockFavoriteCount(postId) : 0);
      } catch {
        setError('帖子加载失败');
      }
    })();
  }, [postIdFromParams]);

  // Sync favorite state whenever the current user changes (login / logout).
  useEffect(() => {
    if (!post) return;
    const userId = mockUser?.id ?? currentUserId;
    setFavorited(userId ? isFavoritedBy(post.id, userId) : false);
  }, [post, mockUser?.id, currentUserId]);

  const togglePostLike = async () => {
    if (!post) return;
    const previous = post.liked;
    setPost({ ...post, liked: !previous, likeCount: post.likeCount + (previous ? -1 : 1) });
    try {
      const response = await fetch(`/api/community/posts/${post.id}/like`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error();
      const result = (await response.json()) as { liked: boolean; likeCount: number };
      setPost((current) =>
        current ? { ...current, liked: result.liked, likeCount: result.likeCount } : current,
      );
    } catch {
      setPost(post);
      setError('互动没有保存，请重试');
    }
  };

  const togglePostFavorite = () => {
    if (!post) return;
    const userId = mockUser?.id ?? currentUserId;
    if (!userId) {
      setError('登录后再收藏吧');
      return;
    }
    const result = toggleFavorite(post.id, userId, post.userId);
    setFavorited(result.favorited);
    setFavoriteCount(result.count);
  };

  const refreshComments = (postId: string) => {
    setComments(buildCommentTree(postId));
    if (post) setPost({ ...post, commentCount: getCommentCount(postId) });
  };

  const submitComment = () => {
    if (!body.trim() || !post) return;
    const userId = mockUser?.id ?? currentUserId;
    const displayName =
      mockUser?.displayName ?? post?.authorName ?? '啾友';
    if (!userId) {
      setError('登录后再评论吧');
      return;
    }
    const result = addMockComment({
      postId: post.id,
      userId,
      displayName,
      body,
      parentId: replyTo?.id ?? null,
      replyToUserId: replyTo?.userId ?? null,
      replyToDisplayName: replyTo?.displayName ?? null,
      postAuthorId: post.userId,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBody('');
    setReplyTo(null);
    refreshComments(post.id);
  };

  const handleDeleteComment = (commentId: string) => {
    if (!post) return;
    if (!window.confirm('确定删除这条评论吗？')) return;
    const userId = mockUser?.id ?? currentUserId;
    if (!userId) return;
    deleteMockComment(commentId, userId);
    refreshComments(post.id);
  };

  const deletePost = async () => {
    if (!post) return;
    if (!window.confirm('确定删除这条帖子吗？')) return;
    try {
      const response = await fetch(`/api/community/posts/${post.id}`, { method: 'DELETE' });
      if (!response.ok) {
        setError('帖子删除失败，请重试');
        return;
      }
      router.replace('/community');
    } catch {
      setError('帖子删除失败，请重试');
    }
  };

  if (error && !post) {
    return <main className="p-6 text-center text-red-600">{error}</main>;
  }
  if (!post) {
    return <main className="p-6 text-center text-[#8A7666]">加载中...</main>;
  }

  return (
    <main className="min-h-screen bg-[#FFF8F0] pb-[calc(10rem+env(safe-area-inset-bottom,0px))]">
      <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-orange-100 bg-[#FFF8F0]/95 px-4 py-4 backdrop-blur">
        <Link href="/community" className="text-2xl">
          ‹
        </Link>
        <h1 className="text-xl font-black">帖子详情</h1>
      </header>

      <article className="mx-auto max-w-lg p-4">
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#DFF3EF] text-xl">
                {post.authorAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.authorAvatarUrl}
                    alt={post.authorName ?? '作者头像'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  '🐦'
                )}
              </div>
              <div>
                <p className="font-black">{post.authorName ?? '啾友'}</p>
                <p className="text-xs text-[#A49488]">作品分享</p>
              </div>
            </div>
            {post.userId === currentUserId && (
              <button
                type="button"
                onClick={() => void deletePost()}
                className="rounded-full bg-[#FFF1EA] px-3 py-1.5 text-xs font-black text-[#C65D37]"
              >
                删除帖子
              </button>
            )}
          </div>

          {post.body && (
            <p className="mt-4 whitespace-pre-wrap leading-8 text-[#5C4D42]">{post.body}</p>
          )}

          {post.audioUrl && (
            <div className="mt-4 rounded-2xl bg-[#FFF5E8] p-3">
              <p className="mb-2 font-black text-[#8A542B]">我的 AI 音乐作品</p>
              <audio controls className="w-full" src={post.audioUrl} />
            </div>
          )}

          <div className="mt-5 flex gap-5 border-t border-orange-50 pt-4 text-sm font-bold text-[#8A7666]">
            <button
              type="button"
              onClick={() => void togglePostLike()}
              className={post.liked ? 'text-[#E87824]' : ''}
            >
              ♥ {post.likeCount}
            </button>
            <button
              type="button"
              onClick={togglePostFavorite}
              className={favorited ? 'text-[#E87824]' : ''}
            >
              ★ {favoriteCount}
            </button>
            <span>评论 {post.commentCount}</span>
          </div>
        </div>

        <section className="mt-4 rounded-3xl bg-white p-5">
          <h2 className="font-black">评论</h2>
          <div className="mt-4 space-y-4">
            {comments.length === 0 ? (
              <p className="text-sm text-[#8A7666]">还没有评论，来抢沙发？</p>
            ) : (
              comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUserId}
                  canManage={post.userId === currentUserId}
                  onReply={setReplyTo}
                  onDelete={handleDeleteComment}
                />
              ))
            )}
          </div>
        </section>
      </article>

      <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-40 mx-auto flex max-w-lg gap-2 border-t border-orange-100 bg-[#FFF9F2] p-3">
        <input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={replyTo ? `回复 ${replyTo.displayName}` : '说点什么...'}
          className="min-h-12 flex-1 rounded-2xl bg-white px-4 outline-none"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submitComment();
            }
          }}
        />
        <button
          type="button"
          onClick={submitComment}
          className="rounded-2xl bg-[#FF9F43] px-5 font-black text-white"
        >
          发送
        </button>
      </div>

      {error && (
        <p className="fixed bottom-32 left-1/2 z-50 -translate-x-1/2 rounded-full bg-red-50 px-4 py-2 text-xs font-bold text-red-600 shadow-sm">
          {error}
        </p>
      )}
    </main>
  );
}

function CommentItem({
  comment,
  currentUserId,
  canManage,
  onReply,
  onDelete,
}: {
  comment: CommentNode;
  currentUserId: string | null;
  canManage: boolean;
  onReply: (target: ReplyTarget) => void;
  onDelete: (commentId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const replies = comment.replies;
  const visibleReplies = expanded ? replies : replies.slice(0, 3);
  const replyLabel = `${comment.displayName}${
    comment.replyToDisplayName ? ` 回复 ${comment.replyToDisplayName}` : ''
  }`;

  return (
    <div className="rounded-2xl bg-[#FFF9F2] p-3">
      <div className="flex justify-between gap-3 text-sm">
        <b>{replyLabel}</b>
        <span className="text-xs text-[#A49488]">{relativeTime(comment.createdAt)}</span>
      </div>
      <p className="mt-2 text-sm leading-6">{comment.body}</p>
      <div className="mt-2 flex gap-4 text-xs font-bold text-[#C87835]">
        <button type="button" onClick={() => onReply({ id: comment.id, userId: comment.userId, displayName: comment.displayName })}>
          回复
        </button>
        {(comment.userId === currentUserId || canManage) && (
          <button type="button" onClick={() => onDelete(comment.id)}>
            删除
          </button>
        )}
      </div>
      {replies.length > 0 && (
        <div className="mt-3 space-y-2 border-l-2 border-[#F2D1AD] pl-3">
          {visibleReplies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              canManage={canManage}
              onReply={onReply}
              onDelete={onDelete}
            />
          ))}
          {replies.length > 3 && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="text-xs font-bold text-[#C87835]"
            >
              {expanded ? '收起回复' : `展开更多回复（${replies.length - 3}）`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function mockFavoriteCount(postId: string): number {
  return getFavoriteCount(postId);
}

function relativeTime(value: string): string {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (seconds < 60) return '刚刚';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
  return `${Math.floor(seconds / 86400)} 天前`;
}