import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import { decodePhoto } from './momentApi';

export default function MenuPhotoImport({ venueId, onImported }) {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const importPhoto = async (camera) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
        throw new Error('Kamera izni gerekiyor.');
      }
      const options = { mediaTypes: ['images'], base64: true, quality: 0.9, exif: false, allowsEditing: false };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets[0];
      const photo = decodePhoto(asset.base64);
      const { data, error } = await supabase.functions.invoke('import-menu', {
        body: { venueId: String(venueId), image: asset.base64, mimeType: photo.contentType },
      });
      if (error || data?.error) {
        let message = data?.error;
        try { message = message || (await error?.context?.json())?.error; } catch (_) {}
        throw new Error(message || 'Menü okunamadı. Aynı fotoğrafla yeniden deneyebilirsin.');
      }
      await onImported();
      Alert.alert('Menü eklendi', `${data.count} ürün menüde. Okunan ad ve fiyatları kontrol edebilir, ürünleri düzenleyebilirsin.`);
    } catch (error) { Alert.alert('Menü eklenemedi', error.message); }
    finally { lock.current = false; setBusy(false); }
  };
  return <View style={{ padding: 16, backgroundColor: '#FFF0F6', borderRadius: 16, marginBottom: 16 }}>
    <Text style={{ fontWeight: '700', fontSize: 17 }}>Fotoğraftan menü ekle ✨</Text>
    <Text style={{ color: '#666', marginVertical: 8 }}>Menünün fotoğrafını seç; ürünler, kategoriler ve fiyatlar otomatik eklensin. Her sayfayı ayrı yükleyebilirsin. Fotoğraf okunmak üzere yapay zekâya gönderilir.</Text>
    {busy ? <View><ActivityIndicator color="#DB7093" /><Text>Menü okunuyor ve ekleniyor…</Text></View> :
      <View style={{ flexDirection: 'row', gap: 20 }}>
        <TouchableOpacity accessibilityRole="button" onPress={() => importPhoto(false)}><Text style={{ color: '#AD285D', fontWeight: '700' }}>Galeriden seç</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => importPhoto(true)}><Text style={{ color: '#AD285D', fontWeight: '700' }}>Fotoğraf çek</Text></TouchableOpacity>
      </View>}
  </View>;
}
