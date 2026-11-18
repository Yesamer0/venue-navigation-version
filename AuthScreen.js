import { palette } from './theme';
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
import { VENUE_CATEGORIES } from './venueCategories';
import { businessSignupFields, validateBusinessSignup } from './businessSignup';
import { authErrorMessage, parseBirthday, validateAuthInput } from './authService';

export default function AuthScreen({ navigation }) {
  const lock = useRef(false);
  const [formError, setFormError] = useState('');
  const [username, setUsername] = useState('');
  const [birthday, setBirthday] = useState('');
  const [businessFields, setBusinessFields] = useState({});
  const [receipt, setReceipt] = useState('');
  const [applicationStatus, setApplicationStatus] = useState(null);
  const [isBusinessTypeOpen, setIsBusinessTypeOpen] = useState(false);
  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false); 
  const [isVenueOwner, setIsVenueOwner] = useState(false);

  const isApplication = isRegisterMode && isVenueOwner;
  const statusMessages = {
    pending: 'Başvuru onay bekliyor. Takip kodunu sakla.',
    changes: 'Eksik bilgi var. İşletme başvuru formunda takip kodunu kullanarak yeniden gönder.',
    approved: 'Başvuru onaylandı. Hesap kurulum kodu için e-postanı kontrol et.',
    rejected: 'Başvuru reddedildi.',
  };

  const checkApplication = async () => {
    if (lock.current) return;
    setFormError('');
    setApplicationStatus(null);
    if (!/^[0-9a-f-]{36}$/i.test(receipt.trim())) {
      setFormError('Başvuru takip kodunu kontrol et.');
      return;
    }
    lock.current = true;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_business_application_status', { p_receipt: receipt.trim() });
      if (error || !data?.[0]) throw new Error('Başvuru bulunamadı.');
      setApplicationStatus(data[0]);
    } catch (failure) { setFormError(failure.message); }
    finally { lock.current = false; setLoading(false); }
  };

  const handleAuth = async () => {
    if (lock.current) return;
    setFormError('');
    let input;
    let privateBirthday;
    let businessDetails;
    try {
      if (isApplication) {
        const address = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error('Geçerli bir e-posta adresi yaz.');
        input = { email: address };
      } else {
        input = validateAuthInput({ username, email, password, registering: isRegisterMode });
      }
      if (isRegisterMode && !isVenueOwner) privateBirthday = parseBirthday(birthday);
      if (isApplication) businessDetails = validateBusinessSignup(businessFields);
    }
    catch (failure) { setFormError(failure.message); return; }
    lock.current = true; setLoading(true);
    try {
      if (isApplication) {
        const { data, error } = await supabase.rpc('submit_business_application', {
          p_email: input.email, p_details: businessDetails, p_receipt: receipt.trim() || null,
        });
        if (error) throw error;
        setReceipt(data);
        setApplicationStatus({ status: 'pending', feedback: '' });
        return;
      }
      if (isRegisterMode) {
        const { data: available, error: checkError } = await supabase.rpc('is_username_available', { p_username: input.username });
        if (checkError) throw checkError;
        if (!available) { setFormError('Bu kullanıcı adı kullanılıyor. Başka bir ad seç.'); return; }
        const { data, error } = await supabase.auth.signUp({ email: input.email, password: input.password,
          options: { data: {
            username: input.username,
            ...(privateBirthday ? { birthday: privateBirthday } : {}),
          } },
        });
        if (error) throw error;
        if (!data?.session) {
          setIsRegisterMode(false); setPassword(''); setBirthday(''); setBusinessFields({});
          alert('Hesabını tamamlamak için e-postandaki doğrulama bağlantısını aç, ardından giriş yap.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
        if (error) throw error;
      }
      // The root auth listener selects the authenticated screen and clears old navigation history.
    } catch (failure) {
      const message = failure?.message;
      setFormError(message === 'application_rate_limit' ? 'Bu e-posta ile az önce başvuru gönderildi. Takip kodunu kontrol et.' :
        message === 'application_not_editable' ? 'Bu takip koduyla düzeltme gönderilemiyor.' : authErrorMessage(failure));
    }
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
          <View accessibilityRole="radiogroup" accessibilityLabel="Hesap türü">
            {[[false, 'Gezgin hesabı'], [true, 'İşletme hesabı']].map(([isBusiness, label]) => (
              <TouchableOpacity
                key={label}
                accessibilityRole="radio"
                accessibilityState={{ checked: isVenueOwner === isBusiness }}
                style={[styles.checkboxRow, isVenueOwner === isBusiness && styles.checkboxRowActive]}
                disabled={loading}
                onPress={() => { setIsVenueOwner(isBusiness); setIsBusinessTypeOpen(false); setFormError(''); }}
              >
                <View style={[styles.checkboxCircle, isVenueOwner === isBusiness && styles.checkboxCircleChecked]} />
                <Text style={[styles.checkboxLabel, isVenueOwner === isBusiness && styles.checkboxLabelActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {isRegisterMode && !isApplication && (
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

        {!isApplication && <TextInput
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
        />}

        {isRegisterMode && isVenueOwner && (
          <View>
            <Text style={styles.sectionTitle}>Şirket ve vergi kaydı</Text>
            {businessSignupFields.map(({ key, label, keyboardType, maxLength }) => key === 'business_type' ? (
              <View key={key}>
                <Text style={styles.fieldLabel}>{label}</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={label + ', ' + (businessFields[key] || 'Seç')}
                  accessibilityState={{ expanded: isBusinessTypeOpen }}
                  disabled={loading}
                  style={styles.selectButton}
                  onPress={() => setIsBusinessTypeOpen((open) => !open)}
                >
                  <Text style={styles.selectText}>{businessFields[key] || 'İş tipi seç'}</Text>
                  <Text accessible={false}>{isBusinessTypeOpen ? '▴' : '▾'}</Text>
                </TouchableOpacity>
                {isBusinessTypeOpen && (
                  <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.selectOptions}>
                    {VENUE_CATEGORIES.map((category) => (
                      <TouchableOpacity
                        key={category}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: businessFields[key] === category }}
                        disabled={loading}
                        style={[styles.selectOption, businessFields[key] === category && styles.checkboxRowActive]}
                        onPress={() => {
                          setBusinessFields((previous) => ({ ...previous, [key]: category }));
                          setIsBusinessTypeOpen(false);
                          setFormError('');
                        }}
                      >
                        <Text style={styles.selectText}>{category}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View key={key}>
                <Text style={styles.fieldLabel}>{label}</Text>
                <TextInput
                  accessibilityLabel={label}
                  style={styles.input}
                  editable={!loading}
                  keyboardType={keyboardType}
                  maxLength={maxLength}
                  value={businessFields[key] || ''}
                  onChangeText={(value) => setBusinessFields((previous) => ({ ...previous, [key]: value }))}
                />
              </View>
            ))}
            <Text style={{ color: '#555', marginBottom: 12 }}>
              İlk mekânını işletme panelinden eklerken adresini kullanıp haritada konumu seçebilirsin.
            </Text>
          </View>
        )}

        {isRegisterMode && !isVenueOwner && (
          <View>
            <Text style={{ color: '#555', marginBottom: 6 }}>Doğum günü (isteğe bağlı)</Text>
            <TextInput
              accessibilityLabel="Doğum günü"
              style={styles.input}
              editable={!loading}
              placeholder="GG.AA"
              placeholderTextColor="#777"
              maxLength={5}
              value={birthday}
              onChangeText={setBirthday}
            />
            <Text style={{ color: '#555', marginBottom: 12 }}>
              Doğum günü kampanyaları için yalnızca gün ve ay alınır. Profilinde gösterilmez.
            </Text>
          </View>
        )}

        {(isApplication || !isRegisterMode) && (
          <View>
            <Text style={styles.fieldLabel}>Başvuru takip kodu{isApplication ? ' (düzeltme için)' : ''}</Text>
            <TextInput accessibilityLabel="Başvuru takip kodu" style={styles.input} editable={!loading}
              autoCapitalize="none" autoCorrect={false} maxLength={36} value={receipt} onChangeText={setReceipt} />
            <TouchableOpacity accessibilityRole="button" disabled={loading} onPress={checkApplication} style={styles.switchButton}>
              <Text style={styles.switchText}>Başvuru durumunu gör</Text>
            </TouchableOpacity>
            {applicationStatus && (
              <Text accessibilityLiveRegion="polite" style={styles.fieldLabel}>
                {statusMessages[applicationStatus.status]}
                {applicationStatus.feedback ? '\n' + applicationStatus.feedback : ''}
              </Text>
            )}
          </View>
        )}

        {!!formError && <Text accessibilityRole="alert" style={{ color: '#B42318', lineHeight: 21, marginBottom: 12 }}>{formError}</Text>}
        <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={handleAuth} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isApplication ? 'Başvuru Gönder' : isRegisterMode ? 'Kayıt Ol' : 'Giriş Yap'}</Text>}
        </TouchableOpacity>

        {!isRegisterMode && (
          <TouchableOpacity disabled={loading} onPress={() => navigation.navigate('PasswordRecovery', { email: email.trim() })} style={styles.switchButton}>
            <Text style={styles.switchText}>Şifremi unuttum</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity disabled={loading} onPress={() => { setIsRegisterMode(!isRegisterMode); setIsBusinessTypeOpen(false); setFormError(''); }} style={styles.switchButton}>
          <Text style={styles.switchText}>
            {isRegisterMode ? 'Zaten hesabınız var mı? Giriş Yapın' : 'Hesabınız yok mu? Kayıt Olun'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={loading} onPress={() => navigation.navigate('Guest')} style={styles.switchButton}>
          <Text style={styles.switchText}>Misafir olarak keşfet</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.canvas, padding: 20 },
  card: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 16, padding: 30 },
  title: { fontSize: 36, fontWeight: 'bold', color: palette.accent, textAlign: 'center', marginBottom: 5 },
  subtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 25 },
  input: { height: 50, borderWidth: 1, borderColor: palette.border, borderRadius: 10, paddingHorizontal: 15, marginBottom: 15, fontSize: 16, backgroundColor: '#FAFAFA', color: '#333' },
  sectionTitle: { color: '#333', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  fieldLabel: { color: '#555', marginBottom: 6 },
  selectButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 50, paddingHorizontal: 15, marginBottom: 8, borderWidth: 1, borderColor: palette.border, borderRadius: 10, backgroundColor: '#FAFAFA' },
  selectOptions: { borderWidth: 1, borderColor: palette.border, borderRadius: 10, marginBottom: 12, overflow: 'hidden' },
  selectOption: { minHeight: 44, paddingHorizontal: 15, justifyContent: 'center' },
  selectText: { color: '#333', fontSize: 16 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFAFA', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: palette.border, marginBottom: 15 },
  checkboxRowActive: { borderColor: palette.accent, backgroundColor: palette.canvas },
  checkboxCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: palette.accent, marginRight: 10 },
  checkboxCircleChecked: { backgroundColor: palette.accent },
  checkboxLabel: { fontSize: 14, color: '#666', fontWeight: '500' },
  checkboxLabelActive: { color: '#DB7093', fontWeight: 'bold' },
  button: { backgroundColor: palette.accent, height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  switchButton: { marginTop: 20, alignItems: 'center' },
  switchText: { color: '#DB7093', fontSize: 14, fontWeight: '500' }
});