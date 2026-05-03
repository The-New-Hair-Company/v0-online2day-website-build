export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_feed: {
        Row: {
          actor_name: string
          created_at: string | null
          description: string
          entity_id: string | null
          entity_name: string | null
          entity_type: string | null
          id: string
          type: string
        }
        Insert: {
          actor_name?: string
          created_at?: string | null
          description: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          type: string
        }
        Update: {
          actor_name?: string
          created_at?: string | null
          description?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          type?: string
        }
      }
      analytics_snapshots: {
        Row: {
          created_at: string
          id: string
          lost_leads: number
          meetings_booked: number
          new_leads: number
          pipeline_value: number
          qualified_leads: number
          snapshotted_at: string
          total_leads: number
          won_leads: number
        }
        Insert: {
          created_at?: string
          id?: string
          lost_leads?: number
          meetings_booked?: number
          new_leads?: number
          pipeline_value?: number
          qualified_leads?: number
          snapshotted_at?: string
          total_leads?: number
          won_leads?: number
        }
        Update: {
          created_at?: string
          id?: string
          lost_leads?: number
          meetings_booked?: number
          new_leads?: number
          pipeline_value?: number
          qualified_leads?: number
          snapshotted_at?: string
          total_leads?: number
          won_leads?: number
        }
      }
      conversations: {
        Row: {
          assigned_to: string | null
          channel: string | null
          company: string | null
          contact_name: string
          created_at: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          lead_id: string | null
          priority: string | null
          resolved_at: string | null
          score: number | null
          status: string | null
          unread_count: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          channel?: string | null
          company?: string | null
          contact_name: string
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          priority?: string | null
          resolved_at?: string | null
          score?: number | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          channel?: string | null
          company?: string | null
          contact_name?: string
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          priority?: string | null
          resolved_at?: string | null
          score?: number | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
      }
      email_templates: {
        Row: {
          audience: string | null
          body: string
          category: string | null
          click_count: number | null
          created_at: string | null
          created_by: string | null
          cta_label: string | null
          id: string
          meetings_booked: number | null
          name: string
          open_count: number | null
          reply_count: number | null
          sent_count: number | null
          stage: string | null
          subject: string
          updated_at: string | null
        }
        Insert: {
          audience?: string | null
          body: string
          category?: string | null
          click_count?: number | null
          created_at?: string | null
          created_by?: string | null
          cta_label?: string | null
          id?: string
          meetings_booked?: number | null
          name: string
          open_count?: number | null
          reply_count?: number | null
          sent_count?: number | null
          stage?: string | null
          subject: string
          updated_at?: string | null
        }
        Update: {
          audience?: string | null
          body?: string
          category?: string | null
          click_count?: number | null
          created_at?: string | null
          created_by?: string | null
          cta_label?: string | null
          id?: string
          meetings_booked?: number | null
          name?: string
          open_count?: number | null
          reply_count?: number | null
          sent_count?: number | null
          stage?: string | null
          subject?: string
          updated_at?: string | null
        }
      }
      emails: {
        Row: {
          body: string | null
          clicked_at: string | null
          created_at: string | null
          id: string
          lead_id: string | null
          opened_at: string | null
          replied_at: string | null
          sender_id: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
          template_id: string | null
        }
        Insert: {
          body?: string | null
          clicked_at?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          opened_at?: string | null
          replied_at?: string | null
          sender_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_id?: string | null
        }
        Update: {
          body?: string | null
          clicked_at?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          opened_at?: string | null
          replied_at?: string | null
          sender_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_id?: string | null
        }
      }
      goals: {
        Row: {
          created_at: string | null
          current_value: number | null
          id: string
          label: string
          period_end: string | null
          period_start: string | null
          target_value: number
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_value?: number | null
          id?: string
          label: string
          period_end?: string | null
          period_start?: string | null
          target_value: number
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_value?: number | null
          id?: string
          label?: string
          period_end?: string | null
          period_start?: string | null
          target_value?: number
          unit?: string | null
          updated_at?: string | null
        }
      }
      integrations: {
        Row: {
          config: Json | null
          created_at: string | null
          id: string
          last_synced_at: string | null
          name: string
          status: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          name: string
          status?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string
          status?: string | null
          type?: string
          updated_at?: string | null
        }
      }
      lead_agreements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          public_url: string | null
          storage_path: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          public_url?: string | null
          storage_path?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          public_url?: string | null
          storage_path?: string | null
          title?: string
        }
      }
      lead_assets: {
        Row: {
          created_at: string
          id: string
          lead_id: string | null
          metadata: Json | null
          name: string
          public_url: string | null
          slug: string | null
          storage_path: string
          type: string
          url: string
          view_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          name?: string
          public_url?: string | null
          slug?: string | null
          storage_path?: string
          type: string
          url?: string
          view_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          name?: string
          public_url?: string | null
          slug?: string | null
          storage_path?: string
          type?: string
          url?: string
          view_count?: number
        }
      }
      lead_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          created_at: string | null
          field_changed: string | null
          id: string
          ip_address: string | null
          lead_id: string | null
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string | null
          field_changed?: string | null
          id?: string
          ip_address?: string | null
          lead_id?: string | null
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string | null
          field_changed?: string | null
          id?: string
          ip_address?: string | null
          lead_id?: string | null
          new_value?: string | null
          old_value?: string | null
        }
      }
      lead_events: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lead_id: string | null
          metadata: Json | null
          note: string | null
          title: string | null
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          note?: string | null
          title?: string | null
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          note?: string | null
          title?: string | null
          type?: string
        }
      }
      lead_tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          due_at: string | null
          id: string
          is_done: boolean
          lead_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          is_done?: boolean
          lead_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          is_done?: boolean
          lead_id?: string | null
          title?: string
          updated_at?: string
        }
      }
      leads: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          company: string | null
          created_at: string
          email: string | null
          email_address: string | null
          engagement: number | null
          follow_up_date: string | null
          id: string
          last_contacted_at: string | null
          linkedin_url: string | null
          lost_reason: string | null
          name: string
          next_action: string | null
          notes: string | null
          phone: string | null
          phone_number: string | null
          role: string | null
          score: number | null
          source: string | null
          status: string | null
          updated_at: string
          value: number | null
          website: string | null
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          email_address?: string | null
          engagement?: number | null
          follow_up_date?: string | null
          id?: string
          last_contacted_at?: string | null
          linkedin_url?: string | null
          lost_reason?: string | null
          name: string
          next_action?: string | null
          notes?: string | null
          phone?: string | null
          phone_number?: string | null
          role?: string | null
          score?: number | null
          source?: string | null
          status?: string | null
          updated_at?: string
          value?: number | null
          website?: string | null
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          email_address?: string | null
          engagement?: number | null
          follow_up_date?: string | null
          id?: string
          last_contacted_at?: string | null
          linkedin_url?: string | null
          lost_reason?: string | null
          name?: string
          next_action?: string | null
          notes?: string | null
          phone?: string | null
          phone_number?: string | null
          role?: string | null
          score?: number | null
          source?: string | null
          status?: string | null
          updated_at?: string
          value?: number | null
          website?: string | null
        }
      }
      messages: {
        Row: {
          attachment_label: string | null
          content: string
          conversation_id: string | null
          conversation_user_id: string
          created_at: string
          id: string
          is_read: boolean
          message_type: string | null
          sender_id: string
        }
        Insert: {
          attachment_label?: string | null
          content: string
          conversation_id?: string | null
          conversation_user_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message_type?: string | null
          sender_id: string
        }
        Update: {
          attachment_label?: string | null
          content?: string
          conversation_id?: string | null
          conversation_user_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message_type?: string | null
          sender_id?: string
        }
      }
      metric_snapshots: {
        Row: {
          created_at: string | null
          id: string
          metric_label: string
          section: string
          snapshot_date: string
          value_numeric: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          metric_label: string
          section: string
          snapshot_date?: string
          value_numeric?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          metric_label?: string
          section?: string
          snapshot_date?: string
          value_numeric?: number | null
        }
      }
      site_build_requests: {
        Row: {
          admin_notes: string | null
          business_name: string
          created_at: string
          id: string
          live_url: string | null
          staging_url: string | null
          status: string
          style_description: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          business_name: string
          created_at?: string
          id?: string
          live_url?: string | null
          staging_url?: string | null
          status?: string
          style_description?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          business_name?: string
          created_at?: string
          id?: string
          live_url?: string | null
          staging_url?: string | null
          status?: string
          style_description?: string | null
          updated_at?: string
          user_id?: string | null
        }
      }
      site_requests: {
        Row: {
          assigned_to: string | null
          brief_url: string | null
          budget_max: number | null
          budget_min: number | null
          company: string
          contact_email: string | null
          contact_name: string | null
          created_at: string | null
          description: string | null
          id: string
          lead_id: string | null
          next_action: string | null
          priority: string | null
          stage: string | null
          timeline_weeks: number | null
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          brief_url?: string | null
          budget_max?: number | null
          budget_min?: number | null
          company: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          next_action?: string | null
          priority?: string | null
          stage?: string | null
          timeline_weeks?: number | null
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          brief_url?: string | null
          budget_max?: number | null
          budget_min?: number | null
          company?: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          next_action?: string | null
          priority?: string | null
          stage?: string | null
          timeline_weeks?: number | null
          title?: string
          type?: string | null
          updated_at?: string | null
        }
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: string
          user_id?: string
        }
      }
      video_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_seconds: number | null
          id: string
          name: string
          public_url: string | null
          storage_path: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          name: string
          public_url?: string | null
          storage_path?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          name?: string
          public_url?: string | null
          storage_path?: string | null
          title?: string
          updated_at?: string | null
        }
      }
      videos: {
        Row: {
          assigned_to: string | null
          channel: string | null
          created_at: string | null
          cta_label: string | null
          cta_url: string | null
          duration_seconds: number | null
          funnel_stage: string | null
          id: string
          last_viewed_at: string | null
          lead_id: string | null
          meetings_booked: number | null
          next_action: string | null
          public_url: string | null
          reply_count: number | null
          status: string | null
          storage_path: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          watch_rate: number | null
        }
        Insert: {
          assigned_to?: string | null
          channel?: string | null
          created_at?: string | null
          cta_label?: string | null
          cta_url?: string | null
          duration_seconds?: number | null
          funnel_stage?: string | null
          id?: string
          last_viewed_at?: string | null
          lead_id?: string | null
          meetings_booked?: number | null
          next_action?: string | null
          public_url?: string | null
          reply_count?: number | null
          status?: string | null
          storage_path?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          watch_rate?: number | null
        }
        Update: {
          assigned_to?: string | null
          channel?: string | null
          created_at?: string | null
          cta_label?: string | null
          cta_url?: string | null
          duration_seconds?: number | null
          funnel_stage?: string | null
          id?: string
          last_viewed_at?: string | null
          lead_id?: string | null
          meetings_booked?: number | null
          next_action?: string | null
          public_url?: string | null
          reply_count?: number | null
          status?: string | null
          storage_path?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          watch_rate?: number | null
        }
      }
    }
    Views: {
      dashboard_metrics: {
        Row: {
          avg_score: number | null
          high_intent_leads: number | null
          new_leads: number | null
          pipeline_value: number | null
          qualified_leads: number | null
          total_leads: number | null
          won_leads: number | null
        }
      }
      lead_pipeline_summary: {
        Row: {
          avg_score: number | null
          avg_value: number | null
          count: number | null
          stage: string | null
        }
      }
      lead_source_performance: {
        Row: {
          avg_engagement: number | null
          avg_score: number | null
          leads: number | null
          source: string | null
          total_value: number | null
        }
      }
      owner_lead_performance: {
        Row: {
          avatar_url: string | null
          avg_score: number | null
          email: string | null
          leads: number | null
          owner: string | null
          qualified: number | null
          total_value: number | null
          won: number | null
        }
      }
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Row"]
export type Views<T extends keyof DefaultSchema["Views"]> = DefaultSchema["Views"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T] extends { Insert: unknown } ? DefaultSchema["Tables"][T]["Insert"] : never
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T] extends { Update: unknown } ? DefaultSchema["Tables"][T]["Update"] : never
