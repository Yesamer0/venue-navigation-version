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
import { supabase } from './supabase';
import MomentFeed from './MomentFeed';

export default function ProfileScreen({ navigation }) {
  const [username, setUsername] = useState('Kullanıcı');
  const [profileUserId, setProfileUserId] = useState(null);
  // --- Favori Mekanlar ---
  const [favoriteVenues, setFavoriteVenues] = useState([]);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  
  // --- Koleksiyonlar ---
const [collections, setCollections] = useState([]);
const [newCollectionName, setNewCollectionName] = useState('');
const [loadingCollections, setLoadingCollections] = useState(false);

const [selectedCollection, setSelectedCollection] = useState(null);
const [collectionVenues, setCollectionVenues] = useState([]);
const [loadingCollectionVenues, setLoadingCollectionVenues] = useState(false);

const [editingCollectionId, setEditingCollectionId] = useState(null);
const [editingCollectionName, setEditingCollectionName] = useState('');

  useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    if (data?.user) {
      setProfileUserId(data.user.id);
      const currentUsername =
        data.user.user_metadata?.username ||
        data.user.email.split('@')[0];

      setUsername(currentUsername);

      // Kullanıcının favori mekanlarını getir
      fetchFavoriteVenues(data.user.id);
      fetchCollections(data.user.id);
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


const fetchCollections = async (userId) => {
  setLoadingCollections(true);

  try {
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.log(
  'Koleksiyonlar çekilemedi:',
  JSON.stringify(error, null, 2)
);
      return;
    }

    setCollections(data || []);

  } catch (err) {
    console.log('Koleksiyon yükleme hatası:', err);
  } finally {
    setLoadingCollections(false);
  }
};

const fetchCollectionVenues = async (collection) => {
  setSelectedCollection(collection);
  setLoadingCollectionVenues(true);

  try {
    const { data, error } = await supabase
      .from('collection_venues')
      .select(`
        id,
        venue_id,
        venues (*)
      `)
      .eq('collection_id', collection.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.log(
        'Koleksiyon mekanları çekilemedi:',
        JSON.stringify(error, null, 2)
      );
      return;
    }

    const venues = (data || [])
      .map((item) => item.venues)
      .filter(Boolean);

    console.log('KOLEKSIYON VENUES:', JSON.stringify(venues, null, 2));

    setCollectionVenues(venues);

  } catch (err) {
    console.log('Koleksiyon mekanları yükleme hatası:', err);
  } finally {
    setLoadingCollectionVenues(false);
  }
};

const handleRemoveFromCollection = async (venueId) => {
  if (!selectedCollection) {
    return;
  }

  try {
    const { error } = await supabase
      .from('collection_venues')
      .delete()
      .eq('collection_id', selectedCollection.id)
      .eq('venue_id', venueId);

    if (error) {
      console.log(
        'Koleksiyondan çıkarma hatası:',
        JSON.stringify(error, null, 2)
      );
      alert('Mekan koleksiyondan çıkarılamadı.');
      return;
    }

    setCollectionVenues((currentVenues) =>
      currentVenues.filter((venue) => venue.id !== venueId)
    );

    alert('Mekan koleksiyondan çıkarıldı.');

  } catch (err) {
    console.log('Koleksiyondan çıkarma hatası:', err);
  }
};

const handleDeleteCollection = async (collectionId) => {
  try {
    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('id', collectionId);

    if (error) {
      console.log(
        'Koleksiyon silme hatası:',
        JSON.stringify(error, null, 2)
      );
      alert('Koleksiyon silinemedi.');
      return;
    }

    setCollections((currentCollections) =>
      currentCollections.filter(
        (collection) => collection.id !== collectionId
      )
    );

    if (selectedCollection?.id === collectionId) {
      setSelectedCollection(null);
      setCollectionVenues([]);
    }

    alert('Koleksiyon silindi.');

  } catch (err) {
    console.log('Koleksiyon silme hatası:', err);
  }
};

const handleUpdateCollectionName = async (collectionId) => {
  const name = editingCollectionName.trim();

  if (!name) {
    alert('Koleksiyon adı boş olamaz.');
    return;
  }

  try {
    const { error } = await supabase
      .from('collections')
      .update({ name: name })
      .eq('id', collectionId);

    if (error) {
      console.log(
        'Koleksiyon güncelleme hatası:',
        JSON.stringify(error, null, 2)
      );
      alert('Koleksiyon adı güncellenemedi.');
      return;
    }

    setCollections((currentCollections) =>
      currentCollections.map((collection) =>
        collection.id === collectionId
          ? { ...collection, name: name }
          : collection
      )
    );

    if (selectedCollection?.id === collectionId) {
      setSelectedCollection((currentCollection) => ({
        ...currentCollection,
        name: name,
      }));
    }

    setEditingCollectionId(null);
    setEditingCollectionName('');

    alert('Koleksiyon adı güncellendi.');
  } catch (err) {
    console.log('Koleksiyon güncelleme hatası:', err);
  }
};

const handleCreateCollection = async () => {
  const name = newCollectionName.trim();

  if (!name) {
    alert('Koleksiyon adı yazmalısınız.');
    return;
  }

  try {
    const { data: authData } = await supabase.auth.getUser();

    if (!authData?.user) {
      alert('Koleksiyon oluşturmak için giriş yapmalısınız.');
      return;
    }

    const { data, error } = await supabase
      .from('collections')
      .insert([
        {
          user_id: authData.user.id,
          name: name,
        },
      ])
      .select()
      .single();

    if (error) {
      console.log('Koleksiyon oluşturma hatası:', JSON.stringify(error, null, 2));
      alert('Koleksiyon oluşturulamadı.');
      return;
    }

    setCollections((current) => [data, ...current]);
    setNewCollectionName('');

  } catch (err) {
    console.log('Koleksiyon oluşturma hatası:', err);
  }
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
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 30 }}>
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



