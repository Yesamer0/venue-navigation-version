import { authErrorMessage } from './authService';
import { createRecoveryClient } from './supabase';

export function createPasswordRecovery() {
  const { auth } = createRecoveryClient();
  let verified = false;

  return {
    async requestCode(input) {
      const email = String(input || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Geçerli bir e-posta adresi yaz.');
      const { error } = await auth.resetPasswordForEmail(email);
      if (error && !['user_not_found', 'email_address_not_authorized'].includes(error.code)) {
        throw new Error(authErrorMessage(error));
      }
      return email;
    },

    async verifyCode(email, input) {
      const token = input.trim();
      if (!/^\d{6,10}$/.test(token)) throw new Error('E-postadaki sayısal kodu gir.');
      const { data, error } = await auth.verifyOtp({ email, token, type: 'recovery' });
      if (error?.code === 'otp_expired' || (!error && !data?.session)) {
        throw new Error('Kod yanlış veya süresi dolmuş. Kodu kontrol et ya da yeni kod iste.');
      }
      if (error) throw new Error(authErrorMessage(error));
      verified = true;
    },

    async updatePassword(password, confirmation) {
      if (!verified) throw new Error('Önce e-posta kodunu doğrula.');
      if (password.length < 8 || password.length > 128) throw new Error('Şifre 8–128 karakter olmalı.');
      if (password !== confirmation) throw new Error('Şifreler eşleşmiyor.');
      const { error } = await auth.updateUser({ password });
      if (error?.code === 'same_password') throw new Error('Önceki şifrenden farklı bir şifre seç.');
      if (error) throw new Error(authErrorMessage(error));
      verified = false;
      await auth.signOut({ scope: 'local' }).catch(() => {});
    },
  };
}
