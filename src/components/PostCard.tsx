import { Heart, MessageSquare, Trash2, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { formatRelativeTime } from '../lib/format.ts';
import type { PostItem, UserSummary } from '../types/social.ts';
import { Avatar } from './Avatar.tsx';

interface PostCardProps {
  post: PostItem;
  currentUser: UserSummary | null;
  onSelectProfile: (username: string) => void;
  onToggleLike: (postId: string, currentlyLiked: boolean) => Promise<void>;
  onToggleFollow: (userId: string, currentlyFollowing: boolean) => Promise<void>;
  onAddComment: (postId: string, content: string) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
  onDeleteComment: (commentId: string, postId: string) => Promise<void>;
  onRequireAuth: () => void;
}

export function PostCard({
  post,
  currentUser,
  onSelectProfile,
  onToggleLike,
  onToggleFollow,
  onAddComment,
  onDeletePost,
  onDeleteComment,
  onRequireAuth,
}: PostCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(post.comments.length > 0 && post.comments.length <= 2);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const isOwnPost = currentUser?.id === post.author.id;

  const handleLikeClick = async () => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    await onToggleLike(post.id, post.likedByMe);
  };

  const handleFollowClick = async () => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    await onToggleFollow(post.author.id, post.authorIsFollowedByMe);
  };

  const handleCommentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    const trimmed = commentText.trim();
    if (!trimmed) return;

    setCommentSubmitting(true);
    setCommentError('');
    try {
      await onAddComment(post.id, trimmed);
      setCommentText('');
      setCommentsOpen(true);
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Unable to post comment.');
    } finally {
      setCommentSubmitting(false);
    }
  };

  return (
    <article className="bg-white border border-slate-200 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => onSelectProfile(post.author.username)}
            className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer"
          >
            <Avatar src={post.author.avatarUrl} name={post.author.displayName} size="md" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => onSelectProfile(post.author.username)}
                className="font-display font-semibold text-[15px] text-slate-900 hover:underline truncate cursor-pointer"
              >
                {post.author.displayName}
              </button>
              <span className="text-xs text-slate-400" aria-hidden="true">
                ·
              </span>
              <button
                type="button"
                onClick={() => onSelectProfile(post.author.username)}
                className="text-xs text-slate-500 hover:text-slate-800 truncate cursor-pointer"
              >
                @{post.author.username}
              </button>
              <span className="text-xs text-slate-400" aria-hidden="true">
                ·
              </span>
              <time
                dateTime={post.createdAt}
                className="text-xs text-slate-500 font-mono tabular-nums whitespace-nowrap"
              >
                {formatRelativeTime(post.createdAt)}
              </time>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isOwnPost && (
            <button
              type="button"
              onClick={handleFollowClick}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                post.authorIsFollowedByMe
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  : 'text-blue-600 hover:bg-blue-50'
              }`}
            >
              {post.authorIsFollowedByMe ? 'Following' : 'Follow'}
            </button>
          )}

          {isOwnPost && !confirmDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete post"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {isOwnPost && confirmDelete && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onDeletePost(post.id)}
                className="px-2.5 py-1 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-md transition-colors whitespace-nowrap cursor-pointer"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body Copy */}
      {post.content && (
        <p className="mt-3 text-[15px] leading-relaxed text-slate-800 whitespace-pre-wrap break-words">
          {post.content}
        </p>
      )}

      {/* Media Attachment */}
      {post.imageUrl && (
        <div className="mt-3.5">
          {imageFailed ? (
            <div className="w-full h-48 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-sm text-slate-500">
              Image unavailable
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="block w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-zoom-in"
            >
              <img
                src={post.imageUrl}
                alt={post.imageAlt || `Post visual by ${post.author.displayName}`}
                referrerPolicy="no-referrer"
                onError={() => setImageFailed(true)}
                className="w-full max-h-[380px] object-cover"
              />
            </button>
          )}
        </div>
      )}

      {/* Action Bar */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-6">
        <button
          type="button"
          onClick={handleLikeClick}
          aria-pressed={post.likedByMe}
          className={`inline-flex items-center gap-1.5 py-1 px-2 -ml-2 rounded-lg text-xs font-medium transition-transform duration-150 active:scale-95 cursor-pointer ${
            post.likedByMe
              ? 'text-rose-600 bg-rose-50/70'
              : 'text-slate-600 hover:text-rose-600 hover:bg-slate-50'
          }`}
        >
          <Heart className={`w-4 h-4 ${post.likedByMe ? 'fill-rose-600' : ''}`} />
          <span className="font-mono tabular-nums">{post.likesCount}</span>
          <span>{post.likesCount === 1 ? 'Like' : 'Likes'}</span>
        </button>

        <button
          type="button"
          onClick={() => setCommentsOpen((prev) => !prev)}
          aria-expanded={commentsOpen}
          className={`inline-flex items-center gap-1.5 py-1 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            commentsOpen
              ? 'text-blue-600 bg-blue-50/70'
              : 'text-slate-600 hover:text-blue-600 hover:bg-slate-50'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span className="font-mono tabular-nums">{post.commentsCount}</span>
          <span>{post.commentsCount === 1 ? 'Comment' : 'Comments'}</span>
        </button>
      </div>

      {/* Expandable Comments Section */}
      {commentsOpen && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
          {post.comments.length === 0 ? (
            <p className="text-xs text-slate-500">
              No comments yet. Start the thread below.
            </p>
          ) : (
            <ul className="space-y-3">
              {post.comments.map((comment) => {
                const isOwnComment = currentUser?.id === comment.authorId;
                return (
                  <li key={comment.id} className="flex items-start gap-2.5 group">
                    <button
                      type="button"
                      onClick={() => onSelectProfile(comment.author.username)}
                      className="shrink-0 mt-0.5 cursor-pointer"
                    >
                      <Avatar
                        src={comment.author.avatarUrl}
                        name={comment.author.displayName}
                        size="sm"
                      />
                    </button>
                    <div className="flex-1 min-w-0 bg-slate-50 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => onSelectProfile(comment.author.username)}
                            className="text-xs font-semibold text-slate-900 hover:underline truncate cursor-pointer"
                          >
                            {comment.author.displayName}
                          </button>
                          <span className="text-xs text-slate-400" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-[11px] font-mono tabular-nums text-slate-500 whitespace-nowrap">
                            {formatRelativeTime(comment.createdAt)}
                          </span>
                        </div>
                        {isOwnComment && (
                          <button
                            type="button"
                            onClick={() => onDeleteComment(comment.id, post.id)}
                            aria-label="Delete comment"
                            className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-slate-700 mt-0.5 break-words">
                        {comment.content}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Add Comment Input */}
          <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 pt-1">
            {currentUser && (
              <Avatar
                src={currentUser.avatarUrl}
                name={currentUser.displayName}
                size="sm"
              />
            )}
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              maxLength={320}
              placeholder={
                currentUser ? 'Write a comment...' : 'Sign in to write a comment...'
              }
              onFocus={() => {
                if (!currentUser) onRequireAuth();
              }}
              aria-label="Write a comment"
              className="flex-1 min-w-0 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 transition-colors"
            />
            <button
              type="submit"
              disabled={commentSubmitting || !commentText.trim()}
              className="px-3.5 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              {commentSubmitting ? 'Posting...' : 'Reply'}
            </button>
          </form>
          {commentError && (
            <p role="alert" className="text-xs text-rose-600">
              {commentError}
            </p>
          )}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxOpen && post.imageUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Post image preview"
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-6"
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close image preview"
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={post.imageUrl}
            alt={post.imageAlt || `Post visual by ${post.author.displayName}`}
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl w-full max-h-[85vh] object-contain rounded-lg bg-white"
          />
        </div>
      )}
    </article>
  );
}
