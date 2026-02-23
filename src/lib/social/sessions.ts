import { getSupabaseClient } from '@/lib/supabaseClient';
import type { FollowRow, FriendRequestRow, FriendshipRow, NotificationRow, PrivacyMode, ProfileRow, RelationshipState } from '@/lib/social/types';

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function isMissingSchemaError(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? '';
  return message.includes('does not exist') || message.includes('column') || message.includes('relation');
}

function isDuplicateKeyError(error: { code?: string; message?: string } | null) {
  return error?.code === '23505' || Boolean(error?.message?.toLowerCase().includes('duplicate key'));
}

function toPrivacyMode(isPrivate?: boolean, privacyMode?: string | null): PrivacyMode {
  if (typeof isPrivate === 'boolean') return isPrivate ? 'private' : 'public';
  return privacyMode === 'private' ? 'private' : 'public';
}

function normalizeProfileRow(row: any): ProfileRow {
  const privacy = toPrivacyMode(row?.is_private, row?.privacy_mode);
  return {
    id: row.id,
    email: row.email ?? null,
    username: row.username ?? null,
    privacy_mode: privacy,
    is_private: privacy === 'private',
    following_count: typeof row.following_count === 'number' ? row.following_count : 0,
    follower_count: typeof row.follower_count === 'number' ? row.follower_count : 0
  };
}

async function ensureProfileRow(userId: string, email?: string | null) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.from('profiles').upsert({ id: userId, ...(email ? { email } : {}) }, { onConflict: 'id' });
  return { error };
}

export async function fetchMyProfile(userId: string, email?: string | null) {
  const supabase = await getSupabaseClient();
  const primary = await supabase.from('profiles').select('id,email,username,is_private,privacy_mode,following_count,follower_count').eq('id', userId).maybeSingle();

  if (!primary.error && primary.data) return { data: normalizeProfileRow(primary.data), error: null };

  if (!primary.error && !primary.data) {
    const insertResult = await ensureProfileRow(userId, email);
    if (insertResult.error) return { data: null as ProfileRow | null, error: insertResult.error };
    const reload = await supabase.from('profiles').select('id,email,username,is_private,privacy_mode,following_count,follower_count').eq('id', userId).maybeSingle();
    return { data: reload.data ? normalizeProfileRow(reload.data) : null, error: reload.error };
  }

  if (isMissingSchemaError(primary.error)) {
    const fallback = await supabase.from('profiles').select('id,email,username,privacy_mode').eq('id', userId).maybeSingle();
    if (fallback.error) return { data: null as ProfileRow | null, error: fallback.error };
    return { data: fallback.data ? normalizeProfileRow(fallback.data) : null, error: null };
  }

  return { data: null as ProfileRow | null, error: primary.error };
}

export async function updateMyProfileSettings(payload: { userId: string; username: string; privacyMode: PrivacyMode }) {
  const supabase = await getSupabaseClient();
  const normalized = normalizeUsername(payload.username);

  if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
    return { error: { message: 'Username must be 3-20 chars and only use letters, numbers, and underscores.' } };
  }

  const { data: existing, error: findError } = await supabase
    .from('profiles')
    .select('id,username')
    .eq('username', normalized)
    .neq('id', payload.userId)
    .maybeSingle();

  if (findError && !isMissingSchemaError(findError)) return { error: findError };
  if (existing) return { error: { message: 'That username is already taken.' } };

  const upsertPayload: Record<string, unknown> = {
    id: payload.userId,
    username: normalized,
    privacy_mode: payload.privacyMode,
    is_private: payload.privacyMode === 'private'
  };

  const { error } = await supabase.from('profiles').upsert(upsertPayload, { onConflict: 'id' });
  return { error };
}

export async function searchProfilesByUsername(currentUserId: string, query: string) {
  const supabase = await getSupabaseClient();
  const normalized = normalizeUsername(query);
  if (!normalized) return { data: [] as ProfileRow[], error: null };

  const primary = await supabase
    .from('profiles')
    .select('id,email,username,is_private,privacy_mode,following_count,follower_count')
    .ilike('username', `%${normalized}%`)
    .neq('id', currentUserId)
    .limit(20);

  if (!primary.error) return { data: (primary.data ?? []).map(normalizeProfileRow), error: null };

  const fallback = await supabase
    .from('profiles')
    .select('id,email,username,privacy_mode')
    .ilike('username', `%${normalized}%`)
    .neq('id', currentUserId)
    .limit(20);

  if (fallback.error) return { data: [] as ProfileRow[], error: fallback.error };
  return { data: (fallback.data ?? []).map(normalizeProfileRow), error: null };
}

