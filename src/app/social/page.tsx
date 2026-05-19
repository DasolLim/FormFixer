'use client';

import { useEffect, useMemo, useState } from 'react';
import { AuthGate } from '@/components/auth/AuthGate';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FriendCard } from '@/components/social/FriendCard';
import { FriendRequestCard } from '@/components/social/FriendRequestCard';
import { getSupabaseClient } from '@/lib/supabaseClient';
import {
  areFriends,
  fetchFriends,
  fetchOutgoingPendingRequests,
  fetchPendingRequests,
  fetchProfilesByIds,
  searchProfilesByUsername,
  sendFriendAction,
  sendGymInvite,
  respondToFriendRequest,
  unfollowUser
} from '@/lib/social/sessions';
import type { ProfileRow } from '@/lib/social/types';
import { Search } from 'lucide-react';

export default function SocialPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ProfileRow[]>([]);
  const [friends, setFriends] = useState<Array<{ id: string; profile: ProfileRow | null }>>([]);
  const [pending, setPending] = useState<Array<{ id: string; requester_id: string }>>([]);
  const [pendingProfiles, setPendingProfiles] = useState<Record<string, ProfileRow>>({});
  const [outgoingPendingUserIds, setOutgoingPendingUserIds] = useState<Set<string>>(new Set());
  const [inviteFriendId, setInviteFriendId] = useState<string | null>(null);
  const [inviteText, setInviteText] = useState('Gym today at 7pm?');
  const [message, setMessage] = useState('');
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  async function loadSocialData(currentUserId: string) {
    const [friendsResult, pendingResult, outgoingResult] = await Promise.all([
      fetchFriends(currentUserId),
      fetchPendingRequests(currentUserId),
      fetchOutgoingPendingRequests(currentUserId)
    ]);

    if (!friendsResult.error) {
      setFriends((friendsResult.data as Array<{ id: string; profile: ProfileRow | null }>).map((row) => ({ id: row.id, profile: row.profile })));
    }

    if (!pendingResult.error) {
      setPending(pendingResult.data.map((row: { id: string; requester_id: string }) => ({ id: row.id, requester_id: row.requester_id })));
      const profileResult = await fetchProfilesByIds(Array.from(new Set(pendingResult.data.map((row: { requester_id: string }) => row.requester_id))));
      if (!profileResult.error) {
        const map: Record<string, ProfileRow> = {};
        for (const profile of profileResult.data) map[profile.id] = profile;
        setPendingProfiles(map);
      }
    }

    if (!outgoingResult.error) {
      setOutgoingPendingUserIds(new Set(outgoingResult.data.map((row: { receiver_id: string }) => row.receiver_id)));
    }
  }

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      await loadSocialData(data.user.id);
    })();
  }, []);

  const friendIds = useMemo(() => new Set(friends.map((friend) => friend.profile?.id).filter(Boolean) as string[]), [friends]);

  async function handleSearch() {
    setMessage('');
    if (!userId) return;

    const result = await searchProfilesByUsername(userId, search);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setResults(result.data);
  }

  async function handleFriendAction(targetProfile: ProfileRow) {
    if (!userId) return;
    const existingFriend = await areFriends(userId, targetProfile.id);
    if (existingFriend.error) {
      setMessage(existingFriend.error.message);
      return;
    }

    if (existingFriend.value) {
      const unfollowResult = await unfollowUser({ currentUserId: userId, targetUserId: targetProfile.id });
      if (unfollowResult.error) {
        setMessage(unfollowResult.error.message);
        return;
      }
      setMessage('Unfollowed.');
      await loadSocialData(userId);
      return;
    }

    const result = await sendFriendAction({
      currentUserId: userId,
      targetProfile,
      alreadyFriend: existingFriend.value,
      hasPendingOutgoing: outgoingPendingUserIds.has(targetProfile.id)
    });

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    const targetIsPrivate = typeof targetProfile.is_private === 'boolean' ? targetProfile.is_private : targetProfile.privacy_mode === 'private';
    setMessage(targetIsPrivate ? 'Follow request sent.' : 'Now following.');
    await loadSocialData(userId);
  }

  async function handleRespond(requestId: string, requesterId: string, accept: boolean) {
    if (!userId || processingRequestId) return;
    setMessage('');
    setProcessingRequestId(requestId);

    setPending((previous) => previous.filter((request) => request.id !== requestId));

    try {
      const result = await respondToFriendRequest({
        currentUserId: userId,
        request: { id: requestId, requester_id: requesterId, receiver_id: userId, status: 'pending', created_at: '', responded_at: null },
        accept
      });

      if (result.error) {
        setMessage(result.error.message);
        await loadSocialData(userId);
        return;
      }

      setMessage(accept ? 'Friend request accepted.' : 'Friend request declined.');
      await loadSocialData(userId);
    } finally {
      setProcessingRequestId(null);
    }
  }

  async function handleSendInvite() {
    if (!userId || !inviteFriendId) return;
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await sendGymInvite({
        actorId: userId,
        targetId: inviteFriendId,
        inviteDate: tomorrow.toISOString().split('T')[0],
        exerciseId: 'squat',
        message: inviteText || undefined,
      });
      setMessage('Gym invite sent.');
      setInviteFriendId(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to send invite');
    }
  }

  return (
    <AuthGate>
      <div className="ui-section">
        <div className="social-desktop-grid">
          {/* Left: search + pending */}
          <div className="social-col-left">
            <Card title="Find Friends">
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by username…"
                  className="form-input"
                  style={{ flex: 1 }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} style={{ height: 48, minWidth: 48, width: 48, padding: 0, borderRadius: 12, flex: 'none' }}>
                  <Search size={18} strokeWidth={1.5} />
                </Button>
              </div>

              {results.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  {results.map((profile) => {
                    const targetIsPrivate = typeof profile.is_private === 'boolean' ? profile.is_private : profile.privacy_mode === 'private';
                    const actionLabel = friendIds.has(profile.id)
                      ? 'Following'
                      : outgoingPendingUserIds.has(profile.id)
                        ? 'Requested'
                        : 'Follow';

                    return (
                      <div key={profile.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                        <div className="avatar-placeholder" style={{ width: 40, height: 40, fontSize: 16 }}>
                          {(profile.username || '?').slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>{profile.username ?? 'Unnamed'}</p>
                          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{targetIsPrivate ? 'Private' : 'Public'}</p>
                        </div>
                        <Button
                          variant={actionLabel === 'Following' ? 'ghost' : 'solid'}
                          onClick={() => handleFriendAction(profile)}
                          disabled={actionLabel === 'Requested'}
                          style={{ height: 36, padding: '0 14px', fontSize: 13, opacity: actionLabel === 'Requested' ? 0.5 : 1 }}
                        >
                          {actionLabel}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {pending.length > 0 && (
              <Card title="Pending Requests">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  {pending.map((request) => (
                    <FriendRequestCard
                      key={request.id}
                      requester={pendingProfiles[request.requester_id] ?? null}
                      onAccept={() => handleRespond(request.id, request.requester_id, true)}
                      onDecline={() => handleRespond(request.id, request.requester_id, false)}
                      disabled={processingRequestId === request.id}
                    />
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Right: friends + invite */}
          <div className="social-col-right">
            <Card title={`Friends (${friends.length})`}>
              {friends.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  {friends.map((friend) =>
                    friend.profile ? (
                      <FriendCard
                        key={friend.id}
                        profile={friend.profile}
                        onNotify={() => setInviteFriendId(friend.profile!.id)}
                      />
                    ) : null
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8 }}>No friends yet — search above.</p>
              )}
            </Card>

            {inviteFriendId && (
              <Card title="Send Gym Invite">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  <textarea
                    value={inviteText}
                    onChange={(e) => setInviteText(e.target.value)}
                    rows={3}
                    className="form-input"
                    style={{ height: 'auto', padding: '12px 14px', resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button onClick={handleSendInvite} full>Send Invite</Button>
                    <Button variant="ghost" onClick={() => setInviteFriendId(null)}>Cancel</Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>

        {message && (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>{message}</p>
        )}
      </div>
    </AuthGate>
  );
}
