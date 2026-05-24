import { getSupabaseClient } from '@/lib/supabaseClient';
import type { JournalEntry, ProgressPhoto, WeightLog, WeightUnit } from './types';

const LB_PER_KG = 2.20462;

function toWeightLog(row: { id: string; log_date: string; weight_kg: number; created_at: string }): WeightLog {
  return {
    id:         row.id,
    log_date:   row.log_date,
    weight_kg:  row.weight_kg,
    weight_lb:  Math.round(row.weight_kg * LB_PER_KG * 10) / 10,
    created_at: row.created_at,
  };
}

function getISOWeek(dateStr: string): { week: number; year: number } {
  const d = new Date(dateStr);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return {
    week: 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7),
    year: d.getUTCFullYear(),
  };
}

// ── Journal ──────────────────────────────────────────────────────────────────

export async function upsertJournalEntry(payload: {
  userId: string;
  entryDate: string;
  content: string;
  workoutSessionId?: string | null;
}): Promise<{ data: JournalEntry | null; error: Error | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('journal_entries')
    .upsert(
      {
        user_id:            payload.userId,
        entry_date:         payload.entryDate,
        content:            payload.content,
        workout_session_id: payload.workoutSessionId ?? null,
        updated_at:         new Date().toISOString(),
      },
      { onConflict: 'user_id,entry_date' },
    )
    .select()
    .single();
  return { data: data as JournalEntry | null, error: error as Error | null };
}

export async function fetchJournalEntries(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<{ data: JournalEntry[]; error: Error | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id,workout_session_id,entry_date,content,created_at,updated_at')
    .eq('user_id', userId)
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .order('entry_date', { ascending: false });
  return { data: (data ?? []) as JournalEntry[], error: error as Error | null };
}

export async function fetchJournalEntryByDate(
  userId: string,
  entryDate: string,
): Promise<{ data: JournalEntry | null; error: Error | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id,workout_session_id,entry_date,content,created_at,updated_at')
    .eq('user_id', userId)
    .eq('entry_date', entryDate)
    .maybeSingle();
  return { data: data as JournalEntry | null, error: error as Error | null };
}

export async function deleteJournalEntry(
  userId: string,
  entryId: string,
): Promise<{ error: Error | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId);
  return { error: error as Error | null };
}

