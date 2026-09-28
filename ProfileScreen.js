import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image // EKLENDİ: Fotoğrafları göstermek için
} from 'react-native';
import * as Location from 'expo-location'; 
import * as ImagePicker from 'expo-image-picker'; // EKLENDİ: Görsel seçici kütüphane
import { supabase } from './supabase';

export default function ProfileScreen({ navigation }) {
  const [username, setUsername] = useState('Kullanıcı');
  const [postText, setPostText] = useState('');
  const [locationText, setLocationText] = useState('');
  const [isLocationFocused, setIsLocationFocused] = useState(false);
  
  // Görsel yükleme için yeni state
  const [selectedImage, setSelectedImage] = useState(null);

  const [nearbyVenues, setNearbyVenues] = useState([]);
  const [loadingLocation, setLoadingLocation] = useState(false);

  // --- Favori Mekanlar ---
  const [favoriteVenues, setFavoriteVenues] = useState([]);
  const [loadingFavorites, setLoadingFavorites] = useState(true);


  const [posts, setPosts] = useState([
    { id: '1', text: 'Bugün harika bir kahve mekanı keşfettim! ☕✨', location: 'Kadıköy Kahvecisi', time: '2 saat önce', image: null },
    { id: '2', text: 'Venue uygulamasının arayüzü çok tatlı oldu, burası tam benlik.', location: '', time: 'Dün', image: null }
  ]);

  useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    if (data?.user) {
      const currentUsername =
        data.user.user_metadata?.username ||
        data.user.email.split('@')[0];

      setUsername(currentUsername);

      // Kullanıcının favori mekanlarını getir
      fetchFavoriteVenues(data.user.id);
    }
  }).catch(err => console.log(err));
}, []);

