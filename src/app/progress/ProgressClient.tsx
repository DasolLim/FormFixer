'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  upsertJournalEntry, fetchJournalEntries, fetchJournalEntryByDate,
  deleteJournalEntry, fetchTodayWorkoutSession,
  uploadProgressPhoto, fetchProgressPhotos, deleteProgressPhoto,
  upsertWeightLog, fetchWeightLogs, fetchRecentWeightLogs, deleteWeightLog,
} from '@/lib/progress/sessions';
import type { JournalEntry, ProgressPhoto, WeightLog, WeightUnit, WeightDataPoint } from '@/lib/progress/types';
import { Trash2, Upload, TrendingUp, BookOpen, Camera, Scale, Flame } from 'lucide-react';
import { CalorieBurnCard } from '@/app/nutrition/CalorieBurnCard';

// ── Date helpers ──────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fmtDateFull(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ProgressClientProps {
  userId: string;
  defaultWeightUnit: WeightUnit;
}

// ── Section nav items ─────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'burn',    label: 'Calorie Burn', icon: Flame },
  { id: 'journal', label: 'Journal',      icon: BookOpen },
  { id: 'photos',  label: 'Photos',       icon: Camera },
  { id: 'graph',   label: 'Weight',       icon: TrendingUp },
  { id: 'log',     label: 'Log',          icon: Scale },
] as const;

type SectionId = typeof SECTIONS[number]['id'];

// ── Weight trend ──────────────────────────────────────────────────────────────

function getTrend(data: WeightDataPoint[], unit: WeightUnit): string {
  if (data.length < 2) return '';
  const first = data[0].weight;
  const last  = data[data.length - 1].weight;
  const diff  = last - first;
  const sign  = diff > 0 ? '↑' : '↓';
  const abs   = Math.abs(diff).toFixed(1);
  return `${sign} ${abs} ${unit} over this period`;
}

// ── ALLOWED FILE TYPES ────────────────────────────────────────────────────────

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// ── Main component ────────────────────────────────────────────────────────────

