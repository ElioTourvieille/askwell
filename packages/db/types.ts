// Écrit à la main pour refléter la migration 20261117150000 (le générateur ne peut pas tourner
// avant que la migration soit appliquée au projet de développement, après la fusion).
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
      owned_project_ids: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
