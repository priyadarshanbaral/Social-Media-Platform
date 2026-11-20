import { LogOut, Search, Users } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthModal } from './components/AuthModal.tsx';
import { Avatar } from './components/Avatar.tsx';
import { EditProfileModal } from './components/EditProfileModal.tsx';
import { ExploreDirectory } from './components/ExploreDirectory.tsx';
import { PostCard } from './components/PostCard.tsx';
import { PostComposer } from './components/PostComposer.tsx';
import { ProfileView } from './components/ProfileView.tsx';
import { UserListModal } from './components/UserListModal.tsx';
import {
  api,
  getStoredToken,
  hasExplicitLogout,
  markExplicitLogout,
  setStoredToken,
} from './lib/api.ts';
import type { AuthResponse, PostItem, UserSummary } from './types/social.ts';

type ActiveRoute =
  | { view: 'feed'; feedType: 'all' | 'following' }
  | { view: 'explore' }
  | { view: 'profile'; username: string; tab: 'posts' | 'liked' };

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserSummary | null>(null);
  const [route, setRoute] = useState<ActiveRoute>({ view: 'feed', feedType: 'all' });
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [activeProfile, setActiveProfile] = useState<UserSummary | null>(null);
  const [postsLoading, setPostsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorBanner, setErrorBanner] = useState('');

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [userListModal, setUserListModal] = useState<{
    username: string;
    mode: 'followers' | 'following';
  } | null>(null);

  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const loadDirectory = useCallback(async () => {
    try {
      const res = await api.users.list();
      setUsers(res.users);
    } catch {
      // Directory refresh errors are non-blocking
    }
  }, []);

  const loadPosts = useCallback(async (targetRoute: ActiveRoute, query: string) => {
    setPostsLoading(true);
    setErrorBanner('');
    try {
      if (targetRoute.view === 'feed') {
        const res = await api.posts.list({
          feed: targetRoute.feedType,
          q: query,
        });
        setPosts(res.posts);
      } else if (targetRoute.view === 'profile') {
        const [profileRes, postsRes] = await Promise.all([
          api.users.getProfile(targetRoute.username),
          api.posts.list({
            username: targetRoute.username,
            feed: targetRoute.tab === 'liked' ? 'liked' : 'all',
          }),
        ]);
        setActiveProfile(profileRes.user);
        setPosts(postsRes.posts);
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to load feed.');
    } finally {
      setPostsLoading(false);
    }
  }, []);

  // Bootstrap authentication session
  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      const token = getStoredToken();
      if (token) {
        try {
          const me = await api.auth.me();
          if (!cancelled && me.user) {
            setCurrentUser(me.user);
            return;
          }
        } catch {
          setStoredToken(null);
        }
      }

      if (!hasExplicitLogout()) {
        try {
          const demo = await api.auth.demoSwitch('elena_vance');
          if (!cancelled) {
            setStoredToken(demo.token);
            setCurrentUser(demo.user);
          }
        } catch {
          // Stay signed out if auto-demo fails
        }
      }
    }
    bootstrap().finally(() => {
      if (!cancelled) {
        loadDirectory();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadDirectory]);

  // Reload posts whenever route, auth user, or search changes
  useEffect(() => {
    if (route.view === 'explore') {
      loadDirectory();
      return;
    }
    loadPosts(route, searchQuery);
  }, [route, currentUser?.id, searchQuery, loadPosts, loadDirectory]);

  const handleAuthSuccess = (auth: AuthResponse) => {
    setStoredToken(auth.token);
    setCurrentUser(auth.user);
    loadDirectory();
  };

  const handleSignOut = async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    }
    markExplicitLogout();
    setCurrentUser(null);
    if (route.view === 'feed' && route.feedType === 'following') {
      setRoute({ view: 'feed', feedType: 'all' });
    }
  };

  const handlePublishPost = async (payload: {
    content: string;
    imageUrl?: string;
    imageAlt?: string;
  }) => {
    const res = await api.posts.create(payload);
    setPosts((prev) => [res.post, ...prev]);
    if (currentUser) {
      setCurrentUser({ ...currentUser, postsCount: currentUser.postsCount + 1 });
    }
    loadDirectory();
  };

  const handleDeletePost = async (postId: string) => {
    await api.posts.remove(postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    if (currentUser) {
      setCurrentUser({
        ...currentUser,
        postsCount: Math.max(0, currentUser.postsCount - 1),
      });
    }
    loadDirectory();
  };

  const handleToggleLike = async (postId: string, currentlyLiked: boolean) => {
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              likedByMe: !currentlyLiked,
              likesCount: currentlyLiked
                ? Math.max(0, p.likesCount - 1)
                : p.likesCount + 1,
            }
          : p,
      ),
    );
    try {
      const res = currentlyLiked
        ? await api.posts.unlike(postId)
        : await api.posts.like(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, likedByMe: res.liked, likesCount: res.likesCount }
            : p,
        ),
      );
    } catch (err) {
      // Revert on failure
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                likedByMe: currentlyLiked,
                likesCount: currentlyLiked
                  ? p.likesCount + 1
                  : Math.max(0, p.likesCount - 1),
              }
            : p,
        ),
      );
      setErrorBanner(err instanceof Error ? err.message : 'Unable to update like.');
    }
  };

  const handleToggleFollow = async (targetUserId: string, currentlyFollowing: boolean) => {
    const res = currentlyFollowing
      ? await api.users.unfollow(targetUserId)
      : await api.users.follow(targetUserId);

    setPosts((prev) =>
      prev.map((p) =>
        p.authorId === targetUserId
          ? { ...p, authorIsFollowedByMe: res.following }
          : p,
      ),
    );

    setUsers((prev) =>
      prev.map((u) =>
        u.id === targetUserId
          ? { ...u, isFollowing: res.following, followersCount: res.followersCount }
          : u,
      ),
    );

    if (activeProfile && activeProfile.id === targetUserId) {
      setActiveProfile({
        ...activeProfile,
        isFollowing: res.following,
        followersCount: res.followersCount,
      });
    }

    if (currentUser) {
      setCurrentUser({
        ...currentUser,
        followingCount: res.following
          ? currentUser.followingCount + 1
          : Math.max(0, currentUser.followingCount - 1),
      });
    }
  };

  const handleAddComment = async (postId: string, content: string) => {
    const res = await api.posts.addComment(postId, content);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              commentsCount: res.commentsCount,
              comments: [...p.comments, res.comment],
            }
          : p,
      ),
    );
  };

  const handleDeleteComment = async (commentId: string, postId: string) => {
    const res = await api.posts.deleteComment(commentId);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              commentsCount: res.commentsCount,
              comments: p.comments.filter((c) => c.id !== commentId),
            }
          : p,
      ),
    );
  };

  const handleSaveProfile = async (payload: {
    displayName: string;
    bio: string;
    location: string;
    website: string;
    avatarUrl: string;
    coverColor: string;
  }) => {
    const res = await api.users.updateProfile(payload);
    setCurrentUser(res.user);
    if (activeProfile && activeProfile.id === res.user.id) {
      setActiveProfile(res.user);
    }
    loadDirectory();
    if (route.view !== 'explore') {
      loadPosts(route, searchQuery);
    }
  };

  const openProfile = (username: string) => {
    setRoute({ view: 'profile', username, tab: 'posts' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNewPostCTA = () => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    if (route.view !== 'feed') {
      setRoute({ view: 'feed', feedType: 'all' });
    }
    setTimeout(() => {
      composerRef.current?.focus();
    }, 60);
  };

  const suggestedUsers = users
    .filter((u) => u.id !== currentUser?.id)
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* Top Bar Contract: Zone 1 (Wordmark) — Zone 2 (4 single-line links) — Zone 3 (1 Primary CTA) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1220px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element brand wordmark */}
          <button
            type="button"
            onClick={() => setRoute({ view: 'feed', feedType: 'all' })}
            className="font-display font-bold text-xl tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Meridian
          </button>

          {/* Zone 2: Single-line navigation links */}
          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-5 sm:gap-7 text-sm font-medium overflow-x-auto"
          >
            <button
              type="button"
              onClick={() => setRoute({ view: 'feed', feedType: 'all' })}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                route.view === 'feed' && route.feedType === 'all'
                  ? 'border-blue-600 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              For You
            </button>
            <button
              type="button"
              onClick={() => {
                if (!currentUser) {
                  setAuthModalOpen(true);
                  return;
                }
                setRoute({ view: 'feed', feedType: 'following' });
              }}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                route.view === 'feed' && route.feedType === 'following'
                  ? 'border-blue-600 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Following
            </button>
            <button
              type="button"
              onClick={() => setRoute({ view: 'explore' })}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                route.view === 'explore'
                  ? 'border-blue-600 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Explore
            </button>
            <button
              type="button"
              onClick={() => {
                if (!currentUser) {
                  setAuthModalOpen(true);
                  return;
                }
                openProfile(currentUser.username);
              }}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                route.view === 'profile' &&
                currentUser &&
                route.username === currentUser.username
                  ? 'border-blue-600 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Profile
            </button>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleNewPostCTA}
              className="px-4 py-2 text-xs sm:text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {currentUser ? 'New Post' : 'Sign In'}
            </button>
          </div>
        </div>
      </header>

      {/* Main 3-Column Social Workspace */}
      <main className="max-w-[1220px] mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)_300px] gap-6 items-start">
        {/* Left Sidebar: Active Identity Card */}
        <aside className="hidden lg:block sticky top-22 space-y-4">
          {currentUser ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <button
                type="button"
                onClick={() => openProfile(currentUser.username)}
                className="flex items-center gap-3 w-full text-left cursor-pointer group"
              >
                <Avatar
                  src={currentUser.avatarUrl}
                  name={currentUser.displayName}
                  size="md"
                />
                <div className="min-w-0">
                  <p className="font-display font-semibold text-sm text-slate-900 truncate group-hover:underline">
                    {currentUser.displayName}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    @{currentUser.username}
                  </p>
                </div>
              </button>

              <p className="mt-3 text-xs leading-relaxed text-slate-600 line-clamp-3">
                {currentUser.bio}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="font-mono font-semibold text-sm tabular-nums text-slate-900">
                    {currentUser.postsCount}
                  </p>
                  <p className="text-[11px] text-slate-500">Posts</p>
                </div>
                <div>
                  <p className="font-mono font-semibold text-sm tabular-nums text-slate-900">
                    {currentUser.followersCount}
                  </p>
                  <p className="text-[11px] text-slate-500">Followers</p>
                </div>
                <div>
                  <p className="font-mono font-semibold text-sm tabular-nums text-slate-900">
                    {currentUser.followingCount}
                  </p>
                  <p className="text-[11px] text-slate-500">Following</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Switch Account</span>
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  aria-label="Sign out"
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="font-display font-semibold text-sm text-slate-900">
                Welcome to Meridian
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                Sign in or pick a community profile to publish updates, follow creators, and join threads.
              </p>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="mt-4 w-full py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer"
              >
                Sign In or Register
              </button>
            </div>
          )}
        </aside>

        {/* Center Stream */}
        <section className="min-w-0 space-y-4">
          {errorBanner && (
            <div
              role="alert"
              className="bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl px-4 py-3 flex items-center justify-between gap-3"
            >
              <span>{errorBanner}</span>
              <button
                type="button"
                onClick={() => setErrorBanner('')}
                className="text-xs font-medium underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {route.view === 'feed' && (
            <>
              <PostComposer
                currentUser={currentUser}
                onPublish={handlePublishPost}
                onRequireAuth={() => setAuthModalOpen(true)}
                composerRef={composerRef}
              />

              {/* Mobile quick search + feed filter bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setRoute({ view: 'feed', feedType: 'all' })}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      route.feedType === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Posts
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentUser) {
                        setAuthModalOpen(true);
                        return;
                      }
                      setRoute({ view: 'feed', feedType: 'following' });
                    }}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      route.feedType === 'following'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Following
                  </button>
                </div>

                <div className="lg:hidden relative flex-1 min-w-[180px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search posts..."
                    className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>

                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="hidden lg:inline text-xs text-blue-600 hover:underline cursor-pointer"
                  >
                    Clear search "{searchQuery}"
                  </button>
                )}
              </div>

              {postsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="bg-white border border-slate-200 rounded-xl p-5 h-40 animate-pulse"
                    />
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                  <p className="font-display font-semibold text-slate-900">
                    {route.feedType === 'following'
                      ? 'Your following feed is quiet'
                      : 'No posts match your view'}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    {route.feedType === 'following'
                      ? 'Follow people from the Explore directory to see their latest posts here.'
                      : 'Try another search term or publish the first note above.'}
                  </p>
                  {route.feedType === 'following' && (
                    <button
                      type="button"
                      onClick={() => setRoute({ view: 'explore' })}
                      className="mt-4 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer"
                    >
                      Explore Profiles
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      currentUser={currentUser}
                      onSelectProfile={openProfile}
                      onToggleLike={handleToggleLike}
                      onToggleFollow={handleToggleFollow}
                      onAddComment={handleAddComment}
                      onDeletePost={handleDeletePost}
                      onDeleteComment={handleDeleteComment}
                      onRequireAuth={() => setAuthModalOpen(true)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {route.view === 'explore' && (
            <ExploreDirectory
              users={users}
              currentUser={currentUser}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelectProfile={openProfile}
              onToggleFollow={handleToggleFollow}
              onRequireAuth={() => setAuthModalOpen(true)}
            />
          )}

          {route.view === 'profile' && activeProfile && (
            <ProfileView
              profile={activeProfile}
              posts={posts}
              postsLoading={postsLoading}
              activeTab={route.tab}
              onTabChange={(tab) => setRoute({ ...route, tab })}
              currentUser={currentUser}
              onBack={() => setRoute({ view: 'feed', feedType: 'all' })}
              onOpenEdit={() => setEditProfileOpen(true)}
              onSwitchAccount={() => setAuthModalOpen(true)}
              onSignOut={handleSignOut}
              onOpenUserList={(mode) =>
                setUserListModal({ username: activeProfile.username, mode })
              }
              onSelectProfile={openProfile}
              onToggleFollow={handleToggleFollow}
              onToggleLike={handleToggleLike}
              onAddComment={handleAddComment}
              onDeletePost={handleDeletePost}
              onDeleteComment={handleDeleteComment}
              onRequireAuth={() => setAuthModalOpen(true)}
            />
          )}
        </section>

        {/* Right Rail: Search + People to Follow */}
        <aside className="hidden lg:block sticky top-22 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <label htmlFor="global-search" className="sr-only">
              Search posts and people
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="global-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search posts & people..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600 transition-colors"
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between gap-2 mb-3.5">
              <h2 className="font-display font-semibold text-sm text-slate-900">
                People to Follow
              </h2>
              <button
                type="button"
                onClick={() => setRoute({ view: 'explore' })}
                className="text-xs font-medium text-blue-600 hover:underline cursor-pointer"
              >
                See all
              </button>
            </div>

            <div className="space-y-3.5">
              {suggestedUsers.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center justify-between gap-2.5"
                >
                  <button
                    type="button"
                    onClick={() => openProfile(person.username)}
                    className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer group"
                  >
                    <Avatar
                      src={person.avatarUrl}
                      name={person.displayName}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate group-hover:underline">
                        {person.displayName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        @{person.username}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!currentUser) {
                        setAuthModalOpen(true);
                        return;
                      }
                      handleToggleFollow(person.id, person.isFollowing);
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      person.isFollowing
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {person.isFollowing ? 'Following' : 'Follow'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {/* Modals */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {currentUser && (
        <EditProfileModal
          key={currentUser.id}
          user={currentUser}
          open={editProfileOpen}
          onClose={() => setEditProfileOpen(false)}
          onSave={handleSaveProfile}
        />
      )}

      <UserListModal
        username={userListModal?.username || ''}
        mode={userListModal?.mode || null}
        currentUserId={currentUser?.id}
        onClose={() => setUserListModal(null)}
        onSelectProfile={openProfile}
        onToggleFollow={handleToggleFollow}
      />
    </div>
  );
}
