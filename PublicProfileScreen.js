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
    const load = async () => {
      const { data: venue, error: venueError } = await supabase.from('venues').select('*').eq('owner_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!active) return;
      if (venueError) throw venueError;
      if (venue) {
        navigation.replace('Details', { item: venue });
        return;
      }
      const { data, error: e } = await supabase.rpc('get_venue_moment_profile', { p_user_id: userId });
      if (!active) return;
      if (e) setError(friendlyError(e));
      else if (!data?.length) setError('Profil bulunamadı.');
      else setProfile(data[0]);
    };
    load().catch((e) => { if (active) setError(friendlyError(e)); });
    return () => { active = false; };
  }, [userId, navigation]);
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
