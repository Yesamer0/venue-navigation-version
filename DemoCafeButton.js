import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from './AuthProvider';
import { supabase } from './supabase';
import { getFreshLocation } from './deviceLocation';

export default function DemoCafeButton({ navigation }) {
  const { profile } = useAuth();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const open = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error('Önce giriş yap.');
      const { data: allowed, error: accessError } = await supabase.rpc('can_use_demo_cafe');
      if (accessError) throw accessError;
      if (!allowed) throw new Error('Bu hesap deneme kafesini kullanamaz.');
      const position = await getFreshLocation();
      const { data: existing, error: lookupError } = await supabase.from('venues').select('*')
        .eq('owner_id', auth.user.id).eq('name', 'deneme').order('id').limit(1).maybeSingle();
      if (lookupError) throw lookupError;
      const coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      const query = existing
        ? supabase.from('venues').update(coordinates).eq('id', existing.id).eq('owner_id', auth.user.id)
        : supabase.from('venues').insert({ ...coordinates, name: 'deneme', category: 'Kafe',
          description: 'Menü fotoğrafı ve check-in denemesi için oluşturulmuştur.',
          owner_id: auth.user.id, photo_closing_time: '23:59:00', photo_timezone: 'Europe/Istanbul' });
      const { data: cafe, error: saveError } = await query.select().single();
      if (saveError) throw saveError;
      navigation.navigate('Details', { item: cafe });
    } catch (error) { Alert.alert('Deneme kafesi açılamadı', error.message); }
    finally { lock.current = false; setBusy(false); }
  };
  if (profile?.is_venue !== true || profile.username?.trim().toLowerCase() !== 'mekancı') return null;
  return <View style={{ padding: 16 }}>
    <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={open}>
      <Text style={{ color: '#666', marginTop: 6 }}>Deneme kafesi güncel konumunda açılır.</Text>
    </TouchableOpacity>
    <Text style={{ color: '#666', marginTop: 6 }}>Mekan hesabı kafeyi güncel konumunda hazırlar. Gezgin hesabı aynı kafeyi ziyaret eder ve check-in yapabilir. Ziyaretçilerde gezgin kareleri pembe, mekan paylaşımları mavidir; mekan sahibi en fazla 3 kendi fotoğrafını sabitler.</Text>
  </View>;
}
