export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Enums: {
      attempt_status: "in_progress" | "completed" | "failed" | "abandoned";
      data_snapshot_status: "importing" | "active" | "archived" | "failed";
      puzzle_kind: "daily" | "practice";
      puzzle_mode: "club_club" | "club_year" | "club_nationality";
      puzzle_status: "draft" | "scheduled" | "published" | "archived";
    };
    Tables: {
      accepted_answers: {
        Row: {
          created_at: string;
          is_featured: boolean;
          player_id: number;
          puzzle_cell_id: number;
        };
        Insert: {
          created_at?: string;
          is_featured?: boolean;
          player_id: number;
          puzzle_cell_id: number;
        };
        Update: {
          created_at?: string;
          is_featured?: boolean;
          player_id?: number;
          puzzle_cell_id?: number;
        };
        Relationships: [];
      };
      career_spells: {
        Row: {
          club_id: number;
          created_at: string;
          data_snapshot_id: string | null;
          external_id: string | null;
          id: number;
          is_loan: boolean;
          player_id: number;
          season_end: number | null;
          season_start: number;
          source: string | null;
          source_ref: string | null;
          updated_at: string;
        };
        Insert: {
          club_id: number;
          created_at?: string;
          data_snapshot_id?: string | null;
          external_id?: string | null;
          id?: number;
          is_loan?: boolean;
          player_id: number;
          season_end?: number | null;
          season_start: number;
          source?: string | null;
          source_ref?: string | null;
          updated_at?: string;
        };
        Update: {
          club_id?: number;
          created_at?: string;
          data_snapshot_id?: string | null;
          external_id?: string | null;
          id?: number;
          is_loan?: boolean;
          player_id?: number;
          season_end?: number | null;
          season_start?: number;
          source?: string | null;
          source_ref?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      clubs: {
        Row: {
          country_id: number | null;
          created_at: string;
          data_snapshot_id: string | null;
          external_id: string | null;
          id: number;
          name: string;
          slug: string;
          transfermarkt_id: string | null;
          updated_at: string;
        };
        Insert: {
          country_id?: number | null;
          created_at?: string;
          data_snapshot_id?: string | null;
          external_id?: string | null;
          id?: number;
          name: string;
          slug: string;
          transfermarkt_id?: string | null;
          updated_at?: string;
        };
        Update: {
          country_id?: number | null;
          created_at?: string;
          data_snapshot_id?: string | null;
          external_id?: string | null;
          id?: number;
          name?: string;
          slug?: string;
          transfermarkt_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      countries: {
        Row: {
          created_at: string;
          data_snapshot_id: string | null;
          external_id: string | null;
          fifa_code: string | null;
          id: number;
          iso2: string | null;
          name: string;
          slug: string;
        };
        Insert: {
          created_at?: string;
          data_snapshot_id?: string | null;
          external_id?: string | null;
          fifa_code?: string | null;
          id?: number;
          iso2?: string | null;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          data_snapshot_id?: string | null;
          external_id?: string | null;
          fifa_code?: string | null;
          id?: number;
          iso2?: string | null;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      data_snapshots: {
        Row: {
          created_at: string;
          id: string;
          imported_at: string | null;
          label: string;
          notes: string | null;
          source_id: number;
          status: Database["public"]["Enums"]["data_snapshot_status"];
          updated_at: string;
          version: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          imported_at?: string | null;
          label: string;
          notes?: string | null;
          source_id: number;
          status?: Database["public"]["Enums"]["data_snapshot_status"];
          updated_at?: string;
          version: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          imported_at?: string | null;
          label?: string;
          notes?: string | null;
          source_id?: number;
          status?: Database["public"]["Enums"]["data_snapshot_status"];
          updated_at?: string;
          version?: string;
        };
        Relationships: [];
      };
      data_sources: {
        Row: {
          created_at: string;
          id: number;
          license_note: string | null;
          name: string;
          provider_url: string | null;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          license_note?: string | null;
          name: string;
          provider_url?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          license_note?: string | null;
          name?: string;
          provider_url?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      daily_attempt_answers: {
        Row: {
          answered_at: string;
          attempt_id: string;
          id: number;
          is_correct: boolean;
          player_id: number | null;
          puzzle_cell_id: number;
          submitted_name: string;
        };
        Insert: {
          answered_at?: string;
          attempt_id: string;
          id?: number;
          is_correct: boolean;
          player_id?: number | null;
          puzzle_cell_id: number;
          submitted_name: string;
        };
        Update: {
          answered_at?: string;
          attempt_id?: string;
          id?: number;
          is_correct?: boolean;
          player_id?: number | null;
          puzzle_cell_id?: number;
          submitted_name?: string;
        };
        Relationships: [];
      };
      daily_attempts: {
        Row: {
          completed_at: string | null;
          created_at: string;
          duration_ms: number | null;
          error_count: number;
          found_count: number;
          id: string;
          puzzle_id: string;
          score: number;
          started_at: string;
          status: Database["public"]["Enums"]["attempt_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          duration_ms?: number | null;
          error_count?: number;
          found_count?: number;
          id?: string;
          puzzle_id: string;
          score?: number;
          started_at?: string;
          status?: Database["public"]["Enums"]["attempt_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          duration_ms?: number | null;
          error_count?: number;
          found_count?: number;
          id?: string;
          puzzle_id?: string;
          score?: number;
          started_at?: string;
          status?: Database["public"]["Enums"]["attempt_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      player_nationalities: {
        Row: {
          country_id: number;
          created_at: string;
          is_primary: boolean;
          player_id: number;
        };
        Insert: {
          country_id: number;
          created_at?: string;
          is_primary?: boolean;
          player_id: number;
        };
        Update: {
          country_id?: number;
          created_at?: string;
          is_primary?: boolean;
          player_id?: number;
        };
        Relationships: [];
      };
      players: {
        Row: {
          birth_date: string | null;
          created_at: string;
          data_snapshot_id: string | null;
          display_name: string;
          external_id: string | null;
          id: number;
          slug: string;
          transfermarkt_id: string | null;
          updated_at: string;
        };
        Insert: {
          birth_date?: string | null;
          created_at?: string;
          data_snapshot_id?: string | null;
          display_name: string;
          external_id?: string | null;
          id?: number;
          slug: string;
          transfermarkt_id?: string | null;
          updated_at?: string;
        };
        Update: {
          birth_date?: string | null;
          created_at?: string;
          data_snapshot_id?: string | null;
          display_name?: string;
          external_id?: string | null;
          id?: number;
          slug?: string;
          transfermarkt_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          updated_at: string;
          username: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          updated_at?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      puzzle_axes: {
        Row: {
          axis: "row" | "col";
          club_id: number | null;
          country_id: number | null;
          id: number;
          kind: "club" | "year" | "country";
          label: string;
          position: number;
          puzzle_id: string;
          season_end: number | null;
          season_start: number | null;
        };
        Insert: {
          axis: "row" | "col";
          club_id?: number | null;
          country_id?: number | null;
          id?: number;
          kind: "club" | "year" | "country";
          label: string;
          position: number;
          puzzle_id: string;
          season_end?: number | null;
          season_start?: number | null;
        };
        Update: {
          axis?: "row" | "col";
          club_id?: number | null;
          country_id?: number | null;
          id?: number;
          kind?: "club" | "year" | "country";
          label?: string;
          position?: number;
          puzzle_id?: string;
          season_end?: number | null;
          season_start?: number | null;
        };
        Relationships: [];
      };
      puzzle_cells: {
        Row: {
          answer_count: number;
          col_position: number;
          created_at: string;
          id: number;
          puzzle_id: string;
          rarity_score: number | null;
          row_position: number;
        };
        Insert: {
          answer_count?: number;
          col_position: number;
          created_at?: string;
          id?: number;
          puzzle_id: string;
          rarity_score?: number | null;
          row_position: number;
        };
        Update: {
          answer_count?: number;
          col_position?: number;
          created_at?: string;
          id?: number;
          puzzle_id?: string;
          rarity_score?: number | null;
          row_position?: number;
        };
        Relationships: [];
      };
      puzzles: {
        Row: {
          created_at: string;
          data_snapshot_id: string | null;
          difficulty: number | null;
          generated_at: string | null;
          id: string;
          kind: Database["public"]["Enums"]["puzzle_kind"];
          mode: Database["public"]["Enums"]["puzzle_mode"];
          published_at: string | null;
          puzzle_date: string | null;
          seed: string | null;
          status: Database["public"]["Enums"]["puzzle_status"];
          title: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data_snapshot_id?: string | null;
          difficulty?: number | null;
          generated_at?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["puzzle_kind"];
          mode: Database["public"]["Enums"]["puzzle_mode"];
          published_at?: string | null;
          puzzle_date?: string | null;
          seed?: string | null;
          status?: Database["public"]["Enums"]["puzzle_status"];
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data_snapshot_id?: string | null;
          difficulty?: number | null;
          generated_at?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["puzzle_kind"];
          mode?: Database["public"]["Enums"]["puzzle_mode"];
          published_at?: string | null;
          puzzle_date?: string | null;
          seed?: string | null;
          status?: Database["public"]["Enums"]["puzzle_status"];
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      random_attempts: {
        Row: {
          completed_at: string | null;
          created_at: string;
          duration_ms: number | null;
          error_count: number;
          found_count: number;
          id: string;
          puzzle_id: string;
          score: number;
          started_at: string;
          user_id: string | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          duration_ms?: number | null;
          error_count?: number;
          found_count?: number;
          id?: string;
          puzzle_id: string;
          score?: number;
          started_at?: string;
          user_id?: string | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          duration_ms?: number | null;
          error_count?: number;
          found_count?: number;
          id?: string;
          puzzle_id?: string;
          score?: number;
          started_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      user_streaks: {
        Row: {
          best_streak: number;
          current_streak: number;
          last_completed_date: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          best_streak?: number;
          current_streak?: number;
          last_completed_date?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          best_streak?: number;
          current_streak?: number;
          last_completed_date?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      active_data_snapshots: {
        Row: {
          id: string | null;
          imported_at: string | null;
          label: string | null;
          notes: string | null;
          source_name: string | null;
          source_slug: string | null;
          version: string | null;
        };
        Relationships: [];
      };
      daily_leaderboard: {
        Row: {
          completed_at: string | null;
          display_name: string | null;
          duration_ms: number | null;
          error_count: number | null;
          found_count: number | null;
          puzzle_id: string | null;
          rank: number | null;
          score: number | null;
          user_id: string | null;
          username: string | null;
        };
        Relationships: [];
      };
      streak_leaderboard: {
        Row: {
          best_rank: number | null;
          best_streak: number | null;
          current_rank: number | null;
          current_streak: number | null;
          display_name: string | null;
          last_completed_date: string | null;
          user_id: string | null;
          username: string | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