export async function fetchTodayWorkoutSession(
  userId: string,
  today: string,
): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('workout_sessions')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', `${today}T00:00:00.000Z`)
    .lte('created_at', `${today}T23:59:59.999Z`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

// ── Progress Photos ───────────────────────────────────────────────────────────

export async function uploadProgressPhoto(payload: {
  userId: string;
  file: File;
  photoDate: string;
  notes: string | null;
}): Promise<{ data: ProgressPhoto | null; error: string | null }> {
  const supabase = getSupabaseClient();
  const { week, year } = getISOWeek(payload.photoDate);

  // Check for existing photo this week
  const { data: existing } = await supabase
    .from('progress_photos')
    .select('id')
    .eq('user_id', payload.userId)
    .eq('week_number', week)
    .eq('year', year)
    .maybeSingle();

  if (existing) {
    return {
      data: null,
      error: 'You already have a photo for this week. Delete the existing one to replace it.',
    };
  }

  // Derive extension
  const ext = payload.file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const photoId = crypto.randomUUID();
  const storagePath = `${payload.userId}/${photoId}.${ext}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('progress-photos')
    .upload(storagePath, payload.file, { contentType: payload.file.type, upsert: false });

  if (uploadError) {
    return { data: null, error: uploadError.message };
  }

  // Generate 7-day signed URL
  const { data: urlData, error: urlError } = await supabase.storage
    .from('progress-photos')
    .createSignedUrl(storagePath, 7 * 24 * 60 * 60);

  if (urlError || !urlData?.signedUrl) {
    return { data: null, error: urlError?.message ?? 'Failed to generate signed URL' };
  }

  const signedUrlExp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from('progress_photos')
    .insert({
      user_id:        payload.userId,
      photo_date:     payload.photoDate,
      storage_path:   storagePath,
      signed_url:     urlData.signedUrl,
      signed_url_exp: signedUrlExp,
      week_number:    week,
      year,
      notes:          payload.notes,
    })
    .select()
    .single();

  if (insertError) {
    // Clean up storage on DB failure
    await supabase.storage.from('progress-photos').remove([storagePath]);
    return { data: null, error: insertError.message };
  }

  return { data: inserted as ProgressPhoto, error: null };
}

export async function fetchProgressPhotos(
  userId: string,
): Promise<{ data: ProgressPhoto[]; error: Error | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('progress_photos')
    .select('id,photo_date,storage_path,signed_url,signed_url_exp,week_number,year,notes,created_at')
    .eq('user_id', userId)
    .order('photo_date', { ascending: false })
    .limit(52);

  if (error || !data) return { data: [], error: error as Error | null };

  // Refresh expiring signed URLs (< 1 day remaining)
  const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const refreshed = await Promise.all(
    data.map(async (row) => {
      if (!row.signed_url_exp || row.signed_url_exp < cutoff) {
        const { data: urlData } = await supabase.storage
          .from('progress-photos')
          .createSignedUrl(row.storage_path, 7 * 24 * 60 * 60);
        if (urlData?.signedUrl) {
          const exp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          await supabase
            .from('progress_photos')
            .update({ signed_url: urlData.signedUrl, signed_url_exp: exp })
            .eq('id', row.id);
          return { ...row, signed_url: urlData.signedUrl, signed_url_exp: exp };
        }
      }
      return row;
    }),
  );

  return { data: (refreshed.filter(p => p.signed_url) as unknown) as ProgressPhoto[], error: null };
}

export async function deleteProgressPhoto(
  userId: string,
  photoId: string,
  storagePath: string,
): Promise<{ error: Error | null }> {
  const supabase = getSupabaseClient();
  await supabase.storage.from('progress-photos').remove([storagePath]);
  const { error } = await supabase
    .from('progress_photos')
    .delete()
    .eq('id', photoId)
    .eq('user_id', userId);
  return { error: error as Error | null };
}

// ── Weight Logs ───────────────────────────────────────────────────────────────

export async function upsertWeightLog(payload: {
  userId: string;
  logDate: string;
  weightKg: number;
}): Promise<{ data: WeightLog | null; error: Error | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('weight_logs')
    .upsert(
      { user_id: payload.userId, log_date: payload.logDate, weight_kg: payload.weightKg },
      { onConflict: 'user_id,log_date' },
    )
    .select()
    .single();
  return {
    data: data ? toWeightLog(data as { id: string; log_date: string; weight_kg: number; created_at: string }) : null,
    error: error as Error | null,
  };
}

export async function fetchWeightLogs(
  userId: string,
  startDate: string,
  endDate: string,
  unit: WeightUnit = 'kg',
): Promise<{ data: WeightLog[]; error: Error | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('weight_logs')
    .select('id,log_date,weight_kg,created_at')
    .eq('user_id', userId)
    .gte('log_date', startDate)
    .lte('log_date', endDate)
    .order('log_date', { ascending: true });

  const logs = (data ?? []).map(row =>
    toWeightLog(row as { id: string; log_date: string; weight_kg: number; created_at: string })
  );

  // If unit=lb, returned weight_lb is already computed in toWeightLog; chart uses the correct field
  void unit; // unit is used by callers to choose which field to display

  return { data: logs, error: error as Error | null };
}

export async function fetchLatestWeightLog(
  userId: string,
): Promise<{ data: WeightLog | null; error: Error | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('weight_logs')
    .select('id,log_date,weight_kg,created_at')
    .eq('user_id', userId)
    .order('log_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    data: data ? toWeightLog(data as { id: string; log_date: string; weight_kg: number; created_at: string }) : null,
    error: error as Error | null,
  };
}

export async function fetchRecentWeightLogs(
  userId: string,
  limit = 7,
): Promise<{ data: WeightLog[]; error: Error | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('weight_logs')
    .select('id,log_date,weight_kg,created_at')
    .eq('user_id', userId)
    .order('log_date', { ascending: false })
    .limit(limit);
  return {
    data: (data ?? []).map(row =>
      toWeightLog(row as { id: string; log_date: string; weight_kg: number; created_at: string })
    ),
    error: error as Error | null,
  };
}

export async function deleteWeightLog(
  userId: string,
  logId: string,
): Promise<{ error: Error | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('weight_logs')
    .delete()
    .eq('id', logId)
    .eq('user_id', userId);
  return { error: error as Error | null };
}
