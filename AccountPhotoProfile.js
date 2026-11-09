import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from './supabase';

export default function AccountPhotoProfile({ userId }) {
  const [photos, setPhotos] = useState([]);
  const [mine, setMine] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setMine(user?.id === userId);
      const { data, error: e } = await supabase.from('venue_account_photos').select('*').eq('user_id', userId).eq('profile_hidden', false).order('created_at', { ascending: false }).limit(300);
      if (e) throw e;
      setPhotos(data || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [userId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const hide = (photo) => Alert.alert('Profilimden kaldır', 'Fotoğraf mekanın Fotoğraflar bölümünde kalacak.', [
    { text: 'Vazgeç', style: 'cancel' }, { text: 'Kaldır', onPress: async () => {
      if (lock.current) return;
      lock.current = true;
      try {
        const { error: e } = await supabase.rpc('hide_photo_from_profile', { p_photo_id: photo.id, p_kind: 'account' });
        if (e) throw e;
        setPhotos(previous => previous.filter(p => p.id !== photo.id));
      } catch (e) { Alert.alert('Kaldırılamadı', e.message); }
      finally { lock.current = false; }
    } },
  ]);
  return <View style={{ padding: 16 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ color: '#9B1B4D', fontSize: 18, fontWeight: '700' }}>Mekan paylaşımları</Text>
      <TouchableOpacity onPress={load}><Text style={{ color: '#9B1B4D', padding: 10 }}>Yenile</Text></TouchableOpacity>
    </View>
    {loading && <ActivityIndicator color="#9B1B4D" />}
    {!!error && <Text style={{ color: '#B42318' }}>{error}</Text>}
    {!loading && !photos.length && !error && <Text style={{ color: '#777', paddingVertical: 12 }}>Henüz paylaşım yok.</Text>}
    {photos.map(photo => <View key={photo.id} style={{ marginVertical: 10 }}>
      <Text style={{ color: '#9B1B4D', fontWeight: '700', paddingVertical: 8 }}>@{photo.username || 'Kullanıcı'}</Text>
      <Image source={{ uri: supabase.storage.from('venue-account').getPublicUrl(photo.storage_path).data.publicUrl }} style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }} />
      {!!photo.caption && <Text style={{ paddingVertical: 8 }}>{photo.caption}</Text>}
      {mine && <TouchableOpacity onPress={() => hide(photo)}><Text style={{ color: '#777', paddingVertical: 10 }}>Profilimden kaldır</Text></TouchableOpacity>}
    </View>)}
  </View>;
}
