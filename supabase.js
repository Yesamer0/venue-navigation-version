import { createClient } from '@supabase/supabase-js'; // <-- HATALI KISIM DOĞRUSUYLA DEĞİŞTİRİLDİ

const supabaseUrl = 'https://rkqsobflqmkqzuzmiagn.supabase.co'; 
const supabaseAnonKey = 'sb_publishable_F-QSJaAP_CosUVQyHW_80Q_h7u3GAH5';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);