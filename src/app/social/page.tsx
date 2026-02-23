'use client';

import { useEffect, useMemo, useState } from 'react';
import { AuthGate } from '@/components/auth/AuthGate';
import { Section } from '@/components/layout/Section';
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
      setFriends(friendsResult.data.map((row) => ({ id: row.id, profile: row.profile })));
    }

    if (!pendingResult.error) {
      setPending(pendingResult.data.map((row) => ({ id: row.id, requester_id: row.requester_id })));
      const profileResult = await fetchProfilesByIds(Array.from(new Set(pendingResult.data.map((row) => row.requester_id))));
      if (!profileResult.error) {
        const map: Record<string, ProfileRow> = {};
        for (const profile of profileResult.data) map[profile.id] = profile;
        setPendingProfiles(map);
      }
    }

    if (!outgoingResult.error) {
      setOutgoingPendingUserIds(new Set(outgoingResult.data.map((row) => row.receiver_id)));
    }
  }

  useEffect(() => {
    getSupabaseClient().then((supabase) =>
      supabase.auth.getUser().then(async ({ data }: { data: { user: { id: string } | null } }) => {
        if (!data.user) return;
        setUserId(data.user.id);
        await loadSocialData(data.user.id);
      })
    );
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
    const result = await sendGymInvite({ currentUserId: userId, friendId: inviteFriendId, message: inviteText });
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setMessage('Gym invite sent.');
    setInviteFriendId(null);
  }

  return (
    <AuthGate>
      <Section title="Social" subtitle="v4 Foundation" description="Find friends, manage requests, and send gym invites.">
        <Card title="Find Friends by Username">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="search username" style={{ minWidth: 220, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }} />
            <Button onClick={handleSearch}>Search</Button>
          </div>
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            {results.map((profile) => {
              const targetIsPrivate = typeof profile.is_private === 'boolean' ? profile.is_private : profile.privacy_mode === 'private';
              const actionLabel = friendIds.has(profile.id)
                ? 'Following'
                : outgoingPendingUserIds.has(profile.id)
                  ? 'Requested'
                  : 'Follow';

              return (
                <Card key={profile.id} title={profile.username ?? 'Unnamed'} description={profile.email ?? 'No email'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--muted)', fontSize: 13 }}>{targetIsPrivate ? 'Private account' : 'Public account'}</span>
                    <Button
                      variant="ghost"
                      onClick={() => handleFriendAction(profile)}
                      disabled={actionLabel === 'Requested'}
                      style={{ opacity: actionLabel === 'Requested' ? 0.5 : 1 }}
                    >
                      {actionLabel}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </Card>

        <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
          <Card title="Pending Friend Requests" description="Accept or decline incoming requests.">
            <div style={{ display: 'grid', gap: 10 }}>
              {pending.length ? (
                pending.map((request) => (
                  <FriendRequestCard
                    key={request.id}
                    requester={pendingProfiles[request.requester_id] ?? null}
                    onAccept={() => handleRespond(request.id, request.requester_id, true)}
                    onDecline={() => handleRespond(request.id, request.requester_id, false)}
                    disabled={processingRequestId === request.id}
                  />
                ))
              ) : (
                <p style={{ color: 'var(--muted)' }}>No pending requests.</p>
              )}
            </div>
          </Card>

          <Card title="Friends List" description="Your accepted friends and quick invite action.">
            <div style={{ display: 'grid', gap: 10 }}>
              {friends.length ? (
                friends.map((friend) =>
                  friend.profile ? <FriendCard key={friend.id} profile={friend.profile} onNotify={() => setInviteFriendId(friend.profile!.id)} /> : null
                )
              ) : (
                <p style={{ color: 'var(--muted)' }}>No friends yet.</p>
              )}
            </div>
          </Card>
        </div>

        {inviteFriendId ? (
          <div style={{ marginTop: 16 }}>
            <Card title="Notify Friend" description="Send a gym invite/planning message.">
              <div style={{ display: 'grid', gap: 8 }}>
                <textarea value={inviteText} onChange={(e) => setInviteText(e.target.value)} rows={3} style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button onClick={handleSendInvite}>Send Invite</Button>
                  <Button variant="ghost" onClick={() => setInviteFriendId(null)}>Cancel</Button>
                </div>
              </div>
            </Card>
          </div>
        ) : null}

        {message ? <p style={{ color: 'var(--muted)' }}>{message}</p> : null}
      </Section>
    </AuthGate>
  );
}
