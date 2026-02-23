import { getSupabaseClient } from '@/lib/supabaseClient';
import type { FriendRequestRow, FriendshipRow, NotificationRow, PrivacyMode, ProfileRow } from '@/lib/social/types';

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function isMissingColumnError(error: { message?: string } | null) {
  return Boolean(error?.message?.toLowerCase().includes('column') && error?.message?.toLowerCase().includes('does not exist'));
}

function isDuplicateKeyError(error: { code?: string; message?: string } | null) {
  return error?.code === '23505' || Boolean(error?.message?.toLowerCase().includes('duplicate key'));
}

async function ensureProfileRow(userId: string, email?: string | null) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      ...(email ? { email } : {})
    },
    { onConflict: 'id' }
  );

  return { error };
}

export async function fetchMyProfile(userId: string, email?: string | null) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.from('profiles').select('id,email,username,privacy_mode').eq('id', userId).maybeSingle();

  if (!error && !data) {
    const insertResult = await ensureProfileRow(userId, email);
    if (insertResult.error) return { data: null as ProfileRow | null, error: insertResult.error };

    const reload = await supabase.from('profiles').select('id,email,username,privacy_mode').eq('id', userId).maybeSingle();
    return { data: (reload.data ?? null) as ProfileRow | null, error: reload.error };
  }

  if (isMissingColumnError(error)) {
    const fallback = await supabase.from('profiles').select('id,email').eq('id', userId).maybeSingle();
    if (fallback.error) return { data: null as ProfileRow | null, error: fallback.error };
    return {
      data: (fallback.data
        ? {
            id: fallback.data.id,
            email: fallback.data.email,
            username: null,
            privacy_mode: 'public'
          }
        : null) as ProfileRow | null,
      error: { message: 'Social columns are missing. Please run latest supabase/schema.sql migration.' }
    };
  }

  return { data: (data ?? null) as ProfileRow | null, error };
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

  if (isMissingColumnError(findError)) {
    return { error: { message: 'Database is missing social columns. Run supabase/schema.sql in Supabase SQL editor.' } };
  }

  if (findError) return { error: findError };
  if (existing) return { error: { message: 'That username is already taken.' } };

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: payload.userId, username: normalized, privacy_mode: payload.privacyMode }, { onConflict: 'id' });

  if (isMissingColumnError(error)) {
    return { error: { message: 'Database is missing social columns. Run supabase/schema.sql in Supabase SQL editor.' } };
  }

  return { error };
}

export async function searchProfilesByUsername(currentUserId: string, query: string) {
  const supabase = await getSupabaseClient();
  const normalized = normalizeUsername(query);
  if (!normalized) return { data: [] as ProfileRow[], error: null };

  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,username,privacy_mode')
    .ilike('username', `%${normalized}%`)
    .neq('id', currentUserId)
    .limit(20);

  if (isMissingColumnError(error)) {
    return { data: [] as ProfileRow[], error: { message: 'Username search requires latest social schema migration.' } };
  }

  return { data: (data ?? []) as ProfileRow[], error };
}

export async function fetchFriendCounts(userId: string) {
  const supabase = await getSupabaseClient();
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
  const { data: friendships, error } = await supabase.from('friendships').select('id,user_id,friend_id,created_at').eq('user_id', userId);
  if (error) return { data: [] as Array<FriendshipRow & { profile: ProfileRow | null }>, error };

  const rows = (friendships ?? []) as FriendshipRow[];
  const friendIds = rows.map((row) => row.friend_id);
  if (!friendIds.length) return { data: [] as Array<FriendshipRow & { profile: ProfileRow | null }>, error: null };

  const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id,email,username,privacy_mode').in('id', friendIds);
  if (profilesError) return { data: [] as Array<FriendshipRow & { profile: ProfileRow | null }>, error: profilesError };

  const map = new Map((profiles ?? []).map((profile: ProfileRow) => [profile.id, profile]));
  return { data: rows.map((row) => ({ ...row, profile: map.get(row.friend_id) ?? null })), error: null };
}

export async function fetchPendingRequests(userId: string) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('friend_requests')
    .select('id,requester_id,receiver_id,status,created_at,responded_at')
    .eq('receiver_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  return { data: (data ?? []) as FriendRequestRow[], error };
}

export async function fetchOutgoingPendingRequests(userId: string) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('friend_requests')
    .select('id,requester_id,receiver_id,status,created_at,responded_at')
    .eq('requester_id', userId)
    .eq('status', 'pending');

  return { data: (data ?? []) as FriendRequestRow[], error };
}

