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
      availability: {
        Row: {
          created_at: string
          end_time: string
          id: string
          start_time: string
          user_id: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          start_time: string
          user_id: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
          user_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_links: {
        Row: {
          booking_id: string
          created_at: string
          kind: string
          link_owner_id: string | null
          slug: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string
          kind?: string
          link_owner_id?: string | null
          slug?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string
          kind?: string
          link_owner_id?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_links_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_links_link_owner_id_fkey"
            columns: ["link_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_priority: {
        Row: {
          position: number
          user_id: string
        }
        Insert: {
          position: number
          user_id: string
        }
        Update: {
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_priority_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_priority_items: {
        Row: {
          list_id: string
          position: number
          user_id: string
        }
        Insert: {
          list_id: string
          position: number
          user_id: string
        }
        Update: {
          list_id?: string
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_priority_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "booking_priority_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_priority_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_priority_lists: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      booking_settings: {
        Row: {
          id: boolean
          priority_enabled: boolean
          priority_user_id: string | null
        }
        Insert: {
          id?: boolean
          priority_enabled?: boolean
          priority_user_id?: string | null
        }
        Update: {
          id?: boolean
          priority_enabled?: boolean
          priority_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_settings_priority_user_id_fkey"
            columns: ["priority_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_slugs: {
        Row: {
          created_at: string
          owner_id: string
          slug: string
        }
        Insert: {
          created_at?: string
          owner_id: string
          slug: string
        }
        Update: {
          created_at?: string
          owner_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_slugs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          created_at: string
          duration_minutes: number
          email: string | null
          id: string
          lead_id: string | null
          link_owner_id: string | null
          name: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["booking_status"]
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          email?: string | null
          id?: string
          lead_id?: string | null
          link_owner_id?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["booking_status"]
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          email?: string | null
          id?: string
          lead_id?: string | null
          link_owner_id?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
        }
        Relationships: [
          {
            foreignKeyName: "bookings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_link_owner_id_fkey"
            columns: ["link_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          deadline_note: string | null
          editor_id: string | null
          id: string
          kind: string
          label: string
          slug: string
        }
        Insert: {
          created_at?: string
          deadline_note?: string | null
          editor_id?: string | null
          id?: string
          kind: string
          label: string
          slug: string
        }
        Update: {
          created_at?: string
          deadline_note?: string | null
          editor_id?: string | null
          id?: string
          kind?: string
          label?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_messages: {
        Row: {
          author_id: string | null
          body: string
          channel_id: string
          created_at: string
          file_name: string | null
          file_url: string | null
          id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          channel_id: string
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          channel_id?: string
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      editor_daily_status: {
        Row: {
          editor_id: string
          id: string
          status: string
          status_date: string
          updated_at: string
        }
        Insert: {
          editor_id: string
          id?: string
          status?: string
          status_date?: string
          updated_at?: string
        }
        Update: {
          editor_id?: string
          id?: string
          status?: string
          status_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "editor_daily_status_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      editor_cards: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          editor_id: string
          id: string
          reason: string
        }
        Insert: {
          color: string
          created_at?: string
          created_by?: string | null
          editor_id: string
          id?: string
          reason: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          editor_id?: string
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "editor_cards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "editor_cards_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      editor_clip_stock: {
        Row: {
          clips_remaining: number
          clips_total: number
          editor_id: string
          updated_at: string
        }
        Insert: {
          clips_remaining?: number
          clips_total?: number
          editor_id: string
          updated_at?: string
        }
        Update: {
          clips_remaining?: number
          clips_total?: number
          editor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "editor_clip_stock_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_calendar: {
        Row: {
          clip_type: string
          created_at: string
          created_by: string | null
          day: string
          editor_id: string
          file_name: string | null
          file_path: string | null
          file_url: string | null
          id: string
          status: string
          updated_at: string
          uploaded_at: string | null
        }
        Insert: {
          clip_type: string
          created_at?: string
          created_by?: string | null
          day: string
          editor_id: string
          file_name?: string | null
          file_path?: string | null
          file_url?: string | null
          id?: string
          status?: string
          updated_at?: string
          uploaded_at?: string | null
        }
        Update: {
          clip_type?: string
          created_at?: string
          created_by?: string | null
          day?: string
          editor_id?: string
          file_name?: string | null
          file_path?: string | null
          file_url?: string | null
          id?: string
          status?: string
          updated_at?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_calendar_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_calendar_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          expiry_date: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          lead_id: string | null
          notes: string | null
          owner_id: string | null
          signed_date: string | null
          status: Database["public"]["Enums"]["document_status"]
          title: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          value_total: number | null
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          owner_id?: string | null
          signed_date?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          title: string
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          value_total?: number | null
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          owner_id?: string | null
          signed_date?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          title?: string
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          value_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          body: string
          booking_id: string | null
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          is_html: boolean
          send_at: string
          sent_at: string | null
          status: string
          subject: string
          template_id: string | null
          to_email: string
          to_name: string | null
        }
        Insert: {
          body: string
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          is_html?: boolean
          send_at?: string
          sent_at?: string | null
          status?: string
          subject: string
          template_id?: string | null
          to_email: string
          to_name?: string | null
        }
        Update: {
          body?: string
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          is_html?: boolean
          send_at?: string
          sent_at?: string | null
          status?: string
          subject?: string
          template_id?: string | null
          to_email?: string
          to_name?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          delay_minutes: number
          enabled: boolean
          id: string
          is_html: boolean
          name: string
          position: number
          subject: string
        }
        Insert: {
          body: string
          created_at?: string
          delay_minutes?: number
          enabled?: boolean
          id?: string
          is_html?: boolean
          name: string
          position?: number
          subject: string
        }
        Update: {
          body?: string
          created_at?: string
          delay_minutes?: number
          enabled?: boolean
          id?: string
          is_html?: boolean
          name?: string
          position?: number
          subject?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          document_id: string | null
          due_date: string | null
          id: string
          issue_date: string
          lead_id: string | null
          notes: string | null
          number: string
          owner_id: string | null
          paid_date: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          document_id?: string | null
          due_date?: string | null
          id?: string
          issue_date?: string
          lead_id?: string | null
          notes?: string | null
          number?: string
          owner_id?: string | null
          paid_date?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          document_id?: string | null
          due_date?: string | null
          id?: string
          issue_date?: string
          lead_id?: string | null
          notes?: string | null
          number?: string
          owner_id?: string | null
          paid_date?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          description: string
          enabled: boolean
          id: string
          kind: Database["public"]["Enums"]["automation_kind"]
          label: string
          threshold: number
          updated_at: string
        }
        Insert: {
          description: string
          enabled?: boolean
          id?: string
          kind: Database["public"]["Enums"]["automation_kind"]
          label: string
          threshold?: number
          updated_at?: string
        }
        Update: {
          description?: string
          enabled?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["automation_kind"]
          label?: string
          threshold?: number
          updated_at?: string
        }
        Relationships: []
      }
      automation_log: {
        Row: {
          created_at: string
          id: string
          rule_kind: Database["public"]["Enums"]["automation_kind"]
          summary: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          rule_kind: Database["public"]["Enums"]["automation_kind"]
          summary: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          rule_kind?: Database["public"]["Enums"]["automation_kind"]
          summary?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string
          id: string
          last_activity_at: string
          name: string
          notes: string | null
          owner_id: string | null
          source: string
          stage: Database["public"]["Enums"]["lead_stage"]
          updated_at: string
          value_monthly: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_activity_at?: string
          name: string
          notes?: string | null
          owner_id?: string | null
          source?: string
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
          value_monthly?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_activity_at?: string
          name?: string
          notes?: string | null
          owner_id?: string | null
          source?: string
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
          value_monthly?: number
        }
        Relationships: [
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          title: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          booking_slug: string | null
          created_at: string
          full_name: string
          id: string
          initials: string
          is_super_admin: boolean
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          booking_slug?: string | null
          created_at?: string
          full_name: string
          id: string
          initials: string
          is_super_admin?: boolean
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          booking_slug?: string | null
          created_at?: string
          full_name?: string
          id?: string
          initials?: string
          is_super_admin?: boolean
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          deadline: string | null
          id: string
          lead_id: string | null
          notes: string | null
          owner_id: string | null
          stage: Database["public"]["Enums"]["project_stage"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          owner_id?: string | null
          stage?: Database["public"]["Enums"]["project_stage"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          owner_id?: string | null
          stage?: Database["public"]["Enums"]["project_stage"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          done: boolean
          id: string
          position: number
          project_id: string
          title: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          done?: boolean
          id?: string
          position?: number
          project_id: string
          title: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          done?: boolean
          id?: string
          position?: number
          project_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_files: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          project_id: string
          status_label: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          name: string
          project_id: string
          status_label?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          project_id?: string
          status_label?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_access: {
        Row: {
          can_edit: boolean | null
          can_view: boolean | null
          menu: string
          user_id: string
        }
        Insert: {
          can_edit?: boolean | null
          can_view?: boolean | null
          menu: string
          user_id: string
        }
        Update: {
          can_edit?: boolean | null
          can_view?: boolean | null
          menu?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      book_slot: {
        Args: {
          p_email: string
          p_name: string
          p_phone: string
          p_slot: string
          p_slug: string
        }
        Returns: Json
      }
      ensure_booking_slug: { Args: never; Returns: string }
      my_access: { Args: never; Returns: Json }
      get_booking_host: {
        Args: { p_slug: string }
        Returns: {
          full_name: string
          initials: string
        }[]
      }
      list_available_slots: {
        Args: { p_from: string; p_slug: string; p_to: string }
        Returns: {
          slot: string
          with_owner: boolean
        }[]
      }
      create_public_booking: {
        Args: {
          p_email: string
          p_name: string
          p_phone: string
          p_scheduled_at: string
        }
        Returns: string
      }
      current_role_name: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_role"]
      }
      run_automations: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      list_taken_slots: {
        Args: { p_from: string; p_to: string }
        Returns: { scheduled_at: string }[]
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "vanzari" | "editor"
      automation_kind: "lead_inactiv" | "document_expira" | "factura_restanta" | "stoc_clipuri_redus"
      booking_status: "confirmat" | "anulat"
      document_status: "draft" | "trimis" | "semnat" | "expirat"
      document_type: "contract" | "anexa" | "oferta" | "altul"
      invoice_status: "neplatita" | "platita" | "restanta" | "anulata"
      lead_stage: "nou" | "discutie" | "confirmat" | "lucru" | "finalizat"
      project_stage:
        | "de_pornit"
        | "filmare"
        | "montaj"
        | "revizuire_client"
        | "finalizat"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]
export type Enums<T extends keyof DefaultSchema["Enums"]> =
  DefaultSchema["Enums"][T]
