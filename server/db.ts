import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface DbUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  passwordHash: string;
  bio: string;
  location: string;
  website: string;
  avatarUrl: string;
  coverColor: string;
  createdAt: string;
  isDemoAccount?: boolean;
}

export interface DbPost {
  id: string;
  authorId: string;
  content: string;
  imageUrl?: string;
  imageAlt?: string;
  createdAt: string;
}

export interface DbComment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface DbLike {
  userId: string;
  postId: string;
  createdAt: string;
}

export interface DbFollow {
  followerId: string;
  followingId: string;
  createdAt: string;
}

export interface DbSession {
  token: string;
  userId: string;
  createdAt: string;
}

export interface SocialDatabase {
  users: DbUser[];
  posts: DbPost[];
  comments: DbComment[];
  likes: DbLike[];
  follows: DbFollow[];
  sessions: DbSession[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'social-db.json');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, originalHash] = stored.split(':');
  if (!salt || !originalHash) {
    return false;
  }
  const derived = crypto.scryptSync(password, salt, 64);
  const originalBuffer = Buffer.from(originalHash, 'hex');
  if (derived.length !== originalBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(derived, originalBuffer);
}

function createInitialSeed(): SocialDatabase {
  const now = Date.now();
  const minutesAgo = (mins: number) => new Date(now - mins * 60_000).toISOString();
  const daysAgo = (days: number) => new Date(now - days * 86_400_000).toISOString();

  const defaultPassHash = hashPassword('meridian2026');

  const users: DbUser[] = [
    {
      id: 'usr_elena',
      username: 'elena_vance',
      displayName: 'Elena Vance',
      email: 'elena@meridian.example',
      passwordHash: defaultPassHash,
      bio: 'Design systems lead and architectural typographer. Building calm tools for long-form thinking.',
      location: 'Zurich, CH',
      website: 'elenavance.design',
      avatarUrl: '/media/avatar-elena.svg',
      coverColor: '#1E3A8A',
      createdAt: daysAgo(120),
      isDemoAccount: true,
    },
    {
      id: 'usr_marcus',
      username: 'marcus_chen',
      displayName: 'Marcus Chen',
      email: 'marcus@meridian.example',
      passwordHash: defaultPassHash,
      bio: 'Documentary photographer & cartography nerd. Chasing coastal light and quiet public spaces.',
      location: 'Vancouver, CA',
      website: 'marcuschen.studio',
      avatarUrl: '/media/avatar-marcus.svg',
      coverColor: '#334155',
      createdAt: daysAgo(98),
      isDemoAccount: true,
    },
    {
      id: 'usr_priya',
      username: 'priya_nair',
      displayName: 'Priya Nair',
      email: 'priya@meridian.example',
      passwordHash: defaultPassHash,
      bio: 'Distributed systems engineer writing about local-first storage, SQLite internals, and reliable APIs.',
      location: 'Bengaluru, IN',
      website: 'priyanair.dev',
      avatarUrl: '/media/avatar-priya.svg',
      coverColor: '#0F172A',
      createdAt: daysAgo(84),
      isDemoAccount: true,
    },
    {
      id: 'usr_julian',
      username: 'julian_mercer',
      displayName: 'Julian Mercer',
      email: 'julian@meridian.example',
      passwordHash: defaultPassHash,
      bio: 'Industrial designer working between stoneware ceramics and machined aluminum desk instruments.',
      location: 'Portland, US',
      website: 'mercerworkshop.co',
      avatarUrl: '/media/avatar-julian.svg',
      coverColor: '#475569',
      createdAt: daysAgo(62),
      isDemoAccount: true,
    },
    {
      id: 'usr_claire',
      username: 'claire_moreau',
      displayName: 'Claire Moreau',
      email: 'claire@meridian.example',
      passwordHash: defaultPassHash,
      bio: 'Essayist and print publisher documenting small independent bookshops and community libraries.',
      location: 'Lyon, FR',
      website: 'ateliermoreau.fr',
      avatarUrl: '/media/avatar-claire.svg',
      coverColor: '#292524',
      createdAt: daysAgo(45),
      isDemoAccount: true,
    },
  ];

  const posts: DbPost[] = [
    {
      id: 'pst_1',
      authorId: 'usr_elena',
      content:
        'Spent the morning auditing our editorial grid proportions. Switching from arbitrary 12px card padding to strict harmonic ratios immediately calmed down every dense view in the app.',
      imageUrl: '/media/post-architecture.svg',
      imageAlt: 'Editorial grid proportion study on drafting board',
      createdAt: minutesAgo(28),
    },
    {
      id: 'pst_2',
      authorId: 'usr_marcus',
      content:
        'First light breaking over the basalt headlands at 05:40. Twenty minutes of clear stillness before the coastal fog rolled back in across the channel.',
      imageUrl: '/media/post-topography.svg',
      imageAlt: 'Coastal horizon study at dawn',
      createdAt: minutesAgo(95),
    },
    {
      id: 'pst_3',
      authorId: 'usr_priya',
      content:
        'Hot take: most social web apps feel sluggish not because of network latency, but because they block simple actions like liking or following behind full feed refetches. Optimistic state + idempotent REST endpoints solve 95% of it.',
      createdAt: minutesAgo(190),
    },
    {
      id: 'pst_4',
      authorId: 'usr_julian',
      content:
        'Unloaded the reduction kiln after a 36-hour cool-down. This matte iron-speckled glaze finally settled into the exact warm limestone finish I have been testing since September.',
      imageUrl: '/media/post-ceramics.svg',
      imageAlt: 'Stoneware vessels on studio timber shelf',
      createdAt: minutesAgo(320),
    },
    {
      id: 'pst_5',
      authorId: 'usr_claire',
      content:
        'Visited a neighborhood lending library in Croix-Rousse that catalogs every margin note left by previous readers in a physical ledger at the front desk. Instant community memory.',
      createdAt: minutesAgo(540),
    },
    {
      id: 'pst_6',
      authorId: 'usr_elena',
      content:
        'Reminder when building typography scales: tabular numerals (font-variant-numeric: tabular-nums) are non-negotiable anywhere counters tick up or down live.',
      createdAt: daysAgo(1),
    },
  ];

  const comments: DbComment[] = [
    {
      id: 'cmt_1',
      postId: 'pst_1',
      authorId: 'usr_julian',
      content: 'The blue inset frame balances the dense right-hand column really cleanly.',
      createdAt: minutesAgo(18),
    },
    {
      id: 'cmt_2',
      postId: 'pst_1',
      authorId: 'usr_priya',
      content: 'Love seeing the underlying construction lines before final polish.',
      createdAt: minutesAgo(11),
    },
    {
      id: 'cmt_3',
      postId: 'pst_2',
      authorId: 'usr_claire',
      content: 'That silver reflection along the ridge line feels so quiet.',
      createdAt: minutesAgo(62),
    },
    {
      id: 'cmt_4',
      postId: 'pst_3',
      authorId: 'usr_elena',
      content: 'Agreed. Instant visual feedback within 100ms makes a huge difference in perceived craft.',
      createdAt: minutesAgo(140),
    },
    {
      id: 'cmt_5',
      postId: 'pst_4',
      authorId: 'usr_marcus',
      content: 'The tall amber vessel on the right has a wonderful silhouette.',
      createdAt: minutesAgo(260),
    },
  ];

  const likes: DbLike[] = [
    { userId: 'usr_marcus', postId: 'pst_1', createdAt: minutesAgo(20) },
    { userId: 'usr_priya', postId: 'pst_1', createdAt: minutesAgo(15) },
    { userId: 'usr_julian', postId: 'pst_1', createdAt: minutesAgo(12) },
    { userId: 'usr_elena', postId: 'pst_2', createdAt: minutesAgo(80) },
    { userId: 'usr_claire', postId: 'pst_2', createdAt: minutesAgo(60) },
    { userId: 'usr_elena', postId: 'pst_3', createdAt: minutesAgo(145) },
    { userId: 'usr_julian', postId: 'pst_3', createdAt: minutesAgo(120) },
    { userId: 'usr_marcus', postId: 'pst_4', createdAt: minutesAgo(260) },
    { userId: 'usr_elena', postId: 'pst_4', createdAt: minutesAgo(240) },
    { userId: 'usr_priya', postId: 'pst_5', createdAt: minutesAgo(420) },
  ];

  const follows: DbFollow[] = [
    { followerId: 'usr_elena', followingId: 'usr_marcus', createdAt: daysAgo(40) },
    { followerId: 'usr_elena', followingId: 'usr_priya', createdAt: daysAgo(35) },
    { followerId: 'usr_elena', followingId: 'usr_julian', createdAt: daysAgo(20) },
    { followerId: 'usr_marcus', followingId: 'usr_elena', createdAt: daysAgo(38) },
    { followerId: 'usr_marcus', followingId: 'usr_claire', createdAt: daysAgo(18) },
    { followerId: 'usr_priya', followingId: 'usr_elena', createdAt: daysAgo(30) },
    { followerId: 'usr_julian', followingId: 'usr_elena', createdAt: daysAgo(15) },
    { followerId: 'usr_julian', followingId: 'usr_marcus', createdAt: daysAgo(14) },
    { followerId: 'usr_claire', followingId: 'usr_marcus', createdAt: daysAgo(10) },
    { followerId: 'usr_claire', followingId: 'usr_julian', createdAt: daysAgo(9) },
  ];

  return {
    users,
    posts,
    comments,
    likes,
    follows,
    sessions: [],
  };
}

let dbCache: SocialDatabase | null = null;

export function getDb(): SocialDatabase {
  if (dbCache) {
    return dbCache;
  }
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DB_PATH)) {
    try {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as SocialDatabase;
      dbCache = {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        posts: Array.isArray(parsed.posts) ? parsed.posts : [],
        comments: Array.isArray(parsed.comments) ? parsed.comments : [],
        likes: Array.isArray(parsed.likes) ? parsed.likes : [],
        follows: Array.isArray(parsed.follows) ? parsed.follows : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      };
      return dbCache;
    } catch {
      dbCache = createInitialSeed();
      saveDb(dbCache);
      return dbCache;
    }
  }
  dbCache = createInitialSeed();
  saveDb(dbCache);
  return dbCache;
}

export function saveDb(db: SocialDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${DB_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpPath, DB_PATH);
  dbCache = db;
}
