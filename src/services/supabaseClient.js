import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('As variáveis de ambiente do Supabase não estão configuradas no .env.local!');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,       // Garante que a sessão é guardada no localStorage
    autoRefreshToken: true,     // Renova o token automaticamente antes de expirar
    detectSessionInUrl: true,   // Deteta a sessão caso venha de um link de autenticação
    storage: window.localStorage // Força o uso do armazenamento local do navegador
  }
});