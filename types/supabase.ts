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
      }
      emails: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          lead_id: string | null
          sender_id: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
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
      }
      leads: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          company: string | null
          created_at: string
          email: string | null
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
          role: string | null
          score: number | null
          source: string | null
          status: string | null
          updated_at: string
          value: number | null
          website: string | null
        }
      }
      messages: {
        Row: {
          content: string
          conversation_user_id: string
          created_at: string
          id: string
          is_read: boolean
          sender_id: string
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
