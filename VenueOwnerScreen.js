import React, { useEffect, useCallback, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { supabase } from './supabase';
import VenueCampaign from './VenueCampaign';
import { signOutVenue } from './authService';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

export default function VenueOwnerScreen({ navigation }) {
  const [username, setUsername] = useState('Mekan Sahibi');

  // Mekan sahibinin kendi mekanları
  const [myVenues, setMyVenues] = useState([]);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [announcementVenueId, setAnnouncementVenueId] = useState(null);
  const [announcementRevision, setAnnouncementRevision] = useState(0);
  
  useFocusEffect(useCallback(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        const currentUsername = data.user.user_metadata?.username || data.user.email.split('@')[0];
        setUsername(currentUsername);
        fetchMyVenues(data.user.id);
      }
    }).catch(err => console.log(err));
  }, []));

  const fetchMyVenues = async (ownerId) => {
    setLoadingVenues(true);
    const { data, error } = await supabase
      .from('venues')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.log('Mekan çekme hatası:', error);
    } else {
      setMyVenues(data || []);
    }
    setLoadingVenues(false);
  };


  const pickVenueImage = async (venue) => {
  try {
    // 1. Galeri izni
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      alert('Fotoğraf seçebilmek için galeri izni vermelisin.');
      return;
    }

    // 2. Galeriden fotoğraf seç
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    const imageUri = result.assets[0].uri;

    // 3. Telefonda bulunan fotoğrafı dosya verisine çevir
    const response = await fetch(imageUri);
    const arrayBuffer = await response.arrayBuffer();

    // 4. Dosya adı oluştur
    const fileExtension =
      result.assets[0].fileName?.split('.').pop() || 'jpg';

    const filePath =
      `${venue.id}/${Date.now()}.${fileExtension}`;

    // 5. Supabase Storage'a yükle
    const { error: uploadError } = await supabase.storage
      .from('venue-images')
      .upload(filePath, arrayBuffer, {
        contentType:
          result.assets[0].mimeType || 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.log('Fotoğraf yükleme hatası:', uploadError);
      alert('Fotoğraf Storage alanına yüklenemedi.');
      return;
    }

    // 6. Public URL al
    const { data: publicUrlData } = supabase.storage
      .from('venue-images')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    // 7. venues tablosundaki image_url alanını güncelle
    const { error: updateError } = await supabase
      .from('venues')
      .update({
        image_url: publicUrl,
      })
      .eq('id', venue.id);

    if (updateError) {
      console.log('Venue fotoğraf güncelleme hatası:', updateError);
      alert('Fotoğraf yüklendi fakat mekana kaydedilemedi.');
      return;
    }

    // 8. Ekrandaki mekan listesini de güncelle
    setMyVenues((currentVenues) =>
      currentVenues.map((currentVenue) =>
        currentVenue.id === venue.id
          ? { ...currentVenue, image_url: publicUrl }
          : currentVenue
      )
    );

    alert('Kapak fotoğrafı başarıyla eklendi.');

  } catch (err) {
    console.log('Fotoğraf işlemi hatası:', err);
    alert('Fotoğraf yüklenirken bir hata oluştu.');
  }
};

