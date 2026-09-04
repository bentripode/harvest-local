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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string
          country: string
          created_at: string
          id: string
          is_default: boolean
          label: string | null
          line1: string
          line2: string | null
          location: unknown
          postal_code: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          line1: string
          line2?: string | null
          location?: unknown
          postal_code: string
          state: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          line1?: string
          line2?: string | null
          location?: unknown
          postal_code?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          tax_code: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          tax_code?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          tax_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          last_message_at: string | null
          order_id: string | null
          seller_id: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          order_id?: string | null
          seller_id: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          order_id?: string | null
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          attempt_count: number
          channel: string
          created_at: string
          error: string | null
          id: string
          payload: Json
          read_at: string | null
          sent_at: string | null
          status: string
          template: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          payload?: Json
          read_at?: string | null
          sent_at?: string | null
          status?: string
          template: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          payload?: Json
          read_at?: string | null
          sent_at?: string | null
          status?: string
          template?: string
          user_id?: string
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
      order_items: {
        Row: {
          category_snapshot: string | null
          id: string
          line_total: number
          order_id: string
          product_id: string
          quantity: number
          tax_code: string | null
          title_snapshot: string
          unit_price: number
        }
        Insert: {
          category_snapshot?: string | null
          id?: string
          line_total: number
          order_id: string
          product_id: string
          quantity: number
          tax_code?: string | null
          title_snapshot: string
          unit_price: number
        }
        Update: {
          category_snapshot?: string | null
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string
          quantity?: number
          tax_code?: string | null
          title_snapshot?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          order_id: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          order_id: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          order_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_id: string
          buyer_state: string
          created_at: string
          delivery_address_id: string | null
          delivery_address_text: string | null
          delivery_distance_miles: number | null
          delivery_fee: number
          delivery_window: string | null
          discount_total: number
          fulfillment_type: string
          id: string
          promo_code_id: string | null
          revenue_recorded_at: string | null
          seller_id: string
          seller_state: string
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
        }
        Insert: {
          buyer_id: string
          buyer_state: string
          created_at?: string
          delivery_address_id?: string | null
          delivery_address_text?: string | null
          delivery_distance_miles?: number | null
          delivery_fee?: number
          delivery_window?: string | null
          discount_total?: number
          fulfillment_type?: string
          id?: string
          promo_code_id?: string | null
          revenue_recorded_at?: string | null
          seller_id: string
          seller_state: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal: number
          tax_total?: number
          total: number
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          buyer_state?: string
          created_at?: string
          delivery_address_id?: string | null
          delivery_address_text?: string | null
          delivery_distance_miles?: number | null
          delivery_fee?: number
          delivery_window?: string | null
          discount_total?: number
          fulfillment_type?: string
          id?: string
          promo_code_id?: string | null
          revenue_recorded_at?: string | null
          seller_id?: string
          seller_state?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tags: {
        Row: {
          product_id: string
          tag_id: string
        }
        Insert: {
          product_id: string
          tag_id: string
        }
        Update: {
          product_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      product_view_counts: {
        Row: {
          day: string
          product_id: string
          views: number
        }
        Insert: {
          day?: string
          product_id: string
          views?: number
        }
        Update: {
          day?: string
          product_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_view_counts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          images: Json
          price: number
          quantity_available: number | null
          search_tsv: unknown
          seller_id: string
          status: string
          subcategory_id: string | null
          tax_code: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          images?: Json
          price: number
          quantity_available?: number | null
          search_tsv?: unknown
          seller_id: string
          status?: string
          subcategory_id?: string | null
          tax_code?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          images?: Json
          price?: number
          quantity_available?: number | null
          search_tsv?: unknown
          seller_id?: string
          status?: string
          subcategory_id?: string | null
          tax_code?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          home_state: string | null
          id: string
          notification_prefs: Json
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          home_state?: string | null
          id: string
          notification_prefs?: Json
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          home_state?: string | null
          id?: string
          notification_prefs?: Json
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          seller_id: string
          times_used: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          seller_id: string
          times_used?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          seller_id?: string
          times_used?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          window_start: string
        }
        Update: {
          bucket?: string
          count?: number
          window_start?: string
        }
        Relationships: []
      }
      referral_cycles: {
        Row: {
          active_referral_count: number
          closed_at: string | null
          created_at: string
          id: string
          period_end: string
          period_start: string
          reward_granted: boolean
          reward_stripe_coupon_id: string | null
          seller_id: string
          subscription_id: string
        }
        Insert: {
          active_referral_count?: number
          closed_at?: string | null
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          reward_granted?: boolean
          reward_stripe_coupon_id?: string | null
          seller_id: string
          subscription_id: string
        }
        Update: {
          active_referral_count?: number
          closed_at?: string | null
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          reward_granted?: boolean
          reward_stripe_coupon_id?: string | null
          seller_id?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_cycles_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_cycles_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          activated_at: string | null
          buyer_id: string
          created_at: string
          cycle_id: string | null
          discount_amount: number
          id: string
          invalidated_at: string | null
          order_id: string
          promo_code_id: string
          seller_id: string
          status: string
        }
        Insert: {
          activated_at?: string | null
          buyer_id: string
          created_at?: string
          cycle_id?: string | null
          discount_amount?: number
          id?: string
          invalidated_at?: string | null
          order_id: string
          promo_code_id: string
          seller_id: string
          status?: string
        }
        Update: {
          activated_at?: string | null
          buyer_id?: string
          created_at?: string
          cycle_id?: string | null
          discount_amount?: number
          id?: string
          invalidated_at?: string | null
          order_id?: string
          promo_code_id?: string
          seller_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "referral_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          id: string
          initiated_by: string | null
          order_id: string
          reason: string | null
          report_id: string | null
          stripe_refund_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          initiated_by?: string | null
          order_id: string
          reason?: string | null
          report_id?: string | null
          stripe_refund_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          initiated_by?: string | null
          order_id?: string
          reason?: string | null
          report_id?: string | null
          stripe_refund_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          order_id: string
          reason: string
          reporter_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          order_id: string
          reason: string
          reporter_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string
          reason?: string
          reporter_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string | null
          created_at: string
          id: string
          order_id: string
          rating: number
          responded_at: string | null
          response: string | null
          reviewer_id: string
          seller_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          order_id: string
          rating: number
          responded_at?: string | null
          response?: string | null
          reviewer_id: string
          seller_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          order_id?: string
          rating?: number
          responded_at?: string | null
          response?: string | null
          reviewer_id?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_licenses: {
        Row: {
          created_at: string
          document_path: string | null
          expiration_date: string
          id: string
          issued_date: string | null
          issuing_state: string
          license_number: string | null
          license_type: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          seller_id: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          document_path?: string | null
          expiration_date: string
          id?: string
          issued_date?: string | null
          issuing_state: string
          license_number?: string | null
          license_type: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seller_id: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          document_path?: string | null
          expiration_date?: string
          id?: string
          issued_date?: string | null
          issuing_state?: string
          license_number?: string | null
          license_type?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seller_id?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_licenses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_licenses_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_profiles: {
        Row: {
          avg_rating: number | null
          bio: string | null
          business_name: string
          connect_charges_enabled: boolean
          connect_details_submitted: boolean
          connect_payouts_enabled: boolean
          created_at: string
          delivery_base_fee: number
          delivery_enabled: boolean
          delivery_per_mile_fee: number
          delivery_radius_miles: number | null
          delivery_windows: Json
          home_state: string
          id: string
          is_paused: boolean
          pause_reason: string | null
          pickup_address_id: string | null
          profile_id: string
          storefront_slug: string
          stripe_account_id: string | null
          updated_at: string
        }
        Insert: {
          avg_rating?: number | null
          bio?: string | null
          business_name: string
          connect_charges_enabled?: boolean
          connect_details_submitted?: boolean
          connect_payouts_enabled?: boolean
          created_at?: string
          delivery_base_fee?: number
          delivery_enabled?: boolean
          delivery_per_mile_fee?: number
          delivery_radius_miles?: number | null
          delivery_windows?: Json
          home_state: string
          id?: string
          is_paused?: boolean
          pause_reason?: string | null
          pickup_address_id?: string | null
          profile_id: string
          storefront_slug: string
          stripe_account_id?: string | null
          updated_at?: string
        }
        Update: {
          avg_rating?: number | null
          bio?: string | null
          business_name?: string
          connect_charges_enabled?: boolean
          connect_details_submitted?: boolean
          connect_payouts_enabled?: boolean
          created_at?: string
          delivery_base_fee?: number
          delivery_enabled?: boolean
          delivery_per_mile_fee?: number
          delivery_radius_miles?: number | null
          delivery_windows?: Json
          home_state?: string
          id?: string
          is_paused?: boolean
          pause_reason?: string | null
          pickup_address_id?: string | null
          profile_id?: string
          storefront_slug?: string
          stripe_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_profiles_pickup_address_id_fkey"
            columns: ["pickup_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_revenue_tracking: {
        Row: {
          cap_amount: number | null
          gross_revenue: number
          id: string
          is_over_cap: boolean
          period_year: number
          seller_id: string
          state: string
          updated_at: string
        }
        Insert: {
          cap_amount?: number | null
          gross_revenue?: number
          id?: string
          is_over_cap?: boolean
          period_year: number
          seller_id: string
          state: string
          updated_at?: string
        }
        Update: {
          cap_amount?: number | null
          gross_revenue?: number
          id?: string
          is_over_cap?: boolean
          period_year?: number
          seller_id?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_revenue_tracking_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_view_counts: {
        Row: {
          day: string
          seller_id: string
          views: number
        }
        Insert: {
          day?: string
          seller_id: string
          views?: number
        }
        Update: {
          day?: string
          seller_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "seller_view_counts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      state_cottage_food_rules: {
        Row: {
          allowed_categories: Json | null
          notes: string | null
          requires_license: boolean
          revenue_cap: number | null
          state_code: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed_categories?: Json | null
          notes?: string | null
          requires_license?: boolean
          revenue_cap?: number | null
          state_code: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed_categories?: Json | null
          notes?: string | null
          requires_license?: boolean
          revenue_cap?: number | null
          state_code?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "state_cottage_food_rules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          account_id: string | null
          error: string | null
          id: string
          payload: Json
          processed_at: string | null
          received_at: string
          type: string
        }
        Insert: {
          account_id?: string | null
          error?: string | null
          id: string
          payload: Json
          processed_at?: string | null
          received_at?: string
          type: string
        }
        Update: {
          account_id?: string | null
          error?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          received_at?: string
          type?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          seller_id: string
          status: string
          stripe_customer_id: string
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          trial_start: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          seller_id: string
          status?: string
          stripe_customer_id: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          seller_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          id: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_referral_for_order: {
        Args: { p_order_id: string }
        Returns: {
          cycle_count: number
          cycle_threshold: number
          granted: boolean
          reward_cycle_id: string
          reward_seller_id: string
          reward_subscription: string
        }[]
      }
      advance_order_status: {
        Args: { p_note?: string; p_order_id: string; p_to_status: string }
        Returns: {
          buyer_id: string
          buyer_state: string
          created_at: string
          delivery_address_id: string | null
          delivery_address_text: string | null
          delivery_distance_miles: number | null
          delivery_fee: number
          delivery_window: string | null
          discount_total: number
          fulfillment_type: string
          id: string
          promo_code_id: string | null
          revenue_recorded_at: string | null
          seller_id: string
          seller_state: string
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_secs: number }
        Returns: {
          allowed: boolean
          retry_after: number
        }[]
      }
      create_referral_for_order: {
        Args: { p_order_id: string }
        Returns: boolean
      }
      decrement_product_quantity: {
        Args: { p_product_id: string; p_qty: number }
        Returns: undefined
      }
      delivery_route_inputs: {
        Args: { p_lat: number; p_lng: number; p_seller_id: string }
        Returns: {
          base_fee: number
          deliverable: boolean
          per_mile_fee: number
          pickup_lat: number
          pickup_lng: number
          straight_miles: number
        }[]
      }
      ensure_open_referral_cycle: {
        Args: { p_seller_id: string }
        Returns: string
      }
      expire_seller_license: {
        Args: { p_license_id: string }
        Returns: boolean
      }
      finalize_paid_order: {
        Args: {
          p_discount_total: string
          p_order_id: string
          p_payment_intent_id: string
          p_tax_total: string
          p_total: string
        }
        Returns: boolean
      }
      get_or_create_conversation: {
        Args: { p_order_id?: string; p_seller_id: string }
        Returns: string
      }
      invalidate_referral_for_order: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: {
          ref_seller_id: string
          reward_at_risk: boolean
          was_active: boolean
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_conversation_participant: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      is_platform_context: { Args: never; Returns: boolean }
      is_service_role: { Args: never; Returns: boolean }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      mark_notifications_read: { Args: never; Returns: undefined }
      open_referral_cycle: {
        Args: {
          p_period_end: string
          p_period_start: string
          p_seller_id: string
        }
        Returns: string
      }
      recompute_seller_rating: {
        Args: { p_seller_id: string }
        Returns: undefined
      }
      record_order_revenue: {
        Args: { p_order_id: string }
        Returns: {
          cap: number
          gross: number
          over: boolean
          paused: boolean
        }[]
      }
      record_storefront_view: {
        Args: { p_product_ids?: string[]; p_seller_id: string }
        Returns: undefined
      }
      set_referral_reward_coupon: {
        Args: { p_coupon_id: string; p_cycle_id: string }
        Returns: undefined
      }
      upsert_address: {
        Args: {
          p_city?: string
          p_id?: string
          p_label?: string
          p_lat?: number
          p_line1?: string
          p_line2?: string
          p_lng?: number
          p_postal?: string
          p_state?: string
        }
        Returns: string
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
