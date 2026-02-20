export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          project_type: string | null
          budget: string | null
          timeline: string | null
          requirements: string | null
          technical_stack: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          project_type?: string | null
          budget?: string | null
          timeline?: string | null
          requirements?: string | null
          technical_stack?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          project_type?: string | null
          budget?: string | null
          timeline?: string | null
          requirements?: string | null
          technical_stack?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      blog_posts: {
        Row: {
          id: string
          title: string
          slug: string
          excerpt: string | null
          content: string
          category: string | null
          read_time: number | null
          published: boolean
          published_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          excerpt?: string | null
          content: string
          category?: string | null
          read_time?: number | null
          published?: boolean
          published_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          slug?: string
          excerpt?: string | null
          content?: string
          category?: string | null
          read_time?: number | null
          published?: boolean
          published_at?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
