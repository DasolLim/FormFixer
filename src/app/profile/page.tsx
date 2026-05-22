'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { rlLimited, rlIncrement, rlRemaining, rlResetLabel } from '@/lib/rate-limit';

const DISPLAY_NAME_KEY = 'display_name_change';
const DISPLAY_NAME_MAX = 2;
const PASSWORD_KEY     = 'password_change';
const PASSWORD_MAX     = 2;
import { useRouter } from 'next/navigation';
import { AuthGate } from '@/components/auth/AuthGate';
import { Button } from '@/components/ui/Button';
import { FriendRequestCard } from '@/components/social/FriendRequestCard';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { fetchPlanTier } from '@/lib/workouts/sessions';
import { useXPStore } from '@/store/xpStore';
import { xpLevelColor, xpLevelGlow, xpProgress, xpToNextLevel } from '@/lib/xp';
import {
  acceptGymInvite,
  areFriends,
  declineGymInvite,
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
} from '@/lib/social/sessions';
import type { NotificationRow, PrivacyMode, ProfileRow } from '@/lib/social/types';
import {
  User,
  Users,
  Bell,
  Trash2,
  ChevronRight,
  Send,
  X,
  Pencil,
  LogOut,
  Lock,
  Shield,
  UserSearch,
  UserPlus,
} from 'lucide-react';