{/* Koleksiyonlar */}
<View style={styles.collectionsContainer}>

  <Text style={styles.collectionsTitle}>
    📁 Koleksiyonlarım
  </Text>

  <View style={styles.collectionInputRow}>
    <TextInput
      style={styles.collectionInput}
      placeholder="Yeni koleksiyon adı..."
      placeholderTextColor="#aaa"
      value={newCollectionName}
      onChangeText={setNewCollectionName}
    />

    <TouchableOpacity
      style={styles.collectionAddButton}
      onPress={handleCreateCollection}
    >
      <Text style={styles.collectionAddButtonText}>+</Text>
    </TouchableOpacity>
  </View>

  {loadingCollections ? (
    <ActivityIndicator
      size="small"
      color="#FF69B4"
      style={{ marginTop: 10 }}
    />
  ) : collections.length === 0 ? (
    <Text style={styles.emptyCollectionsText}>
      Henüz koleksiyon oluşturmadın.
    </Text>
  ) : (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginTop: 12 }}
    >
      {collections.map((collection) => (
        <View
          key={collection.id}
          style={{
            position: 'relative',
            marginRight: 10,
          }}
        >
          {/* Koleksiyonu aç */}
          <TouchableOpacity
            onPress={() => fetchCollectionVenues(collection)}
            style={styles.collectionCard}
          >
            <Text style={styles.collectionIcon}>📁</Text>

            <Text
              style={styles.collectionName}
              numberOfLines={1}
            >
              {collection.name}
            </Text>
          </TouchableOpacity>
           {/* Koleksiyon adını düzenle */}
<TouchableOpacity
  onPress={() => {
    setEditingCollectionId(collection.id);
    setEditingCollectionName(collection.name);
  }}
  style={{
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#DB7093',
    justifyContent: 'center',
    alignItems: 'center',
  }}
>
  <Text
    style={{
      color: '#fff',
      fontSize: 11,
      fontWeight: 'bold',
    }}
  >
    ✎
  </Text>
</TouchableOpacity>

{editingCollectionId === collection.id && (
  <View
    style={{
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
    }}
  >
    <TextInput
      value={editingCollectionName}
      onChangeText={setEditingCollectionName}
      placeholder="Yeni isim"
      style={{
        width: 110,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#DB7093',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 5,
        fontSize: 12,
      }}
    />

    <TouchableOpacity
      onPress={() => handleUpdateCollectionName(collection.id)}
      style={{
        marginLeft: 5,
        backgroundColor: '#DB7093',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 6,
      }}
    >
      <Text
        style={{
          color: '#fff',
          fontWeight: 'bold',
          fontSize: 12,
        }}
      >
        ✓
      </Text>
    </TouchableOpacity>
  </View>
)}

          {/* Koleksiyonu sil */}
          <TouchableOpacity
            onPress={() => handleDeleteCollection(collection.id)}
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: 'rgba(0,0,0,0.65)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontSize: 11,
                fontWeight: 'bold',
              }}
            >
              ✕
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  )}

  {/* Seçilen Koleksiyonun İçindeki Mekanlar */}
  {selectedCollection && (
    <View style={{ marginTop: 15 }}>

      <Text
        style={{
          fontSize: 16,
          fontWeight: 'bold',
          color: '#DB7093',
          marginBottom: 10,
        }}
      >
        📁 {selectedCollection.name}
      </Text>

      {loadingCollectionVenues ? (
        <ActivityIndicator
          size="small"
          color="#FF69B4"
        />
      ) : collectionVenues.length === 0 ? (
        <Text
          style={{
            color: '#999',
            fontSize: 13,
          }}
        >
          Bu koleksiyonda henüz mekan yok.
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {collectionVenues.map((venue) => (
            <View
              key={venue.id}
              style={{
                width: 130,
                marginRight: 10,
                backgroundColor: '#FFF0F5',
                borderRadius: 12,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* Mekana git */}
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('Details', {
                    item: venue,
                  })
                }
              >
                <Image
                  source={{ uri: venue.image_url }}
                  style={{
                    width: '100%',
                    height: 90,
                  }}
                />

                <View style={{ padding: 8 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontWeight: 'bold',
                      color: '#DB7093',
                      fontSize: 13,
                    }}
                  >
                    {venue.name}
                  </Text>

                  <Text
                    numberOfLines={1}
                    style={{
                      color: '#777',
                      fontSize: 11,
                      marginTop: 2,
                    }}
                  >
                    {venue.location}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Mekanı koleksiyondan çıkar */}
              <TouchableOpacity
                onPress={() =>
                  handleRemoveFromCollection(venue.id)
                }
                style={{
                  position: 'absolute',
                  top: 5,
                  right: 5,
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: 'rgba(0,0,0,0.65)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 'bold',
                  }}
                >
                  ✕
                </Text>
              </TouchableOpacity>

            </View>
          ))}
        </ScrollView>
      )}

    </View>
  )}

