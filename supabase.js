import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createClient, processLock } from '@supabase/supabase-js';

const supabaseUrl = 'https://rkqsobflqmkqzuzmiagn.supabase.co'; 
const supabaseAnonKey = 'sb_publishable_F-QSJaAP_CosUVQyHW_80Q_h7u3GAH5';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === 'web',
    lock: processLock,
  },
});
