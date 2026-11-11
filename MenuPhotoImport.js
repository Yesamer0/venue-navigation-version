import React, { useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from './supabase';
import { decodePhoto } from './momentApi';

export default function MenuPhotoImport({ venueId, canManage = false, onImported }) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const choose = async camera => {
    if (!canManage || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('Kamera izni gerekiyor.');
      setStatus(camera ? 'Kamera açılıyor…' : 'Galeri açılıyor…');
      const options = { mediaTypes: ['images'], quality: 1, exif: false, allowsEditing: false };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) { setStatus(''); return; }
      const asset = result.assets?.[0];
      if (!asset?.uri) throw new Error('Fotoğraf alınamadı. Yeniden seç.');
      setStatus('Fotoğraf hazırlanıyor…');
      const actions = Math.max(asset.width || 0, asset.height || 0) > 2400
        ? [{ resize: asset.width >= asset.height ? { width: 2400 } : { height: 2400 } }] : [];
      const prepared = await manipulateAsync(asset.uri, actions, { format: SaveFormat.JPEG, compress: 0.85, base64: true });
      decodePhoto(prepared.base64);
      setPhoto(prepared); setPreview(null); setStatus('Fotoğraf hazır. Menüyü okuyup değişiklikleri incele.');
    } catch (cause) { setError(cause.message || 'Fotoğraf hazırlanamadı.'); setStatus(''); }
    finally { lock.current = false; setBusy(false); }
  };
  const submit = async () => {
    if (!canManage || !photo || lock.current) return;
    lock.current = true; setBusy(true); setError(''); setStatus('Menüdeki ürünler ve fiyatlar okunuyor…');
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error('Oturumun sona erdi. Yeniden giriş yap.');
      const { data, error: invokeError } = await supabase.functions.invoke('import-menu', {
        body: { venueId: String(venueId), image: photo.base64, mimeType: 'image/jpeg', action: 'preview' },
      });
      if (invokeError || data?.error) {
        let message = data?.error;
        if (invokeError?.context) {
          try { const details = await invokeError.context.json(); message ||= details?.error || details?.message; } catch (_) {}
        }
        if (!message && invokeError?.name === 'FunctionsFetchError') message = 'Sunucuya bağlanılamadı. İnternetini kontrol edip tekrar dene.';
        throw new Error(message || 'Menü kaydedilemedi. Fotoğraf korunuyor; tekrar deneyebilirsin.');
      }
      if (data?.previewId && data?.changes) {
        setPreview(data); setStatus('Henüz kaydedilmedi. Aşağıdaki değişiklikleri kontrol edip onayla.'); return;
      }
      if (!Number.isInteger(data?.count) || data.count < 1) throw new Error('Fotoğraftan ürün alınamadı. Daha net bir menü fotoğrafı seç.');
      setStatus('Kaydedilen ürünler yükleniyor…');
      try { if (await onImported() === false) throw new Error('refresh'); }
      catch (_) { setPhoto(null); setStatus(`${data.count} ürün kaydedildi. Liste yenilenemedi; sayfayı tekrar aç.`); return; }
      setPhoto(null);
      setStatus(data.alreadyImported ? `${data.count} ürün bu fotoğraftan zaten eklenmiş. Menü yenilendi.` : `${data.count} ürün işlendi. Yeni ürünler eklendi; mevcut ürünlerin okunan fiyatları güncellendi.`);
    } catch (cause) { setError(cause.message || 'Menü kaydedilemedi.'); setStatus(''); }
    finally { lock.current = false; setBusy(false); }
  };
  const confirm = async () => {
    if (!canManage || !preview || lock.current) return;
    lock.current = true; setBusy(true); setError(''); setStatus('Onayladığın değişiklikler kaydediliyor…');
    try {
      const { data: count, error: failure } = await supabase.rpc('confirm_venue_menu_preview', { p_preview_id: preview.previewId });
      if (failure) {
        if (failure.code === '40001') setPreview(null);
        throw new Error(failure.message || 'Menü kaydedilemedi. Yeniden dene.');
      }
      if (!Number.isInteger(count) || count < 1) throw new Error('Menü kaydı doğrulanamadı. Yeniden dene.');
      setPreview(null); setPhoto(null);
      try { if (await onImported() === false) throw new Error('refresh'); }
      catch (_) { setStatus(`${count} ürün kaydedildi. Liste yenilenemedi; sayfayı tekrar aç.`); return; }
      setStatus(`${count} ürün işlendi. Onayladığın değişiklikler kaydedildi.`);
    } catch (cause) { setError(cause.message || 'Menü kaydedilemedi.'); setStatus(''); }
    finally { lock.current = false; setBusy(false); }
  };
  const price = value => value == null ? 'Fiyat okunamadı' : `${Number(value).toLocaleString('tr-TR')} TL`;
  const changes = preview?.changes;
  if (!canManage) return null;
  return <View style={styles.card}>
    <Text style={styles.title}>Fotoğraftan menü ekle</Text>
    <Text style={styles.help}>Menünün tamamı net ve düz görünsün. Fotoğraf yapay zekâyla ürün, kategori ve fiyatlara dönüştürülür; yeni ürünler eklenir, fiyatlar güncellenir. Aynı ürünün eski boy seçenekleri yerine yeni fotoğraftaki seçenekler kullanılır. Fotoğraf galeriye eklenmez.</Text>
    {photo && <Image accessibilityLabel="Seçilen menü fotoğrafı" source={{ uri: photo.uri }} style={styles.preview} resizeMode="contain" />}
    {!!status && <Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>}
    {!!error && <View accessibilityRole="alert" style={styles.error}><Text style={styles.errorText}>{error}</Text><Text style={styles.help}>Yeniden deneyebilir veya başka bir fotoğraf seçebilirsin.</Text></View>}
    {changes && <View style={styles.changes}>
      <Text style={styles.title}>Kaydetmeden önce kontrol et</Text>
      <Text style={styles.help}>Bu fotoğrafta yer almayan diğer ürün aileleri korunur. Okunamayan fiyatlar mevcut fiyatı silmez. Önizleme 15 dakika geçerlidir.</Text>
      <Text style={styles.changeHeading}>Eklenecek · {changes.added.length}</Text>
      {changes.added.map((item, i) => <Text key={`add-${i}`} style={styles.changeLine}>＋ {item.name} · {price(item.price)}</Text>)}
      <Text style={styles.changeHeading}>Güncellenecek · {changes.updated.length}</Text>
      {changes.updated.map((item, i) => <View key={`update-${i}`} style={{ marginBottom: 8 }}><Text style={styles.changeLine}>{item.after.name} · {price(item.before.price)} → {price(item.after.price)}</Text>{item.before.category !== item.after.category && <Text style={styles.help}>{item.before.category || 'Diğer'} → {item.after.category}</Text>}</View>)}
      <Text style={styles.changeHeading}>Kaldırılacak eski seçenekler · {changes.removed.length}</Text>
      {changes.removed.map((item, i) => <Text key={`remove-${i}`} style={styles.changeLine}>− {item.name} · {price(item.price)}</Text>)}
      {!changes.added.length && !changes.updated.length && !changes.removed.length && <Text style={styles.help}>Menüde değişiklik yok. Aynı ürünler ve fiyatlar korunacak.</Text>}
    </View>}
    {busy ? <ActivityIndicator color="#AD285D" style={{ marginVertical: 12 }} /> : <>
      {photo && <TouchableOpacity accessibilityRole="button" onPress={preview ? confirm : submit} style={styles.primary}><Text style={styles.primaryText}>{preview ? 'Değişiklikleri onayla ve kaydet' : error ? 'Menüyü tekrar oku' : 'Menüyü oku ve değişiklikleri göster'}</Text></TouchableOpacity>}
      {preview && <TouchableOpacity accessibilityRole="button" onPress={() => { setPreview(null); setError(''); setStatus('Önizlemeden vazgeçildi. Menü değiştirilmedi.'); }} style={styles.secondary}><Text style={styles.actionText}>Kaydetmeden vazgeç</Text></TouchableOpacity>}
      <View style={styles.actions}>
        <TouchableOpacity accessibilityRole="button" onPress={() => choose(false)} style={styles.secondary}><Text style={styles.actionText}>Galeriden seç</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => choose(true)} style={styles.secondary}><Text style={styles.actionText}>Fotoğraf çek</Text></TouchableOpacity>
      </View>
    </>}
  </View>;
}
const styles = StyleSheet.create({
  changes: { padding: 12, borderWidth: 1, borderColor: '#E8C4D4', backgroundColor: '#fff', borderRadius: 12, marginVertical: 8 },
  changeHeading: { color: '#702044', fontWeight: '700', marginTop: 12, marginBottom: 6 }, changeLine: { color: '#493640', lineHeight: 22 },
  card: { padding: 16, backgroundColor: '#FFF5F8', borderRadius: 18, marginBottom: 18, borderWidth: 1, borderColor: '#F1D6E1' },
  title: { color: '#702044', fontWeight: '700', fontSize: 18 },
  help: { color: '#665660', fontSize: 13, lineHeight: 20, marginVertical: 8 },
  preview: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#fff', marginVertical: 8 },
  status: { color: '#624152', lineHeight: 21, marginVertical: 8 },
  error: { padding: 12, backgroundColor: '#FFF0ED', borderRadius: 12, marginVertical: 8 },
  errorText: { color: '#A32C24', fontWeight: '600', lineHeight: 21 },
  primary: { backgroundColor: '#A52A61', padding: 14, borderRadius: 12, alignItems: 'center', marginVertical: 8 },
  primaryText: { color: '#fff', fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10 },
  secondary: { flex: 1, padding: 13, alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E8C4D4' },
  actionText: { color: '#92315B', fontWeight: '600' },
});
