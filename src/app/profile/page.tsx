'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGate } from '@/components/auth/AuthGate';
import { Button } from '@/components/ui/Button';
import { NotificationItem } from '@/components/social/NotificationItem';
import { FriendRequestCard } from '@/components/social/FriendRequestCard';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { fetchPlanTier } from '@/lib/workouts/sessions';
import {
  areFriends,
  fetchFriendCounts,
  fetchFriends,
  fetchMyProfile,
  fetchNotifications,
  fetchOutgoingPendingRequests,
  fetchPendingRequests,
  fetchProfilesByIds,
  markNotificationRead,
  respondToFriendRequest,
  searchProfilesByUsername,
  sendFriendAction,
  sendWorkoutAlert,
  unfollowUser,
  updateMyProfileSettings,
} from '@/lib/social/sessions';
import type { NotificationRow, PrivacyMode, ProfileRow } from '@/lib/social/types';
import {
  User,
  Users,
  Bell,
  Search,
  Shield,
  Lock,
  Trash2,
  Check,
  ChevronRight,
  Send,
  X,
} from 'lucide-react';

type Tab = 'account' | 'social' | 'alerts';

// ---------------------------------------------------------------------------
// Shared small primitives
// ---------------------------------------------------------------------------

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        margin: '0 0 12px',
      }}
    >
      {children}
    </h3>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
      {children}
    </label>
  );
}

function FormInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        height: 44,
        padding: '0 14px',
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--bg-input)',
        color: 'var(--text-primary)',
        fontSize: 14,
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
        ...props.style,
      }}
    />
  );
}

