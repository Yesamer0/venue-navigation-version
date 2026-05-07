import { createClient } from '@supabase/supabase-js';

// Project URL:image_b292e1.png şemana ulaşmak için gereken adres
const supabaseUrl = 'https://rkqsobflqmkqzuzmiagn.supabase.co'; 

// Anon Public Key: Paylaştığın 'ey...' ile başlayan uzun anahtar
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcXNvYmZscW1rcXp1em1pYWduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNjgxNDQsImV4cCI6MjA5Mjk0NDE0NH0.5tbkqwpGhiHnoE2XWZxBoWAfPPXUPXQq-45ovBYOO1c'; 

// İstemciyi oluşturup dışarı aktarıyoruz
export const supabase = createClient(supabaseUrl, supabaseAnonKey);