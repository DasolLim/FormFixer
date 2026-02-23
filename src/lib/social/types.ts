export type PrivacyMode = 'public' | 'private';

export type ProfileRow = {
  id: string;
  email: string | null;
  username: string | null;
  privacy_mode: PrivacyMode;
  is_private?: boolean;
  following_count: number;
  follower_count: number;
};

export type FriendRequestRow = {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
  responded_at: string | null;
};

export type FriendshipRow = {
  id: string;
  user_id: string;
  friend_id: string;
  created_at: string;
};

export type FollowRow = {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
};

export type FollowRequestRow = {
  id: string;
  requester_id: string;
  target_user_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
  updated_at: string;
};

export type RelationshipState = {
  isSelf: boolean;
  isFollowing: boolean;
  isRequested: boolean;
  requestedByThem: boolean;
  targetIsPrivate: boolean;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: 'friend_request_received' | 'friend_request_accepted' | 'gym_invite';
  message: string;
  data: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
};
