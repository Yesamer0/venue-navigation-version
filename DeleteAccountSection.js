import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { deleteVenueAccount } from './authService';
import { supabase } from './supabase';

export default function DeleteAccountSection({ business = false }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);

  const submit = async () => {
    if (lock.current || !password) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    try {
      await deleteVenueAccount({ password });
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) setMessage('Hesap silindi. Bu cihazdaki oturumu kapatmak için Çıkış’a dokun.');
    } catch (failure) {
      setMessage(failure.message);
    } finally {
      setPassword('');
      lock.current = false;
      setBusy(false);
    }
  };

  return <View style={styles.section}>
    {open ? <>
      <Text>Bu işlem geri alınamaz. {business
        ? 'Mekânların Keşfet’ten kalkacak. Gezgin fotoğrafları, paylaşanların profillerinde kalacak.'
        : 'Fotoğrafların, yorumların ve diğer hesap verilerin silinecek.'}</Text>
      <TextInput style={styles.input} accessibilityLabel="Mevcut şifre" placeholder="Mevcut şifre"
        editable={!busy} secureTextEntry autoCapitalize="none" autoComplete="current-password"
        value={password} onChangeText={setPassword} />
      <TouchableOpacity accessibilityRole="button" disabled={busy || !password} onPress={submit}>
        <Text style={[styles.action, (busy || !password) && styles.disabled]}>{busy ? 'Hesap siliniyor…' : 'Hesabımı kalıcı olarak sil'}</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => {
        setOpen(false);
        setPassword('');
        setMessage('');
      }}><Text>Vazgeç</Text></TouchableOpacity>
      {!!message && <Text accessibilityRole="alert">{message}</Text>}
    </> : <TouchableOpacity accessibilityRole="button" onPress={() => setOpen(true)}>
      <Text style={styles.action}>Hesabımı sil</Text>
    </TouchableOpacity>}
  </View>;
}

const styles = StyleSheet.create({
  section: { margin: 16, gap: 12, paddingVertical: 12 },
  input: { borderWidth: 1, borderColor: '#88777D', borderRadius: 8, padding: 12 },
  action: { color: '#9B1B43', fontWeight: '700', paddingVertical: 10 },
  disabled: { opacity: 0.55 },
});
