import { ArrowLeft, Calendar, Link as LinkIcon, MapPin } from 'lucide-react';
import { useState } from 'react';
import { formatJoinedDate } from '../lib/format.ts';
import type { PostItem, UserSummary } from '../types/social.ts';
import { Avatar } from './Avatar.tsx';
import { PostCard } from './PostCard.tsx';

interface ProfileViewProps {
  profile: UserSummary;
  posts: PostItem[];
  postsLoading: boolean;
  activeTab: 'posts' | 'liked';
  onTabChange: (tab: 'posts' | 'liked') => void;
  currentUser: UserSummary | null;
  onBack: () => void;
  onOpenEdit: () => void;
  onSwitchAccount: () => void;
  onSignOut: () => void;
  onOpenUserList: (mode: 'followers' | 'following') => void;
  onSelectProfile: (username: string) => void;
  onToggleFollow: (userId: string, currentlyFollowing: boolean) => Promise<void>;
  onToggleLike: (postId: string, currentlyLiked: boolean) => Promise<void>;
  onAddComment: (postId: string, content: string) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
  onDeleteComment: (commentId: string, postId: string) => Promise<void>;
  onRequireAuth: () => void;
}

export function ProfileView({
  profile,
  posts,
  postsLoading,
  activeTab,
  onTabChange,
  currentUser,
  onBack,
  onOpenEdit,
  onSwitchAccount,
  onSignOut,
  onOpenUserList,
  onSelectProfile,
  onToggleFollow,
  onToggleLike,
  onAddComment,
  onDeletePost,
  onDeleteComment,
  onRequireAuth,
}: ProfileViewProps) {
  const [followBusy, setFollowBusy] = useState(false);
  const isOwnProfile = currentUser?.id === profile.id;

  const handleFollowToggle = async () => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setFollowBusy(true);
    try {
      await onToggleFollow(profile.id, profile.isFollowing);
    } finally {
      setFollowBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Back navigation */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to feed</span>
      </button>

      {/* Profile Header Surface */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div
          className="h-32 w-full"
          style={{ backgroundColor: profile.coverColor || '#1E3A8A' }}
        />
        <div className="px-6 pb-6">
          <div className="flex items-end justify-between gap-4 -mt-10 flex-wrap">
            <Avatar
              src={profile.avatarUrl}
              name={profile.displayName}
              size="xl"
              className="ring-4 ring-white"
            />
            <div className="pt-12 flex items-center gap-2">
              {isOwnProfile ? (
                <>
                  <button
                    type="button"
                    onClick={onOpenEdit}
                    className="px-4 py-2 text-sm font-medium border border-slate-300 hover:bg-slate-50 text-slate-900 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Edit Profile
                  </button>
                  <button
                    type="button"
                    onClick={onSwitchAccount}
                    className="lg:hidden px-3 py-2 text-sm font-medium border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Switch
                  </button>
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="lg:hidden px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={followBusy}
                  onClick={handleFollowToggle}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    profile.isFollowing
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {profile.isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
          </div>

          <div className="mt-4">
            <h1 className="font-display font-bold text-xl text-slate-900">
              {profile.displayName}
            </h1>
            <div className="flex items-center gap-2 text-sm text-slate-500 mt-0.5">
              <span>@{profile.username}</span>
              {profile.followsYou && !isOwnProfile && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-xs font-medium text-slate-600">Follows you</span>
                </>
              )}
            </div>

            {profile.bio && (
              <p className="mt-3 text-[15px] leading-relaxed text-slate-700 max-w-xl">
                {profile.bio}
              </p>
            )}

            {/* Metadata row (unboxed text, zero pills) */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
              {profile.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{profile.location}</span>
                </span>
              )}
              {profile.website && (
                <span className="inline-flex items-center gap-1">
                  <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-blue-600">{profile.website}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Joined {formatJoinedDate(profile.createdAt)}</span>
              </span>
            </div>

            {/* Tabular Counts */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-6 text-sm">
              <div>
                <span className="font-mono font-semibold tabular-nums text-slate-900">
                  {profile.postsCount}
                </span>{' '}
                <span className="text-slate-500">
                  {profile.postsCount === 1 ? 'Post' : 'Posts'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onOpenUserList('following')}
                className="hover:underline cursor-pointer"
              >
                <span className="font-mono font-semibold tabular-nums text-slate-900">
                  {profile.followingCount}
                </span>{' '}
                <span className="text-slate-500">Following</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenUserList('followers')}
                className="hover:underline cursor-pointer"
              >
                <span className="font-mono font-semibold tabular-nums text-slate-900">
                  {profile.followersCount}
                </span>{' '}
                <span className="text-slate-500">
                  {profile.followersCount === 1 ? 'Follower' : 'Followers'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Segmented Profile Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => onTabChange('posts')}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            activeTab === 'posts'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Posts
        </button>
        <button
          type="button"
          onClick={() => onTabChange('liked')}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            activeTab === 'liked'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Likes
        </button>
      </div>

      {/* Profile Posts Feed */}
      {postsLoading ? (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="bg-white border border-slate-200 rounded-xl p-5 h-36 animate-pulse"
            />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="font-display font-semibold text-slate-900">
            {activeTab === 'posts' ? 'No posts published yet' : 'No liked posts yet'}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {activeTab === 'posts'
              ? 'Updates published by this member will appear here.'
              : 'Posts liked by this member will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={currentUser}
              onSelectProfile={onSelectProfile}
              onToggleLike={onToggleLike}
              onToggleFollow={onToggleFollow}
              onAddComment={onAddComment}
              onDeletePost={onDeletePost}
              onDeleteComment={onDeleteComment}
              onRequireAuth={onRequireAuth}
            />
          ))}
        </div>
      )}
    </div>
  );
}
