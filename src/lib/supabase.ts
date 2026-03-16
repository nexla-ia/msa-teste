import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      usuarios: {
        Row: {
          id: string;
          nome: string;
          email: string;
          senha: string;
          nivel_acesso: 'ADM' | 'USER';
          ultima_acao: string | null;
          token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['usuarios']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['usuarios']['Insert']>;
      };
      clientes: {
        Row: {
          id: string;
          nome_cliente: string;
          endereco: string;
          email: string;
          telefone: string;
          whatsapp: string;
          contato: string;
          site: string;
          instagram: string;
          created_at: string;
          updated_at: string;
        };
      };
      logs: {
        Row: {
          id: string;
          data_hora: string;
          usuario_id: string;
          usuario_nome: string;
          acao: string;
          linha_afetada: string;
          dados_antes: any;
          dados_depois: any;
          created_at: string;
        };
      };
    };
  };
};