const addGalleryPhoto = async (venue) => {
  try {
    // 1. Galeri izni
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      alert('Fotoğraf seçebilmek için galeri izni vermelisin.');
      return;
    }

    // 2. Fotoğraf seç
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    // 3. Giriş yapan kullanıcıyı al
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert('Fotoğraf eklemek için giriş yapmalısın.');
      return;
    }

    // 4. Fotoğrafı dosya verisine çevir
    const imageUri = result.assets[0].uri;

    const response = await fetch(imageUri);
    const arrayBuffer = await response.arrayBuffer();

    // 5. Dosya yolunu oluştur
    const fileExtension =
      result.assets[0].fileName?.split('.').pop() || 'jpg';

    const filePath =
      `${venue.id}/gallery/${Date.now()}.${fileExtension}`;

    // 6. Storage'a yükle
    const { error: uploadError } = await supabase.storage
      .from('venue-images')
      .upload(filePath, arrayBuffer, {
        contentType:
          result.assets[0].mimeType || 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.log('Galeri upload hatası:', uploadError);
      alert('Fotoğraf yüklenemedi.');
      return;
    }

    // 7. Public URL al
    const { data: publicUrlData } = supabase.storage
      .from('venue-images')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    // 8. venue_photos tablosuna kaydet
    const { error: insertError } = await supabase
      .from('venue_photos')
      .insert([
        {
          venue_id: venue.id,
          user_id: user.id,
          image_url: publicUrl,
          type: 'gallery',
        },
      ]);

    if (insertError) {
      console.log('Galeri kayıt hatası:', insertError);
      alert('Fotoğraf yüklendi fakat galeriye kaydedilemedi.');
      return;
    }

    alert('Galeri fotoğrafı eklendi.');

  } catch (err) {
    console.log('Galeri fotoğraf hatası:', err);
    alert('Galeri fotoğrafı eklenirken hata oluştu.');
  }
};



  const handleSignOut = async () => {
    try { await signOutVenue(); }
    catch (failure) { alert(failure.message); }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      {/* Üst Kısım: Mekan Yönetim Başlığı */}
      <View style={styles.headerContainer}>
        <View style={styles.storeIconBox}>
          <Text style={styles.storeIconText}>🏢</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.venueTitleText}>{username} Yönetim Paneli</Text>
          <Text style={styles.userRoleText}>Onaylı Mekan Hesabı 🛡️</Text>
        </View>
        <TouchableOpacity style={styles.miniSignOutButton} onPress={handleSignOut}>
          <Text style={styles.miniSignOutText}>Çıkış</Text>
        </TouchableOpacity>
      </View>

      {/* Mekanlarım Bölümü: Geçiş Noktası */}
      <View style={styles.venuesSectionHeader}>
        <Text style={styles.boxTitle}>Mekânlarım</Text>
        {!loadingVenues && <TouchableOpacity
          style={styles.addVenueButton}
          onPress={() => navigation.navigate('AddVenue')}
        >
          <Text style={styles.addVenueButtonText}>+ Mekan Ekle</Text>
        </TouchableOpacity>}
      </View>

      {loadingVenues ? (
        <ActivityIndicator color="#4A90E2" style={{ marginVertical: 15 }} />
      ) : myVenues.length === 0 ? (
        <View style={styles.emptyVenueBox}>
          <Text style={styles.emptyVenueText}>
            Henüz mekanını eklemedin. "Mekan Ekle" ile herkese açık mekan profilini oluşturabilirsin.
          </Text>
        </View>
      ) : (
        <View style={styles.venuesScroll}>
          {myVenues.map((venue) => (
            <View key={venue.id} style={styles.venueCard}>
              <Text style={styles.venueCardName} numberOfLines={1}>{venue.name}</Text>
              <Text style={styles.venueCardCategory}>{venue.category || 'Kategori yok'}</Text>
              <View
  style={{
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  }}
>
  <TouchableOpacity
    style={[styles.manageButton, { flex: 1 }]}
    onPress={() => pickVenueImage(venue)}
  >
    <Text style={styles.manageButtonText}>
      📷 Kapak
    </Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={[styles.manageButton, { flex: 1 }]}
    onPress={() => navigation.navigate('Details', { item: venue, initialTab: 'accountphotos' })}
  >
    <Text style={styles.manageButtonText}>
      🖼️ Fotoğrafları Yönet
    </Text>
  </TouchableOpacity>
</View>

<TouchableOpacity
  style={[styles.manageButton, { marginTop: 7 }]}
  onPress={() =>
    navigation.navigate('Details', { item: venue })
  }
>
  <Text style={styles.manageButtonText}>
    Mekanın Herkese Açık Sayfası
  </Text>
</TouchableOpacity>
<TouchableOpacity
  accessibilityRole="button"
  accessibilityState={{ expanded: announcementVenueId === venue.id }}
  style={[styles.manageButton, { marginTop: 7 }]}
  onPress={() => setAnnouncementVenueId(current => current === venue.id ? null : venue.id)}
>
  <Text style={styles.manageButtonText}>Duyuru oluştur</Text>
</TouchableOpacity>
              {announcementVenueId === venue.id && (
                <VenueCampaign
                  venueId={venue.id}
                  venueName={venue.name}
                  canManage
                  onClose={() => setAnnouncementVenueId(null)}
                  onSaved={() => setAnnouncementRevision(value => value + 1)}
                />
              )}
            </View>
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>Duyurular</Text>
      <View style={styles.feedList}>
        {myVenues.map(venue => (
          <VenueCampaign
            key={venue.id}
            venueId={venue.id}
            canManage
            manageExisting
            venueName={venue.name}
            refreshVersion={announcementRevision}
          />
        ))}
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5', // Mekan paneli için daha kurumsal, temiz bir gri-beyaz arka plan
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 15,
    borderRadius: 16,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  storeIconBox: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#4A90E2', // Mekan sahipleri için mavi tonu kullandık (Farkı hissetmek için)
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeIconText: {
    fontSize: 24,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 15,
  },
  venueTitleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  userRoleText: {
    fontSize: 12,
    color: '#4A90E2',
    marginTop: 2,
    fontWeight: '600',
  },
  miniSignOutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  miniSignOutText: {
    color: '#4A90E2',
    fontSize: 12,
    fontWeight: '600',
  },
  boxTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#555',
    marginLeft: 20,
    marginTop: 25,
    marginBottom: 10,
  },
  feedList: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  venuesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 15,
    marginTop: 20,
    marginBottom: 10,
  },
  addVenueButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  addVenueButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  emptyVenueBox: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 10,
  },
  emptyVenueText: {
    color: '#888',
    fontSize: 13,
    lineHeight: 19,
  },
  venuesScroll: {
    marginHorizontal: 15,
    marginBottom: 10,
  },
  venueCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    paddingBottom: 25,
    marginBottom: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  venueCardName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  venueCardCategory: {
    fontSize: 12,
    color: '#4A90E2',
    marginBottom: 2,
  },
  manageButton: {
    backgroundColor: '#F0F7FF',
    borderWidth: 1,
    borderColor: '#4A90E2',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  manageButtonText: {
    color: '#4A90E2',
    fontSize: 12,
    fontWeight: '700',
  },
});
