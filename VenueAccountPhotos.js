import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import { decodePhoto } from './momentApi';

export default function VenueAccountPhotos({ venue, isOwner, legacyPhotos = [], onDeleteLegacy, active = true, onClosingChange }) {
  const [photos, setPhotos] = useState([]);
  const [closing, setClosing] = useState((venue.photo_closing_time || '').slice(0, 5));
  const [selected, setSelected] = useState(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(null);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from('venue_account_photos').select('*').eq('venue_id', String(venue.id)).order('pinned_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(300);
    if (e) setError('Fotoğraflar yüklenemedi. Yeniden dene.');
    else { setPhotos(data || []); setError(''); }
    const { data: settings } = await supabase.from('venues').select('photo_closing_time').eq('id', venue.id).maybeSingle();
    if (settings) { setClosing((settings.photo_closing_time || '').slice(0, 5)); onClosingChange?.(settings.photo_closing_time); }
  }, [venue.id]);
  useFocusEffect(useCallback(() => { if (active) load(); }, [load, active]));
  const pick = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.85, exif: false });
      if (!result.canceled) { decodePhoto(result.assets[0].base64); setSelected(result.assets[0]); }
    } catch (e) { Alert.alert('Fotoğraf seçilemedi', e.message); }
    finally { lock.current = false; setBusy(false); }
  };
  const publish = async () => {
    if (lock.current || !selected) return;
    lock.current = true; setBusy(true);
    try {
      const photo = decodePhoto(selected.base64);
      let path = selected.path;
      if (!path) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Yeniden giriş yapmalısın.');
        path = `${user.id}/${venue.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${photo.extension}`;
        const { error: e } = await supabase.storage.from('venue-account').upload(path, photo.buffer, { contentType: photo.contentType });
        if (e) throw e;
        setSelected({ ...selected, path });
      }
      const { error: e } = await supabase.rpc('publish_venue_account_photo', { p_venue_id: String(venue.id), p_path: path, p_caption: caption.trim() });
      if (e) throw e;
      setSelected(null); setCaption(''); await load();
    } catch (e) { Alert.alert('Paylaşılamadı', e.message); }
    finally { lock.current = false; setBusy(false); }
  };
  const saveClosing = async () => {
    if (lock.current) return;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(closing)) { Alert.alert('Kapanış saati', 'Saati 23:30 gibi SS:DD biçiminde yaz.'); return; }
    lock.current = true; setBusy(true);
    try {
      const { error: e } = await supabase.rpc('set_venue_photo_closing', { p_venue_id: String(venue.id), p_close: closing });
      if (e) throw e;
      onClosingChange?.(closing);
      Alert.alert('Kaydedildi', 'Ziyaretçi fotoğrafları bu kapanış saatinde kaldırılacak. Saat dilimi: Türkiye.');
    } catch (e) { Alert.alert('Kaydedilemedi', e.message); }
    finally { lock.current = false; setBusy(false); }
  };
  const pin = async (photo) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const { error: e } = await supabase.rpc('set_account_photo_pinned', { p_photo_id: photo.id, p_pinned: !photo.pinned_at });
      if (e) throw e;
      await load();
    } catch (e) { Alert.alert('Sabitleme yapılamadı', e.message); }
    finally { lock.current = false; setBusy(false); }
  };
  const remove = (photo) => Alert.alert('Fotoğraf silinsin mi?', 'Bu fotoğraf mekandan ve paylaşanın profilinden kaldırılacak.', [
    { text: 'Vazgeç', style: 'cancel' }, { text: 'Sil', style: 'destructive', onPress: async () => {
      if (lock.current) return;
      lock.current = true; setBusy(true);
      try {
        const { error: e } = await supabase.from('venue_account_photos').delete().eq('id', photo.id);
        if (e) throw e;
        const { error: storageError } = await supabase.storage.from('venue-account').remove([photo.storage_path]);
        await load();
        if (storageError) Alert.alert('Fotoğraf kaldırıldı', 'Dosya temizliği tamamlanamadı.');
      } catch (e) { Alert.alert('Silinemedi', e.message); }
      finally { lock.current = false; setBusy(false); }
    } },
  ]);
  const all = [...photos.map(p => ({ ...p, image_url: supabase.storage.from('venue-account').getPublicUrl(p.storage_path).data.publicUrl })), ...legacyPhotos.map(p => ({ ...p, legacy: true }))].sort((a, b) => Number(!!b.pinned_at) - Number(!!a.pinned_at) || new Date(b.created_at || 0) - new Date(a.created_at || 0));
  return <View style={{ paddingHorizontal: 20 }}>
    <Text style={{ fontSize: 19, fontWeight: '700', marginBottom: 12 }}>Mekanın Fotoğrafları</Text>
    <TouchableOpacity onPress={load} accessibilityLabel="Fotoğrafları yenile"><Text style={{ color: '#9B1B4D', paddingVertical: 8 }}>Yenile</Text></TouchableOpacity>
    {isOwner && <View style={{ backgroundColor: '#FFF0F6', padding: 12, borderRadius: 12, marginVertical: 8 }}>
      <Text style={{ fontWeight: '700' }}>Ziyaretçi fotoğrafları için kapanış saati</Text>
      <TextInput accessibilityLabel="Mekan kapanış saati" placeholder="23:30" value={closing} onChangeText={setClosing} maxLength={5} keyboardType="numbers-and-punctuation" style={{ paddingVertical: 12 }} />
      <TouchableOpacity disabled={busy} onPress={saveClosing}><Text style={{ color: '#9B1B4D', fontWeight: '700' }}>Saati kaydet</Text></TouchableOpacity>
      <Text style={{ color: '#777', marginTop: 8 }}>En fazla 3 fotoğrafı sabitleyebilirsin. Diğerleri yeniden eskiye sıralanır.</Text>
    </View>}
    {isOwner && <TouchableOpacity disabled={busy || !!selected} onPress={pick}><Text style={{ color: '#AD285D', paddingVertical: 12 }}>+ Fotoğraf paylaş</Text></TouchableOpacity>}
    {selected && <View>
      <Image source={{ uri: selected.uri }} style={{ width: '100%', height: 220, borderRadius: 12 }} />
      <TextInput accessibilityLabel="Fotoğraf açıklaması" placeholder="Bir açıklama yaz…" maxLength={500} value={caption} onChangeText={setCaption} editable={!busy} style={{ padding: 12 }} />
      <TouchableOpacity disabled={busy} onPress={publish}><Text style={{ padding: 12, color: '#AD285D' }}>Paylaş</Text></TouchableOpacity>
      <TouchableOpacity disabled={busy} onPress={() => { setSelected(null); setCaption(''); }}><Text style={{ padding: 12 }}>Vazgeç</Text></TouchableOpacity>
    </View>}
    {busy && <ActivityIndicator color="#DB7093" />}
    {!!error && <TouchableOpacity onPress={load}><Text>{error}</Text></TouchableOpacity>}
    {!all.length && !error && <Text style={{ color: '#888', paddingVertical: 24 }}>Mekan henüz fotoğraf paylaşmadı.</Text>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -2 }}>
      {all.map(photo => <View key={`${photo.legacy ? 'legacy' : 'new'}-${photo.id}`} style={{ width: '33.33%', padding: 2 }}>
        <TouchableOpacity accessibilityLabel={photo.caption || 'Mekan fotoğrafını aç'} onPress={() => setOpened(photo)}><Image source={{ uri: photo.image_url }} style={{ width: '100%', aspectRatio: 1 }} />
          {!!photo.username && <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.65)', padding: 6 }}>
            <Text numberOfLines={1} style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>@{photo.username.replace(/^@/, '')}</Text>
          </View>}
        </TouchableOpacity>
        <Text numberOfLines={1} style={{ color: '#9B1B4D', fontSize: 12, fontWeight: '600', paddingVertical: 6 }}>
          {photo.username ? `@${photo.username.replace(/^@/, '')}` : photo.legacy ? 'Mekan paylaşımı' : 'Kullanıcı'}
        </Text>
        {isOwner && !photo.legacy && <TouchableOpacity disabled={busy} onPress={() => pin(photo)} style={{ paddingVertical: 8 }}><Text style={{ color: '#9B1B4D', fontSize: 12 }}>{photo.pinned_at ? '📌 Sabitlemeyi kaldır' : 'Sabitle'}</Text></TouchableOpacity>}
        {!isOwner && photo.pinned_at && <Text style={{ color: '#9B1B4D', fontSize: 12 }}>📌 Sabit</Text>}
        {isOwner && <TouchableOpacity disabled={busy} accessibilityLabel="Fotoğrafı sil" onPress={() => photo.legacy ? onDeleteLegacy(photo.id) : remove(photo)} style={{ position: 'absolute', right: 6, top: 6, backgroundColor: '#222', padding: 7, borderRadius: 16 }}><Text style={{ color: '#fff' }}>✕</Text></TouchableOpacity>}
      </View>)}
    </View>
    <Modal visible={!!opened} transparent animationType="fade" onRequestClose={() => setOpened(null)}>
      <View style={{ flex: 1, backgroundColor: '#111', justifyContent: 'center', padding: 20 }}>
        <TouchableOpacity accessibilityLabel="Fotoğrafı kapat" onPress={() => setOpened(null)}><Text style={{ color: '#fff', padding: 20 }}>Kapat ✕</Text></TouchableOpacity>
        {opened && <Image source={{ uri: opened.image_url }} style={{ width: '100%', height: '65%' }} resizeMode="contain" />}
        <Text style={{ color: '#fff', fontWeight: '700', paddingHorizontal: 12 }}>
          {opened?.username ? `@${opened.username.replace(/^@/, '')}` : opened?.legacy ? 'Mekan paylaşımı' : 'Kullanıcı'}
        </Text>
        <Text style={{ color: '#fff', padding: 12 }}>{opened?.caption}</Text>
      </View>
    </Modal>
  </View>;
}
