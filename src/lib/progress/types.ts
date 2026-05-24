export interface JournalEntry {
  id:                 string;
  workout_session_id: string | null;
  entry_date:         string;
  content:            string;
  created_at:         string;
  updated_at:         string;
}

export interface ProgressPhoto {
  id:           string;
  photo_date:   string;
  signed_url:   string;
  storage_path: string;
  week_number:  number;
  year:         number;
  notes:        string | null;
  created_at:   string;
}

export interface WeightLog {
  id:         string;
  log_date:   string;
  weight_kg:  number;
  weight_lb:  number;
  created_at: string;
}

export interface PhotoCompareResponse {
  photo_a: ProgressPhoto;
  photo_b: ProgressPhoto;
}

export type WeightUnit = 'kg' | 'lb';

export interface WeightDataPoint {
  date:    string;
  weight:  number;
  isoDate: string;
}