function Toast({ text, variant = 'success' }: { text: string; variant?: 'success' | 'error' }) {
  return (
    <p
      style={{
        fontSize: 13,
        margin: '4px 0 0',
        color: variant === 'error' ? 'var(--color-danger, #ef4444)' : 'var(--accent)',
      }}
    >
      {text}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Account tab
// ---------------------------------------------------------------------------

function AccountTab({
  userId,
  email,
  username,
  tier,
  onUsernameChange,
}: {
  userId: string;
  email: string;
  username: string;
  tier: 'free' | 'pro';
  onUsernameChange: (u: string) => void;
}) {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const [displayName, setDisplayName] = useState(username);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deleteConfirmPassword, setDeleteConfirmPassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [, startTransition] = useTransition();

  useEffect(() => { setDisplayName(username); }, [username]);

  async function handleSaveUsername() {
    setMessage(''); setErrMsg('');
    const { error } = await supabase
      .from('profiles')
      .update({ username: displayName.trim() })
      .eq('id', userId);
    if (error) { setErrMsg(error.message); return; }
    onUsernameChange(displayName.trim());
    setMessage('Username updated.');
  }

  async function handleChangePassword() {
    setMessage(''); setErrMsg('');
    if (!newPassword) { setErrMsg('Enter a new password.'); return; }
    if (newPassword !== confirmPassword) { setErrMsg('Passwords do not match.'); return; }
    if (newPassword.length < 8) { setErrMsg('Password must be at least 8 characters.'); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setErrMsg(error.message); return; }
    setNewPassword(''); setConfirmPassword('');
    setMessage('Password updated successfully.');
  }

  function handleDeleteAccount() {
    setMessage(''); setErrMsg('');
    if (!deleteConfirmPassword) { setErrMsg('Enter your password to confirm deletion.'); return; }
    startTransition(async () => {
      // Re-authenticate then delete
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: deleteConfirmPassword });
      if (signInError) { setErrMsg('Incorrect password.'); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: deleteError } = await (supabase as any).rpc('delete_user');
      if (deleteError) {
        // Fallback: sign out and let the user know
        await supabase.auth.signOut();
        setErrMsg('Account deletion failed — contact support.');
        return;
      }
      await supabase.auth.signOut();
      router.push('/');
    });
  }

  const initials = (displayName || email || '?').slice(0, 2).toUpperCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Avatar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0 8px' }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--accent-fg, #fff)',
          }}
        >
          {initials}
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px' }}>
            {displayName || 'Set a username'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{email}</p>
        </div>
        <span
          style={{
            padding: '3px 12px',
            borderRadius: 999,
            background: tier === 'pro' ? 'var(--accent)' : 'var(--bg-input)',
            color: tier === 'pro' ? 'var(--accent-fg, #fff)' : 'var(--text-secondary)',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {tier === 'pro' ? 'Pro' : 'Free plan'}
        </span>
      </div>

      {/* Username */}
      <section>
        <SectionHeading>Display Name</SectionHeading>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FieldGroup label="Username">
            <FormInput
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="username (3–20 chars)"
              maxLength={20}
            />
          </FieldGroup>
          <Button onClick={handleSaveUsername} full>Save Username</Button>
        </div>
      </section>

      {/* Change password */}
      <section>
        <SectionHeading>Change Password</SectionHeading>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FieldGroup label="New Password">
            <FormInput
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 8 characters"
              autoComplete="new-password"
            />
          </FieldGroup>
          <FieldGroup label="Confirm Password">
            <FormInput
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              autoComplete="new-password"
            />
          </FieldGroup>
          <Button onClick={handleChangePassword} full>Update Password</Button>
        </div>
      </section>

      {message && <Toast text={message} />}
      {errMsg  && <Toast text={errMsg}  variant="error" />}

      {/* Danger zone */}
      <section>
        <SectionHeading>Danger Zone</SectionHeading>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 10,
              border: '1px solid var(--color-danger, #ef4444)',
              background: 'transparent',
              color: 'var(--color-danger, #ef4444)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <Trash2 size={16} />
            Delete account
          </button>
        ) : (
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              border: '1px solid var(--color-danger, #ef4444)',
              background: 'var(--bg-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              This is permanent. Enter your password to confirm.
            </p>
            <FormInput
              type="password"
              value={deleteConfirmPassword}
              onChange={(e) => setDeleteConfirmPassword(e.target.value)}
              placeholder="Your current password"
              autoComplete="current-password"
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleDeleteAccount}
                style={{
                  flex: 1, height: 40, borderRadius: 10, border: 'none',
                  background: 'var(--color-danger, #ef4444)', color: '#fff',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Permanently Delete
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmPassword(''); }}
                style={{
                  flex: 1, height: 40, borderRadius: 10,
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Social tab
// ---------------------------------------------------------------------------

function SocialTab({ userId }: { userId: string }) {
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>('public');
  const [username, setUsername] = useState('');
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [friends, setFriends] = useState<Array<{ id: string; profile: ProfileRow | null }>>([]);
  const [pending, setPending] = useState<Array<{ id: string; requester_id: string }>>([]);
  const [pendingProfiles, setPendingProfiles] = useState<Record<string, ProfileRow>>({});
  const [outgoingIds, setOutgoingIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ProfileRow[]>([]);
  const [alertTargetId, setAlertTargetId] = useState<string | null>(null);
  const [alertText, setAlertText] = useState('');
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const friendIds = useMemo(
    () => new Set(friends.map((f) => f.profile?.id).filter(Boolean) as string[]),
    [friends]
  );

  async function load(uid: string) {
    const [profileRes, countRes, friendsRes, pendingRes, outgoingRes] = await Promise.all([
      fetchMyProfile(uid, null),
      fetchFriendCounts(uid),
      fetchFriends(uid),
      fetchPendingRequests(uid),
      fetchOutgoingPendingRequests(uid),
    ]);
    if (!profileRes.error && profileRes.data) {
      setUsername(profileRes.data.username ?? '');
      setPrivacyMode(profileRes.data.privacy_mode);
    }
    if (!countRes.error) {
      setFollowers(countRes.data.followers);
      setFollowing(countRes.data.following);
    }
    if (!friendsRes.error) {
      setFriends(
        (friendsRes.data as Array<{ id: string; profile: ProfileRow | null }>).map((r) => ({
          id: r.id,
          profile: r.profile,
        }))
      );
    }
    if (!pendingRes.error) {
      setPending(pendingRes.data.map((r: { id: string; requester_id: string }) => r));
      const ids = Array.from(new Set(pendingRes.data.map((r: { requester_id: string }) => r.requester_id)));
      const profilesRes = await fetchProfilesByIds(ids as string[]);
      if (!profilesRes.error) {
        const map: Record<string, ProfileRow> = {};
        for (const p of profilesRes.data) map[p.id] = p;
        setPendingProfiles(map);
      }
    }
    if (!outgoingRes.error) {
      setOutgoingIds(new Set(outgoingRes.data.map((r: { receiver_id: string }) => r.receiver_id)));
    }
  }

  useEffect(() => { load(userId); }, [userId]);

  async function handleSaveSettings() {
    setMessage(''); setErrMsg('');
    const res = await updateMyProfileSettings({ userId, username, privacyMode });
    if (res.error) { setErrMsg(res.error.message); return; }
    setMessage('Settings saved.');
    load(userId);
  }

  async function handleSearch() {
    setMessage(''); setErrMsg('');
    const res = await searchProfilesByUsername(userId, search);
    if (res.error) { setErrMsg(res.error.message); return; }
    setResults(res.data);
  }

  async function handleFriendAction(target: ProfileRow) {
    const isFriend = await areFriends(userId, target.id);
    if (isFriend.error) { setErrMsg(isFriend.error.message); return; }
    if (isFriend.value) {
      const r = await unfollowUser({ currentUserId: userId, targetUserId: target.id });
      if (r.error) { setErrMsg(r.error.message); return; }
      setMessage('Unfollowed.');
      load(userId); return;
    }
    const r = await sendFriendAction({
      currentUserId: userId,
      targetProfile: target,
      alreadyFriend: false,
      hasPendingOutgoing: outgoingIds.has(target.id),
    });
    if (r.error) { setErrMsg(r.error.message); return; }
    const isPrivate = typeof target.is_private === 'boolean' ? target.is_private : target.privacy_mode === 'private';
    setMessage(isPrivate ? 'Follow request sent.' : 'Now following.');
    load(userId);
  }

  async function handleRespond(requestId: string, requesterId: string, accept: boolean) {
    if (processingRequestId) return;
    setProcessingRequestId(requestId);
    setPending((prev) => prev.filter((r) => r.id !== requestId));
    try {
      const r = await respondToFriendRequest({
        currentUserId: userId,
        request: { id: requestId, requester_id: requesterId, receiver_id: userId, status: 'pending', created_at: '', responded_at: null },
        accept,
      });
      if (r.error) { setErrMsg(r.error.message); load(userId); return; }
      setMessage(accept ? 'Request accepted.' : 'Request declined.');
      load(userId);
    } finally {
      setProcessingRequestId(null);
    }
  }

  async function handleSendAlert() {
    if (!alertTargetId || !alertText.trim()) return;
    try {
      await sendWorkoutAlert(userId, [alertTargetId], alertText.trim());
      setMessage('Workout alert sent!');
      setAlertTargetId(null);
      setAlertText('');
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Failed to send alert');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
        }}
      >
        {[
          { label: 'Friends', value: friends.length },
          { label: 'Following', value: following },
          { label: 'Followers', value: followers },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              padding: '14px 0',
              borderRadius: 12,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px' }}>
              {value}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Privacy settings */}
      <section>
        <SectionHeading>Privacy &amp; Settings</SectionHeading>
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <FieldGroup label="Username">
            <FormInput
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username (3–20 chars)"
              maxLength={20}
            />
          </FieldGroup>
          <FieldGroup label="Account Privacy">
            <select
              value={privacyMode}
              onChange={(e) => setPrivacyMode(e.target.value as PrivacyMode)}
              style={{
                height: 44,
                padding: '0 14px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: 14,
              }}
            >
              <option value="public">Public (instant follow)</option>
              <option value="private">Private (request + accept)</option>
            </select>
          </FieldGroup>
          <Button onClick={handleSaveSettings} full>Save Settings</Button>
        </div>
      </section>

      {/* Search & follow */}
      <section>
        <SectionHeading>Find &amp; Add Friends</SectionHeading>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <FormInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username…"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg-input)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Search size={18} />
          </button>
        </div>
        {results.length > 0 && (
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            {results.map((profile, i) => {
              const isPrivate = typeof profile.is_private === 'boolean'
                ? profile.is_private
                : profile.privacy_mode === 'private';
              const actionLabel = friendIds.has(profile.id)
                ? 'Following'
                : outgoingIds.has(profile.id)
                  ? 'Requested'
                  : 'Follow';
              return (
                <div
                  key={profile.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      background: 'var(--bg-input)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--text-secondary)',
                      flexShrink: 0,
                    }}
                  >
                    {(profile.username || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 2px', color: 'var(--text-primary)' }}>
                      {profile.username ?? 'Unnamed'}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                      {isPrivate ? 'Private' : 'Public'}
                    </p>
                  </div>
                  <Button
                    variant={actionLabel === 'Following' ? 'ghost' : 'solid'}
                    onClick={() => handleFriendAction(profile)}
                    disabled={actionLabel === 'Requested'}
                    style={{ height: 34, padding: '0 14px', fontSize: 13, flexShrink: 0 }}
                  >
                    {actionLabel}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Pending requests */}
      {pending.length > 0 && (
        <section>
          <SectionHeading>Pending Requests ({pending.length})</SectionHeading>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pending.map((req) => (
              <FriendRequestCard
                key={req.id}
                requester={pendingProfiles[req.requester_id] ?? null}
                onAccept={() => handleRespond(req.id, req.requester_id, true)}
                onDecline={() => handleRespond(req.id, req.requester_id, false)}
                disabled={processingRequestId === req.id}
              />
            ))}
          </div>
        </section>
      )}

      {/* Friends list */}
      <section>
        <SectionHeading>Friends ({friends.length})</SectionHeading>
        {friends.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            No friends yet — search above.
          </p>
        ) : (
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            {friends.map((f, i) => {
              if (!f.profile) return null;
              const p = f.profile;
              return (
                <div
                  key={f.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderBottom: i < friends.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      background: 'var(--bg-input)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--text-secondary)',
                      flexShrink: 0,
                    }}
                  >
                    {(p.username || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, margin: 0, color: 'var(--text-primary)' }}>
                      {p.username ?? 'Unnamed'}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                      {p.privacy_mode === 'private' ? 'Private' : 'Public'}
                    </p>
                  </div>
                  {alertTargetId === p.id ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        value={alertText}
                        onChange={(e) => setAlertText(e.target.value)}
                        placeholder="Alert message…"
                        maxLength={120}
                        style={{
                          height: 34,
                          padding: '0 10px',
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          fontSize: 13,
                          width: 160,
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendAlert()}
                        autoFocus
                      />
                      <button
                        onClick={handleSendAlert}
                        title="Send"
                        style={{
                          width: 34, height: 34, borderRadius: 8,
                          border: 'none', background: 'var(--accent)',
                          color: 'var(--accent-fg, #fff)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Send size={14} />
                      </button>
                      <button
                        onClick={() => { setAlertTargetId(null); setAlertText(''); }}
                        title="Cancel"
                        style={{
                          width: 34, height: 34, borderRadius: 8,
                          border: '1px solid var(--border)', background: 'transparent',
                          color: 'var(--text-muted)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAlertTargetId(p.id)}
                      title="Send workout alert"
                      style={{
                        height: 34, padding: '0 12px', borderRadius: 8,
                        border: '1px solid var(--border)', background: 'var(--bg-input)',
                        color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      <Bell size={13} />
                      Alert
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {message && <Toast text={message} />}
      {errMsg  && <Toast text={errMsg} variant="error" />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alerts tab
// ---------------------------------------------------------------------------

function AlertsTab({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [errMsg, setErrMsg] = useState('');

  async function load(uid: string) {
    const res = await fetchNotifications(uid);
    if (res.error) { setErrMsg(res.error.message); return; }
    setNotifications(res.data);
  }

  useEffect(() => { load(userId); }, [userId]);

  async function handleMarkRead(id: string) {
    const res = await markNotificationRead(id);
    if (res.error) { setErrMsg(res.error.message); return; }
    load(userId);
  }

  if (errMsg) return <Toast text={errMsg} variant="error" />;

  if (notifications.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 0',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bell size={24} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
        </div>
        <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
          All caught up
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
          No notifications yet.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {notifications.map((n) => (
        <NotificationItem
          key={n.id}
          notification={n}
          userId={userId}
          onMarkRead={() => handleMarkRead(n.id)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const [userId,   setUserId]   = useState<string | null>(null);
  const [email,    setEmail]    = useState('');
  const [username, setUsername] = useState('');
  const [tier,     setTier]     = useState<'free' | 'pro'>('free');
  const [tab,      setTab]      = useState<Tab>('account');

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      setEmail(data.user.email ?? '');
      const [planTier, profileRes] = await Promise.all([
        fetchPlanTier(data.user.id),
        fetchMyProfile(data.user.id, data.user.email ?? null),
      ]);
      setTier(planTier);
      if (!profileRes.error && profileRes.data) {
        setUsername(profileRes.data.username ?? '');
      }
    })();
  }, []);

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: 'account', label: 'Account', icon: <User  size={16} /> },
    { id: 'social',  label: 'Social',  icon: <Users size={16} /> },
    { id: 'alerts',  label: 'Alerts',  icon: <Bell  size={16} /> },
  ];

  return (
    <AuthGate>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 20px 80px' }}>
        {/* Tab bar */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            margin: '16px 0 24px',
            gap: 0,
          }}
        >
          {tabs.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '12px 0',
                border: 'none',
                borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
                background: 'transparent',
                color: tab === id ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: 13,
                fontWeight: tab === id ? 600 : 400,
                cursor: 'pointer',
                transition: 'color 0.15s',
                marginBottom: -1,
              }}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {userId && tab === 'account' && (
          <AccountTab
            userId={userId}
            email={email}
            username={username}
            tier={tier}
            onUsernameChange={setUsername}
          />
        )}
        {userId && tab === 'social' && <SocialTab userId={userId} />}
        {userId && tab === 'alerts' && <AlertsTab userId={userId} />}
      </div>
    </AuthGate>
  );
}