export async function fetchFriendCounts(userId: string) {
  const supabase = await getSupabaseClient();

  const following = await supabase.from('follows').select('following_id').eq('follower_id', userId);
  const followers = await supabase.from('follows').select('follower_id').eq('following_id', userId);

  if (!following.error && !followers.error) {
    return {
      data: {
        following: (following.data ?? []).length,
        followers: (followers.data ?? []).length,
        friends: 0
      },
      error: null
    };
  }

  const { data: followingRows, error: followingError } = await supabase.from('friendships').select('friend_id').eq('user_id', userId);
  if (followingError) return { data: { following: 0, followers: 0, friends: 0 }, error: followingError };

  const { data: followerRows, error: followerError } = await supabase.from('friendships').select('user_id').eq('friend_id', userId);
  if (followerError) return { data: { following: 0, followers: 0, friends: 0 }, error: followerError };

  const followingSet = new Set((followingRows ?? []).map((row: { friend_id: string }) => row.friend_id));
  const followerSet = new Set((followerRows ?? []).map((row: { user_id: string }) => row.user_id));
  let friends = 0;
  for (const id of followingSet) if (followerSet.has(id)) friends += 1;

  return { data: { following: followingSet.size, followers: followerSet.size, friends }, error: null };
}

export async function fetchFriends(userId: string) {
  const supabase = await getSupabaseClient();
  const followsResult = await supabase.from('follows').select('id,follower_id,following_id,created_at').eq('follower_id', userId);

  if (!followsResult.error) {
    const rows = (followsResult.data ?? []) as FollowRow[];
    const ids = rows.map((row) => row.following_id);
    if (!ids.length) return { data: [] as Array<FriendshipRow & { profile: ProfileRow | null }>, error: null };

    const profiles = await supabase.from('profiles').select('id,email,username,is_private,privacy_mode,following_count,follower_count').in('id', ids);
    if (profiles.error) return { data: [] as Array<FriendshipRow & { profile: ProfileRow | null }>, error: profiles.error };

    const map = new Map((profiles.data ?? []).map((profile: any) => [profile.id, normalizeProfileRow(profile)]));

    return {
      data: rows.map((row) => ({ id: row.id, user_id: row.follower_id, friend_id: row.following_id, created_at: row.created_at, profile: map.get(row.following_id) ?? null })),
      error: null
    };
  }

  const friendships = await supabase.from('friendships').select('id,user_id,friend_id,created_at').eq('user_id', userId);
  if (friendships.error) return { data: [] as Array<FriendshipRow & { profile: ProfileRow | null }>, error: friendships.error };

  const rows = (friendships.data ?? []) as FriendshipRow[];
  const friendIds = rows.map((row) => row.friend_id);
  if (!friendIds.length) return { data: [] as Array<FriendshipRow & { profile: ProfileRow | null }>, error: null };

  const profiles = await supabase.from('profiles').select('id,email,username,privacy_mode').in('id', friendIds);
  if (profiles.error) return { data: [] as Array<FriendshipRow & { profile: ProfileRow | null }>, error: profiles.error };

  const map = new Map((profiles.data ?? []).map((profile: any) => [profile.id, normalizeProfileRow(profile)]));
  return { data: rows.map((row) => ({ ...row, profile: map.get(row.friend_id) ?? null })), error: null };
}

function mapFollowRequestToFriendRequest(row: any): FriendRequestRow {
  return {
    id: row.id,
    requester_id: row.requester_id,
    receiver_id: row.target_user_id,
    status: row.status,
    created_at: row.created_at,
    responded_at: row.updated_at ?? null
  };
}

