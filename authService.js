import { supabase } from './supabase';

export function authErrorMessage(error) {
  const code = error?.code;
  if (code === 'invalid_credentials') return 'E-posta veya şifre yanlış.';
  if (code === 'email_not_confirmed') return 'Giriş yapmadan önce e-postandaki doğrulama bağlantısını aç.';
  if (['email_exists', 'user_already_exists'].includes(code)) return 'Bu e-posta zaten kayıtlı. Giriş yapmayı dene.';
  if (code === 'weak_password') return 'Daha güçlü bir şifre seç. En az 8 karakter kullan.';
  if (code === '23505' || error?.message?.includes('username_taken')) return 'Bu kullanıcı adı kullanılıyor. Başka bir ad seç.';
  if (['over_request_rate_limit', 'over_email_send_rate_limit'].includes(code) || error?.status === 429) return 'Çok fazla deneme yapıldı. Biraz bekleyip yeniden dene.';
  if (error?.name === 'AuthRetryableFetchError' || /network|fetch|timeout/i.test(error?.message || '')) return 'Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.';
  return 'İşlem tamamlanamadı. Yeniden dene.';
}

export function validateAuthInput({ username, email, password, registering }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(username || '').trim();
  if (!cleanEmail || !password || (registering && !cleanName)) throw new Error('Lütfen tüm alanları doldur.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error('Geçerli bir e-posta adresi yaz.');
  if (registering && (cleanName.length < 3 || cleanName.length > 30)) throw new Error('Kullanıcı adı 3–30 karakter olmalı.');
  if (registering && (password.length < 8 || password.length > 128)) throw new Error('Şifre 8–128 karakter olmalı.');
  return { email: cleanEmail, username: cleanName, password };
}

export async function signOutVenue() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    // Signing out must not leave the user visibly checked in after leaving the app.
    const { error } = await supabase.from('venue_presence').delete().eq('user_id', user.id);
    if (error) throw new Error('Çıkış tamamlanamadı. İnternetini kontrol edip tekrar dene.');
  }
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw new Error(authErrorMessage(error));
}