export async function sendFriendAction(payload: {
  currentUserId: string;
  targetProfile: ProfileRow;
  alreadyFriend: boolean;
  hasPendingOutgoing: boolean;
}) {
  const supabase = await getSupabaseClient();

  if (payload.currentUserId === payload.targetProfile.id) {
    return { error: { message: 'You cannot add yourself.' } };
  }

  if (payload.alreadyFriend) {
    return { error: { message: 'Already friends with this user.' } };
  }

  if (payload.hasPendingOutgoing) {
    return { error: { message: 'Friend request already pending.' } };
  }

  if (payload.targetProfile.privacy_mode === 'public') {
    const { error: followError } = await supabase.from('friendships').insert({ user_id: payload.currentUserId, friend_id: payload.targetProfile.id });
    if (followError && !isDuplicateKeyError(followError)) return { error: followError };

    const { error: notifError } = await supabase.from('notifications').insert({
      user_id: payload.targetProfile.id,
      actor_id: payload.currentUserId,
      type: 'friend_request_accepted',
      message: 'You have a new follower.'
    });

    return { error: notifError };
  }

  const existingRequest = await supabase
    .from('friend_requests')
    .select('id,status')
    .eq('requester_id', payload.currentUserId)
    .eq('receiver_id', payload.targetProfile.id)
    .maybeSingle();

  if (existingRequest.error) return { error: existingRequest.error };

  let requestId = existingRequest.data?.id as string | undefined;

  if (!existingRequest.data) {
    const created = await supabase
      .from('friend_requests')
      .insert({ requester_id: payload.currentUserId, receiver_id: payload.targetProfile.id, status: 'pending', responded_at: null })
      .select('id')
      .single();

    if (created.error) return { error: created.error };
    requestId = created.data.id;
  } else if (existingRequest.data.status === 'pending') {
    return { error: { message: 'Friend request already pending.' } };
  } else if (existingRequest.data.status !== 'accepted') {
    const reopened = await supabase
      .from('friend_requests')
      .update({ status: 'pending', responded_at: null })
      .eq('id', existingRequest.data.id)
      .select('id')
      .single();

    if (reopened.error) return { error: reopened.error };
    requestId = reopened.data.id;
  }

  if (existingRequest.data?.status === 'accepted') {
    return { error: { message: 'Already friends with this user.' } };
  }

  const { error: notifError } = await supabase.from('notifications').insert({
    user_id: payload.targetProfile.id,
    actor_id: payload.currentUserId,
    type: 'friend_request_received',
    message: 'You have a new friend request.',
    data: { friend_request_id: requestId }
  });

  return { error: notifError };
}

export async function respondToFriendRequest(payload: { currentUserId: string; request: FriendRequestRow; accept: boolean }) {
  const supabase = await getSupabaseClient();
  const nextStatus = payload.accept ? 'accepted' : 'rejected';

  const { data: updatedRow, error: updateError } = await supabase
    .from('friend_requests')
    .update({ status: nextStatus, responded_at: new Date().toISOString() })
    .eq('id', payload.request.id)
    .eq('receiver_id', payload.currentUserId)
    .eq('status', 'pending')
    .select('id,requester_id,receiver_id')
    .maybeSingle();

  if (updateError) return { error: updateError };
  if (!updatedRow) return { error: { message: 'This request was already handled.' } };

  if (payload.accept) {
    const { error: edgeError } = await supabase.from('friendships').insert({ user_id: payload.request.requester_id, friend_id: payload.currentUserId });
    if (edgeError && !isDuplicateKeyError(edgeError)) return { error: edgeError };

    const { error: notifError } = await supabase.from('notifications').insert({
      user_id: payload.request.requester_id,
      actor_id: payload.currentUserId,
      type: 'friend_request_accepted',
      message: 'Your follow request was accepted.'
    });

    return { error: notifError };
  }

  return { error: null };
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

  const { data, error } = await supabase.from('profiles').select('id,email,username,privacy_mode').in('id', ids);
  return { data: (data ?? []) as ProfileRow[], error };
}

export async function areFriends(userId: string, friendId: string) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.from('friendships').select('id').eq('user_id', userId).eq('friend_id', friendId).maybeSingle();

  if (error) return { value: false, error };
  return { value: Boolean(data), error: null };
}
