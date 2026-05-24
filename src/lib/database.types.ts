export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          criteria: Json
          description: string
          icon_name: string
          id: string
          key: string
          name: string
        }
        Insert: {
          criteria: Json
          description: string
          icon_name: string
          id?: string
          key: string
          name: string
        }
        Update: {
          criteria?: Json
          description?: string
          icon_name?: string
          id?: string
          key?: string
          name?: string
        }
        Relationships: []
      }
      body_weight_logs: {
        Row: {
          id: string
          recorded_at: string | null
          user_id: string
          weight_kg: number
        }
        Insert: {
          id?: string
          recorded_at?: string | null
          user_id: string
          weight_kg: number
        }
        Update: {
          id?: string
          recorded_at?: string | null
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
      }
      follow_requests: {
        Row: {
          created_at: string
          id: string
          requester_id: string
          status: string
          target_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          target_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          target_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          requester_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          requester_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          requester_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_items: {
        Row: {
          calories: number
          carbs_g: number
          created_at: string
          fats_g: number
          food_name: string
          id: string
          meal_type: string
          protein_g: number
          serving_amount: number
          serving_unit: string
          user_id: string
        }
        Insert: {
          calories?: number
          carbs_g?: number
          created_at?: string
          fats_g?: number
          food_name: string
          id?: string
          meal_type: string
          protein_g?: number
          serving_amount?: number
          serving_unit?: string
          user_id: string
        }
        Update: {
          calories?: number
          carbs_g?: number
          created_at?: string
          fats_g?: number
          food_name?: string
          id?: string
          meal_type?: string
          protein_g?: number
          serving_amount?: number
          serving_unit?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          data: Json
          id: string
          invite_date: string | null
          invite_exercise_id: string | null
          invite_status: string | null
          message: string
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          invite_date?: string | null
          invite_exercise_id?: string | null
          invite_status?: string | null
          message: string
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          invite_date?: string | null
          invite_exercise_id?: string | null
          invite_status?: string | null
          message?: string
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_records: {
        Row: {
          achieved_at: string | null
          best_form_score: number | null
          best_rep_count: number | null
          best_volume: number | null
          exercise_id: string
          id: string
          user_id: string
        }
        Insert: {
          achieved_at?: string | null
          best_form_score?: number | null
          best_rep_count?: number | null
          best_volume?: number | null
          exercise_id: string
          id?: string
          user_id: string
        }
        Update: {
          achieved_at?: string | null
          best_form_score?: number | null
          best_rep_count?: number | null
          best_volume?: number | null
          exercise_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_level: string | null
          age: number | null
          best_form_score: number | null
          biological_sex: string | null
          created_at: string
          current_streak: number | null
          current_weekly_streak: number | null
          default_rest_seconds: number | null
          email: string | null
          email_digest: boolean | null
          equipment_profile: Json | null
          height_cm: number | null
          height_unit: string | null
          id: string
          is_private: boolean
          last_session_date: string | null
          longest_streak: number | null
          movement_baseline: Json | null
          nutrition_goals: Json | null
          onboarding_complete: boolean | null
          privacy_mode: string
          target_sessions_per_week: number | null
          target_weight_kg: number | null
          theme_preference: string | null
          unavailable_days: Json | null
          username: string | null
          weight_unit: string | null
          xp_total: number | null
          xp_level: number | null
        }
        Insert: {
          activity_level?: string | null
          age?: number | null
          best_form_score?: number | null
          biological_sex?: string | null
          created_at?: string
          current_streak?: number | null
          current_weekly_streak?: number | null
          default_rest_seconds?: number | null
          email?: string | null
          email_digest?: boolean | null
          equipment_profile?: Json | null
          height_cm?: number | null
          height_unit?: string | null
          id: string
          is_private?: boolean
          last_session_date?: string | null
          longest_streak?: number | null
          movement_baseline?: Json | null
          nutrition_goals?: Json | null
          onboarding_complete?: boolean | null
          privacy_mode?: string
          target_sessions_per_week?: number | null
          target_weight_kg?: number | null
          theme_preference?: string | null
          unavailable_days?: Json | null
          username?: string | null
          weight_unit?: string | null
          xp_total?: number | null
          xp_level?: number | null
        }
        Update: {
          activity_level?: string | null
          age?: number | null
          best_form_score?: number | null
          biological_sex?: string | null
          created_at?: string
          current_streak?: number | null
          current_weekly_streak?: number | null
          default_rest_seconds?: number | null
          email?: string | null
          email_digest?: boolean | null
          equipment_profile?: Json | null
          height_cm?: number | null
          height_unit?: string | null
          id?: string
          is_private?: boolean
          last_session_date?: string | null
          longest_streak?: number | null
          movement_baseline?: Json | null
          nutrition_goals?: Json | null
          onboarding_complete?: boolean | null
          privacy_mode?: string
          target_sessions_per_week?: number | null
          target_weight_kg?: number | null
          theme_preference?: string | null
          unavailable_days?: Json | null
          username?: string | null
          weight_unit?: string | null
          xp_total?: number | null
          xp_level?: number | null
        }
        Relationships: []
      }
      weekly_challenges: {
        Row: {
          id: string
          exercise_id: string
          target_reps: number
          week_start: string
          created_at: string
        }
        Insert: {
          id?: string
          exercise_id: string
          target_reps: number
          week_start: string
          created_at?: string
        }
        Update: {
          id?: string
          exercise_id?: string
          target_reps?: number
          week_start?: string
          created_at?: string
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          id: string
          user_id: string
          amount: number
          source: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          source: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          source?: string
          created_at?: string
        }
        Relationships: []
      }
      user_challenge_progress: {
        Row: {
          id: string
          user_id: string
          challenge_id: string
          current_reps: number
          completed: boolean
          xp_awarded: number
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          challenge_id: string
          current_reps?: number
          completed?: boolean
          xp_awarded?: number
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          challenge_id?: string
          current_reps?: number
          completed?: boolean
          xp_awarded?: number
          completed_at?: string | null
        }
        Relationships: []
      }
      programs: {
        Row: {
          author_id: string | null
          created_at: string | null
          description: string | null
          difficulty: string
          id: string
          is_ai_generated: boolean | null
          is_public: boolean | null
          required_equipment: Json | null
          slug: string
          title: string
          weeks: number
          workout_days: Json
        }
        Insert: {
          author_id?: string | null
          created_at?: string | null
          description?: string | null
          difficulty: string
          id?: string
          is_ai_generated?: boolean | null
          is_public?: boolean | null
          required_equipment?: Json | null
          slug: string
          title: string
          weeks: number
          workout_days: Json
        }
        Update: {
          author_id?: string | null
          created_at?: string | null
          description?: string | null
          difficulty?: string
          id?: string
          is_ai_generated?: boolean | null
          is_public?: boolean | null
          required_equipment?: Json | null
          slug?: string
          title?: string
          weeks?: number
          workout_days?: Json
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          id: string
          plan_tier: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_tier?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_tier?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          earned_at: string | null
          user_id: string
        }
        Insert: {
          achievement_id: string
          earned_at?: string | null
          user_id: string
        }
        Update: {
          achievement_id?: string
          earned_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_program_progress: {
        Row: {
          completed_workouts: number
          completion_percent: number
          created_at: string
          updated_at: string | null
          current_week: number
          id: string
          program_id: string | null
          program_slug: string
          total_workouts: number
          user_id: string
        }
        Insert: {
          completed_workouts?: number
          completion_percent?: number
          created_at?: string
          updated_at?: string | null
          current_week?: number
          id?: string
          program_id?: string | null
          program_slug: string
          total_workouts?: number
          user_id: string
        }
        Update: {
          completed_workouts?: number
          completion_percent?: number
          created_at?: string
          updated_at?: string | null
          current_week?: number
          id?: string
          program_id?: string | null
          program_slug?: string
          total_workouts?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_program_progress_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_events: {
        Row: {
          created_at: string
          exercise_id: string | null
          id: string
          is_completed: boolean
          notes: string | null
          program_day_id: string | null
          scheduled_date: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exercise_id?: string | null
          id?: string
          is_completed?: boolean
          notes?: string | null
          program_day_id?: string | null
          scheduled_date: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string | null
          id?: string
          is_completed?: boolean
          notes?: string | null
          program_day_id?: string | null
          scheduled_date?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_sessions: {
        Row: {
          average_form_score: number | null
          created_at: string
          duration_ms: number | null
          exercise_id: string | null
          exercise_type: string
          form_score: number
          form_summary: string
          form_trend: string | null
          id: string
          load_kg: Json | null
          program_id: string | null
          recorded_at: string | null
          rep_count: number
          rep_scores: Json | null
          set_results: Json | null
          top_issues: Json | null
          user_id: string
        }
        Insert: {
          average_form_score?: number | null
          created_at?: string
          duration_ms?: number | null
          exercise_id?: string | null
          exercise_type: string
          form_score?: number
          form_summary?: string
          form_trend?: string | null
          id?: string
          load_kg?: Json | null
          program_id?: string | null
          recorded_at?: string | null
          rep_count?: number
          rep_scores?: Json | null
          set_results?: Json | null
          top_issues?: Json | null
          user_id: string
        }
        Update: {
          average_form_score?: number | null
          created_at?: string
          duration_ms?: number | null
          exercise_id?: string | null
          exercise_type?: string
          form_score?: number
          form_summary?: string
          form_trend?: string | null
          id?: string
          load_kg?: Json | null
          program_id?: string | null
          recorded_at?: string | null
          rep_count?: number
          rep_scores?: Json | null
          set_results?: Json | null
          top_issues?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          id:                 string
          user_id:            string
          workout_session_id: string | null
          entry_date:         string
          content:            string
          created_at:         string
          updated_at:         string
        }
        Insert: {
          id?:                string
          user_id:            string
          workout_session_id?: string | null
          entry_date?:        string
          content:            string
          created_at?:        string
          updated_at?:        string
        }
        Update: {
          id?:                string
          user_id?:           string
          workout_session_id?: string | null
          entry_date?:        string
          content?:           string
          created_at?:        string
          updated_at?:        string
        }
        Relationships: []
      }
      progress_photos: {
        Row: {
          id:              string
          user_id:         string
          photo_date:      string
          storage_path:    string
          signed_url:      string | null
          signed_url_exp:  string | null
          week_number:     number | null
          year:            number | null
          notes:           string | null
          created_at:      string
        }
        Insert: {
          id?:             string
          user_id:         string
          photo_date:      string
          storage_path:    string
          signed_url?:     string | null
          signed_url_exp?: string | null
          week_number?:    number | null
          year?:           number | null
          notes?:          string | null
          created_at?:     string
        }
        Update: {
          id?:             string
          user_id?:        string
          photo_date?:     string
          storage_path?:   string
          signed_url?:     string | null
          signed_url_exp?: string | null
          week_number?:    number | null
          year?:           number | null
          notes?:          string | null
          created_at?:     string
        }
        Relationships: []
      }
      weight_logs: {
        Row: {
          id:         string
          user_id:    string
          log_date:   string
          weight_kg:  number
          created_at: string
        }
        Insert: {
          id?:        string
          user_id:    string
          log_date?:  string
          weight_kg:  number
          created_at?: string
        }
        Update: {
          id?:        string
          user_id?:   string
          log_date?:  string
          weight_kg?: number
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_xp: {
        Args: { p_user_id: string; p_amount: number; p_source?: string }
        Returns: Json
      }
      get_or_create_weekly_challenge: {
        Args: Record<string, never>
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
