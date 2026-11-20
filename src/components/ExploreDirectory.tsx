import { Search } from 'lucide-react';
import type { UserSummary } from '../types/social.ts';
import { Avatar } from './Avatar.tsx';

interface ExploreDirectoryProps {
  users: UserSummary[];
  currentUser: UserSummary | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectProfile: (username: string) => void;
  onToggleFollow: (userId: string, currentlyFollowing: boolean) => Promise<void>;
  onRequireAuth: () => void;
}

export function ExploreDirectory({
  users,
  currentUser,
  searchQuery,
  onSearchChange,
  onSelectProfile,
  onToggleFollow,
  onRequireAuth,
}: ExploreDirectoryProps) {
  const filtered = users.filter((u) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.bio.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h1 className="font-display font-bold text-lg text-slate-900">
          Community Directory
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Discover creators, engineers, and designers sharing notes on Meridian.
        </p>

        <div className="mt-4 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search people by name, @username, or bio..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600 transition-colors"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="font-display font-semibold text-slate-900">No matching profiles</p>
          <p className="text-sm text-slate-500 mt-1">
            Try clearing your search query to see all community members.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((member) => {
            const isSelf = currentUser?.id === member.id;
            return (
              <div
                key={member.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onSelectProfile(member.username)}
                      className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
                    >
                      <Avatar
                        src={member.avatarUrl}
                        name={member.displayName}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p className="font-display font-semibold text-sm text-slate-900 truncate hover:underline">
                          {member.displayName}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          @{member.username}
                        </p>
                      </div>
                    </button>

                    {!isSelf && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!currentUser) {
                            onRequireAuth();
                            return;
                          }
                          onToggleFollow(member.id, member.isFollowing);
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          member.isFollowing
                            ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {member.isFollowing ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>

                  {member.bio && (
                    <p className="mt-3 text-sm text-slate-600 line-clamp-2 leading-relaxed">
                      {member.bio}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center gap-3 text-xs text-slate-500">
                  <span>
                    <strong className="font-mono tabular-nums text-slate-800">
                      {member.followersCount}
                    </strong>{' '}
                    followers
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    <strong className="font-mono tabular-nums text-slate-800">
                      {member.postsCount}
                    </strong>{' '}
                    posts
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
