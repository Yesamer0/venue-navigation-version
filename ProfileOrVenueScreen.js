import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { supabase } from './supabase';
import ProfileScreen from './ProfileScreen';
import VenueOwnerScreen from './VenueOwnerScreen';

// Bu bileşen tek başına bir ekran değil, bir "yönlendirici" gibi çalışır:
// Giriş yapmış kullanıcı mekan sahibiyse VenueOwnerScreen'i,
// değilse ProfileScreen'i gösterir. Tab bar'da tek bir "Profil" sekmesi
// olmasını istediğimiz için bu ayrımı burada yapıyoruz.
export default function ProfileOrVenueScreen({ navigation, route }) {
  const [isVenue, setIsVenue] = useState(null); // null = henüz bilinmiyor
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkRole();
  }, []);

  const checkRole = async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const authUser = data?.user;

      if (!authUser) {
        // Oturum yoksa, güvenlik amaçlı Auth ekranına geri gönder
        navigation.replace('Auth');
        return;
      }

      const { data: userData, error } = await supabase
        .from('users')
        .select('is_venue')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error) {
        console.log('Rol bilgisi alınamadı:', error);
      }

      setIsVenue(userData?.is_venue === true);
    } catch (err) {
      console.log('Kullanıcı kontrol hatası:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#D8A7B1" />
      </View>
    );
  }

  return isVenue
    ? <VenueOwnerScreen navigation={navigation} route={route} />
    : <ProfileScreen navigation={navigation} route={route} />;
}