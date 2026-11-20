import type { AuthResponse, CommentItem, PostItem, UserSummary } from '../types/social.ts';

const TOKEN_KEY = 'meridian_session_token';
const SIGNED_OUT_KEY = 'meridian_explicit_logout';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(SIGNED_OUT_KEY);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function markExplicitLogout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.setItem(SIGNED_OUT_KEY, '1');
}

export function hasExplicitLogout(): boolean {
  return localStorage.getItem(SIGNED_OUT_KEY) === '1';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(path, { ...options, headers });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  auth: {
    me: () => request<{ user: UserSummary | null }>('/api/auth/me'),
    demoAccounts: () => request<{ accounts: UserSummary[] }>('/api/auth/demo-accounts'),
    demoSwitch: (username: string) =>
      request<AuthResponse>('/api/auth/demo-switch', {
        method: 'POST',
        body: JSON.stringify({ username }),
      }),
    login: (identifier: string, password: string) =>
      request<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      }),
    register: (payload: {
      username: string;
      displayName: string;
      email: string;
      password: string;
      bio?: string;
    }) =>
      request<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  },
  users: {
    list: (q = '') =>
      request<{ users: UserSummary[] }>(
        `/api/users${q ? `?q=${encodeURIComponent(q)}` : ''}`,
      ),
    getProfile: (username: string) =>
      request<{ user: UserSummary }>(`/api/users/${encodeURIComponent(username)}`),
    updateProfile: (payload: {
      displayName?: string;
      bio?: string;
      location?: string;
      website?: string;
      avatarUrl?: string;
      coverColor?: string;
    }) =>
      request<{ user: UserSummary }>('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    followers: (username: string) =>
      request<{ users: UserSummary[] }>(
        `/api/users/${encodeURIComponent(username)}/followers`,
      ),
    following: (username: string) =>
      request<{ users: UserSummary[] }>(
        `/api/users/${encodeURIComponent(username)}/following`,
      ),
    follow: (userId: string) =>
      request<{ following: boolean; followersCount: number }>(
        `/api/users/${encodeURIComponent(userId)}/follow`,
        { method: 'POST' },
      ),
    unfollow: (userId: string) =>
      request<{ following: boolean; followersCount: number }>(
        `/api/users/${encodeURIComponent(userId)}/follow`,
        { method: 'DELETE' },
      ),
  },
  posts: {
    list: (params: { feed?: string; username?: string; q?: string } = {}) => {
      const search = new URLSearchParams();
      if (params.feed) search.set('feed', params.feed);
      if (params.username) search.set('username', params.username);
      if (params.q) search.set('q', params.q);
      const qs = search.toString();
      return request<{ posts: PostItem[] }>(`/api/posts${qs ? `?${qs}` : ''}`);
    },
    create: (payload: { content: string; imageUrl?: string; imageAlt?: string }) =>
      request<{ post: PostItem }>('/api/posts', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    remove: (postId: string) =>
      request<{ ok: boolean }>(`/api/posts/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
      }),
    like: (postId: string) =>
      request<{ liked: boolean; likesCount: number }>(
        `/api/posts/${encodeURIComponent(postId)}/like`,
        { method: 'POST' },
      ),
    unlike: (postId: string) =>
      request<{ liked: boolean; likesCount: number }>(
        `/api/posts/${encodeURIComponent(postId)}/like`,
        { method: 'DELETE' },
      ),
    addComment: (postId: string, content: string) =>
      request<{ comment: CommentItem; commentsCount: number }>(
        `/api/posts/${encodeURIComponent(postId)}/comments`,
        {
          method: 'POST',
          body: JSON.stringify({ content }),
        },
      ),
    deleteComment: (commentId: string) =>
      request<{ ok: boolean; postId: string; commentsCount: number }>(
        `/api/comments/${encodeURIComponent(commentId)}`,
        { method: 'DELETE' },
      ),
  },
};
