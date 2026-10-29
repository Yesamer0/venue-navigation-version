import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { supabase } from './supabase';
import MomentFeed from './MomentFeed';
import { friendlyError } from './momentApi';

export default function PublicProfileScreen({ route, navigation }) {
  const { userId } = route.params;
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setProfile(null); setError('');
    supabase.rpc('get_venue_moment_profile', { p_user_id: userId }).then(({ data, error: e }) => {
      if (!active) return;
      if (e) setError(friendlyError(e));
      else if (!data?.length) setError('Profil bulunamadı.');
      else setProfile(data[0]);
    }).catch((e) => { if (active) setError(friendlyError(e)); });
    return () => { active = false; };
  }, [userId]);
  return <ScrollView style={{ flex: 1, backgroundColor: '#FFF9FC' }}>
    <View style={{ padding: 24, alignItems: 'center' }}>
      {error ? <Text style={{ color: '#B42318' }}>{error}</Text> : profile ? <>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFEAF2', justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: '#C2185B', fontSize: 30 }}>{profile.username?.charAt(0).toUpperCase() || 'V'}</Text></View>
        <Text style={{ fontSize: 22, color: '#9B1B4D', fontWeight: '700', marginTop: 12 }}>@{profile.username}</Text>
        <Text style={{ color: '#777', marginTop: 8 }}>Mekânlardan paylaşılan anlar</Text>
      </> : <ActivityIndicator color="#C2185B" />}
    </View>
    {!error && profile ? <MomentFeed userId={userId} navigation={navigation} /> : null}
  </ScrollView>;
}
