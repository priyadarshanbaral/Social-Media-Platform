export interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  location: string;
  website: string;
  coverColor: string;
  createdAt: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isFollowing: boolean;
  followsYou: boolean;
}

export interface CommentItem {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
  };
}

export interface PostItem {
  id: string;
  authorId: string;
  content: string;
  imageUrl?: string;
  imageAlt?: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    bio: string;
  };
  likesCount: number;
  likedByMe: boolean;
  commentsCount: number;
  comments: CommentItem[];
  authorIsFollowedByMe: boolean;
}

export interface AuthResponse {
  token: string;
  user: UserSummary;
}