const fetchFavoriteVenues = async (userId) => {
  setLoadingFavorites(true);

  try {
    const { data, error } = await supabase
      .from('favorites')
      .select(`
        id,
        venue_id,
        venues (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.log('Favoriler çekilemedi:', error);
      return;
    }

    const venues = (data || [])
      .map((favorite) => favorite.venues)
      .filter(Boolean);

    setFavoriteVenues(venues);

  } catch (err) {
    console.log('Favoriler yüklenirken hata:', err);
  } finally {
    setLoadingFavorites(false);
  }
};

  // EKLENDİ: Galeriden fotoğraf seçme fonksiyonu
  const pickImage = async () => {
    // Önce galeri erişim izni isteyelim
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Fotoğraf ekleyebilmek için galeri izni vermelisiniz.');
      return;
    }

    // Galeriyi aç
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, // Kullanıcı kırpabilsin
      aspect: [4, 3],
      quality: 0.7, // Performans için kaliteyi biraz düşürelim
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri); // Seçilen görselin yerel yolunu kaydet
    }
  };

  const fetchNearbyVenues = async () => {
    try {
      setLoadingLocation(true);
      setIsLocationFocused(true);

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Yakındaki mekanları görebilmek için konum izni vermelisiniz.');
        setLoadingLocation(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const userLat = location.coords.latitude;
      const userLng = location.coords.longitude;

      const { data: venuesData, error } = await supabase.from('venues').select('*');
      if (error) throw error;

      if (venuesData) {
        const validVenues = venuesData.filter(v => v.latitude !== null && v.longitude !== null);
        const sortedVenues = validVenues.map(venue => {
          const distance = Math.sqrt(
            Math.pow(venue.latitude - userLat, 2) + Math.pow(venue.longitude - userLng, 2)
          );
          return { ...venue, distance };
        })
        .sort((a, b) => a.distance - b.distance) 
        .slice(0, 5); 

        setNearbyVenues(sortedVenues);
      }
    } catch (err) {
      console.log("Konum veya mekan çekme hatası:", err.message);
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleSharePost = () => {
    if (!postText.trim() && !selectedImage) {
      alert("Paylaşmak için bir metin yazın veya fotoğraf ekleyin!");
      return;
    }

    const newPost = {
      id: Date.now().toString(),
      text: postText.trim(),
      location: locationText.trim(), 
      image: selectedImage, // EKLENDİ: Seçilen görseli gönderiye ekliyoruz
      time: 'Şimdi'
    };

    setPosts([newPost, ...posts]);
    setPostText('');
    setLocationText('');
    setSelectedImage(null); // Paylaştıktan sonra fotoğrafı temizle
    setIsLocationFocused(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // ProfileScreen artık ProfileStack (Profil sekmesinin kendi iç
    // gezinmesi) içinde yaşıyor, o da Tab Navigator içinde, o da kök
    // Stack içinde. 'Auth' kök Stack'te olduğu için iki kat yukarı çıkmamız lazım.
    navigation.getParent()?.getParent()?.replace('Auth');
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      {/* Üst Kısım: Profil Kartı */}
      <View style={styles.headerContainer}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarLetter}>
            {username ? username.charAt(0).toUpperCase() : 'V'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.usernameText}>@{username}</Text>
          <Text style={styles.userTitleText}>Gezgin / Kaşif</Text>
        </View>
        <TouchableOpacity style={styles.miniSignOutButton} onPress={handleSignOut}>
          <Text style={styles.miniSignOutText}>Çıkış</Text>
        </TouchableOpacity>
      </View>



      {/* Favori Mekanlar */}
<View style={styles.favoritesContainer}>

  <Text style={styles.favoritesTitle}>
    ❤️ Favori Mekanlarım
  </Text>

  {loadingFavorites ? (

    <ActivityIndicator
      size="small"
      color="#FF69B4"
      style={{ marginVertical: 15 }}
    />

  ) : favoriteVenues.length === 0 ? (

    <Text style={styles.emptyFavoritesText}>
      Henüz favori mekanın yok.
    </Text>

  ) : (

    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {favoriteVenues.map((venue) => (

        <TouchableOpacity
          key={venue.id}
          style={styles.favoriteCard}
          onPress={() =>
            navigation.navigate('Details', { item: venue })
          }
        >

          <Image
            source={{ uri: venue.image_url }}
            style={styles.favoriteImage}
          />

          <View style={styles.favoriteInfo}>

            <Text
              style={styles.favoriteName}
              numberOfLines={1}
            >
              {venue.name}
            </Text>

            <Text
              style={styles.favoriteLocation}
              numberOfLines={1}
            >
              📍 {venue.location}
            </Text>

          </View>

        </TouchableOpacity>

      ))}
    </ScrollView>

  )}

</View>

      {/* Orta Kısım: Gelişmiş Paylaşım Kutusu */}
      <View style={styles.shareContainer}>
        <TextInput
          style={styles.shareInput}
          placeholder="Neler düşünüyorsun? Yaz..."
          placeholderTextColor="#aaa"
          multiline
          value={postText}
          onChangeText={setPostText}
        />
        
        <TextInput
          style={styles.locationInput}
          placeholder="📍 Mekan ara veya direkt kendin yaz..."
          placeholderTextColor="#bbb"
          value={locationText}
          onChangeText={(text) => setLocationText(text)}
          onFocus={fetchNearbyVenues} 
        />

        {/* Dinamik Öneri Alanı */}
        {isLocationFocused && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>Yakınındaki Mekanlar:</Text>
            {loadingLocation ? (
              <ActivityIndicator size="small" color="#FF69B4" style={{ alignSelf: 'flex-start', marginLeft: 10 }} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {nearbyVenues.length > 0 ? (
                  nearbyVenues.map((venue) => (
                    <TouchableOpacity 
                      key={venue.id} 
                      style={styles.suggestionBadge}
                      onPress={() => {
                        setLocationText(venue.name); 
                        setIsLocationFocused(false);
                      }}
                    >
                      <Text style={styles.suggestionText}>☕ {venue.name}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={{ fontSize: 12, color: '#aaa', paddingLeft: 5 }}>
                    Mekan bulunamadı, direkt yazabilirsiniz.
                  </Text>
                )}
              </ScrollView>
            )}
          </View>
        )}

        {/* EKLENDİ: Seçilen fotoğrafın küçük önizlemesi ve iptal butonu */}
        {selectedImage && (
          <View style={styles.previewImageContainer}>
            <Image source={{ uri: selectedImage }} style={styles.previewImage} />
            <TouchableOpacity style={styles.removeImageButton} onPress={() => setSelectedImage(null)}>
              <Text style={styles.removeImageText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.shareActionRow}>
          {/* EKLENDİ: Fotoğraf Ekleme İkonlu Buton */}
          <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
            <Text style={styles.photoButtonText}>🖼️ Fotoğraf Ekle</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.shareButton} onPress={handleSharePost}>
            <Text style={styles.shareButtonText}>Paylaş</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Paylaşımlarım</Text>

      {/* Alt Kısım: Akış Gönderileri */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.postCard}>
            <View style={styles.postHeader}>
              <Text style={styles.postUser}>@{username}</Text>
              <Text style={styles.postTime}>{item.time || 'Şimdi'}</Text>
            </View>
            <Text style={styles.postText}>{item.text}</Text>
            
            {/* EKLENDİ: Eğer gönderide fotoğraf varsa listelemede göster */}
            {item.image && (
              <Image source={{ uri: item.image }} style={styles.postImage} />
            )}

            {item.location ? (
              <View style={styles.locationBadge}>
                <Text style={styles.locationText}>📍 {item.location}</Text>
              </View>
            ) : null}
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
    backgroundColor: '#FFF0F5', 
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
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF69B4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 15,
  },
  usernameText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  userTitleText: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  miniSignOutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF69B4',
  },
  miniSignOutText: {
    color: '#FF69B4',
    fontSize: 12,
    fontWeight: '600',
  },
  shareContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 16,
    padding: 15,
  },
  shareInput: {
    minHeight: 50,
    fontSize: 15,
    color: '#333',
    textAlignVertical: 'top',
  },
  locationInput: {
    height: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#FFF0F5',
    fontSize: 13,
    color: '#555',
    marginTop: 5,
    marginBottom: 10,
    paddingHorizontal: 5,
  },
  previewImageContainer: {
    position: 'relative',
    marginTop: 5,
    marginBottom: 10,
  },
  previewImage: {
    width: '100%',
    height: 150,
    borderRadius: 10,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  suggestionsContainer: {
    marginTop: 5,
    marginBottom: 5,
    paddingVertical: 5,
  },
  suggestionsTitle: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
    fontWeight: '500',
  },
  suggestionBadge: {
    backgroundColor: '#FFF0F5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#FFE4E1',
  },
  suggestionText: {
    color: '#DB7093',
    fontSize: 12,
    fontWeight: '500',
  },
  shareActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  photoButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  photoButtonText: {
    color: '#DB7093',
    fontSize: 14,
    fontWeight: '600',
  },
  shareButton: {
    backgroundColor: '#FF69B4',
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#DB7093',
    marginLeft: 20,
    marginTop: 20,
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
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  postUser: {
    fontWeight: 'bold',
    color: '#FF69B4',
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
    marginBottom: 8,
  },
  postImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginBottom: 8,
  },
  locationBadge: {
    backgroundColor: '#FFF0F5',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  locationText: {
    color: '#DB7093',
    fontSize: 12,
    fontWeight: '500',
  },

  favoritesContainer: {
  backgroundColor: '#fff',
  marginHorizontal: 15,
  marginTop: 15,
  borderRadius: 16,
  padding: 15,
},

favoritesTitle: {
  fontSize: 16,
  fontWeight: 'bold',
  color: '#DB7093',
  marginBottom: 12,
},

emptyFavoritesText: {
  fontSize: 13,
  color: '#aaa',
  paddingVertical: 10,
},

favoriteCard: {
  width: 145,
  backgroundColor: '#FFF0F5',
  borderRadius: 12,
  marginRight: 10,
  overflow: 'hidden',
  borderWidth: 1,
  borderColor: '#FFE4E1',
},

favoriteImage: {
  width: '100%',
  height: 90,
},

favoriteInfo: {
  padding: 9,
},

favoriteName: {
  fontSize: 14,
  fontWeight: 'bold',
  color: '#333',
},

favoriteLocation: {
  fontSize: 11,
  color: '#DB7093',
  marginTop: 4,
},
});