import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { supabase } from './supabase';
import { registerForPushNotificationsAsync } from './pushNotifications';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const knownUser = useRef(undefined);
  const retry = useCallback(() => setAttempt(value => value + 1), []);

  useEffect(() => {
    let active = true, receivedEvent = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      receivedEvent = true;
      setSession(next);
      if (knownUser.current !== (next?.user?.id || null)) {
        knownUser.current = next?.user?.id || null;
        setProfile(null); setError(''); setLoading(!!next);
      }
    });
    supabase.auth.getSession().then(({ data, error: failure }) => {
      if (!active || receivedEvent) return;
      if (failure) { setError('Oturum yüklenemedi. Yeniden dene.'); setLoading(false); return; }
      knownUser.current = data.session?.user?.id || null;
      setError(''); setSession(data.session); setLoading(!!data.session);
    }).catch(() => { if (active && !receivedEvent) { setError('Oturum yüklenemedi. Yeniden dene.'); setLoading(false); } });
    if (Platform.OS !== 'web') {
      if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
      const stateSubscription = AppState.addEventListener('change', state => {
        if (state === 'active') supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh();
      });
      return () => { active = false; subscription.unsubscribe(); stateSubscription.remove(); supabase.auth.stopAutoRefresh(); };
    }
    return () => { active = false; subscription.unsubscribe(); };
  }, [attempt]);

  useEffect(() => {
    const version = ++generation.current;
    if (!session) { setProfile(null); return; }
    setLoading(true); setError('');
    const load = async () => {
      try {
        const { data: { user }, error: failure } = await supabase.auth.getUser();
        if (failure || !user || user.id !== session.user.id) throw new Error('Oturum doğrulanamadı. İnternetini kontrol edip tekrar dene.');
        const { data, error: profileFailure } = await supabase.rpc('ensure_current_profile');
        if (profileFailure || !data?.[0] || data[0].id !== session.user.id) throw new Error('Profil yüklenemedi. Yeniden dene.');
        if (version !== generation.current) return;
        setProfile(data[0]);
        // Notification registration never blocks entry to the app.
        void registerForPushNotificationsAsync(user.id).catch(() => {});
      } catch (failure) { if (version === generation.current) setError(failure.message); }
      finally { if (version === generation.current) setLoading(false); }
    };
    void load();
    return () => { generation.current++; };
  }, [session?.user?.id, attempt]);

  return <AuthContext.Provider value={{ session, profile, loading, error, retry }}>{children}</AuthContext.Provider>;
}
