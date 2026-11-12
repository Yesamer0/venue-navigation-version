import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { createPasswordRecovery } from './passwordRecovery';

export default function PasswordRecoveryScreen({ navigation, route }) {
  const [recovery] = useState(createPasswordRecovery);
  const lock = useRef(false);
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState(route.params?.email || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async action => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (failure) {
      setError(failure.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const request = () => run(async () => {
    setEmail(await recovery.requestCode(email));
    setCode('');
    setStep('code');
  });

  const verify = () => run(async () => {
    await recovery.verifyCode(email, code);
    setCode('');
    setStep('password');
  });

  const save = () => run(async () => {
    await recovery.updatePassword(password, confirmation);
    setPassword('');
    setConfirmation('');
    setStep('done');
  });

  const actions = {
    email: [request, 'Kod gönder'],
    code: [verify, 'Kodu doğrula'],
    password: [save, 'Yeni şifreyi kaydet'],
    done: [() => navigation.goBack(), 'Giriş ekranına dön'],
  };
  const [submit, label] = actions[step];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>Şifre sıfırla</Text>
          {step === 'email' && (
            <TextInput style={styles.input} accessibilityLabel="E-posta adresi" placeholder="E-posta adresi"
              keyboardType="email-address" autoComplete="email" autoCapitalize="none" autoCorrect={false}
              value={email} onChangeText={setEmail} editable={!busy} onSubmitEditing={request} />
          )}
          {step === 'code' && <>
            <Text style={styles.description}>Kayıtlı adresine gelen şifre sıfırlama kodunu gir. E-postayı bulamazsan spam klasörüne de bak.</Text>
            <Text style={styles.description}>{email}</Text>
            <TextInput style={styles.input} accessibilityLabel="Sıfırlama kodu" placeholder="E-postadaki kod"
              keyboardType="number-pad" textContentType="oneTimeCode" maxLength={10}
              value={code} onChangeText={value => setCode(value.replace(/[^0-9]/g, ''))}
              editable={!busy} onSubmitEditing={verify} />
          </>}
          {step === 'password' && <>
            <TextInput style={styles.input} accessibilityLabel="Yeni şifre" placeholder="Yeni şifre"
              secureTextEntry autoComplete="new-password" value={password} onChangeText={setPassword} editable={!busy} />
            <TextInput style={styles.input} accessibilityLabel="Yeni şifre tekrar" placeholder="Yeni şifre tekrar"
              secureTextEntry autoComplete="new-password" value={confirmation} onChangeText={setConfirmation}
              editable={!busy} onSubmitEditing={save} />
          </>}
          {step === 'done' && <Text accessibilityLiveRegion="polite" style={styles.description}>Şifren güncellendi. Yeni şifrenle giriş yapabilirsin.</Text>}
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={submit} style={styles.button}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{label}</Text>}
          </TouchableOpacity>
          {step === 'code' && <>
            <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={request} style={styles.link}>
              <Text style={styles.linkText}>Yeni kod iste</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => { setError(''); setCode(''); setStep('email'); }} style={styles.link}>
              <Text style={styles.linkText}>E-posta adresini değiştir</Text>
            </TouchableOpacity>
          </>}
          {step !== 'done' && (
            <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => navigation.goBack()} style={styles.link}>
              <Text style={styles.linkText}>Giriş ekranına dön</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF0F5' },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#9B1B4D', marginBottom: 16 },
  description: { color: '#555', lineHeight: 22, marginBottom: 12 },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#F3CEDD', borderRadius: 10, padding: 12, marginBottom: 12, color: '#333' },
  error: { color: '#B42318', lineHeight: 20, marginBottom: 12 },
  button: { minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: '#9B1B4D', borderRadius: 10, padding: 12 },
  buttonText: { color: '#fff', fontWeight: '700' },
  link: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  linkText: { color: '#9B1B4D', fontWeight: '600' },
});