export async function fetchPendingRequests(userId: string) {
  const supabase = await getSupabaseClient();
  const result = await supabase
    .from('follow_requests')
    .select('id,requester_id,target_user_id,status,created_at,updated_at')
    .eq('target_user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (!result.error) return { data: (result.data ?? []).map(mapFollowRequestToFriendRequest), error: null };

  const fallback = await supabase
    .from('friend_requests')
    .select('id,requester_id,receiver_id,status,created_at,responded_at')
    .eq('receiver_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  return { data: (fallback.data ?? []) as FriendRequestRow[], error: fallback.error };
}

export async function fetchOutgoingPendingRequests(userId: string) {
  const supabase = await getSupabaseClient();
  const result = await supabase
    .from('follow_requests')
    .select('id,requester_id,target_user_id,status,created_at,updated_at')
    .eq('requester_id', userId)
    .eq('status', 'pending');

  if (!result.error) {
    return {
      data: (result.data ?? []).map((row: any) => ({ ...mapFollowRequestToFriendRequest(row), receiver_id: row.target_user_id })),
      error: null
    };
  }

  const fallback = await supabase
    .from('friend_requests')
    .select('id,requester_id,receiver_id,status,created_at,responded_at')
    .eq('requester_id', userId)
    .eq('status', 'pending');

  return { data: (fallback.data ?? []) as FriendRequestRow[], error: fallback.error };
}

export async function resolveRelationshipState(currentUserId: string, targetUserId: string, targetIsPrivate = false): Promise<{ data: RelationshipState; error: any }> {
  const base: RelationshipState = {
    isSelf: currentUserId === targetUserId,
    isFollowing: false,
    isRequested: false,
    requestedByThem: false,
    targetIsPrivate
  };

  if (base.isSelf) return { data: base, error: null };

  const supabase = await getSupabaseClient();

  const following = await supabase.from('follows').select('id').eq('follower_id', currentUserId).eq('following_id', targetUserId).maybeSingle();
  if (!following.error) {
    base.isFollowing = Boolean(following.data);

    const outgoing = await supabase
      .from('follow_requests')
      .select('id')
      .eq('requester_id', currentUserId)
      .eq('target_user_id', targetUserId)
      .eq('status', 'pending')
      .maybeSingle();
    if (!outgoing.error) base.isRequested = Boolean(outgoing.data);

    const incoming = await supabase
      .from('follow_requests')
      .select('id')
      .eq('requester_id', targetUserId)
      .eq('target_user_id', currentUserId)
      .eq('status', 'pending')
      .maybeSingle();
    if (!incoming.error) base.requestedByThem = Boolean(incoming.data);

    return { data: base, error: null };
  }

  const legacy = await supabase.from('friendships').select('id').eq('user_id', currentUserId).eq('friend_id', targetUserId).maybeSingle();
  if (legacy.error) return { data: base, error: legacy.error };
  base.isFollowing = Boolean(legacy.data);
  return { data: base, error: null };
}

export async function sendFriendAction(payload: {
  currentUserId: string;
  targetProfile: ProfileRow;
  alreadyFriend: boolean;
  hasPendingOutgoing: boolean;
}) {
  const supabase = await getSupabaseClient();
  const relationship = await resolveRelationshipState(payload.currentUserId, payload.targetProfile.id, payload.targetProfile.privacy_mode === 'private');
  if (relationship.error) return { error: relationship.error };

  if (relationship.data.isSelf) return { error: { message: 'You cannot follow yourself.' } };
  if (relationship.data.isFollowing) return { error: { message: 'Already following this user.' } };
  if (relationship.data.isRequested) return { error: { message: 'Follow request already pending.' } };

  const targetIsPrivate = payload.targetProfile.privacy_mode === 'private';

  if (!targetIsPrivate) {
    const followInsert = await supabase.from('follows').insert({ follower_id: payload.currentUserId, following_id: payload.targetProfile.id });
    if (followInsert.error && !isDuplicateKeyError(followInsert.error)) {
      const legacyA = await supabase.from('friendships').insert({ user_id: payload.currentUserId, friend_id: payload.targetProfile.id });
      if (legacyA.error && !isDuplicateKeyError(legacyA.error)) return { error: legacyA.error };
    }

    const { error: notifError } = await supabase.from('notifications').insert({
      user_id: payload.targetProfile.id,
      actor_id: payload.currentUserId,
      type: 'friend_request_accepted',
      message: 'You have a new follower.'
    });

    return { error: notifError };
  }

  const existingRequest = await supabase
    .from('follow_requests')
    .select('id,status')
    .eq('requester_id', payload.currentUserId)
    .eq('target_user_id', payload.targetProfile.id)
    .maybeSingle();

  if (existingRequest.error && !isMissingSchemaError(existingRequest.error)) return { error: existingRequest.error };

  let requestId: string | undefined = existingRequest.data?.id;

  if (!existingRequest.data) {
    const created = await supabase
      .from('follow_requests')
      .insert({ requester_id: payload.currentUserId, target_user_id: payload.targetProfile.id, status: 'pending' })
      .select('id')
      .single();

    if (created.error) {
      const legacyCreate = await supabase
        .from('friend_requests')
        .insert({ requester_id: payload.currentUserId, receiver_id: payload.targetProfile.id, status: 'pending', responded_at: null })
        .select('id')
        .single();
      if (legacyCreate.error) return { error: legacyCreate.error };
      requestId = legacyCreate.data.id;
    } else {
      requestId = created.data.id;
    }
  } else if (existingRequest.data.status === 'pending') {
    return { error: { message: 'Follow request already pending.' } };
  } else if (existingRequest.data.status !== 'accepted') {
    const reopened = await supabase.from('follow_requests').update({ status: 'pending' }).eq('id', existingRequest.data.id).select('id').single();
    if (reopened.error) return { error: reopened.error };
    requestId = reopened.data.id;
  }

  const { error: notifError } = await supabase.from('notifications').insert({
    user_id: payload.targetProfile.id,
    actor_id: payload.currentUserId,
    type: 'friend_request_received',
    message: 'You have a new follow request.',
    data: { follow_request_id: requestId }
  });

  return { error: notifError };
}

export async function respondToFriendRequest(payload: { currentUserId: string; request: FriendRequestRow; accept: boolean }) {
  const supabase = await getSupabaseClient();
  const nextStatus = payload.accept ? 'accepted' : 'rejected';

  const updateRequest = await supabase
    .from('follow_requests')
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq('id', payload.request.id)
    .eq('target_user_id', payload.currentUserId)
    .eq('status', 'pending')
    .select('id,requester_id,target_user_id')
    .maybeSingle();

  if (updateRequest.error && !isMissingSchemaError(updateRequest.error)) return { error: updateRequest.error };

  if (!updateRequest.data) {
    const fallback = await supabase
      .from('friend_requests')
      .update({ status: nextStatus, responded_at: new Date().toISOString() })
      .eq('id', payload.request.id)
      .eq('receiver_id', payload.currentUserId)
      .eq('status', 'pending')
      .select('id,requester_id,receiver_id')
      .maybeSingle();

    if (fallback.error) return { error: fallback.error };
    if (!fallback.data) return { error: { message: 'This request was already handled.' } };

    if (payload.accept) {
      const { error: edgeError } = await supabase.from('friendships').insert({ user_id: payload.request.requester_id, friend_id: payload.currentUserId });
      if (edgeError && !isDuplicateKeyError(edgeError)) return { error: edgeError };
    }

    return { error: null };
  }

  if (payload.accept) {
    const followInsert = await supabase.from('follows').insert({ follower_id: payload.request.requester_id, following_id: payload.currentUserId });
    if (followInsert.error && !isDuplicateKeyError(followInsert.error)) return { error: followInsert.error };

    const { error: notifError } = await supabase.from('notifications').insert({
      user_id: payload.request.requester_id,
      actor_id: payload.currentUserId,
      type: 'friend_request_accepted',
      message: 'Your follow request was accepted.'
    });

    if (notifError) return { error: notifError };
  }

  return { error: null };
}

export async function unfollowUser(payload: { currentUserId: string; targetUserId: string }) {
  const supabase = await getSupabaseClient();
  const result = await supabase.from('follows').delete().eq('follower_id', payload.currentUserId).eq('following_id', payload.targetUserId);
  if (!result.error) return { error: null };

  const fallback = await supabase.from('friendships').delete().eq('user_id', payload.currentUserId).eq('friend_id', payload.targetUserId);
  return { error: fallback.error };
}

export async function sendGymInvite(payload: { currentUserId: string; friendId: string; message: string }) {
  const supabase = await getSupabaseClient();
  const cleanMessage = payload.message.trim();
  if (!cleanMessage) return { error: { message: 'Please enter a message.' } };

  const { error } = await supabase.from('notifications').insert({
    user_id: payload.friendId,
    actor_id: payload.currentUserId,
    type: 'gym_invite',
    message: cleanMessage
  });

  return { error };
}

export async function fetchNotifications(userId: string) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('notifications')
    .select('id,user_id,actor_id,type,message,data,created_at,read_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  return { data: (data ?? []) as NotificationRow[], error };
}

export async function markNotificationRead(notificationId: string) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notificationId);
  return { error };
}

export async function fetchProfilesByIds(ids: string[]) {
  const supabase = await getSupabaseClient();
  if (!ids.length) return { data: [] as ProfileRow[], error: null };

  const primary = await supabase.from('profiles').select('id,email,username,is_private,privacy_mode,following_count,follower_count').in('id', ids);
  if (!primary.error) return { data: (primary.data ?? []).map(normalizeProfileRow), error: null };

  const fallback = await supabase.from('profiles').select('id,email,username,privacy_mode').in('id', ids);
  return { data: (fallback.data ?? []).map(normalizeProfileRow), error: fallback.error };
}

export async function areFriends(userId: string, friendId: string) {
  const relationship = await resolveRelationshipState(userId, friendId);
  if (relationship.error) return { value: false, error: relationship.error };
  return { value: relationship.data.isFollowing, error: null };
}