export function ProgressClient({ userId, defaultWeightUnit }: ProgressClientProps) {
  const [activeSection, setActiveSection] = useState<SectionId>('burn');

  // ── Journal state ─────────────────────────────────────────────────────────
  const [journalContent,     setJournalContent]     = useState('');
  const [journalDate,        setJournalDate]         = useState(today());
  const [todaySessionId,     setTodaySessionId]      = useState<string | null>(null);
  const [pastEntries,        setPastEntries]         = useState<JournalEntry[]>([]);
  const [expandedEntry,      setExpandedEntry]       = useState<string | null>(null);
  const [journalSaving,      setJournalSaving]       = useState(false);
  const [journalMsg,         setJournalMsg]          = useState('');
  const [deleteEntryConfirm, setDeleteEntryConfirm]  = useState<string | null>(null);

  // ── Photo state ───────────────────────────────────────────────────────────
  const [photos,          setPhotos]          = useState<ProgressPhoto[]>([]);
  const [selectedFile,    setSelectedFile]    = useState<File | null>(null);
  const [uploadDate,      setUploadDate]      = useState(today());
  const [uploadNotes,     setUploadNotes]     = useState('');
  const [isUploading,     setIsUploading]     = useState(false);
  const [uploadError,     setUploadError]     = useState<string | null>(null);
  const [compareA,        setCompareA]        = useState('');
  const [compareB,        setCompareB]        = useState('');
  const [compareResult,   setCompareResult]   = useState<{ a: ProgressPhoto; b: ProgressPhoto } | null>(null);
  const [deletePhotoId,   setDeletePhotoId]   = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Weight graph state ────────────────────────────────────────────────────
  const [weightLogs,    setWeightLogs]    = useState<WeightLog[]>([]);
  const [weightRange,   setWeightRange]   = useState<'7d' | '30d' | '1yr'>('30d');
  const [weightUnit,    setWeightUnit]    = useState<WeightUnit>(defaultWeightUnit);
  const [graphLoading,  setGraphLoading]  = useState(false);

  // ── Log weight state ──────────────────────────────────────────────────────
  const [weightInput,    setWeightInput]    = useState('');
  const [weightLogDate,  setWeightLogDate]  = useState(today());
  const [recentLogs,     setRecentLogs]     = useState<WeightLog[]>([]);
  const [isLogging,      setIsLogging]      = useState(false);
  const [logMsg,         setLogMsg]         = useState('');
  const [deleteLogId,    setDeleteLogId]    = useState<string | null>(null);

  // ── Load journal on mount ─────────────────────────────────────────────────
  const loadJournal = useCallback(async () => {
    const [todayResult, pastResult, sessionId] = await Promise.all([
      fetchJournalEntryByDate(userId, today()),
      fetchJournalEntries(userId, daysAgo(30), today()),
      fetchTodayWorkoutSession(userId, today()),
    ]);
    if (todayResult.data) setJournalContent(todayResult.data.content);
    setPastEntries(pastResult.data);
    setTodaySessionId(sessionId);
  }, [userId]);

  // ── Load photos on mount ──────────────────────────────────────────────────
  const loadPhotos = useCallback(async () => {
    const { data } = await fetchProgressPhotos(userId);
    setPhotos(data);
  }, [userId]);

  // ── Load weight graph ─────────────────────────────────────────────────────
  const loadWeightGraph = useCallback(async (range: '7d' | '30d' | '1yr', unit: WeightUnit) => {
    setGraphLoading(true);
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 365;
    const { data } = await fetchWeightLogs(userId, daysAgo(days), today(), unit);
    setWeightLogs(data);
    setGraphLoading(false);
  }, [userId]);

  // ── Load recent weight logs ───────────────────────────────────────────────
  const loadRecentLogs = useCallback(async () => {
    const { data } = await fetchRecentWeightLogs(userId, 7);
    setRecentLogs(data);
  }, [userId]);

  useEffect(() => {
    loadJournal();
    loadPhotos();
    loadWeightGraph(weightRange, weightUnit);
    loadRecentLogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartData: WeightDataPoint[] = useMemo(() =>
    weightLogs.map(log => ({
      date:    fmtDate(log.log_date),
      weight:  weightUnit === 'lb' ? log.weight_lb : log.weight_kg,
      isoDate: log.log_date,
    })),
    [weightLogs, weightUnit],
  );

  const trend = getTrend(chartData, weightUnit);

  // ── Journal handlers ──────────────────────────────────────────────────────
  async function handleSaveJournal() {
    if (!journalContent.trim()) return;
    setJournalSaving(true);
    setJournalMsg('');
    const { error } = await upsertJournalEntry({
      userId,
      entryDate: journalDate,
      content: journalContent.trim(),
      workoutSessionId: todaySessionId,
    });
    setJournalSaving(false);
    if (error) { setJournalMsg('Save failed'); return; }
    setJournalMsg('Saved.');
    await loadJournal();
  }

  async function handleDeleteEntry(entryId: string) {
    const { error } = await deleteJournalEntry(userId, entryId);
    if (!error) {
      setDeleteEntryConfirm(null);
      setExpandedEntry(null);
      await loadJournal();
    }
  }

  // ── Photo handlers ────────────────────────────────────────────────────────
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setUploadError(null);
    if (!file) { setSelectedFile(null); return; }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError('Invalid file type. JPEG, PNG, or HEIC only.');
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('File too large. Maximum size is 5MB.');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  }

  async function handleUploadPhoto() {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadError(null);
    const { error } = await uploadProgressPhoto({
      userId,
      file: selectedFile,
      photoDate: uploadDate,
      notes: uploadNotes.trim() || null,
    });
    setIsUploading(false);
    if (error) { setUploadError(error); return; }
    setSelectedFile(null);
    setUploadNotes('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    await loadPhotos();
  }

  async function handleCompare() {
    if (!compareA || !compareB || compareA === compareB) return;
    const a = photos.find(p => p.id === compareA);
    const b = photos.find(p => p.id === compareB);
    if (a && b) setCompareResult({ a, b });
  }

  async function handleDeletePhoto(photoId: string, storagePath: string) {
    const { error } = await deleteProgressPhoto(userId, photoId, storagePath);
    if (!error) {
      setDeletePhotoId(null);
      setCompareResult(null);
      await loadPhotos();
    }
  }

  // ── Weight handlers ───────────────────────────────────────────────────────
  async function handleRangeChange(range: '7d' | '30d' | '1yr') {
    setWeightRange(range);
    await loadWeightGraph(range, weightUnit);
  }

  async function handleUnitChange(unit: WeightUnit) {
    setWeightUnit(unit);
    await loadWeightGraph(weightRange, unit);
  }

  async function handleLogWeight() {
    const val = parseFloat(weightInput);
    if (!val || val <= 0) return;
    setIsLogging(true);
    setLogMsg('');
    const kg = weightUnit === 'lb' ? Math.round(val * 0.453592 * 100) / 100 : val;
    const { error } = await upsertWeightLog({ userId, logDate: weightLogDate, weightKg: kg });
    setIsLogging(false);
    if (error) { setLogMsg('Log failed'); return; }
    setLogMsg('Logged.');
    setWeightInput('');
    await Promise.all([loadRecentLogs(), loadWeightGraph(weightRange, weightUnit)]);
  }

  async function handleDeleteLog(logId: string) {
    const { error } = await deleteWeightLog(userId, logId);
    if (!error) {
      setDeleteLogId(null);
      await Promise.all([loadRecentLogs(), loadWeightGraph(weightRange, weightUnit)]);
    }
  }

  // ── Shared style atoms ────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '18px 20px',
    marginBottom: 16,
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px',
  };

  const fieldLabel: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
    display: 'block', marginBottom: 4,
  };

  const charCount = journalContent.length;
  const charColor = charCount >= 250 ? 'var(--danger)' : charCount >= 220 ? '#f59e0b' : 'var(--text-muted)';

  return (
    <div className="ui-section" style={{ maxWidth: 800, margin: '0 auto' }}>

      {/* Section tab nav */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {SECTIONS.map(({ id, label, icon: Icon }) => {
          const isActive = activeSection === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSection(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 16px',
                background: 'transparent', border: 'none',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13, fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                marginBottom: -1,
                transition: 'color 0.15s ease, border-color 0.15s ease',
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </div>

      {/* ══ SECTION 0 — Calorie Burn ════════════════════════════════════════ */}
      {activeSection === 'burn' && (
        <div>
          <CalorieBurnCard userId={userId} />
        </div>
      )}

      {/* ══ SECTION 1 — Journal ══════════════════════════════════════════════ */}
      {activeSection === 'journal' && (
        <div>
          <div style={card}>
            <p style={sectionTitle}>Today&apos;s Journal Entry</p>
            {todaySessionId && (
              <p style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, margin: '-8px 0 12px' }}>
                Linked to today&apos;s workout session
              </p>
            )}
            <label style={fieldLabel}>
              Date
              <input
                type="date"
                value={journalDate}
                onChange={e => setJournalDate(e.target.value)}
                className="form-input"
                style={{ marginTop: 4, marginBottom: 12 }}
              />
            </label>
            <textarea
              value={journalContent}
              onChange={e => setJournalContent(e.target.value.slice(0, 250))}
              placeholder="How did your workout feel? Any notes on form, energy, or progress…"
              maxLength={250}
              rows={4}
              className="form-input"
              style={{ resize: 'vertical', width: '100%', fontFamily: 'inherit', fontSize: 14 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <span style={{ fontSize: 11, color: charColor }}>{250 - charCount} characters remaining</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {journalMsg && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{journalMsg}</span>}
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ height: 34, padding: '0 16px', fontSize: 13 }}
                  onClick={handleSaveJournal}
                  disabled={journalSaving || !journalContent.trim()}
                >
                  {journalSaving ? 'Saving…' : 'Save Entry'}
                </button>
              </div>
            </div>
          </div>

          {/* Past entries */}
          <div style={card}>
            <p style={sectionTitle}>Past Entries</p>
            {pastEntries.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No entries in the last 30 days.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {pastEntries.map(entry => {
                  const isExpanded = expandedEntry === entry.id;
                  return (
                    <div
                      key={entry.id}
                      style={{
                        borderRadius: 10, overflow: 'hidden',
                        border: '1px solid var(--border)',
                        background: isExpanded ? 'var(--bg-input)' : 'transparent',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center',
                          justifyContent: 'space-between', gap: 12,
                          padding: '10px 14px', background: 'transparent',
                          border: 'none', cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                          {fmtDateFull(entry.entry_date)}
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isExpanded ? 'normal' : 'nowrap' }}>
                          {isExpanded ? entry.content : entry.content.slice(0, 80) + (entry.content.length > 80 ? '…' : '')}
                        </span>
                      </button>
                      {isExpanded && (
                        <div style={{ padding: '0 14px 12px', display: 'flex', justifyContent: 'flex-end' }}>
                          {deleteEntryConfirm === entry.id ? (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Delete this entry? This cannot be undone.</span>
                              <button type="button" className="btn btn-ghost" style={{ height: 28, fontSize: 11 }} onClick={() => setDeleteEntryConfirm(null)}>Cancel</button>
                              <button type="button" className="btn btn-primary" style={{ height: 28, fontSize: 11, background: 'var(--danger)' }} onClick={() => handleDeleteEntry(entry.id)}>Delete</button>
                            </div>
                          ) : (
                            <button type="button" className="btn btn-ghost" style={{ height: 28, fontSize: 11 }} onClick={() => setDeleteEntryConfirm(entry.id)}>
                              <Trash2 size={12} /> Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ SECTION 2 — Photos ══════════════════════════════════════════════ */}
      {activeSection === 'photos' && (
        <div>
          {/* Upload */}
          <div style={card}>
            <p style={sectionTitle}>This Week&apos;s Photo</p>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${selectedFile ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 12, padding: '28px 20px', textAlign: 'center',
                cursor: 'pointer', marginBottom: 12,
                background: selectedFile ? 'var(--accent-muted)' : 'var(--bg-input)',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <Upload size={24} color={selectedFile ? 'var(--accent)' : 'var(--text-muted)'} style={{ marginBottom: 8 }} />
              <p style={{ fontSize: 13, color: selectedFile ? 'var(--accent)' : 'var(--text-secondary)', margin: 0, fontWeight: selectedFile ? 600 : 400 }}>
                {selectedFile ? selectedFile.name : 'Drag & drop or click to upload'}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                PNG, JPEG, or HEIC · Max 5MB
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/heic,image/heif"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            {uploadError && (
              <p style={{ fontSize: 12, color: 'var(--danger)', margin: '-4px 0 12px' }}>{uploadError}</p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <label style={fieldLabel}>
                Date
                <input
                  type="date"
                  value={uploadDate}
                  onChange={e => setUploadDate(e.target.value)}
                  className="form-input"
                  style={{ marginTop: 4 }}
                />
              </label>
              <label style={fieldLabel}>
                Notes (optional)
                <input
                  value={uploadNotes}
                  onChange={e => setUploadNotes(e.target.value.slice(0, 250))}
                  placeholder="e.g. Morning, fasted"
                  className="form-input"
                  style={{ marginTop: 4 }}
                />
              </label>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-full"
              onClick={handleUploadPhoto}
              disabled={!selectedFile || isUploading}
            >
              <Upload size={14} />
              {isUploading ? 'Uploading…' : 'Upload Photo'}
            </button>
          </div>

          {/* Compare */}
          {photos.length >= 2 && (
            <div style={card}>
              <p style={sectionTitle}>Compare Progress</p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                <select
                  value={compareA}
                  onChange={e => setCompareA(e.target.value)}
                  className="exercise-select"
                  style={{ flex: 1, minWidth: 140 }}
                >
                  <option value="">Select photo A</option>
                  {photos.map(p => (
                    <option key={p.id} value={p.id}>Week {p.week_number} — {fmtDate(p.photo_date)}</option>
                  ))}
                </select>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>vs</span>
                <select
                  value={compareB}
                  onChange={e => setCompareB(e.target.value)}
                  className="exercise-select"
                  style={{ flex: 1, minWidth: 140 }}
                >
                  <option value="">Select photo B</option>
                  {photos.map(p => (
                    <option key={p.id} value={p.id}>Week {p.week_number} — {fmtDate(p.photo_date)}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCompare}
                  disabled={!compareA || !compareB || compareA === compareB}
                >
                  Compare
                </button>
              </div>

              {compareResult && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[compareResult.a, compareResult.b].map(photo => (
                    <div key={photo.id}>
                      <div style={{
                        aspectRatio: '3/4', borderRadius: 10, overflow: 'hidden',
                        background: 'var(--bg-input)',
                      }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.signed_url}
                          alt={`Week ${photo.week_number}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', margin: '6px 0 2px' }}>
                        Week {photo.week_number}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{fmtDateFull(photo.photo_date)}</p>
                      {photo.notes && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0' }}>{photo.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Photo history grid */}
          {photos.length > 0 && (
            <div style={card}>
              <p style={sectionTitle}>Photo History</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {photos.map(photo => (
                  <div key={photo.id} style={{ position: 'relative' }}>
                    <div style={{
                      aspectRatio: '3/4', borderRadius: 10, overflow: 'hidden',
                      background: 'var(--bg-input)', position: 'relative', cursor: 'pointer',
                    }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.signed_url}
                        alt={`Week ${photo.week_number}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {/* Hover overlay */}
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)',
                        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                        padding: '8px 10px',
                      }}>
                        <span style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>Wk {photo.week_number}</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)' }}>{fmtDate(photo.photo_date)}</span>
                      </div>
                    </div>
                    {/* Delete button */}
                    {deletePhotoId === photo.id ? (
                      <div style={{
                        position: 'absolute', inset: 0, borderRadius: 10,
                        background: 'rgba(0,0,0,0.75)',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10,
                      }}>
                        <p style={{ fontSize: 11, color: '#fff', textAlign: 'center', margin: 0 }}>Delete this photo?</p>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button type="button" className="btn btn-ghost" style={{ height: 28, fontSize: 10 }} onClick={() => setDeletePhotoId(null)}>Cancel</button>
                          <button type="button" className="btn btn-primary" style={{ height: 28, fontSize: 10, background: 'var(--danger)' }} onClick={() => handleDeletePhoto(photo.id, photo.storage_path)}>Delete</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeletePhotoId(photo.id)}
                        style={{
                          position: 'absolute', top: 6, right: 6,
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'rgba(0,0,0,0.5)', border: 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={12} color="#fff" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {photos.length === 0 && (
            <div style={{ ...card, textAlign: 'center', padding: '32px 20px' }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No progress photos yet. Upload your first one above.</p>
            </div>
          )}
        </div>
      )}

      {/* ══ SECTION 3 — Weight Graph ═════════════════════════════════════════ */}
      {activeSection === 'graph' && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            <p style={{ ...sectionTitle, margin: 0 }}>Weight History</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* Unit toggle */}
              <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                {(['kg', 'lb'] as WeightUnit[]).map(u => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => handleUnitChange(u)}
                    style={{
                      padding: '5px 12px', border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                      background: weightUnit === u ? 'var(--accent)' : 'var(--bg-input)',
                      color: weightUnit === u ? 'var(--text-on-lime)' : 'var(--text-secondary)',
                    }}
                  >
                    {u}
                  </button>
                ))}
              </div>
              {/* Range buttons */}
              <div style={{ display: 'flex', gap: 4 }}>
                {(['7d', '30d', '1yr'] as const).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleRangeChange(r)}
                    style={{
                      padding: '5px 10px', borderRadius: 6, border: 'none',
                      cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      fontFamily: 'inherit',
                      background: weightRange === r ? 'var(--accent)' : 'var(--bg-input)',
                      color: weightRange === r ? 'var(--text-on-lime)' : 'var(--text-secondary)',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {graphLoading ? (
            <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>
            </div>
          ) : chartData.length === 0 ? (
            <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No weight data for this period. Log your weight to get started.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                  tickLine={false}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={false}
                  unit={weightUnit === 'kg' ? ' kg' : ' lb'}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [`${value} ${weightUnit}`, 'Weight']}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: 'var(--accent)', strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          {trend && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '10px 0 0', textAlign: 'center' }}>
              {trend}
            </p>
          )}
        </div>
      )}

      {/* ══ SECTION 4 — Log Weight ══════════════════════════════════════════ */}
      {activeSection === 'log' && (
        <div>
          <div style={card}>
            <p style={sectionTitle}>Log Your Weight</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 12, alignItems: 'end' }}>
              <label style={fieldLabel}>
                Weight
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <input
                    type="number"
                    min={10}
                    max={500}
                    step={0.1}
                    value={weightInput}
                    onChange={e => setWeightInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogWeight()}
                    placeholder={`e.g. ${weightUnit === 'kg' ? '75.0' : '165.0'}`}
                    className="form-input"
                    style={{ flex: 1 }}
                  />
                  <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
                    {(['kg', 'lb'] as WeightUnit[]).map(u => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setWeightUnit(u)}
                        style={{
                          padding: '0 12px', border: 'none', cursor: 'pointer',
                          fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                          background: weightUnit === u ? 'var(--accent)' : 'var(--bg-input)',
                          color: weightUnit === u ? 'var(--text-on-lime)' : 'var(--text-secondary)',
                        }}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </label>
              <label style={fieldLabel}>
                Date
                <input
                  type="date"
                  value={weightLogDate}
                  onChange={e => setWeightLogDate(e.target.value)}
                  className="form-input"
                  style={{ marginTop: 4 }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleLogWeight}
                disabled={isLogging || !weightInput}
              >
                {isLogging ? 'Logging…' : 'Log Weight'}
              </button>
              {logMsg && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{logMsg}</span>}
            </div>
          </div>

          {/* Recent entries */}
          {recentLogs.length > 0 && (
            <div style={card}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Recent entries
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {recentLogs.map(log => (
                  <div
                    key={log.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '9px 12px', borderRadius: 8, background: 'var(--bg-input)',
                    }}
                  >
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtDate(log.log_date)}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {weightUnit === 'lb' ? `${log.weight_lb} lb` : `${log.weight_kg} kg`}
                    </span>
                    {deleteLogId === log.id ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button type="button" className="btn btn-ghost" style={{ height: 26, fontSize: 11 }} onClick={() => setDeleteLogId(null)}>Cancel</button>
                        <button type="button" className="btn btn-ghost" style={{ height: 26, fontSize: 11, color: 'var(--danger)' }} onClick={() => handleDeleteLog(log.id)}>Remove</button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteLogId(log.id)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px', color: 'var(--text-muted)' }}
                        title="Remove this weight log? The graph will update."
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
