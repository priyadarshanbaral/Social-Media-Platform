import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api.ts';
import type { UserSummary } from '../types/social.ts';
import { Avatar } from './Avatar.tsx';

interface UserListModalProps {
  username: string;
  mode: 'followers' | 'following' | null;
  currentUserId?: string;
  onClose: () => void;
  onSelectProfile: (username: string) => void;
  onToggleFollow: (userId: string, currentlyFollowing: boolean) => Promise<void>;
}

export function UserListModal({
  username,
  mode,
  currentUserId,
  onClose,
  onSelectProfile,
  onToggleFollow,
}: UserListModalProps) {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mode || !username) return;
    let cancelled = false;
    setLoading(true);
    const fetcher =
      mode === 'followers'
        ? api.users.followers(username)
        : api.users.following(username);

    fetcher
      .then((res) => {
        if (!cancelled) setUsers(res.users);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username, mode]);

  if (!mode) return null;

  const handleFollowClick = async (u: UserSummary) => {
    await onToggleFollow(u.id, u.isFollowing);
    setUsers((prev) =>
      prev.map((item) =>
        item.id === u.id
          ? {
              ...item,
              isFollowing: !item.isFollowing,
              followersCount: item.isFollowing
                ? Math.max(0, item.followersCount - 1)
                : item.followersCount + 1,
            }
          : item,
      ),
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'followers' ? 'Followers' : 'Following'}
      className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-5 shadow-xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <h2 className="font-display font-bold text-base text-slate-900">
            {mode === 'followers' ? 'Followers' : 'Following'} · @{username}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close list"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-3 overflow-y-auto space-y-2">
          {loading ? (
            <p className="text-sm text-slate-500 py-6 text-center">Loading connections...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              {mode === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
            </p>
          ) : (
            users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-3 py-2 px-1 rounded-lg hover:bg-slate-50"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectProfile(u.username);
                    onClose();
                  }}
                  className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
                >
                  <Avatar src={u.avatarUrl} name={u.displayName} size="md" />
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-sm text-slate-900 truncate">
                      {u.displayName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">@{u.username}</p>
                  </div>
                </button>

                {currentUserId !== u.id && (
                  <button
                    type="button"
                    onClick={() => handleFollowClick(u)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      u.isFollowing
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {u.isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
