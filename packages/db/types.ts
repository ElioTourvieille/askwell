// Écrit à la main pour refléter les migrations 20261117150000 et 20261117160000 (le générateur ne peut pas
// tourner avant que les migrations soient appliquées au projet de développement, après la fusion).
// Sera remplacé par la sortie de `pnpm db:types` (neon-js gen-types).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          clerk_user_id: string;
          created_at: string;
          plan: string;
        };
        Insert: {
          clerk_user_id: string;
          created_at?: string;
          plan?: string;
        };
        Update: {
          clerk_user_id?: string;
          created_at?: string;
          plan?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          created_at: string;
          id: string;
          messages_used: number;
          name: string;
          owner_id: string;
          period_start: string;
          public_key: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          messages_used?: number;
          name: string;
          owner_id: string;
          period_start?: string;
          public_key: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          messages_used?: number;
          name?: string;
          owner_id?: string;
          period_start?: string;
          public_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["clerk_user_id"];
          },
        ];
      };
      widget_configs: {
        Row: {
          animation: string;
          button_color: string;
          header_text: string;
          label: string;
          position: string;
          project_id: string;
          show_badge: boolean;
        };
        Insert: {
          animation?: string;
          button_color?: string;
          header_text?: string;
          label?: string;
          position?: string;
          project_id: string;
          show_badge?: boolean;
        };
        Update: {
          animation?: string;
          button_color?: string;
          header_text?: string;
          label?: string;
          position?: string;
          project_id?: string;
          show_badge?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "widget_configs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: true;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      knowledge_sources: {
        Row: {
          created_at: string;
          id: string;
          project_id: string;
          status: string;
          storage_key: string | null;
          title: string;
          type: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          project_id: string;
          status?: string;
          storage_key?: string | null;
          title: string;
          type: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          project_id?: string;
          status?: string;
          storage_key?: string | null;
          title?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_sources_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      knowledge_chunks: {
        Row: {
          content: string;
          embedding: string;
          id: string;
          project_id: string;
          source_id: string;
        };
        Insert: {
          content: string;
          embedding: string;
          id?: string;
          project_id: string;
          source_id: string;
        };
        Update: {
          content?: string;
          embedding?: string;
          id?: string;
          project_id?: string;
          source_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "knowledge_chunks_source_id_project_id_fkey";
            columns: ["source_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "knowledge_sources";
            referencedColumns: ["id", "project_id"];
          },
        ];
      };
      conversations: {
        Row: {
          created_at: string;
          id: string;
          project_id: string;
          visitor_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          project_id: string;
          visitor_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          project_id?: string;
          visitor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          body: string;
          conversation_id: string;
          created_at: string;
          id: string;
          role: string;
        };
        Insert: {
          body: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          role: string;
        };
        Update: {
          body?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      schema_migrations: {
        Row: {
          applied_at: string;
          version: string;
        };
        Insert: {
          applied_at?: string;
          version: string;
        };
        Update: {
          applied_at?: string;
          version?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      consume_message: {
        Args: { p_max_messages: number; p_project_id: string };
        Returns: boolean;
      };
      create_project: {
        Args: { p_max_projects: number; p_name: string; p_owner_id: string };
        Returns: {
          created_at: string;
          id: string;
          messages_used: number;
          name: string;
          owner_id: string;
          period_start: string;
          public_key: string;
        };
      };
      match_chunks: {
        Args: { p_embedding: string; p_limit?: number; p_project_id: string };
        Returns: {
          content: string;
          id: string;
          similarity: number;
          source_id: string;
        }[];
      };
      owned_conversation_ids: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      owned_project_ids: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      owner_activity: {
        Args: Record<PropertyKey, never>;
        Returns: {
          conversation_count: number;
          messages_used: number;
          period_start: string;
          project_id: string;
          source_count: number;
        }[];
      };
      reserve_knowledge_source: {
        Args: {
          p_max_sources: number;
          p_project_id: string;
          p_storage_key: string | null;
          p_title: string;
          p_type: string;
        };
        Returns: {
          created_at: string;
          id: string;
          project_id: string;
          status: string;
          storage_key: string | null;
          title: string;
          type: string;
        };
      };
      save_chat_turn: {
        Args: {
          p_bot_body: string;
          p_conversation_id: string | null;
          p_project_id: string;
          p_visitor_body: string;
          p_visitor_id: string;
        };
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