</View>

      {/* Mekânda paylaşılan fotoğraflar kalıcı olarak profilde de görünür. */}
      {profileUserId ? <View>
        <Text style={{ marginHorizontal: 16, color: '#777', marginTop: 16 }}>Yeni fotoğraf paylaşmak için bulunduğun mekânın sayfasını aç.</Text>
        <MomentFeed userId={profileUserId} navigation={navigation} />
      </View> : null}

      </ScrollView>
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

collectionsContainer: {
  backgroundColor: '#fff',
  marginHorizontal: 15,
  marginTop: 15,
  borderRadius: 16,
  padding: 15,
},

collectionsTitle: {
  fontSize: 16,
  fontWeight: 'bold',
  color: '#DB7093',
  marginBottom: 10,
},

collectionInputRow: {
  flexDirection: 'row',
  alignItems: 'center',
},

collectionInput: {
  flex: 1,
  height: 40,
  backgroundColor: '#FFF0F5',
  borderRadius: 10,
  paddingHorizontal: 12,
  color: '#333',
  fontSize: 13,
},

collectionAddButton: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: '#FF69B4',
  justifyContent: 'center',
  alignItems: 'center',
  marginLeft: 8,
},

collectionAddButtonText: {
  color: '#fff',
  fontSize: 24,
  fontWeight: 'bold',
},

emptyCollectionsText: {
  color: '#aaa',
  fontSize: 12,
  marginTop: 10,
},

collectionCard: {
  width: 120,
  backgroundColor: '#FFF0F5',
  borderRadius: 12,
  padding: 12,
  marginRight: 10,
  borderWidth: 1,
  borderColor: '#FFE4E1',
},

collectionIcon: {
  fontSize: 22,
  marginBottom: 6,
},

collectionName: {
  color: '#DB7093',
  fontSize: 13,
  fontWeight: '600',
},
});
