export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  ai: {
    Tables: {
      coaching_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          highlights: Json
          id: string
          input_summary: Json
          latency_ms: number | null
          model_version_id: string
          org_id: string
          output_markdown: string | null
          person_id: string
          status: Database["ai"]["Enums"]["run_status_enum"]
          week_start: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          highlights?: Json
          id?: string
          input_summary?: Json
          latency_ms?: number | null
          model_version_id: string
          org_id: string
          output_markdown?: string | null
          person_id: string
          status?: Database["ai"]["Enums"]["run_status_enum"]
          week_start: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          highlights?: Json
          id?: string
          input_summary?: Json
          latency_ms?: number | null
          model_version_id?: string
          org_id?: string
          output_markdown?: string | null
          person_id?: string
          status?: Database["ai"]["Enums"]["run_status_enum"]
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_runs_model_version_id_fkey"
            columns: ["model_version_id"]
            isOneToOne: false
            referencedRelation: "model_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      improvement_requests: {
        Row: {
          alternatives: Json
          content_hash: string
          created_at: string
          id: string
          improved_text: string | null
          latency_ms: number | null
          model_version_id: string
          org_id: string
          provider_team_id: string
          provider_user_id: string
          scene_label: string | null
          tone_reason: string | null
        }
        Insert: {
          alternatives?: Json
          content_hash: string
          created_at?: string
          id?: string
          improved_text?: string | null
          latency_ms?: number | null
          model_version_id: string
          org_id: string
          provider_team_id: string
          provider_user_id: string
          scene_label?: string | null
          tone_reason?: string | null
        }
        Update: {
          alternatives?: Json
          content_hash?: string
          created_at?: string
          id?: string
          improved_text?: string | null
          latency_ms?: number | null
          model_version_id?: string
          org_id?: string
          provider_team_id?: string
          provider_user_id?: string
          scene_label?: string | null
          tone_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "improvement_requests_model_version_id_fkey"
            columns: ["model_version_id"]
            isOneToOne: false
            referencedRelation: "model_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      message_analyses: {
        Row: {
          created_at: string
          id: string
          latency_ms: number | null
          message_ref_id: string
          model_version_id: string
          reasoning: string | null
          scores: Json
          taxonomy_version_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          latency_ms?: number | null
          message_ref_id: string
          model_version_id: string
          reasoning?: string | null
          scores?: Json
          taxonomy_version_id: string
        }
        Update: {
          created_at?: string
          id?: string
          latency_ms?: number | null
          message_ref_id?: string
          model_version_id?: string
          reasoning?: string | null
          scores?: Json
          taxonomy_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_analyses_model_version_id_fkey"
            columns: ["model_version_id"]
            isOneToOne: false
            referencedRelation: "model_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_analyses_taxonomy_version_id_fkey"
            columns: ["taxonomy_version_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      model_versions: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          model_name: string
          prompt_hash: string
          prompt_template: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          model_name: string
          prompt_hash: string
          prompt_template?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          model_name?: string
          prompt_hash?: string
          prompt_template?: string
        }
        Relationships: []
      }
      taxonomy_versions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          signal_definitions: Json
          version_label: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          signal_definitions: Json
          version_label: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          signal_definitions?: Json
          version_label?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      run_status_enum: "pending" | "running" | "completed" | "failed"
      signal_value_type_enum: "numeric" | "boolean" | "categorical"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  analytics: {
    Tables: {
      org_weekly_metrics: {
        Row: {
          active_people_count: number
          created_at: string
          id: string
          metrics: Json
          org_id: string
          taxonomy_version_id: string
          total_message_count: number
          week_start: string
        }
        Insert: {
          active_people_count?: number
          created_at?: string
          id?: string
          metrics?: Json
          org_id: string
          taxonomy_version_id: string
          total_message_count?: number
          week_start: string
        }
        Update: {
          active_people_count?: number
          created_at?: string
          id?: string
          metrics?: Json
          org_id?: string
          taxonomy_version_id?: string
          total_message_count?: number
          week_start?: string
        }
        Relationships: []
      }
      person_daily_metrics: {
        Row: {
          created_at: string
          date: string
          id: string
          message_count: number
          metrics: Json
          org_id: string
          person_id: string
          taxonomy_version_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          message_count?: number
          metrics?: Json
          org_id: string
          person_id: string
          taxonomy_version_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          message_count?: number
          metrics?: Json
          org_id?: string
          person_id?: string
          taxonomy_version_id?: string
        }
        Relationships: []
      }
      person_weekly_metrics: {
        Row: {
          created_at: string
          id: string
          message_count: number
          metrics: Json
          org_id: string
          person_id: string
          prev_week_metrics: Json | null
          taxonomy_version_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_count?: number
          metrics?: Json
          org_id: string
          person_id: string
          prev_week_metrics?: Json | null
          taxonomy_version_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          message_count?: number
          metrics?: Json
          org_id?: string
          person_id?: string
          prev_week_metrics?: Json | null
          taxonomy_version_id?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  audit: {
    Tables: {
      event_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json
          org_id: string | null
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          org_id?: string | null
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          org_id?: string | null
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  billing: {
    Tables: {
      seat_snapshots: {
        Row: {
          billable_people_count: number
          created_at: string
          id: string
          org_id: string
          seat_count: number
          snapshot_date: string
        }
        Insert: {
          billable_people_count: number
          created_at?: string
          id?: string
          org_id: string
          seat_count: number
          snapshot_date: string
        }
        Update: {
          billable_people_count?: number
          created_at?: string
          id?: string
          org_id?: string
          seat_count?: number
          snapshot_date?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          org_id: string
          plan: Database["public"]["Enums"]["plan_tier_enum"]
          seat_limit: number | null
          status: Database["billing"]["Enums"]["subscription_status_enum"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          org_id: string
          plan?: Database["public"]["Enums"]["plan_tier_enum"]
          seat_limit?: number | null
          status?: Database["billing"]["Enums"]["subscription_status_enum"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          org_id?: string
          plan?: Database["public"]["Enums"]["plan_tier_enum"]
          seat_limit?: number | null
          status?: Database["billing"]["Enums"]["subscription_status_enum"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      subscription_status_enum:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "paused"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  integrations: {
    Tables: {
      connections: {
        Row: {
          config: Json
          created_at: string
          id: string
          installed_by: string
          org_id: string
          provider: Database["public"]["Enums"]["provider_enum"]
          status: Database["integrations"]["Enums"]["connection_status_enum"]
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          installed_by: string
          org_id: string
          provider: Database["public"]["Enums"]["provider_enum"]
          status?: Database["integrations"]["Enums"]["connection_status_enum"]
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          installed_by?: string
          org_id?: string
          provider?: Database["public"]["Enums"]["provider_enum"]
          status?: Database["integrations"]["Enums"]["connection_status_enum"]
          updated_at?: string
        }
        Relationships: []
      }
      external_channels: {
        Row: {
          channel_name: string
          channel_type: string
          connection_id: string
          created_at: string
          first_seen_at: string
          id: string
          is_monitored: boolean
          provider_channel_id: string
          updated_at: string
        }
        Insert: {
          channel_name: string
          channel_type?: string
          connection_id: string
          created_at?: string
          first_seen_at?: string
          id?: string
          is_monitored?: boolean
          provider_channel_id: string
          updated_at?: string
        }
        Update: {
          channel_name?: string
          channel_type?: string
          connection_id?: string
          created_at?: string
          first_seen_at?: string
          id?: string
          is_monitored?: boolean
          provider_channel_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_channels_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
        ]
      }
      external_users: {
        Row: {
          avatar_url: string | null
          connection_id: string
          created_at: string
          display_name: string
          email: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          provider_user_id: string
          raw_profile: Json
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          connection_id: string
          created_at?: string
          display_name: string
          email?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          provider_user_id: string
          raw_profile?: Json
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          connection_id?: string
          created_at?: string
          display_name?: string
          email?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          provider_user_id?: string
          raw_profile?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_users_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
        ]
      }
      installations: {
        Row: {
          bot_token: string
          bot_user_id: string
          connection_id: string
          created_at: string
          id: string
          installed_at: string
          provider_team_id: string
          raw_response: Json
          revoked_at: string | null
          scopes: string[]
          team_name: string
          token_type: string
          updated_at: string
        }
        Insert: {
          bot_token: string
          bot_user_id: string
          connection_id: string
          created_at?: string
          id?: string
          installed_at?: string
          provider_team_id: string
          raw_response?: Json
          revoked_at?: string | null
          scopes?: string[]
          team_name: string
          token_type?: string
          updated_at?: string
        }
        Update: {
          bot_token?: string
          bot_user_id?: string
          connection_id?: string
          created_at?: string
          id?: string
          installed_at?: string
          provider_team_id?: string
          raw_response?: Json
          revoked_at?: string | null
          scopes?: string[]
          team_name?: string
          token_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installations_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
        ]
      }
      message_content_secure: {
        Row: {
          created_at: string
          encrypted_body: string
          encryption_key_id: string
          id: string
          message_ref_id: string
          ttl_expires_at: string
        }
        Insert: {
          created_at?: string
          encrypted_body: string
          encryption_key_id: string
          id?: string
          message_ref_id: string
          ttl_expires_at?: string
        }
        Update: {
          created_at?: string
          encrypted_body?: string
          encryption_key_id?: string
          id?: string
          message_ref_id?: string
          ttl_expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_content_secure_message_ref_id_fkey"
            columns: ["message_ref_id"]
            isOneToOne: true
            referencedRelation: "message_refs"
            referencedColumns: ["id"]
          },
        ]
      }
      message_refs: {
        Row: {
          channel_ref_id: string | null
          connection_id: string
          content_hash: string | null
          created_at: string
          id: string
          metadata: Json
          org_id: string
          permalink: string | null
          person_id: string | null
          provider_channel_id: string
          provider_message_id: string
          sender_ref_id: string | null
          sent_at: string
        }
        Insert: {
          channel_ref_id?: string | null
          connection_id: string
          content_hash?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          org_id: string
          permalink?: string | null
          person_id?: string | null
          provider_channel_id: string
          provider_message_id: string
          sender_ref_id?: string | null
          sent_at: string
        }
        Update: {
          channel_ref_id?: string | null
          connection_id?: string
          content_hash?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          org_id?: string
          permalink?: string | null
          person_id?: string | null
          provider_channel_id?: string
          provider_message_id?: string
          sender_ref_id?: string | null
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_refs_channel_ref_id_fkey"
            columns: ["channel_ref_id"]
            isOneToOne: false
            referencedRelation: "external_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_refs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_refs_sender_ref_id_fkey"
            columns: ["sender_ref_id"]
            isOneToOne: false
            referencedRelation: "external_users"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          attempts: number
          connection_id: string
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          payload_hash: string
          processed_at: string | null
          provider_event_id: string | null
          received_at: string
          status: Database["integrations"]["Enums"]["webhook_event_status_enum"]
        }
        Insert: {
          attempts?: number
          connection_id: string
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json
          payload_hash: string
          processed_at?: string | null
          provider_event_id?: string | null
          received_at?: string
          status?: Database["integrations"]["Enums"]["webhook_event_status_enum"]
        }
        Update: {
          attempts?: number
          connection_id?: string
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          payload_hash?: string
          processed_at?: string | null
          provider_event_id?: string | null
          received_at?: string
          status?: Database["integrations"]["Enums"]["webhook_event_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      connection_status_enum: "active" | "revoked" | "expired"
      webhook_event_status_enum:
        | "pending"
        | "processing"
        | "processed"
        | "failed"
        | "skipped"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  ops: {
    Tables: {
      idempotency_keys: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          key: string
          response: Json | null
          scope: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          key: string
          response?: Json | null
          scope?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          key?: string
          response?: Json | null
          scope?: string
        }
        Relationships: []
      }
      job_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          job_name: string
          metadata: Json
          started_at: string | null
          status: Database["ops"]["Enums"]["job_status_enum"]
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_name: string
          metadata?: Json
          started_at?: string | null
          status?: Database["ops"]["Enums"]["job_status_enum"]
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_name?: string
          metadata?: Json
          started_at?: string | null
          status?: Database["ops"]["Enums"]["job_status_enum"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      purge_expired_content: { Args: never; Returns: number }
    }
    Enums: {
      job_status_enum: "pending" | "running" | "completed" | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      goals: {
        Row: {
          created_at: string
          created_by: string
          direction: Database["public"]["Enums"]["goal_direction_enum"]
          id: string
          org_id: string
          person_id: string | null
          signal_key: string
          target_value: number
          updated_at: string
          week_end: string
          week_start: string
        }
        Insert: {
          created_at?: string
          created_by: string
          direction?: Database["public"]["Enums"]["goal_direction_enum"]
          id?: string
          org_id: string
          person_id?: string | null
          signal_key: string
          target_value: number
          updated_at?: string
          week_end: string
          week_start: string
        }
        Update: {
          created_at?: string
          created_by?: string
          direction?: Database["public"]["Enums"]["goal_direction_enum"]
          id?: string
          org_id?: string
          person_id?: string | null
          signal_key?: string
          target_value?: number
          updated_at?: string
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_links: {
        Row: {
          created_at: string
          id: string
          person_id: string
          provider: Database["public"]["Enums"]["provider_enum"]
          provider_metadata: Json
          provider_team_id: string
          provider_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          person_id: string
          provider: Database["public"]["Enums"]["provider_enum"]
          provider_metadata?: Json
          provider_team_id: string
          provider_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          person_id?: string
          provider?: Database["public"]["Enums"]["provider_enum"]
          provider_metadata?: Json
          provider_team_id?: string
          provider_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_links_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          profile_id: string
          role: Database["public"]["Enums"]["membership_role_enum"]
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          profile_id: string
          role?: Database["public"]["Enums"]["membership_role_enum"]
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["membership_role_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: Database["public"]["Enums"]["plan_tier_enum"]
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan?: Database["public"]["Enums"]["plan_tier_enum"]
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: Database["public"]["Enums"]["plan_tier_enum"]
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          created_at: string
          display_name: string
          email: string | null
          id: string
          is_active: boolean
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          is_active?: boolean
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          is_active?: boolean
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          digest_day: number
          id: string
          locale: string
          notification_channel: string
          notification_prefs: Json
          profile_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          digest_day?: number
          id?: string
          locale?: string
          notification_channel?: string
          notification_prefs?: Json
          profile_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          digest_day?: number
          id?: string
          locale?: string
          notification_channel?: string
          notification_prefs?: Json
          profile_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_digests: {
        Row: {
          coaching_run_id: string | null
          created_at: string
          digest_markdown: string
          highlights: Json
          id: string
          is_read: boolean
          org_id: string
          person_id: string
          week_start: string
        }
        Insert: {
          coaching_run_id?: string | null
          created_at?: string
          digest_markdown?: string
          highlights?: Json
          id?: string
          is_read?: boolean
          org_id: string
          person_id: string
          week_start: string
        }
        Update: {
          coaching_run_id?: string | null
          created_at?: string
          digest_markdown?: string
          highlights?: Json
          id?: string
          is_read?: boolean
          org_id?: string
          person_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_digests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_digests_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_my_installations: {
        Row: {
          bot_user_id: string | null
          connection_id: string | null
          created_at: string | null
          installation_id: string | null
          org_id: string | null
          provider: Database["public"]["Enums"]["provider_enum"] | null
          scopes: string[] | null
          status:
            | Database["integrations"]["Enums"]["connection_status_enum"]
            | null
          team_id: string | null
          team_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_org_weekly_metrics: {
        Row: {
          active_people_count: number | null
          created_at: string | null
          id: string | null
          metrics: Json | null
          org_id: string | null
          org_name: string | null
          total_message_count: number | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_weekly_metrics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_person_weekly_metrics: {
        Row: {
          created_at: string | null
          id: string | null
          message_count: number | null
          metrics: Json | null
          org_id: string | null
          person_id: string | null
          person_name: string | null
          prev_week_metrics: Json | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_weekly_metrics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_weekly_metrics_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_user_org_ids: { Args: never; Returns: string[] }
      is_org_admin: { Args: { target_org_id: string }; Returns: boolean }
    }
    Enums: {
      goal_direction_enum: "up" | "down"
      membership_role_enum: "owner" | "admin" | "member"
      plan_tier_enum: "free" | "pro" | "enterprise"
      provider_enum: "slack" | "teams" | "email"
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
  ai: {
    Enums: {
      run_status_enum: ["pending", "running", "completed", "failed"],
      signal_value_type_enum: ["numeric", "boolean", "categorical"],
    },
  },
  analytics: {
    Enums: {},
  },
  audit: {
    Enums: {},
  },
  billing: {
    Enums: {
      subscription_status_enum: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "paused",
      ],
    },
  },
  integrations: {
    Enums: {
      connection_status_enum: ["active", "revoked", "expired"],
      webhook_event_status_enum: [
        "pending",
        "processing",
        "processed",
        "failed",
        "skipped",
      ],
    },
  },
  ops: {
    Enums: {
      job_status_enum: ["pending", "running", "completed", "failed"],
    },
  },
  public: {
    Enums: {
      goal_direction_enum: ["up", "down"],
      membership_role_enum: ["owner", "admin", "member"],
      plan_tier_enum: ["free", "pro", "enterprise"],
      provider_enum: ["slack", "teams", "email"],
    },
  },
} as const

