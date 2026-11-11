import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { supabase } from './supabase';
import { getFreshLocation } from './deviceLocation';

export default function DemoCafeButton({ navigation }) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const open = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error('Önce giriş yap.');
      const { data: profile, error: roleError } = await supabase.from('users').select('is_venue').eq('id', auth.user.id).maybeSingle();
      if (roleError) throw roleError;
      if (profile?.is_venue !== true) {
        const { data: cafe, error } = await supabase.rpc('get_demo_cafe');
        if (error) throw error;
        if (!cafe) throw new Error('Deneme kafesini önce mekan hesabından oluştur.');
        navigation.navigate('Details', { item: cafe });
        return;
      }
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
  return <View style={{ padding: 16 }}>
    <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={open}>
      <Text style={{ color: '#9B1B4D', fontWeight: '700' }}>{busy ? 'Deneme kafesi açılıyor…' : '☕ deneme kafesini aç'}</Text>
    </TouchableOpacity>
    <Text style={{ color: '#666', marginTop: 6 }}>Mekan hesabı kafeyi güncel konumunda hazırlar. Gezgin hesabı aynı kafeyi ziyaret eder ve check-in yapabilir. Ziyaretçilerde gezgin kareleri pembe, mekan paylaşımları mavidir; mekan sahibi en fazla 3 kendi fotoğrafını sabitler.</Text>
  </View>;
}
