import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  Platform 
} from 'react-native';
import { supabase } from './supabase'; 

export default function AuthScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(true); 
  const [isVenueOwner, setIsVenueOwner] = useState(false);

  const handleAuth = async () => {
    if (isRegisterMode && (!username || !email || !password)) {
      alert("Lütfen tüm alanları doldurun.");
      return;
    }
    if (!isRegisterMode && (!email || !password)) {
      alert("Lütfen e-posta ve şifre alanlarını doldurun.");
      return;
    }

    setLoading(true);

    if (isRegisterMode) {
      if (password.length < 7 || password.length > 20) {
        alert("Şifre en az 7, en fazla 20 karakter uzunluğunda olmalıdır.");
        setLoading(false);
        return;
      }

      try {
        // 1. Kullanıcı adı kontrolünü yeni açtığımız 'username' kolonundan yapıyoruz
        const { data: existingUser, error: checkError } = await supabase
          .from('users')
          .select('username')
          .eq('username', username)
          .maybeSingle();

        if (checkError) {
          console.log('KULLANICI ADI KONTROL HATASI:', checkError);
          alert("Kullanıcı adı kontrol edilirken bir hata oluştu: " + checkError.message);
          setLoading(false);
          return;
        }

        if (existingUser) {
          alert("Bu kullanıcı adı başkası tarafından alınmış. Lütfen farklı bir isim seçin.");
          setLoading(false);
          return;
        }

        // 2. Supabase Auth Kaydı
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: { 
              username: username,
              is_venue: isVenueOwner 
            }
          }
        });

        if (error) throw error;

        const userId = signUpData?.user?.id || signUpData?.data?.user?.id;

        if (!userId) {
          alert("Kayıt Hatası: Kullanıcı kimliği alınamadı. Lütfen tekrar deneyin.");
          setLoading(false);
          return;
        }

        // 3. Mevcut yapıyı bozmamak için hem 'name' hem 'username' alanlarını beraber besliyoruz!
        // ÖNEMLİ: Bu insert'in hatasını mutlaka kontrol ediyoruz.
        // Eğer bu satır sessizce başarısız olursa (örn. RLS/email confirmation
        // yüzünden), is_venue hiç kaydedilmez ve giriş yapınca kullanıcı
        // yanlışlıkla Profile sayfasına yönlendirilir.
        const { error: insertError } = await supabase
          .from('users')
          .insert([{ 
            id: userId, 
            username: username, // Yeni eklediğin sütun
            name: username,     // Projenin orijinal name sütunu
            email: email,       // Tablondaki email sütunu
            is_venue: isVenueOwner 
          }]);

        if (insertError) {
          console.log('KULLANICI TABLOSUNA EKLEME HATASI:', insertError);
          alert(
            "Kayıt Hatası: Hesabınız oluşturuldu fakat profil bilgileriniz kaydedilemedi.\n\n" +
            "Detay: " + insertError.message + "\n\n" +
            "Bu genelde Supabase'de 'Confirm email' ayarı açıkken veya 'users' " +
            "tablosunda uygun bir RLS INSERT politikası yokken oluşur."
          );
          setLoading(false);
          return;
        }

        alert("Kayıt başarılı! Şimdi giriş yapabilirsiniz.");
        setIsRegisterMode(false); 

      } catch (error) {
        alert("Kayıt Hatası: " + error.message);
      } finally {
        setLoading(false);
      }

    } else {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });

        if (error) throw error;

        const loginUserId = data?.user?.id;
        
        // Giriş yaparken rol kontrolünü çekiyoruz
        const { data: userData, error: fetchError } = await supabase
          .from('users')
          .select('is_venue')
          .eq('id', loginUserId)
          .single();

        if (fetchError) {
          console.log('ROL BİLGİSİ ÇEKME HATASI:', fetchError);
          alert(
            "Giriş yapıldı fakat profil bilgileriniz bulunamadı.\n\n" +
            "Detay: " + fetchError.message
          );
          setLoading(false);
          return;
        }

        alert("Başarıyla giriş yapıldı!");

        // Artık Profile/VenueOwner ayrı Stack ekranı değil, MainTabs
        // içindeki tek bir "Profil" sekmesi (ProfileOrVenueScreen) rolüne
        // göre otomatik doğru ekranı gösteriyor. O yüzden ikisinde de
        // sadece 'Main'e yönlendiriyoruz.
        navigation.replace('Main');
        
      } catch (error) {
        alert("Giriş Hatası: " + error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Venue</Text>
        <Text style={styles.subtitle}>
          {isRegisterMode ? 'Yeni bir hesap oluşturun' : 'Hesabınıza giriş yapın'}
        </Text>

        {isRegisterMode && (
          <TextInput
            style={styles.input}
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
          placeholder="E-posta Adresi"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor="#999"
        />

        <TextInput
          style={styles.input}
          placeholder="Şifre"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholderTextColor="#999"
        />

        {isRegisterMode && (
          <TouchableOpacity 
            style={[styles.checkboxRow, isVenueOwner && styles.checkboxRowActive]}
            onPress={() => setIsVenueOwner(!isVenueOwner)}
          >
            <View style={[styles.checkboxCircle, isVenueOwner && styles.checkboxCircleChecked]} />
            <Text style={[styles.checkboxLabel, isVenueOwner && styles.checkboxLabelActive]}>
              Ben bir Mekan Sahibiyim 🏢
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isRegisterMode ? 'Kayıt Ol' : 'Giriş Yap'}</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsRegisterMode(!isRegisterMode)} style={styles.switchButton}>
          <Text style={styles.switchText}>
            {isRegisterMode ? 'Zaten hesabınız var mı? Giriş Yapın' : 'Hesabınız yok mu? Kayıt Olun'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
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