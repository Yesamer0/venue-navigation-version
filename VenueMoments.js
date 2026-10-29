import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import MomentFeed from './MomentFeed';
import { decodePhoto, friendlyError, PHOTO_BUCKET, verifyVenueLocation } from './momentApi';

export default function VenueMoments({ venue, isCheckedIn, navigation, showFeed, onShowPhotos }) {
  const [selected, setSelected] = useState(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const lock = useRef(false);

  const pick = async (camera = false) => {
    if (lock.current) return;
    if (selected?.uploadPath) {
      Alert.alert('Bekleyen paylaşım', 'Önce bekleyen fotoğrafı paylaş veya Vazgeç ile kapat.');
      return;
    }
    lock.current = true; setBusy(true);
    try {
      await verifyVenueLocation(venue);
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error('Fotoğraf çekmek için kamera izni gerekiyor.');
      }
      const options = { mediaTypes: ['images'], allowsEditing: true, quality: 0.7, base64: true, exif: false };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets?.[0]) {
        decodePhoto(result.assets[0].base64);
        setSelected(result.assets[0]); setVerified(true);
      }
    } catch (e) { setVerified(false); Alert.alert('Fotoğraf seçilemedi', friendlyError(e)); }
    finally { lock.current = false; setBusy(false); }
  };

  const publish = async () => {
    if (!selected || lock.current) return;
    lock.current = true; setBusy(true);
    let path = null; let committed = false; let commitAttempted = false;
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Paylaşmak için yeniden giriş yap.');
      const location = await verifyVenueLocation(venue);
      const photo = decodePhoto(selected.base64);
      // This path stays stable after a lost response; retry cannot duplicate a post.
      path = selected.uploadPath || `${user.id}/${venue.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${photo.extension}`;
      if (!selected.uploadPath) {
        const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo.buffer, { contentType: photo.contentType, upsert: false });
        if (uploadError) throw uploadError;
        setSelected((asset) => ({ ...asset, uploadPath: path }));
      }
      commitAttempted = true;
      const { error: postError } = await supabase.rpc('publish_venue_moment', {
        p_venue_id: String(venue.id), p_storage_path: path, p_caption: caption.trim(),
        p_latitude: location.latitude, p_longitude: location.longitude,
        p_accuracy: location.accuracy, p_captured_at: location.capturedAt,
      });
      if (postError) {
        if (postError.code === 'P0001') {
          const { error: cleanupError } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
          if (!cleanupError) setSelected((asset) => asset ? { ...asset, uploadPath: null } : null);
        }
        throw postError;
      }
      committed = true; setSelected(null); setCaption(''); setVerified(false);
      setRefreshKey((key) => key + 1);
      onShowPhotos();
      Alert.alert('Paylaşıldı', 'Fotoğrafın mekân akışında ve profilinde görünüyor.');
    } catch (e) {
      // A timed-out RPC may have committed. Keep its object/path for idempotent retry.
      if (path && !committed && !commitAttempted) await supabase.storage.from(PHOTO_BUCKET).remove([path]);
      Alert.alert('Paylaşım tamamlanamadı', friendlyError(e));
    } finally { lock.current = false; setBusy(false); }
  };

  const cancel = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      if (selected?.uploadPath) {
        const { data, error } = await supabase.from('venue_moments').select('id').eq('storage_path', selected.uploadPath);
        if (error) throw error;
        if (!data?.length) {
          const { error: cleanupError } = await supabase.storage.from(PHOTO_BUCKET).remove([selected.uploadPath]);
          if (cleanupError) throw cleanupError;
        } else {
          setRefreshKey((key) => key + 1); onShowPhotos();
        }
      }
      setSelected(null); setCaption(''); setVerified(false);
    } catch (e) { Alert.alert('İşlem tamamlanamadı', friendlyError(e)); }
    finally { lock.current = false; setBusy(false); }
  };

  return <View style={{ backgroundColor: '#FFF9FC', marginTop: 12 }}>
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 19, fontWeight: '700', color: '#9B1B4D' }}>Buradan bir kare paylaş</Text>
      {isCheckedIn ? <>
        <Text style={{ color: '#777', marginVertical: 10 }}>Fotoğraf eklerken ve paylaşırken mekânda olduğun konumla kontrol edilir.</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity disabled={busy} onPress={() => pick(false)} style={{ padding: 12, backgroundColor: '#FFEAF2', borderRadius: 12 }}><Text style={{ color: '#9B1B4D' }}>Fotoğraf ekle</Text></TouchableOpacity>
          <TouchableOpacity disabled={busy} onPress={() => pick(true)} style={{ padding: 12, backgroundColor: '#FFEAF2', borderRadius: 12 }}><Text style={{ color: '#9B1B4D' }}>Fotoğraf çek</Text></TouchableOpacity>
        </View>
      </> : <Text style={{ color: '#777', marginTop: 10 }}>Mekândaysan yukarıdaki “Buradayım” düğmesiyle konumunu doğrula; fotoğraf paylaşma alanı açılacak.</Text>}
      {selected && isCheckedIn ? <View style={{ marginTop: 14 }}>
        <Image source={{ uri: selected.uri }} style={{ width: '100%', height: 220, borderRadius: 14 }} />
        {verified ? <Text style={{ color: '#15803D', marginTop: 8 }}>Konum doğrulandı</Text> : null}
        <TextInput value={caption} onChangeText={setCaption} maxLength={500} editable={!busy} multiline placeholder="Bu anı anlat…" style={{ padding: 12, backgroundColor: '#fff', marginVertical: 12, borderRadius: 12, minHeight: 64 }} />
        <TouchableOpacity disabled={busy} onPress={publish} style={{ backgroundColor: '#C2185B', borderRadius: 12, padding: 14, alignItems: 'center', opacity: busy ? 0.6 : 1 }}><Text style={{ color: '#fff', fontWeight: '700' }}>Fotoğrafı paylaş</Text></TouchableOpacity>
        <TouchableOpacity disabled={busy} onPress={cancel}><Text style={{ color: '#777', paddingVertical: 12 }}>Vazgeç</Text></TouchableOpacity>
      </View> : null}
      {busy ? <ActivityIndicator color="#C2185B" style={{ marginTop: 12 }} /> : null}
    </View>
    {showFeed ? <MomentFeed venueId={venue.id} navigation={navigation} refreshKey={refreshKey} /> : null}
  </View>;
}
