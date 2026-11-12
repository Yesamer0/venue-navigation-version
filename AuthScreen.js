import React, { useRef, useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  Platform, KeyboardAvoidingView, ScrollView 
} from 'react-native';
import { supabase } from './supabase';
import { authErrorMessage, validateAuthInput } from './authService';

export default function AuthScreen({ navigation }) {
  const lock = useRef(false);
  const [formError, setFormError] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false); 
  const [isVenueOwner, setIsVenueOwner] = useState(false);

  const handleAuth = async () => {
    if (lock.current) return;
    setFormError('');
    let input;
    try { input = validateAuthInput({ username, email, password, registering: isRegisterMode }); }
    catch (failure) { setFormError(failure.message); return; }
    lock.current = true; setLoading(true);
    try {
      if (isRegisterMode) {
        const { data: available, error: checkError } = await supabase.rpc('is_username_available', { p_username: input.username });
        if (checkError) throw checkError;
        if (!available) { setFormError('Bu kullanıcı adı kullanılıyor. Başka bir ad seç.'); return; }
        const { data, error } = await supabase.auth.signUp({ email: input.email, password: input.password,
          options: { data: { username: input.username, is_venue: isVenueOwner } },
        });
        if (error) throw error;
        if (!data?.session) {
          setIsRegisterMode(false); setPassword('');
          alert('Hesabını tamamlamak için e-postandaki doğrulama bağlantısını aç, ardından giriş yap.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
        if (error) throw error;
      }
      // The root auth listener selects the authenticated screen and clears old navigation history.
    } catch (failure) { setFormError(authErrorMessage(failure)); }
    finally { lock.current = false; setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', width: '100%' }} style={{ width: '100%' }}>
      <View style={styles.card}>
        <Text style={styles.title}>Venue</Text>
        <Text style={styles.subtitle}>
          {isRegisterMode ? 'Yeni bir hesap oluşturun' : 'Hesabınıza giriş yapın'}
        </Text>

        {isRegisterMode && (
          <TextInput
            style={styles.input}
          editable={!loading}
            placeholder="Kullanıcı Adı"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor="#999"
          />
        )}

        <TextInput
          style={styles.input}
          editable={!loading}
          placeholder="E-posta Adresi"
          textContentType="emailAddress"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor="#999"
        />

        <TextInput
          style={styles.input}
          editable={!loading}
          placeholder="Şifre"
          textContentType={isRegisterMode ? 'newPassword' : 'password'}
          autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholderTextColor="#999"
        />

        {isRegisterMode && (
          <TouchableOpacity 
            style={[styles.checkboxRow, isVenueOwner && styles.checkboxRowActive]}
            disabled={loading} onPress={() => setIsVenueOwner(!isVenueOwner)}
          >
            <View style={[styles.checkboxCircle, isVenueOwner && styles.checkboxCircleChecked]} />
            <Text style={[styles.checkboxLabel, isVenueOwner && styles.checkboxLabelActive]}>
              Ben bir Mekan Sahibiyim 🏢
            </Text>
          </TouchableOpacity>
        )}

        {!!formError && <Text accessibilityRole="alert" style={{ color: '#B42318', lineHeight: 21, marginBottom: 12 }}>{formError}</Text>}
        <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={handleAuth} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isRegisterMode ? 'Kayıt Ol' : 'Giriş Yap'}</Text>}
        </TouchableOpacity>

        <TouchableOpacity disabled={loading} onPress={() => { setIsRegisterMode(!isRegisterMode); setFormError(''); }} style={styles.switchButton}>
          <Text style={styles.switchText}>
            {isRegisterMode ? 'Zaten hesabınız var mı? Giriş Yapın' : 'Hesabınız yok mu? Kayıt Olun'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={loading} onPress={() => navigation.navigate('Guest')} style={styles.switchButton}>
          <Text style={styles.switchText}>Misafir olarak menülere göz at</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF0F5', padding: 20 },
  card: { width: Platform.OS === 'web' ? 400 : '100%', backgroundColor: '#fff', borderRadius: 16, padding: 30 },
  title: { fontSize: 36, fontWeight: 'bold', color: '#FF69B4', textAlign: 'center', marginBottom: 5 },
  subtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 25 },
  input: { height: 50, borderWidth: 1, borderColor: '#FFE4E1', borderRadius: 10, paddingHorizontal: 15, marginBottom: 15, fontSize: 16, backgroundColor: '#FAFAFA', color: '#333' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFAFA', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#FFE4E1', marginBottom: 15 },
  checkboxRowActive: { borderColor: '#FF69B4', backgroundColor: '#FFF0F5' },
  checkboxCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#FF69B4', marginRight: 10 },
  checkboxCircleChecked: { backgroundColor: '#FF69B4' },
  checkboxLabel: { fontSize: 14, color: '#666', fontWeight: '500' },
  checkboxLabelActive: { color: '#DB7093', fontWeight: 'bold' },
  button: { backgroundColor: '#FF69B4', height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  switchButton: { marginTop: 20, alignItems: 'center' },
  switchText: { color: '#DB7093', fontSize: 14, fontWeight: '500' }
});