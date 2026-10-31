import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from './supabase';
import { friendlyError, PAGE_SIZE, PHOTO_BUCKET, photoUrl } from './momentApi';

export default function MomentFeed({ venueId = null, userId = null, navigation, refreshKey = 0 }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState({});
  const generation = useRef(0);
  const busy = useRef(new Set());
  const fetching = useRef(false);

  const load = useCallback(async (append = false) => {
    if (append && fetching.current) return;
    const version = append ? generation.current : ++generation.current;
    fetching.current = true;
    setLoading(true); setError('');
    try {
      const { data, error: queryError } = await supabase.rpc('list_venue_moments', {
        p_venue_id: venueId == null ? null : String(venueId), p_user_id: userId,
        p_offset: append ? posts.length : 0, p_limit: PAGE_SIZE,
      });
      if (queryError) throw queryError;
      if (version !== generation.current) return;
      setPosts((previous) => append ? [...previous, ...(data || []).filter((p) => !previous.some((old) => old.id === p.id))] : data || []);
      setMore((data || []).length === PAGE_SIZE);
    } catch (e) {
      if (version === generation.current) setError(friendlyError(e));
    } finally {
      if (version === generation.current) { setLoading(false); fetching.current = false; }
    }
  }, [venueId, userId, posts.length]);

  const loadRef = useRef(load);
  loadRef.current = load;

  // Only filter/publication changes should reload; pagination must not reset the feed.
  useFocusEffect(useCallback(() => {
    load();
    const timer = setInterval(() => loadRef.current(), 30000);
    return () => { clearInterval(timer); generation.current += 1; fetching.current = false; };
  }, [venueId, userId, refreshKey]));

  const like = async (post) => {
    if (busy.current.has(post.id)) return;
    busy.current.add(post.id); setPending((p) => ({ ...p, [post.id]: true }));
    try {
      const { data, error: likeError } = await supabase.rpc('set_venue_moment_like', {
        p_moment_id: post.id, p_liked: !post.liked_by_me,
      });
      if (likeError) throw likeError;
      setPosts((previous) => previous.map((p) => p.id === post.id ? { ...p, ...data[0] } : p));
    } catch (e) { Alert.alert('Beğeni kaydedilemedi', friendlyError(e)); }
    finally { busy.current.delete(post.id); setPending((p) => ({ ...p, [post.id]: false })); }
  };

  const remove = async (post) => {
    if (busy.current.has(post.id)) return;
    busy.current.add(post.id); setPending((p) => ({ ...p, [post.id]: true }));
    try {
      if (userId) {
        const { error: hideError } = await supabase.rpc('hide_photo_from_profile', { p_photo_id: post.id, p_kind: 'visitor' });
        if (hideError) throw hideError;
        setPosts(previous => previous.filter(p => p.id !== post.id));
        return;
      }
      const { data, error: deleteError } = await supabase.from('venue_moments').delete().eq('id', post.id).select('id');
      if (deleteError) throw deleteError;
      if (!data?.length) throw new Error('Paylaşım silinemedi. Yeniden dene.');
      setPosts((previous) => previous.filter((p) => p.id !== post.id));
      const { error: storageError } = await supabase.storage.from(PHOTO_BUCKET).remove([post.storage_path]);
      if (storageError) console.log('Silinen paylaşımın dosyası temizlenemedi:', storageError.message);
    } catch (e) { Alert.alert('Silinemedi', friendlyError(e)); }
    finally { busy.current.delete(post.id); setPending((p) => ({ ...p, [post.id]: false })); }
  };

  return <View style={s.feed}>
    <View style={s.row}>
      <Text style={s.heading}>Paylaşılan fotoğraflar</Text>
      <TouchableOpacity accessibilityRole="button" disabled={loading} onPress={() => load()}><Text style={s.link}>Yenile</Text></TouchableOpacity>
    </View>
    {error ? <View accessibilityRole="alert"><Text style={s.error}>{error}</Text><TouchableOpacity onPress={() => load()}><Text style={s.link}>Tekrar dene</Text></TouchableOpacity></View> : null}
    {!loading && !error && !posts.length ? <Text style={s.muted}>Henüz fotoğraf paylaşılmamış.</Text> : null}
    {posts.map((post) => <View key={post.id} style={s.card}>
      <View style={s.row}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${post.username} profilini aç`} onPress={() => navigation.navigate('PublicProfile', { userId: post.user_id })}>
          <Text style={s.username}>@{post.username || 'Gezgin'}</Text>
        </TouchableOpacity>
        <Text style={s.date}>{new Date(post.created_at).toLocaleDateString('tr-TR')}</Text>
      </View>
      <TouchableOpacity onPress={() => navigation.navigate('MomentPhoto', { path: post.storage_path })} accessibilityRole="button" accessibilityLabel="Fotoğrafı büyüt">
        <Image source={{ uri: photoUrl(post.storage_path) }} style={s.photo} resizeMode="cover" accessibilityLabel={post.caption || 'Mekân fotoğrafı'} />
      </TouchableOpacity>
      <Text style={s.venue}>📍 {post.venue_name}</Text>
      {post.caption ? <Text style={s.caption}>{post.caption}</Text> : null}
      <View style={s.row}>
        <TouchableOpacity disabled={pending[post.id]} onPress={() => like(post)} accessibilityRole="button" accessibilityState={{ selected: post.liked_by_me, disabled: !!pending[post.id] }} accessibilityLabel={post.liked_by_me ? 'Beğeniyi kaldır' : 'Fotoğrafı beğen'}>
          <Text style={s.like}>{post.liked_by_me ? '♥' : '♡'} {post.like_count} beğeni</Text>
        </TouchableOpacity>
        {post.is_mine ? <TouchableOpacity disabled={pending[post.id]} onPress={() => Alert.alert(userId ? 'Profilimden kaldır' : 'Fotoğrafı sil', userId ? 'Mekandaki paylaşım kapanış saatine kadar kalır.' : 'Bu paylaşım mekandan ve profilden silinsin mi?', [
          { text: 'Vazgeç', style: 'cancel' }, { text: 'Sil', style: 'destructive', onPress: () => remove(post) },
        ])}><Text style={s.muted}>{userId ? 'Profilimden kaldır' : 'Sil'}</Text></TouchableOpacity> : null}
      </View>
    </View>)}
    {loading ? <ActivityIndicator color="#C2185B" style={{ margin: 16 }} /> : null}
    {more && !loading ? <TouchableOpacity style={s.more} onPress={() => load(true)}><Text style={s.link}>Daha fazla göster</Text></TouchableOpacity> : null}
  </View>;
}

const s = StyleSheet.create({
  feed: { padding: 16 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  heading: { color: '#9B1B4D', fontSize: 17, fontWeight: '700', flexShrink: 1 }, link: { color: '#C2185B', fontWeight: '600', paddingVertical: 8 },
  muted: { color: '#777', paddingVertical: 8 }, error: { color: '#B42318', paddingVertical: 10 },
  card: { backgroundColor: '#fff', borderColor: '#F4D0DF', borderWidth: 1, borderRadius: 18, padding: 12, marginBottom: 16 },
  username: { color: '#C2185B', fontWeight: '700', fontSize: 15, maxWidth: 220 }, date: { color: '#888', fontSize: 11 },
  photo: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#FFEAF2' }, venue: { color: '#9B1B4D', marginTop: 12, fontSize: 13 },
  caption: { color: '#333', lineHeight: 22, marginVertical: 10 }, like: { color: '#C2185B', fontWeight: '600', paddingVertical: 10 },
  more: { alignItems: 'center', padding: 8 },
});
