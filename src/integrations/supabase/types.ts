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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          cfdi_use: string | null
          company_id: string | null
          created_at: string
          email: string | null
          id: string
          is_favorite: boolean
          legal_name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          rfc: string
          tax_regime: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cfdi_use?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_favorite?: boolean
          legal_name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          rfc: string
          tax_regime?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cfdi_use?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_favorite?: boolean
          legal_name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          rfc?: string
          tax_regime?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          branch: string | null
          city: string | null
          created_at: string
          csd_cer_url: string | null
          csd_key_url: string | null
          csd_password_encrypted: string | null
          email: string | null
          id: string
          is_default: boolean
          legal_name: string
          logo_url: string | null
          phone: string | null
          postal_code: string | null
          rfc: string
          state: string | null
          tax_regime: string | null
          trade_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          branch?: string | null
          city?: string | null
          created_at?: string
          csd_cer_url?: string | null
          csd_key_url?: string | null
          csd_password_encrypted?: string | null
          email?: string | null
          id?: string
          is_default?: boolean
          legal_name: string
          logo_url?: string | null
          phone?: string | null
          postal_code?: string | null
          rfc: string
          state?: string | null
          tax_regime?: string | null
          trade_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          branch?: string | null
          city?: string | null
          created_at?: string
          csd_cer_url?: string | null
          csd_key_url?: string | null
          csd_password_encrypted?: string | null
          email?: string | null
          id?: string
          is_default?: boolean
          legal_name?: string
          logo_url?: string | null
          phone?: string | null
          postal_code?: string | null
          rfc?: string
          state?: string | null
          tax_regime?: string | null
          trade_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          discount: number
          id: string
          invoice_id: string
          iva_amount: number
          iva_rate: number
          position: number
          product_id: string | null
          quantity: number
          sat_key: string
          sat_unit: string
          unit_price: number
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          discount?: number
          id?: string
          invoice_id: string
          iva_amount?: number
          iva_rate?: number
          position?: number
          product_id?: string | null
          quantity?: number
          sat_key: string
          sat_unit: string
          unit_price?: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          discount?: number
          id?: string
          invoice_id?: string
          iva_amount?: number
          iva_rate?: number
          position?: number
          product_id?: string | null
          quantity?: number
          sat_key?: string
          sat_unit?: string
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cfdi_use: string | null
          client_id: string | null
          client_snapshot: Json | null
          company_id: string | null
          created_at: string
          currency: string
          discount: number
          exchange_rate: number
          folio: number
          id: string
          issued_at: string | null
          iva_total: number
          notes: string | null
          payment_form: string | null
          payment_method: string | null
          pdf_url: string | null
          retentions_total: number
          series: string
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          total: number
          updated_at: string
          user_id: string
          uuid_fiscal: string | null
          xml_url: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cfdi_use?: string | null
          client_id?: string | null
          client_snapshot?: Json | null
          company_id?: string | null
          created_at?: string
          currency?: string
          discount?: number
          exchange_rate?: number
          folio: number
          id?: string
          issued_at?: string | null
          iva_total?: number
          notes?: string | null
          payment_form?: string | null
          payment_method?: string | null
          pdf_url?: string | null
          retentions_total?: number
          series?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id: string
          uuid_fiscal?: string | null
          xml_url?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cfdi_use?: string | null
          client_id?: string | null
          client_snapshot?: Json | null
          company_id?: string | null
          created_at?: string
          currency?: string
          discount?: number
          exchange_rate?: number
          folio?: number
          id?: string
          issued_at?: string | null
          iva_total?: number
          notes?: string | null
          payment_form?: string | null
          payment_method?: string | null
          pdf_url?: string | null
          retentions_total?: number
          series?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string
          uuid_fiscal?: string | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string | null
          paid_at: string
          payment_form: string | null
          reference: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          paid_at?: string
          payment_form?: string | null
          reference?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          paid_at?: string
          payment_form?: string | null
          reference?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          company_id: string | null
          created_at: string
          description: string
          id: string
          internal_code: string | null
          is_active: boolean
          iva_rate: number
          sat_key: string
          sat_unit: string
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          description: string
          id?: string
          internal_code?: string | null
          is_active?: boolean
          iva_rate?: number
          sat_key: string
          sat_unit: string
          unit_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          description?: string
          id?: string
          internal_code?: string | null
          is_active?: boolean
          iva_rate?: number
          sat_key?: string
          sat_unit?: string
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          biometrics_enabled: boolean
          default_cfdi_use: string | null
          default_payment_form: string | null
          default_payment_method: string | null
          notifications_enabled: boolean
          pin_enabled: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          biometrics_enabled?: boolean
          default_cfdi_use?: string | null
          default_payment_form?: string | null
          default_payment_method?: string | null
          notifications_enabled?: boolean
          pin_enabled?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          biometrics_enabled?: boolean
          default_cfdi_use?: string | null
          default_payment_form?: string | null
          default_payment_method?: string | null
          notifications_enabled?: boolean
          pin_enabled?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      invoice_status: "draft" | "issued" | "cancelled" | "error"
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
    Enums: {
      app_role: ["admin", "user"],
      invoice_status: ["draft", "issued", "cancelled", "error"],
    },
  },
} as const
