import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  getDb,
  hashPassword,
  saveDb,
  verifyPassword,
  type DbPost,
  type DbUser,
  type SocialDatabase,
} from './server/db.ts';
import type { CommentItem, PostItem, UserSummary } from './src/types/social.ts';

interface AuthenticatedRequest extends Request {
  currentUser?: DbUser;
  authToken?: string;
}

function buildUserSummary(
  db: SocialDatabase,
  user: DbUser,
  viewerId?: string,
): UserSummary {
  const followersCount = db.follows.filter((f) => f.followingId === user.id).length;
  const followingCount = db.follows.filter((f) => f.followerId === user.id).length;
  const postsCount = db.posts.filter((p) => p.authorId === user.id).length;
  const isFollowing = viewerId
    ? db.follows.some((f) => f.followerId === viewerId && f.followingId === user.id)
    : false;
  const followsYou = viewerId
    ? db.follows.some((f) => f.followerId === user.id && f.followingId === viewerId)
    : false;

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    location: user.location,
    website: user.website,
    coverColor: user.coverColor,
    createdAt: user.createdAt,
    followersCount,
    followingCount,
    postsCount,
    isFollowing,
    followsYou,
  };
}

function buildPostItem(
  db: SocialDatabase,
  post: DbPost,
  viewerId?: string,
): PostItem | null {
  const author = db.users.find((u) => u.id === post.authorId);
  if (!author) {
    return null;
  }

  const likes = db.likes.filter((l) => l.postId === post.id);
  const likedByMe = viewerId ? likes.some((l) => l.userId === viewerId) : false;

  const comments: CommentItem[] = db.comments
    .filter((c) => c.postId === post.id)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((c) => {
      const commentAuthor = db.users.find((u) => u.id === c.authorId);
      return {
        id: c.id,
        postId: c.postId,
        authorId: c.authorId,
        content: c.content,
        createdAt: c.createdAt,
        author: commentAuthor
          ? {
              id: commentAuthor.id,
              username: commentAuthor.username,
              displayName: commentAuthor.displayName,
              avatarUrl: commentAuthor.avatarUrl,
            }
          : {
              id: c.authorId,
              username: 'former_member',
              displayName: 'Former Member',
              avatarUrl: '/media/avatar-elena.svg',
            },
      };
    });

  const authorIsFollowedByMe = viewerId
    ? db.follows.some((f) => f.followerId === viewerId && f.followingId === author.id)
    : false;

  return {
    id: post.id,
    authorId: post.authorId,
    content: post.content,
    imageUrl: post.imageUrl,
    imageAlt: post.imageAlt,
    createdAt: post.createdAt,
    author: {
      id: author.id,
      username: author.username,
      displayName: author.displayName,
      avatarUrl: author.avatarUrl,
      bio: author.bio,
    },
    likesCount: likes.length,
    likedByMe,
    commentsCount: comments.length,
    comments,
    authorIsFollowedByMe,
  };
}

function attachUser(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const db = getDb();
      const session = db.sessions.find((s) => s.token === token);
      if (session) {
        const user = db.users.find((u) => u.id === session.userId);
        if (user) {
          req.currentUser = user;
          req.authToken = token;
        }
      }
    }
  }
  next();
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.currentUser) {
    res.status(401).json({ error: 'Authentication required. Please sign in to continue.' });
    return;
  }
  next();
}