type Tab = 'account' | 'social' | 'alerts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function avatarBg(name: string): string {
  const palette = [
    'rgba(45,65,35,0.9)',
    'rgba(25,45,75,0.9)',
    'rgba(75,28,35,0.9)',
    'rgba(35,55,60,0.9)',
    'rgba(65,35,65,0.9)',
    'rgba(60,48,22,0.9)',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

function Toast({ text, variant = 'success' }: { text: string; variant?: 'success' | 'error' }) {
  return (
    <p style={{ fontSize: 13, margin: '4px 0 0', color: variant === 'error' ? 'var(--danger)' : 'var(--accent)' }}>
      {text}
    </p>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="form-label">
      <span>{label}</span>
      {children}
    </label>
  );
}

function NotifIconCircle({ type, actorId }: { type: NotificationRow['type']; actorId: string | null }) {
  if (type === 'friend_request_received' || type === 'friend_request_accepted') {
    return (
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <UserPlus size={20} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
      </div>
    );
  }
  if (type === 'workout_alert') {
    return (
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(99,91,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Bell size={20} strokeWidth={1.5} style={{ color: '#6366f1' }} />
      </div>
    );
  }
  const initials = (actorId ?? 'GI').slice(0, 2).toUpperCase();
  return (
    <div style={{ width: 44, height: 44, borderRadius: '50%', background: avatarBg(actorId ?? 'gym'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
      {initials}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account tab
// ---------------------------------------------------------------------------

function AccountTab({
  userId,
  email,
  username,
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

  const [displayName, setDisplayName]                 = useState(username);
  const [privacyMode, setPrivacyMode]                 = useState<PrivacyMode>('public');
  const [newPassword, setNewPassword]                 = useState('');
  const [confirmPassword, setConfirmPassword]         = useState('');
  const [deleteConfirmPassword, setDeleteConfirmPassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm]     = useState(false);
  const [showPasswordForm, setShowPasswordForm]       = useState(false);
  const [message, setMessage]                         = useState('');
  const [errMsg, setErrMsg]                           = useState('');
  const [, startTransition] = useTransition();
  const privacyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [privacyBusy, setPrivacyBusy]                 = useState(false);

  useEffect(() => { setDisplayName(username); }, [username]);

  useEffect(() => {
    (async () => {
      const res = await fetchMyProfile(userId, null);
      if (!res.error && res.data) setPrivacyMode(res.data.privacy_mode);
    })();
  }, [userId]);

  async function handleSaveUsername() {
    setMessage(''); setErrMsg('');
    if (rlLimited(DISPLAY_NAME_KEY, DISPLAY_NAME_MAX, 'week')) {
      setErrMsg(`You can only change your display name ${DISPLAY_NAME_MAX} times per week. Resets ${rlResetLabel('week')}.`);
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ username: displayName.trim() })
      .eq('id', userId);
    if (error) { setErrMsg(error.message); return; }
    rlIncrement(DISPLAY_NAME_KEY, 'week');
    onUsernameChange(displayName.trim());
    const left = rlRemaining(DISPLAY_NAME_KEY, DISPLAY_NAME_MAX, 'week');
    setMessage(`Username updated. ${left} change${left === 1 ? '' : 's'} remaining this week.`);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  function handleTogglePrivacy() {
    if (privacyBusy) return;
    setPrivacyBusy(true);
    if (privacyTimerRef.current) clearTimeout(privacyTimerRef.current);
    privacyTimerRef.current = setTimeout(async () => {
      const next: PrivacyMode = privacyMode === 'public' ? 'private' : 'public';
      await supabase.from('profiles').update({ privacy_mode: next }).eq('id', userId);
      setPrivacyMode(next);
      setPrivacyBusy(false);
    }, 250);
  }

  async function handleChangePassword() {
    setMessage(''); setErrMsg('');
    if (rlLimited(PASSWORD_KEY, PASSWORD_MAX, 'week')) {
      setErrMsg(`Password can only be changed ${PASSWORD_MAX} times per week. Resets ${rlResetLabel('week')}.`);
      return;
    }
    if (!newPassword) { setErrMsg('Enter a new password.'); return; }
    if (newPassword !== confirmPassword) { setErrMsg('Passwords do not match.'); return; }
    if (newPassword.length < 8) { setErrMsg('Password must be at least 8 characters.'); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setErrMsg(error.message); return; }
    rlIncrement(PASSWORD_KEY, 'week');
    setNewPassword(''); setConfirmPassword('');
    setShowPasswordForm(false);
    const left = rlRemaining(PASSWORD_KEY, PASSWORD_MAX, 'week');
    setMessage(`Password updated. ${left} change${left === 1 ? '' : 's'} remaining this week.`);
  }

  function handleDeleteAccount() {
    setMessage(''); setErrMsg('');
    if (!deleteConfirmPassword) { setErrMsg('Enter your password to confirm deletion.'); return; }
    startTransition(async () => {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: deleteConfirmPassword });
      if (signInError) { setErrMsg('Incorrect password.'); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: deleteError } = await (supabase as any).rpc('delete_user');
      if (deleteError) {
        await supabase.auth.signOut();
        setErrMsg('Account deletion failed — contact support.');
        return;
      }
      await supabase.auth.signOut();
      router.push('/');
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Display Name */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
          Display Name
        </span>
        <div style={{ position: 'relative' }}>
          <input
            className="form-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="username (3–20 chars)"
            maxLength={20}
            style={{ paddingRight: 44 }}
          />
          <Pencil size={15} strokeWidth={1.5} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
        </div>
        <button className="btn btn-primary btn-full" onClick={handleSaveUsername}>
          Save
        </button>
        {message && <Toast text={message} />}
        {errMsg   && <Toast text={errMsg} variant="error" />}
      </div>

      {/* Settings rows */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

        <button type="button" className="list-row" onClick={handleLogout}>
          <span className="list-row-left">
            <LogOut size={18} />
            Log out
          </span>
          <span className="list-row-right"><ChevronRight size={16} /></span>
        </button>

        <button type="button" className="list-row" onClick={() => setShowPasswordForm(v => !v)}>
          <span className="list-row-left">
            <Lock size={18} />
            Change password
          </span>
          <span className="list-row-right">
            <ChevronRight size={16} style={{ transform: showPasswordForm ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s' }} />
          </span>
        </button>

        {showPasswordForm && (
          <div style={{ padding: '4px 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FieldGroup label="New Password">
              <input className="form-input" type="password" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 8 characters" autoComplete="new-password" />
            </FieldGroup>
            <FieldGroup label="Confirm Password">
              <input className="form-input" type="password" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat new password" autoComplete="new-password" />
            </FieldGroup>
            <button className="btn btn-primary btn-full" onClick={handleChangePassword} disabled={rlLimited(PASSWORD_KEY, PASSWORD_MAX, 'week')}>
              Update Password
            </button>
            <p style={{ fontSize: 11, color: rlLimited(PASSWORD_KEY, PASSWORD_MAX, 'week') ? 'var(--color-warn)' : 'var(--text-muted)', margin: '2px 0 0' }}>
              {rlLimited(PASSWORD_KEY, PASSWORD_MAX, 'week')
                ? `Limit reached — resets ${rlResetLabel('week')}`
                : `${rlRemaining(PASSWORD_KEY, PASSWORD_MAX, 'week')} of ${PASSWORD_MAX} changes remaining this week`}
            </p>
          </div>
        )}

        <button type="button" className="list-row" onClick={handleTogglePrivacy}>
          <span className="list-row-left">
            <Shield size={18} />
            Privacy mode
          </span>
          <span className="list-row-right">
            <span className="tag tag-dark" style={{ fontSize: 12, height: 26, padding: '0 10px' }}>
              {privacyMode === 'private' ? 'Private' : 'Public'}
            </span>
          </span>
        </button>

      </div>

      {/* Danger zone */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {!showDeleteConfirm ? (
          <button type="button" className="list-row" onClick={() => setShowDeleteConfirm(true)}>
            <span className="list-row-left" style={{ color: 'var(--danger)' }}>
              <Trash2 size={18} style={{ color: 'var(--danger)' }} />
              Delete account
            </span>
            <span className="list-row-right" style={{ color: 'var(--danger)' }}>
              <ChevronRight size={16} />
            </span>
          </button>
        ) : (
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              This is permanent and cannot be undone. Enter your password to confirm.
            </p>
            <input className="form-input" type="password" value={deleteConfirmPassword}
              onChange={(e) => setDeleteConfirmPassword(e.target.value)}
              placeholder="Your current password" autoComplete="current-password" />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-danger btn-full" onClick={handleDeleteAccount}>
                Permanently Delete
              </button>
              <button type="button" className="btn btn-ghost btn-full" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmPassword(''); }}>
                Cancel
              </button>
            </div>
            {errMsg && <Toast text={errMsg} variant="error" />}
          </div>
        )}
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Social tab
// ---------------------------------------------------------------------------

const MSG_TOTAL_KEY  = 'msg_total';
const MSG_TOTAL_MAX  = 15;
const MSG_FRIEND_MAX = 5;

function msgFriendKey(friendId: string) { return `msg_friend_${friendId}`; }

function SocialTab({ userId }: { userId: string }) {
  const [friends, setFriends]                         = useState<Array<{ id: string; profile: ProfileRow | null }>>([]);
  const [pending, setPending]                         = useState<Array<{ id: string; requester_id: string }>>([]);
  const [pendingProfiles, setPendingProfiles]         = useState<Record<string, ProfileRow>>({});
  const [outgoingIds, setOutgoingIds]                 = useState<Set<string>>(new Set());
  const [search, setSearch]                           = useState('');
  const [results, setResults]                         = useState<ProfileRow[]>([]);
  const [alertTargetId, setAlertTargetId]             = useState<string | null>(null);
  const [alertText, setAlertText]                     = useState('');
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [message, setMessage]                         = useState('');
  const [errMsg, setErrMsg]                           = useState('');

  const friendIds = new Set(friends.map((f) => f.profile?.id).filter(Boolean) as string[]);

  async function load(uid: string) {
    const [friendsRes, pendingRes, outgoingRes] = await Promise.all([
      fetchFriends(uid),
      fetchPendingRequests(uid),
      fetchOutgoingPendingRequests(uid),
    ]);
    if (!friendsRes.error) {
      setFriends((friendsRes.data as Array<{ id: string; profile: ProfileRow | null }>).map((r) => ({ id: r.id, profile: r.profile })));
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

  async function handleSearch() {
    setMessage(''); setErrMsg('');
    const res = await searchProfilesByUsername(userId, search);
    if (res.error) { setErrMsg(res.error.message); return; }
    setResults(res.data);
  }

  async function handleFriendAction(target: ProfileRow) {
    if (outgoingIds.has(target.id)) { setErrMsg('You already have a pending request to this user.'); return; }
    const isFriend = await areFriends(userId, target.id);
    if (isFriend.error) { setErrMsg(isFriend.error.message); return; }
    if (isFriend.value) {
      const r = await unfollowUser({ currentUserId: userId, targetUserId: target.id });
      if (r.error) { setErrMsg(r.error.message); return; }
      setMessage('Unfollowed.'); load(userId); return;
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
    if (alertText.length > 250) { setErrMsg('Message must be 250 characters or less.'); return; }
    if (rlLimited(MSG_TOTAL_KEY, MSG_TOTAL_MAX, 'day')) {
      setErrMsg(`Daily message limit reached (${MSG_TOTAL_MAX}/day). Resets at ${rlResetLabel('day')}.`); return;
    }
    if (rlLimited(msgFriendKey(alertTargetId), MSG_FRIEND_MAX, 'day')) {
      setErrMsg(`You've already sent ${MSG_FRIEND_MAX} messages to this person today.`); return;
    }
    try {
      await sendWorkoutAlert(userId, [alertTargetId], alertText.trim());
      rlIncrement(MSG_TOTAL_KEY, 'day');
      rlIncrement(msgFriendKey(alertTargetId), 'day');
      setMessage('Workout alert sent!');
      setAlertTargetId(null); setAlertText('');
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Failed to send alert');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>Friends</h2>

      {/* Search bar */}
      <div style={{ position: 'relative' }}>
        <UserSearch size={16} strokeWidth={1.5} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
        <input
          className="form-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find friends by username…"
          style={{ paddingLeft: 40 }}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
      </div>

      {errMsg   && <Toast text={errMsg} variant="error" />}
      {message  && <Toast text={message} />}

      {/* Search results */}
      {results.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
              <div key={profile.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: avatarBg(profile.username ?? 'u'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>
                  {(profile.username || '?').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 2px', color: 'var(--text-primary)' }}>{profile.username ?? 'Unnamed'}</p>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{isPrivate ? 'Private account' : 'Public account'}</p>
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

      {/* Pending requests */}
      {pending.length > 0 && (
        <div className="card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pending ({pending.length})
          </p>
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
      )}

      {/* Friends list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {friends.length === 0 ? (
          <p style={{ padding: '16px 20px', fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            No friends yet — search above.
          </p>
        ) : (
          friends.map((f, i) => {
            if (!f.profile) return null;
            const p = f.profile;
            const bg = avatarBg(p.username ?? 'u');
            return (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < friends.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>
                  {(p.username || '?').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>{p.username ?? 'Unnamed'}</p>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                    {p.privacy_mode === 'private' ? 'Private account' : 'Public account'}
                  </p>
                </div>
                {alertTargetId === p.id ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <input
                        value={alertText}
                        onChange={(e) => setAlertText(e.target.value.slice(0, 250))}
                        placeholder="Alert message…"
                        maxLength={250}
                        style={{ height: 34, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13, width: 160, fontFamily: 'inherit' }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendAlert()}
                        autoFocus
                      />
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>{alertText.length}/250</span>
                    </div>
                    <button type="button" onClick={handleSendAlert} title="Send"
                      style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--text-on-lime)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Send size={14} />
                    </button>
                    <button type="button" onClick={() => { setAlertTargetId(null); setAlertText(''); }} title="Cancel"
                      style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setAlertTargetId(p.id)}
                    className="btn btn-ghost"
                    style={{ height: 34, padding: '0 12px', fontSize: 12 }}>
                    <Bell size={13} /> Alert
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

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
    await markNotificationRead(id);
    load(userId);
  }

  async function handleFriendRequestNotif(n: NotificationRow, accept: boolean) {
    await respondToFriendRequest({
      currentUserId: userId,
      request: { id: n.id, requester_id: n.actor_id ?? '', receiver_id: userId, status: 'pending', created_at: n.created_at, responded_at: null },
      accept,
    });
    load(userId);
  }

  async function handleGymInviteAccept(notifId: string) {
    await acceptGymInvite(notifId, userId);
    load(userId);
  }

  async function handleGymInviteDecline(notifId: string) {
    await declineGymInvite(notifId);
    load(userId);
  }

  if (errMsg) return <Toast text={errMsg} variant="error" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Alerts &amp; notifications</h2>

      {notifications.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bell size={24} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>All caught up</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>No notifications yet.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {notifications.map((n, i) => {
            const isLast = i === notifications.length - 1;
            const rowStyle: React.CSSProperties = {
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 20px',
              borderBottom: isLast ? 'none' : '1px solid var(--border)',
              background: n.read_at ? 'transparent' : 'color-mix(in srgb, var(--accent) 4%, var(--bg-card))',
            };

            if (n.type === 'friend_request_received') {
              return (
                <div key={n.id} style={rowStyle}>
                  <NotifIconCircle type={n.type} actorId={n.actor_id} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: '0 0 4px', lineHeight: 1.4 }}>
                      <strong>{(n.actor_id ?? '').slice(0, 8)}</strong> sent a friend request
                    </p>
                    <p suppressHydrationWarning style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 10px' }}>
                      {new Date(n.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                    {!n.read_at && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn btn-secondary"
                          style={{ height: 32, padding: '0 14px', fontSize: 13 }}
                          onClick={() => handleFriendRequestNotif(n, true)}>
                          Accept
                        </button>
                        <button type="button" className="btn btn-ghost"
                          style={{ height: 32, padding: '0 14px', fontSize: 13 }}
                          onClick={() => handleFriendRequestNotif(n, false)}>
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            if (n.type === 'gym_invite') {
              const canAct = n.invite_status === null || n.invite_status === undefined;
              return (
                <div key={n.id} style={rowStyle}>
                  <NotifIconCircle type={n.type} actorId={n.actor_id} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: '0 0 4px', lineHeight: 1.4 }}>
                      <strong>{(n.actor_id ?? '').slice(0, 8)}</strong> — Gym invite
                    </p>
                    {(n.invite_exercise_id ?? n.invite_date) && (
                      <p suppressHydrationWarning style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 10px' }}>
                        {n.invite_exercise_id?.replace(/_/g, ' ')}
                        {n.invite_exercise_id && n.invite_date && ' · '}
                        {n.invite_date && new Date(n.invite_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                    )}
                    {canAct && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn btn-secondary"
                          style={{ height: 32, padding: '0 14px', fontSize: 13 }}
                          onClick={() => handleGymInviteAccept(n.id)}>
                          Accept
                        </button>
                        <button type="button" className="btn btn-ghost"
                          style={{ height: 32, padding: '0 14px', fontSize: 13 }}
                          onClick={() => handleGymInviteDecline(n.id)}>
                          Decline
                        </button>
                      </div>
                    )}
                    {n.invite_status === 'accepted' && (
                      <span style={{ fontSize: 12, color: 'var(--accent)' }}>✓ Accepted</span>
                    )}
                    {n.invite_status === 'declined' && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Declined</span>
                    )}
                  </div>
                </div>
              );
            }

            if (n.type === 'workout_alert') {
              return (
                <div key={n.id} style={rowStyle}>
                  <NotifIconCircle type={n.type} actorId={n.actor_id} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: '0 0 4px', lineHeight: 1.4 }}>
                      <strong>{(n.actor_id ?? '').slice(0, 8)}</strong> sent a workout alert
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 4px', fontStyle: 'italic' }}>
                      &ldquo;{n.message}&rdquo;
                    </p>
                    <p suppressHydrationWarning style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!n.read_at && (
                    <button type="button" className="btn btn-ghost"
                      style={{ height: 32, padding: '0 12px', fontSize: 12, flexShrink: 0 }}
                      onClick={() => handleMarkRead(n.id)}>
                      Dismiss
                    </button>
                  )}
                </div>
              );
            }

            // friend_request_accepted + fallback
            return (
              <div key={n.id} style={rowStyle}>
                <NotifIconCircle type={n.type} actorId={n.actor_id} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: '0 0 4px', lineHeight: 1.4 }}>{n.message}</p>
                  <p suppressHydrationWarning style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
                {!n.read_at && (
                  <button type="button" className="btn btn-ghost"
                    style={{ height: 32, padding: '0 12px', fontSize: 12, flexShrink: 0 }}
                    onClick={() => handleMarkRead(n.id)}>
                    Dismiss
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const [userId,      setUserId]      = useState<string | null>(null);
  const [email,       setEmail]       = useState('');
  const [username,    setUsername]    = useState('');
  const [tier,        setTier]        = useState<'free' | 'pro'>('free');
  const [tab,         setTab]         = useState<Tab>('account');
  const [friendCount, setFriendCount] = useState(0);
  const [following,   setFollowing]   = useState(0);
  const [followers,   setFollowers]   = useState(0);

  const xpTotal = useXPStore(s => s.xpTotal);
  const xpLvl   = useXPStore(s => s.xpLevel);

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      setEmail(data.user.email ?? '');

      const [planTier, profileRes, countRes] = await Promise.all([
        fetchPlanTier(data.user.id),
        fetchMyProfile(data.user.id, data.user.email ?? null),
        fetchFriendCounts(data.user.id),
      ]);
      setTier(planTier);
      if (!profileRes.error && profileRes.data) setUsername(profileRes.data.username ?? '');
      if (!countRes.error) {
        const friendsRes = await fetchFriends(data.user.id);
        if (!friendsRes.error) setFriendCount(friendsRes.data.length);
        setFollowing(countRes.data.following);
        setFollowers(countRes.data.followers);
      }
    })();
  }, []);

  const initials = (username || email || '?').slice(0, 2).toUpperCase();

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: 'account', label: 'Account', icon: <User  size={15} /> },
    { id: 'social',  label: 'Social',  icon: <Users size={15} /> },
    { id: 'alerts',  label: 'Alerts',  icon: <Bell  size={15} /> },
  ];

  return (
    <AuthGate>
      <div className="profile-page-col">

        {/* Profile header */}
        <div className="profile-header">
          <div className="avatar-placeholder-lg">{initials}</div>
          <p className="profile-name">{username || 'Set a username'}</p>
          <p className="profile-handle">{email}</p>
          <span className={tier === 'pro' ? 'tag tag-lime' : 'tag tag-dark'}>
            {tier === 'pro' ? 'Pro' : 'Free plan'}
          </span>
        </div>

        {/* XP / Level card */}
        {(() => {
          const color  = xpLevelColor(xpLvl);
          const glow   = xpLevelGlow(xpLvl);
          const pct    = Math.round(xpProgress(xpTotal, xpLvl) * 100);
          const toNext = xpToNextLevel(xpTotal, xpLvl);
          return (
            <div className="card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 14,
                    background: `${color}18`,
                    border: `1.5px solid ${color}`,
                    boxShadow: glow !== 'none' ? glow : undefined,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.04em', textTransform: 'uppercase', opacity: 0.8 }}>LV</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>{xpLvl}</span>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Level {xpLvl}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                      {xpTotal.toLocaleString()} XP total
                    </p>
                  </div>
                </div>
                {xpLvl < 50 && (
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>to next level</p>
                    <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color }}>
                      {toNext.toLocaleString()} XP
                    </p>
                  </div>
                )}
                {xpLvl >= 50 && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#FFD700' }}>Max Level</span>
                )}
              </div>

              {/* Progress bar */}
              <div style={{ height: 7, borderRadius: 4, background: 'var(--bg-input)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: color, borderRadius: 4,
                  transition: 'width 0.6s ease',
                  boxShadow: glow !== 'none' ? `0 0 8px ${color}60` : undefined,
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Level {xpLvl}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color }}>{pct}%</span>
                {xpLvl < 50 && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Level {xpLvl + 1}</span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Stats bar */}
        <div className="stats-highlight-card">
          {[
            { label: 'Friends',   value: friendCount },
            { label: 'Following', value: following },
            { label: 'Followers', value: followers },
          ].map(({ label, value }, i) => (
            <div key={label} style={{ display: 'flex', flex: 1, alignItems: 'stretch' }}>
              {i > 0 && <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch' }} />}
              <div style={{ textAlign: 'center', flex: 1 }}>
                <p className="stats-highlight-value">{value}</p>
                <p className="stats-highlight-label">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {tabs.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 6, padding: '12px 0', border: 'none',
                borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
                background: 'transparent',
                color: tab === id ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 13, fontWeight: tab === id ? 600 : 400,
                cursor: 'pointer', transition: 'color 0.15s', marginBottom: -1,
                fontFamily: 'inherit',
              }}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {userId && tab === 'account' && (
            <AccountTab
              userId={userId}
              email={email}
              username={username}
              tier={tier}
              onUsernameChange={setUsername}
            />
          )}
          {userId && tab === 'social'  && <SocialTab  userId={userId} />}
          {userId && tab === 'alerts'  && <AlertsTab  userId={userId} />}
        </div>

      </div>
    </AuthGate>
  );
}
