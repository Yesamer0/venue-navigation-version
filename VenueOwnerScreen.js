import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  FlatList,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { supabase } from './supabase';
import * as ImagePicker from 'expo-image-picker';

export default function VenueOwnerScreen({ navigation }) {
  const [username, setUsername] = useState('Mekan Sahibi');
  const [announcementText, setAnnouncementText] = useState('');

  // Mekan sahibinin kendi mekanları
  const [myVenues, setMyVenues] = useState([]);
  const [loadingVenues, setLoadingVenues] = useState(true);
  
  // Mekanın kendi yaptığı paylaşımlar/duyurular listesi
  const [announcements, setAnnouncements] = useState([
    { id: '1', text: 'Bu akşam saat 20:00\'de akustik canlı müzik gecemiz başlıyor! 🎸🎙️', time: '3 saat önce' },
    { id: '2', text: 'Hafta içine özel: Alacağınız ikinci kahvede %30 indirim fırsatı! ☕✨', time: 'Dün' }
  ]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        const currentUsername = data.user.user_metadata?.username || data.user.email.split('@')[0];
        setUsername(currentUsername);
        fetchMyVenues(data.user.id);
      }
    }).catch(err => console.log(err));
  }, []);

  const fetchMyVenues = async (ownerId) => {
    setLoadingVenues(true);
    const { data, error } = await supabase
      .from('venues')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.log('Mekanlarım çekme hatası:', error);
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



  const handlePublishAnnouncement = () => {
    if (!announcementText.trim()) {
      alert("Duyuru metni boş olamaz!");
      return;
    }

    const newAnnouncement = {
      id: Date.now().toString(),
      text: announcementText.trim(),
      time: 'Şimdi'
    };

    setAnnouncements([newAnnouncement, ...announcements]);
    setAnnouncementText('');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // VenueOwnerScreen artık ProfileStack içinde yaşıyor, o da Tab
    // Navigator içinde, o da kök Stack içinde — iki kat yukarı çıkıyoruz.
    navigation.getParent()?.getParent()?.replace('Auth');
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
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
        <Text style={styles.boxTitle}>Mekanlarım 🏢</Text>
        <TouchableOpacity 
          style={styles.addVenueButton}
          onPress={() => navigation.navigate('AddVenue')}
        >
          <Text style={styles.addVenueButtonText}>+ Yeni Mekan Ekle</Text>
        </TouchableOpacity>
      </View>

      {loadingVenues ? (
        <ActivityIndicator color="#4A90E2" style={{ marginVertical: 15 }} />
      ) : myVenues.length === 0 ? (
        <View style={styles.emptyVenueBox}>
          <Text style={styles.emptyVenueText}>
            Henüz bir mekanın yok. "+ Yeni Mekan Ekle" ile ilk mekanını oluştur, ardından menü ve fotoğraflarını ekleyebilirsin.
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.venuesScroll}>
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
    onPress={() => addGalleryPhoto(venue)}
  >
    <Text style={styles.manageButtonText}>
      🖼️ Galeri
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
    ⚙️ Mekanı Yönet
  </Text>
</TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Orta Kısım: Kampanya / Duyuru Geçme Kutusu */}
      <View style={styles.shareContainer}>
        <Text style={styles.boxTitle}>Müşterilerinize Duyurun 📢</Text>
        <TextInput
          style={styles.shareInput}
          placeholder="Mekanınızda şu an ne var? Kampanya, etkinlik veya anlık doluluk bilgisini girin..."
          placeholderTextColor="#aaa"
          multiline
          value={announcementText}
          onChangeText={setAnnouncementText}
        />
        
        <View style={styles.shareActionRow}>
          <Text style={styles.charCountText}>{announcementText.length}/280</Text>
          <TouchableOpacity style={styles.shareButton} onPress={handlePublishAnnouncement}>
            <Text style={styles.shareButtonText}>Duyuru Yap</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Aktif Duyurularımız & Kampanyalar</Text>

      {/* Alt Kısım: Mekanın Kendi Duyuru Akışı */}
      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.postCard}>
            <View style={styles.postHeader}>
              <Text style={styles.postUser}>📢 {username}</Text>
              <Text style={styles.postTime}>{item.time}</Text>
            </View>
            <Text style={styles.postText}>{item.text}</Text>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>● Yayında</Text>
            </View>
          </View>
        )}
        contentContainerStyle={styles.feedList}
        showsVerticalScrollIndicator={false}
      />
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
  shareContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  boxTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  shareInput: {
    minHeight: 70,
    fontSize: 14,
    color: '#333',
    textAlignVertical: 'top',
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  shareActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  charCountText: {
    color: '#aaa',
    fontSize: 12,
  },
  shareButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
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
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  postUser: {
    fontWeight: 'bold',
    color: '#4A90E2',
    fontSize: 14,
  },
  postTime: {
    color: '#aaa',
    fontSize: 12,
  },
  postText: {
    color: '#333',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  activeBadge: {
    backgroundColor: '#E8F5E9',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  activeBadgeText: {
    color: '#2E7D32',
    fontSize: 11,
    fontWeight: 'bold',
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
    marginRight: 12,
    width: 180,
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