async function startServer(): Promise<void> {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '5mb' }));
  app.use(attachUser);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Auth: Get current user
  app.get('/api/auth/me', (req: AuthenticatedRequest, res: Response) => {
    if (!req.currentUser) {
      res.json({ user: null });
      return;
    }
    const db = getDb();
    res.json({ user: buildUserSummary(db, req.currentUser, req.currentUser.id) });
  });

  // Auth: List demo accounts for quick switching
  app.get('/api/auth/demo-accounts', (_req: Request, res: Response) => {
    const db = getDb();
    const demoUsers = db.users
      .filter((u) => u.isDemoAccount)
      .map((u) => buildUserSummary(db, u));
    res.json({ accounts: demoUsers });
  });

  // Auth: One-click switch to a seeded demo account
  app.post('/api/auth/demo-switch', (req: Request, res: Response) => {
    const { username } = req.body as { username?: string };
    if (!username) {
      res.status(400).json({ error: 'Username is required.' });
      return;
    }
    const db = getDb();
    const target = db.users.find((u) => u.username === username.toLowerCase() && u.isDemoAccount);
    if (!target) {
      res.status(404).json({ error: 'Demo account not found.' });
      return;
    }
    const token = crypto.randomBytes(24).toString('hex');
    db.sessions.push({
      token,
      userId: target.id,
      createdAt: new Date().toISOString(),
    });
    saveDb(db);
    res.json({
      token,
      user: buildUserSummary(db, target, target.id),
    });
  });

  // Auth: Register new user
  app.post('/api/auth/register', (req: Request, res: Response) => {
    const { username, displayName, email, password, bio } = req.body as {
      username?: string;
      displayName?: string;
      email?: string;
      password?: string;
      bio?: string;
    };

    const cleanUsername = (username || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const cleanDisplayName = (displayName || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (cleanUsername.length < 3 || cleanUsername.length > 24) {
      res.status(400).json({ error: 'Username must be 3–24 characters (letters, numbers, underscores).' });
      return;
    }
    if (cleanDisplayName.length < 2) {
      res.status(400).json({ error: 'Display name must be at least 2 characters.' });
      return;
    }
    if (!cleanEmail.includes('@')) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (!password || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    const db = getDb();
    if (db.users.some((u) => u.username === cleanUsername)) {
      res.status(409).json({ error: 'That username is already taken.' });
      return;
    }
    if (db.users.some((u) => u.email === cleanEmail)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const avatarChoices = [
      '/media/avatar-elena.svg',
      '/media/avatar-marcus.svg',
      '/media/avatar-priya.svg',
      '/media/avatar-julian.svg',
      '/media/avatar-claire.svg',
    ];
    const pickedAvatar = avatarChoices[db.users.length % avatarChoices.length];

    const newUser: DbUser = {
      id: `usr_${crypto.randomBytes(6).toString('hex')}`,
      username: cleanUsername,
      displayName: cleanDisplayName,
      email: cleanEmail,
      passwordHash: hashPassword(password),
      bio: (bio || '').trim() || 'Member of the Meridian community.',
      location: '',
      website: '',
      avatarUrl: pickedAvatar,
      coverColor: '#1E3A8A',
      createdAt: new Date().toISOString(),
    };

    const token = crypto.randomBytes(24).toString('hex');
    db.users.push(newUser);
    db.sessions.push({
      token,
      userId: newUser.id,
      createdAt: new Date().toISOString(),
    });
    saveDb(db);

    res.status(201).json({
      token,
      user: buildUserSummary(db, newUser, newUser.id),
    });
  });

  // Auth: Login
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { identifier, password } = req.body as {
      identifier?: string;
      password?: string;
    };
    const cleanId = (identifier || '').trim().toLowerCase();
    if (!cleanId || !password) {
      res.status(400).json({ error: 'Username/email and password are required.' });
      return;
    }

    const db = getDb();
    const user = db.users.find(
      (u) => u.username === cleanId || u.email.toLowerCase() === cleanId,
    );
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid credentials. Please check your username and password.' });
      return;
    }

    const token = crypto.randomBytes(24).toString('hex');
    db.sessions.push({
      token,
      userId: user.id,
      createdAt: new Date().toISOString(),
    });
    saveDb(db);

    res.json({
      token,
      user: buildUserSummary(db, user, user.id),
    });
  });

  // Auth: Logout
  app.post('/api/auth/logout', (req: AuthenticatedRequest, res: Response) => {
    if (req.authToken) {
      const db = getDb();
      db.sessions = db.sessions.filter((s) => s.token !== req.authToken);
      saveDb(db);
    }
    res.json({ ok: true });
  });

  // Users: Directory & search
  app.get('/api/users', (req: AuthenticatedRequest, res: Response) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const db = getDb();
    const viewerId = req.currentUser?.id;

    const filtered = db.users.filter((u) => {
      if (!q) return true;
      return (
        u.username.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        u.bio.toLowerCase().includes(q)
      );
    });

    const users = filtered.map((u) => buildUserSummary(db, u, viewerId));
    res.json({ users });
  });

  // Users: Get profile by username
  app.get('/api/users/:username', (req: AuthenticatedRequest, res: Response) => {
    const username = String(req.params.username || '').toLowerCase();
    const db = getDb();
    const user = db.users.find((u) => u.username === username);
    if (!user) {
      res.status(404).json({ error: 'User profile not found.' });
      return;
    }
    res.json({ user: buildUserSummary(db, user, req.currentUser?.id) });
  });

  // Users: Update own profile
  app.patch('/api/users/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { displayName, bio, location, website, avatarUrl, coverColor } = req.body as {
      displayName?: string;
      bio?: string;
      location?: string;
      website?: string;
      avatarUrl?: string;
      coverColor?: string;
    };

    const db = getDb();
    const user = db.users.find((u) => u.id === req.currentUser!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (typeof displayName === 'string') {
      const cleanName = displayName.trim();
      if (cleanName.length < 2 || cleanName.length > 48) {
        res.status(400).json({ error: 'Display name must be between 2 and 48 characters.' });
        return;
      }
      user.displayName = cleanName;
    }
    if (typeof bio === 'string') {
      user.bio = bio.trim().slice(0, 220);
    }
    if (typeof location === 'string') {
      user.location = location.trim().slice(0, 60);
    }
    if (typeof website === 'string') {
      user.website = website.trim().slice(0, 80);
    }
    if (typeof avatarUrl === 'string' && avatarUrl.trim()) {
      user.avatarUrl = avatarUrl.trim();
    }
    if (typeof coverColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(coverColor)) {
      user.coverColor = coverColor;
    }

    saveDb(db);
    res.json({ user: buildUserSummary(db, user, user.id) });
  });

  // Users: Followers & Following lists
  app.get('/api/users/:username/followers', (req: AuthenticatedRequest, res: Response) => {
    const username = String(req.params.username || '').toLowerCase();
    const db = getDb();
    const target = db.users.find((u) => u.username === username);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const followerIds = db.follows
      .filter((f) => f.followingId === target.id)
      .map((f) => f.followerId);
    const users = db.users
      .filter((u) => followerIds.includes(u.id))
      .map((u) => buildUserSummary(db, u, req.currentUser?.id));
    res.json({ users });
  });

  app.get('/api/users/:username/following', (req: AuthenticatedRequest, res: Response) => {
    const username = String(req.params.username || '').toLowerCase();
    const db = getDb();
    const target = db.users.find((u) => u.username === username);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const followingIds = db.follows
      .filter((f) => f.followerId === target.id)
      .map((f) => f.followingId);
    const users = db.users
      .filter((u) => followingIds.includes(u.id))
      .map((u) => buildUserSummary(db, u, req.currentUser?.id));
    res.json({ users });
  });

  // Follow / Unfollow
  app.post('/api/users/:userId/follow', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const targetId = String(req.params.userId || '');
    const viewerId = req.currentUser!.id;
    if (targetId === viewerId) {
      res.status(400).json({ error: 'You cannot follow your own account.' });
      return;
    }
    const db = getDb();
    const targetUser = db.users.find((u) => u.id === targetId);
    if (!targetUser) {
      res.status(404).json({ error: 'Target user not found.' });
      return;
    }

    const alreadyFollowing = db.follows.some(
      (f) => f.followerId === viewerId && f.followingId === targetId,
    );
    if (!alreadyFollowing) {
      db.follows.push({
        followerId: viewerId,
        followingId: targetId,
        createdAt: new Date().toISOString(),
      });
      saveDb(db);
    }

    const followersCount = db.follows.filter((f) => f.followingId === targetId).length;
    res.json({ following: true, followersCount });
  });

  app.delete('/api/users/:userId/follow', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const targetId = String(req.params.userId || '');
    const viewerId = req.currentUser!.id;
    const db = getDb();
    db.follows = db.follows.filter(
      (f) => !(f.followerId === viewerId && f.followingId === targetId),
    );
    saveDb(db);

    const followersCount = db.follows.filter((f) => f.followingId === targetId).length;
    res.json({ following: false, followersCount });
  });

  // Posts: Feed & Filtering
  app.get('/api/posts', (req: AuthenticatedRequest, res: Response) => {
    const feed = String(req.query.feed || 'all');
    const username = String(req.query.username || '').trim().toLowerCase();
    const q = String(req.query.q || '').trim().toLowerCase();
    const db = getDb();
    const viewerId = req.currentUser?.id;

    let posts = [...db.posts].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    if (username) {
      const targetUser = db.users.find((u) => u.username === username);
      if (!targetUser) {
        res.json({ posts: [] });
        return;
      }
      if (feed === 'liked') {
        const likedIds = new Set(
          db.likes.filter((l) => l.userId === targetUser.id).map((l) => l.postId),
        );
        posts = posts.filter((p) => likedIds.has(p.id));
      } else {
        posts = posts.filter((p) => p.authorId === targetUser.id);
      }
    } else if (feed === 'following') {
      if (!viewerId) {
        res.json({ posts: [] });
        return;
      }
      const followingIds = new Set(
        db.follows.filter((f) => f.followerId === viewerId).map((f) => f.followingId),
      );
      followingIds.add(viewerId);
      posts = posts.filter((p) => followingIds.has(p.authorId));
    }

    const enriched = posts
      .map((p) => buildPostItem(db, p, viewerId))
      .filter((p): p is PostItem => p !== null)
      .filter((p) => {
        if (!q) return true;
        return (
          p.content.toLowerCase().includes(q) ||
          p.author.displayName.toLowerCase().includes(q) ||
          p.author.username.toLowerCase().includes(q)
        );
      });

    res.json({ posts: enriched });
  });

  // Posts: Create post
  app.post('/api/posts', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { content, imageUrl, imageAlt } = req.body as {
      content?: string;
      imageUrl?: string;
      imageAlt?: string;
    };
    const cleanContent = (content || '').trim();
    const cleanImage = (imageUrl || '').trim();

    if (!cleanContent && !cleanImage) {
      res.status(400).json({ error: 'Post cannot be empty. Add text or an image.' });
      return;
    }
    if (cleanContent.length > 500) {
      res.status(400).json({ error: 'Post content cannot exceed 500 characters.' });
      return;
    }

    const db = getDb();
    const newPost: DbPost = {
      id: `pst_${crypto.randomBytes(6).toString('hex')}`,
      authorId: req.currentUser!.id,
      content: cleanContent,
      imageUrl: cleanImage || undefined,
      imageAlt: imageAlt?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    db.posts.unshift(newPost);
    saveDb(db);

    const enriched = buildPostItem(db, newPost, req.currentUser!.id);
    res.status(201).json({ post: enriched });
  });

  // Posts: Delete own post
  app.delete('/api/posts/:postId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const postId = String(req.params.postId || '');
    const db = getDb();
    const post = db.posts.find((p) => p.id === postId);
    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }
    if (post.authorId !== req.currentUser!.id) {
      res.status(403).json({ error: 'You can only delete your own posts.' });
      return;
    }

    db.posts = db.posts.filter((p) => p.id !== postId);
    db.comments = db.comments.filter((c) => c.postId !== postId);
    db.likes = db.likes.filter((l) => l.postId !== postId);
    saveDb(db);

    res.json({ ok: true });
  });

  // Likes: Like / Unlike
  app.post('/api/posts/:postId/like', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const postId = String(req.params.postId || '');
    const userId = req.currentUser!.id;
    const db = getDb();
    const post = db.posts.find((p) => p.id === postId);
    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    const existing = db.likes.some((l) => l.postId === postId && l.userId === userId);
    if (!existing) {
      db.likes.push({
        postId,
        userId,
        createdAt: new Date().toISOString(),
      });
      saveDb(db);
    }
    const likesCount = db.likes.filter((l) => l.postId === postId).length;
    res.json({ liked: true, likesCount });
  });

  app.delete('/api/posts/:postId/like', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const postId = String(req.params.postId || '');
    const userId = req.currentUser!.id;
    const db = getDb();
    db.likes = db.likes.filter((l) => !(l.postId === postId && l.userId === userId));
    saveDb(db);

    const likesCount = db.likes.filter((l) => l.postId === postId).length;
    res.json({ liked: false, likesCount });
  });

  // Comments: Add comment to post
  app.post('/api/posts/:postId/comments', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const postId = String(req.params.postId || '');
    const { content } = req.body as { content?: string };
    const cleanContent = (content || '').trim();
    if (!cleanContent) {
      res.status(400).json({ error: 'Comment text cannot be empty.' });
      return;
    }
    if (cleanContent.length > 320) {
      res.status(400).json({ error: 'Comment cannot exceed 320 characters.' });
      return;
    }

    const db = getDb();
    const post = db.posts.find((p) => p.id === postId);
    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    const newComment = {
      id: `cmt_${crypto.randomBytes(6).toString('hex')}`,
      postId,
      authorId: req.currentUser!.id,
      content: cleanContent,
      createdAt: new Date().toISOString(),
    };

    db.comments.push(newComment);
    saveDb(db);

    const enrichedComment: CommentItem = {
      ...newComment,
      author: {
        id: req.currentUser!.id,
        username: req.currentUser!.username,
        displayName: req.currentUser!.displayName,
        avatarUrl: req.currentUser!.avatarUrl,
      },
    };

    const commentsCount = db.comments.filter((c) => c.postId === postId).length;
    res.status(201).json({ comment: enrichedComment, commentsCount });
  });

  // Comments: Delete own comment
  app.delete('/api/comments/:commentId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const commentId = String(req.params.commentId || '');
    const db = getDb();
    const comment = db.comments.find((c) => c.id === commentId);
    if (!comment) {
      res.status(404).json({ error: 'Comment not found.' });
      return;
    }
    if (comment.authorId !== req.currentUser!.id) {
      res.status(403).json({ error: 'You can only delete your own comments.' });
      return;
    }
    db.comments = db.comments.filter((c) => c.id !== commentId);
    saveDb(db);

    const commentsCount = db.comments.filter((c) => c.postId === comment.postId).length;
    res.json({ ok: true, postId: comment.postId, commentsCount });
  });

  // Serve Vite middlewares in development or built static assets in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('/{*path}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Meridian server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Meridian server:', err);
  process.exit(1);
});
