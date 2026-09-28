import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Image, 
  TouchableOpacity, 
  Linking, 
  TextInput, 
  ActivityIndicator, 
  Dimensions,
} from 'react-native';
import { supabase } from './supabase'; 
import { styles } from './styles';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// Menü kategorilerini Yiyecek / İçecek / Diğer olarak gruplamak için eşleme.
const FOOD_CATEGORIES = ['Kruvasanlar (Tuzlu)', 'Kruvasanlar (Tatlı)', 'Tatlılar'];
const DRINK_CATEGORIES = [
  'İçecekler', 'Sıcak İçecekler', 'Soğuk İçecekler', 'Sıcak Kahveler', 'Soğuk Kahveler',
  '3. Nesil Kahveler', 'Espressolar', 'Türk Kahveleri', 'Ice Bar Specialleri',
  'Bitki Çayları', 'Soğuk Çaylar', 'Milkshakeler', 'Frozenler', 'Limonatalar',
  'Frappeler', 'Paket Kahveler',
];

function getMenuGroup(category) {
  if (FOOD_CATEGORIES.includes(category)) return 'yiyecek';
  if (DRINK_CATEGORIES.includes(category)) return 'icecek';
  return 'diger';
}

// Canlı durum için: bu süre içinde tazelenmemiş bir "buradayım" kaydı artık sayılmaz
const PRESENCE_WINDOW_MINUTES = 30;

export default function DetailsScreen({ route, navigation }) {
  const { item } = route.params;

  const [currentUser, setCurrentUser] = useState(null);
  const [isOwner, setIsOwner] = useState(false);

  // --- Favoriler ---
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId, setFavoriteId] = useState(null);
  const [loadingFavorite, setLoadingFavorite] = useState(false);

  const [activeMainTab, setActiveMainTab] = useState('menu');
  const [activeMenuGroup, setActiveMenuGroup] = useState('yiyecek');

  // --- Koleksiyonlar ---
  const [collections, setCollections] = useState([]);
  const [showCollections, setShowCollections] = useState(false);
  const [loadingCollections, setLoadingCollections] = useState(false);

  // --- Canlı Durum ---
  const [liveCount, setLiveCount] = useState(0);
  const [loadingLiveCount, setLoadingLiveCount] = useState(true);

  // --- Yorum / Puanlama ---
  const [userRating, setUserRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  // --- Menü ---
  const [menuItems, setMenuItems] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [showAddMenuForm, setShowAddMenuForm] = useState(false);
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuPrice, setNewMenuPrice] = useState('');
  const [newMenuCategory, setNewMenuCategory] = useState('');
  const [isSubmittingMenu, setIsSubmittingMenu] = useState(false);

  const [editingMenuId, setEditingMenuId] = useState(null);
  const [editMenuName, setEditMenuName] = useState('');
  const [editMenuPrice, setEditMenuPrice] = useState('');
  const [editMenuCategory, setEditMenuCategory] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // --- Fotoğraflar ---
  const [venuePhotos, setVenuePhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);

  const [showAddVenuePhotoForm, setShowAddVenuePhotoForm] = useState(false);
  const [newVenuePhotoUrl, setNewVenuePhotoUrl] = useState('');
  const [newVenuePhotoCaption, setNewVenuePhotoCaption] = useState('');
  const [isSubmittingVenuePhoto, setIsSubmittingVenuePhoto] = useState(false);

  const [showAddPhotoForm, setShowAddPhotoForm] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newPhotoCaption, setNewPhotoCaption] = useState('');
  const [isSubmittingPhoto, setIsSubmittingPhoto] = useState(false);

  const [editingPhotoId, setEditingPhotoId] = useState(null);
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editPhotoCaption, setEditPhotoCaption] = useState('');
  const [isSavingPhotoEdit, setIsSavingPhotoEdit] = useState(false);

  useEffect(() => {
    loadCurrentUser();
    fetchMenuItems();
    fetchReviews();
    fetchVenuePhotos();
    fetchLiveCount();

    // Canlı durum tablosunu gerçek zamanlı dinle (biri check-in olunca sayı anlık güncellensin)
    const channel = supabase
      .channel(`venue-presence-${item.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'venue_presence', filter: `venue_id=eq.${item.id}` },
        () => fetchLiveCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadCurrentUser = async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const authUser = data?.user;
      if (!authUser) return;

      const { data: profile } = await supabase
        .from('users')
        .select('username')
        .eq('id', authUser.id)
        .maybeSingle();

      setCurrentUser({ id: authUser.id, username: profile?.username || 'Gezgin' });
      setIsOwner(item.owner_id === authUser.id);

      // Kullanıcının bu mekanı daha önce favorileyip favorilemediğini kontrol et
      await fetchFavoriteStatus(authUser.id);
      await fetchCollections(authUser.id);
    } catch (err) {
      console.log('Kullanıcı bilgisi alınamadı:', err);
    }
  };

  const fetchFavoriteStatus = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', userId)
        .eq('venue_id', item.id)
        .maybeSingle();

      if (error) {
        console.log('Favori kontrol hatası:', error);
        return;
      }

      if (data) {
        setIsFavorite(true);
        setFavoriteId(data.id);
      } else {
        setIsFavorite(false);
        setFavoriteId(null);
      }
    } catch (err) {
      console.log('Favori kontrol hatası:', err);
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
        console.log('Koleksiyonlar çekilemedi:', JSON.stringify(error, null, 2));
        return;
      }

      setCollections(data || []);
    } catch (err) {
      console.log('Koleksiyon yükleme hatası:', err);
    } finally {
      setLoadingCollections(false);
    }
  };
  const handleAddToCollection = async (collectionId) => {
  if (!currentUser) {
    alert('Koleksiyona eklemek için giriş yapmalısınız.');
    return;
  }

  try {
    const { error } = await supabase
      .from('collection_venues')
      .insert([
        {
          collection_id: collectionId,
          venue_id: item.id,
        },
      ]);

    if (error) {
      if (error.code === '23505') {
        alert('Bu mekan zaten bu koleksiyonda.');
      } else {
        console.log(
          'Koleksiyona ekleme hatası:',
          JSON.stringify(error, null, 2)
        );

        alert('Mekan koleksiyona eklenemedi.');
      }

      return;
    }

    setShowCollections(false);
    alert('Mekan koleksiyona eklendi.');

  } catch (err) {
    console.log('Koleksiyona ekleme hatası:', err);
  }
};

  const handleToggleFavorite = async () => {
    if (!currentUser) {
      alert('Favorilere eklemek için giriş yapmalısınız.');
      return;
    }

    if (loadingFavorite) return;

    setLoadingFavorite(true);

    try {
      if (isFavorite) {
        // Zaten favorideyse favorilerden çıkar
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('id', favoriteId);

        if (error) {
          console.log('Favori silme hatası:', error);
          alert('Favoriden çıkarılırken bir hata oluştu.');
          return;
        }

        setIsFavorite(false);
        setFavoriteId(null);
      } else {
        // Favoride değilse favorilere ekle
        const { data, error } = await supabase
          .from('favorites')
          .insert([
            {
              user_id: currentUser.id,
              venue_id: item.id,
            },
          ])
          .select('id')
          .single();

        if (error) {
          console.log('Favori ekleme hatası:', error);
          alert('Favorilere eklenirken bir hata oluştu.');
          return;
        }

        setIsFavorite(true);
        setFavoriteId(data.id);
      }
    } catch (err) {
      console.log('Favori işlem hatası:', err);
      alert('Bir bağlantı sorunu oluştu.');
    } finally {
      setLoadingFavorite(false);
    }
  };

  const fetchLiveCount = async () => {
    setLoadingLiveCount(true);
    const cutoff = new Date(Date.now() - PRESENCE_WINDOW_MINUTES * 60 * 1000).toISOString();

    const { count, error } = await supabase
      .from('venue_presence')
      .select('*', { count: 'exact', head: true })
      .eq('venue_id', item.id)
      .gte('last_seen_at', cutoff);

    if (error) {
      console.log('Canlı durum çekme hatası:', error);
    } else {
      setLiveCount(count || 0);
    }
    setLoadingLiveCount(false);
  };

  const fetchMenuItems = async () => {
    setLoadingMenu(true);
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('venue_id', item.id)
      .order('category', { ascending: true });

    if (error) {
      console.log('Menü çekme hatası:', error);
    } else {
      setMenuItems(data || []);
    }
    setLoadingMenu(false);
  };

  const fetchReviews = async () => {
    setLoadingReviews(true);
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('venue_id', item.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.log('Yorum çekme hatası:', error);
    } else {
      setReviews(data || []);
    }
    setLoadingReviews(false);
  };

  const fetchVenuePhotos = async () => {
    setLoadingPhotos(true);
    const { data, error } = await supabase
      .from('venue_photos')
      .select('*')
      .eq('venue_id', item.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.log('Fotoğraf çekme hatası:', error);
    } else {
      setVenuePhotos(data || []);
    }
    setLoadingPhotos(false);
  };

  const officialPhotos = venuePhotos.filter((p) => p.type === 'venue');
  const taggedPhotos = venuePhotos.filter((p) => p.type !== 'venue');

  const itemsInActiveGroup = menuItems.filter(
    (m) => getMenuGroup(m.category) === activeMenuGroup
  );
  const groupedByCategory = {};
  itemsInActiveGroup.forEach((m) => {
    const cat = m.category || 'Diğer';
    if (!groupedByCategory[cat]) groupedByCategory[cat] = [];
    groupedByCategory[cat].push(m);
  });

  const handleSendReview = async () => {
    if (userRating === 0) {
      alert("Lütfen önce bir puan seçin! ⭐");
      return;
    }
    if (!currentUser) {
      alert("Yorum yapabilmek için giriş yapmalısınız.");
      return;
    }

    setIsSubmittingReview(true);
    try {
      const { error } = await supabase
        .from('reviews')
        .insert([{
          venue_id: item.id,
          user_id: currentUser.id,
          rating: userRating,
          comment: comment,
          user_name: currentUser.username
        }]);

      if (error) {
        alert("Hata: " + error.message);
      } else {
        alert("Başarılı! 🌸 Yorumunuz ve puanınız kaydedildi.");
        setComment('');
        setUserRating(0);
        fetchReviews();
      }
    } catch (err) {
      alert("Bir bağlantı sorunu oluştu.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleAddMenuItem = async () => {
    if (!newMenuName.trim()) {
      alert("Ürün adı boş olamaz.");
      return;
    }

    setIsSubmittingMenu(true);
    try {
      const { error } = await supabase
        .from('menu_items')
        .insert([{
          venue_id: item.id,
          name: newMenuName.trim(),
          price: newMenuPrice ? parseFloat(newMenuPrice.replace(',', '.')) : null,
          category: newMenuCategory.trim() || null,
        }]);

      if (error) {
        alert("Menü Hatası: " + error.message);
      } else {
        setNewMenuName('');
        setNewMenuPrice('');
        setNewMenuCategory('');
        setShowAddMenuForm(false);
        fetchMenuItems();
      }
    } catch (err) {
      alert("Bir bağlantı sorunu oluştu.");
    } finally {
      setIsSubmittingMenu(false);
    }
  };

  const startEditMenuItem = (menuItem) => {
    setEditingMenuId(menuItem.id);
    setEditMenuName(menuItem.name || '');
    setEditMenuPrice(menuItem.price != null ? String(menuItem.price) : '');
    setEditMenuCategory(menuItem.category || '');
  };

  const cancelEditMenuItem = () => {
    setEditingMenuId(null);
    setEditMenuName('');
    setEditMenuPrice('');
    setEditMenuCategory('');
  };

  const handleSaveEditMenuItem = async () => {
    if (!editMenuName.trim()) {
      alert('Ürün adı boş olamaz.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({
          name: editMenuName.trim(),
          price: editMenuPrice ? parseFloat(editMenuPrice.replace(',', '.')) : null,
          category: editMenuCategory.trim() || null,
        })
        .eq('id', editingMenuId);

      if (error) {
        alert('Güncelleme Hatası: ' + error.message);
      } else {
        cancelEditMenuItem();
        fetchMenuItems();
      }
    } catch (err) {
      alert('Bir bağlantı sorunu oluştu.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteMenuItem = async (menuItemId) => {
    try {
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', menuItemId);

      if (error) {
        alert('Silme Hatası: ' + error.message);
      } else {
        fetchMenuItems();
      }
    } catch (err) {
      alert('Bir bağlantı sorunu oluştu.');
    }
  };

  const handleAddVenuePhoto = async () => {
    if (!newVenuePhotoUrl.trim()) {
      alert("Fotoğraf linki boş olamaz.");
      return;
    }
    if (!currentUser) {
      alert("Fotoğraf eklemek için giriş yapmalısınız.");
      return;
    }

    setIsSubmittingVenuePhoto(true);
    try {
      const { error } = await supabase
        .from('venue_photos')
        .insert([{
          venue_id: item.id,
          user_id: currentUser.id,
          image_url: newVenuePhotoUrl.trim(),
          caption: newVenuePhotoCaption.trim() || null,
          type: 'venue',
        }]);

      if (error) {
        alert("Fotoğraf Hatası: " + error.message);
      } else {
        setNewVenuePhotoUrl('');
        setNewVenuePhotoCaption('');
        setShowAddVenuePhotoForm(false);
        fetchVenuePhotos();
      }
    } catch (err) {
      alert("Bir bağlantı sorunu oluştu.");
    } finally {
      setIsSubmittingVenuePhoto(false);
    }
  };

  const handleAddPhoto = async () => {
    if (!newPhotoUrl.trim()) {
      alert("Fotoğraf linki boş olamaz.");
      return;
    }
    if (!currentUser) {
      alert("Fotoğraf eklemek için giriş yapmalısınız.");
      return;
    }

    setIsSubmittingPhoto(true);
    try {
      const { error } = await supabase
        .from('venue_photos')
        .insert([{
          venue_id: item.id,
          user_id: currentUser.id,
          image_url: newPhotoUrl.trim(),
          caption: newPhotoCaption.trim() || null,
          type: 'tag',
        }]);

      if (error) {
        alert("Fotoğraf Hatası: " + error.message);
      } else {
        setNewPhotoUrl('');
        setNewPhotoCaption('');
        setShowAddPhotoForm(false);
        fetchVenuePhotos();
      }
    } catch (err) {
      alert("Bir bağlantı sorunu oluştu.");
    } finally {
      setIsSubmittingPhoto(false);
    }
  };

  const startEditPhoto = (photo) => {
    setEditingPhotoId(photo.id);
    setEditPhotoUrl(photo.image_url || '');
    setEditPhotoCaption(photo.caption || '');
  };

  const cancelEditPhoto = () => {
    setEditingPhotoId(null);
    setEditPhotoUrl('');
    setEditPhotoCaption('');
  };

  const handleSaveEditPhoto = async () => {
    if (!editPhotoUrl.trim()) {
      alert('Fotoğraf linki boş olamaz.');
      return;
    }

    setIsSavingPhotoEdit(true);
    try {
      const { error } = await supabase
        .from('venue_photos')
        .update({
          image_url: editPhotoUrl.trim(),
          caption: editPhotoCaption.trim() || null,
        })
        .eq('id', editingPhotoId);

      if (error) {
        alert('Güncelleme Hatası: ' + error.message);
      } else {
        cancelEditPhoto();
        fetchVenuePhotos();
      }
    } catch (err) {
      alert('Bir bağlantı sorunu oluştu.');
    } finally {
      setIsSavingPhotoEdit(false);
    }
  };

  const handleDeletePhoto = async (photoId) => {
    try {
      const { error } = await supabase
        .from('venue_photos')
        .delete()
        .eq('id', photoId);

      if (error) {
        alert('Silme Hatası: ' + error.message);
      } else {
        fetchVenuePhotos();
      }
    } catch (err) {
      alert('Bir bağlantı sorunu oluştu.');
    }
  };

  const renderMenuItemRow = (menuItem) => {
    const isEditingThis = editingMenuId === menuItem.id;

    if (isEditingThis) {
      return (
        <View
          key={menuItem.id}
          style={{ backgroundColor: '#FFF5F7', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#F9A8D4' }}
        >
          <TextInput
            style={{ backgroundColor: '#fff', borderRadius: 8, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: '#F9A8D4' }}
            placeholder="Ürün adı"
            value={editMenuName}
            onChangeText={setEditMenuName}
          />
          <TextInput
            style={{ backgroundColor: '#fff', borderRadius: 8, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: '#F9A8D4' }}
            placeholder="Fiyat"
            keyboardType="numeric"
            value={editMenuPrice}
            onChangeText={setEditMenuPrice}
          />
          <TextInput
            style={{ backgroundColor: '#fff', borderRadius: 8, padding: 8, marginBottom: 10, borderWidth: 1, borderColor: '#F9A8D4' }}
            placeholder="Kategori"
            value={editMenuCategory}
            onChangeText={setEditMenuCategory}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: '#FF69B4', borderRadius: 8, paddingVertical: 10, alignItems: 'center', opacity: isSavingEdit ? 0.6 : 1 }}
              onPress={handleSaveEditMenuItem}
              disabled={isSavingEdit}
            >
              {isSavingEdit ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Kaydet</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: '#E5E7EB', borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
              onPress={cancelEditMenuItem}
            >
              <Text style={{ color: '#374151', fontWeight: 'bold' }}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View
        key={menuItem.id}
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3D9E4' }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#333' }}>{menuItem.name}</Text>
          {menuItem.description ? (
            <Text style={{ fontSize: 12, color: '#777', marginTop: 2 }}>{menuItem.description}</Text>
          ) : null}
        </View>

        {menuItem.price != null && (
          <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#FF69B4', marginRight: isOwner ? 12 : 0 }}>
            {menuItem.price} ₺
          </Text>
        )}

        {isOwner && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => startEditMenuItem(menuItem)}>
              <Text style={{ color: '#4B5563', fontWeight: '600', fontSize: 12 }}>Düzenle</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeleteMenuItem(menuItem.id)}>
              <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 12 }}>Sil</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={{ height: SCREEN_HEIGHT, backgroundColor: '#fff' }} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* ===== ÜST KISIM ===== */}
      <View>
        <Image source={{ uri: item.image_url }} style={{ width: '100%', height: 180 }} />

        {/* Geri butonu */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            position: 'absolute', top: 15, left: 15,
            width: 38, height: 38, borderRadius: 19,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'center', alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>‹</Text>
        </TouchableOpacity>

        {/* Favori butonu */}
        <TouchableOpacity
          onPress={handleToggleFavorite}
          disabled={loadingFavorite}
          style={{
            position: 'absolute',
            top: 15,
            right: 15,
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {loadingFavorite ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text
              style={{
                color: isFavorite ? '#FF69B4' : '#fff',
                fontSize: 23,
                fontWeight: 'bold',
              }}
            >
              {isFavorite ? '♥' : '♡'}
            </Text>
          )}
        </TouchableOpacity>

        {/* 📁 Koleksiyona Kaydet Butonu */}
        <TouchableOpacity
          onPress={() => setShowCollections(!showCollections)}
          style={{
            position: 'absolute',
            top: 60,
            right: 15,
            backgroundColor: 'rgba(0,0,0,0.45)',
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 18,
          }}
        >
          <Text
            style={{
              color: '#fff',
              fontSize: 12,
              fontWeight: '600',
            }}
          >
            📁 Koleksiyona Kaydet
          </Text>
        </TouchableOpacity>

        {/* 📁 Açılan Koleksiyon Listesi */}
        {showCollections && (
          <View
            style={{
              position: 'absolute',
              top: 105,
              right: 15,
              width: 190,
              backgroundColor: '#fff',
              borderRadius: 12,
              padding: 10,
              zIndex: 20,
              elevation: 5,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: 'bold',
                color: '#DB7093',
                marginBottom: 8,
              }}
            >
              Koleksiyon Seç
            </Text>

            {loadingCollections ? (
              <ActivityIndicator size="small" color="#FF69B4" />
            ) : collections.length === 0 ? (
              <Text style={{ fontSize: 12, color: '#999' }}>
                Henüz koleksiyonun yok.
              </Text>
            ) : (
              collections.map((collection) => (
                <TouchableOpacity
                  key={collection.id}
                  onPress={() => handleAddToCollection(collection.id)}
                  style={{
                    backgroundColor: '#FFF0F5',
                    paddingVertical: 9,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                    marginBottom: 6,
                  }}
                >
                  <Text
                    style={{
                      color: '#DB7093',
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    📁 {collection.name}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </View>

      {/* ===== BAŞLIK BÖLÜMÜ ===== */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#333' }}>{item.name}</Text>
            <Text style={{ color: '#666', fontSize: 13 }}>{item.location}</Text>

            {/* Canlı Durum Göstergesi */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              {loadingLiveCount ? (
                <ActivityIndicator size="small" color="#999" />
              ) : liveCount > 0 ? (
                <>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 6 }} />
                  <Text style={{ color: '#15803D', fontWeight: '600', fontSize: 12 }}>
                    Şu an {liveCount} kişi burada
                  </Text>
                </>
              ) : (
                <Text style={{ color: '#999', fontSize: 12 }}>Şu an kimse check-in yapmamış</Text>
              )}
            </View>
          </View>
          <TouchableOpacity 
            style={{ backgroundColor: '#4B5563', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 }}
            onPress={() => {
              const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + ' ' + item.location)}`;
              Linking.openURL(mapUrl);
            }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Yol Tarifi 📍</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Ana Sekmeler: Menü & Galeri / Yorumlar & Etiketler / Sohbet */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 15 }}>
        <TouchableOpacity
          style={{
            flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
            backgroundColor: activeMainTab === 'menu' ? '#FF69B4' : '#F3F3F3',
          }}
          onPress={() => setActiveMainTab('menu')}
        >
          <Text style={{ color: activeMainTab === 'menu' ? '#fff' : '#666', fontWeight: 'bold' }}>Menü & Galeri</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
            backgroundColor: activeMainTab === 'reviews' ? '#FF69B4' : '#F3F3F3',
          }}
          onPress={() => setActiveMainTab('reviews')}
        >
          <Text style={{ color: activeMainTab === 'reviews' ? '#fff' : '#666', fontWeight: 'bold' }}>Yorumlar & Etiketler</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
            backgroundColor: '#4B5563',
          }}
          onPress={() => navigation.navigate('VenueChat', { item })}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Sohbet 💬</Text>
        </TouchableOpacity>
      </View>

      {/* ===== İÇERİK ===== */}
      {activeMainTab === 'menu' ? (
        <View style={{ paddingHorizontal: 20 }}>

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
            {item.has_wifi && (
              <View style={{ backgroundColor: '#F0F9FF', padding: 8, borderRadius: 12, borderWidth: 1, borderColor: '#BAE6FD' }}>
                <Text style={{ color: '#0369A1', fontWeight: 'bold', fontSize: 12 }}>📶 Wi-Fi</Text>
              </View>
            )}
            {item.is_outdoor && (
              <View style={{ backgroundColor: '#F0FDF4', padding: 8, borderRadius: 12, borderWidth: 1, borderColor: '#BBF7D0' }}>
                <Text style={{ color: '#15803D', fontWeight: 'bold', fontSize: 12 }}>🌳 Açık Alan</Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 19, fontWeight: 'bold', color: '#333' }}>Menü 🍽️</Text>
            {isOwner && (
              <TouchableOpacity onPress={() => setShowAddMenuForm(!showAddMenuForm)}>
                <Text style={{ color: '#FF69B4', fontWeight: 'bold' }}>
                  {showAddMenuForm ? 'İptal' : '+ Ürün Ekle'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 15 }}>
            {[
              { key: 'yiyecek', label: '🍰 Yiyecek' },
              { key: 'icecek', label: '☕ İçecek' },
              { key: 'diger', label: '📦 Diğer' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveMenuGroup(tab.key)}
                style={{
                  paddingVertical: 7,
                  paddingHorizontal: 14,
                  borderRadius: 16,
                  backgroundColor: activeMenuGroup === tab.key ? '#FFF0F5' : '#FAFAFA',
                  borderWidth: 1,
                  borderColor: activeMenuGroup === tab.key ? '#FF69B4' : '#EEEEEE',
                }}
              >
                <Text style={{ color: activeMenuGroup === tab.key ? '#DB7093' : '#888', fontWeight: '600', fontSize: 13 }}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isOwner && showAddMenuForm && (
            <View style={{ backgroundColor: '#FFF5F7', borderRadius: 16, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#FCE7F3' }}>
              <TextInput
                style={{ backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#F9A8D4' }}
                placeholder="Ürün adı (örn: Latte)"
                value={newMenuName}
                onChangeText={setNewMenuName}
              />
              <TextInput
                style={{ backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#F9A8D4' }}
                placeholder="Fiyat (örn: 120)"
                keyboardType="numeric"
                value={newMenuPrice}
                onChangeText={setNewMenuPrice}
              />
              <TextInput
                style={{ backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#F9A8D4' }}
                placeholder="Kategori (örn: Sıcak Kahveler)"
                value={newMenuCategory}
                onChangeText={setNewMenuCategory}
              />
              <TouchableOpacity
                style={[styles.allButton, { opacity: isSubmittingMenu ? 0.6 : 1, alignItems: 'center' }]}
                onPress={handleAddMenuItem}
                disabled={isSubmittingMenu}
              >
                {isSubmittingMenu ? <ActivityIndicator color="#fff" /> : <Text style={styles.allButtonText}>Menüye Ekle</Text>}
              </TouchableOpacity>
            </View>
          )}

          {loadingMenu ? (
            <ActivityIndicator color="#FF69B4" style={{ marginVertical: 20 }} />
          ) : Object.keys(groupedByCategory).length === 0 ? (
            <Text style={{ color: '#999', marginBottom: 20 }}>Bu bölümde henüz ürün yok.</Text>
          ) : (
            <View style={{ marginBottom: 20 }}>
              {Object.keys(groupedByCategory).sort().map((categoryName) => (
                <View key={categoryName} style={{ marginBottom: 18 }}>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#DB7093', marginBottom: 6, textTransform: 'uppercase' }}>
                    {categoryName}
                  </Text>
                  {groupedByCategory[categoryName].map((menuItem) => renderMenuItemRow(menuItem))}
                </View>
              ))}
            </View>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 19, fontWeight: 'bold', color: '#333' }}>Mekandan Kareler 📸</Text>
            {isOwner && (
              <TouchableOpacity onPress={() => setShowAddVenuePhotoForm(!showAddVenuePhotoForm)}>
                <Text style={{ color: '#FF69B4', fontWeight: 'bold' }}>
                  {showAddVenuePhotoForm ? 'İptal' : '+ Fotoğraf Ekle'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {isOwner && showAddVenuePhotoForm && (
            <View style={{ backgroundColor: '#FFF5F7', borderRadius: 16, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#FCE7F3' }}>
              <TextInput
                style={{ backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#F9A8D4' }}
                placeholder="Fotoğraf linki (URL)"
                autoCapitalize="none"
                value={newVenuePhotoUrl}
                onChangeText={setNewVenuePhotoUrl}
              />
              <TextInput
                style={{ backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#F9A8D4' }}
                placeholder="Açıklama (opsiyonel)"
                value={newVenuePhotoCaption}
                onChangeText={setNewVenuePhotoCaption}
              />
              <TouchableOpacity
                style={[styles.allButton, { opacity: isSubmittingVenuePhoto ? 0.6 : 1, alignItems: 'center' }]}
                onPress={handleAddVenuePhoto}
                disabled={isSubmittingVenuePhoto}
              >
                {isSubmittingVenuePhoto ? <ActivityIndicator color="#fff" /> : <Text style={styles.allButtonText}>Galeriye Ekle</Text>}
              </TouchableOpacity>
            </View>
          )}

          {loadingPhotos ? (
            <ActivityIndicator color="#FF69B4" style={{ marginVertical: 20 }} />
          ) : officialPhotos.length === 0 ? (
            <Text style={{ color: '#999', marginBottom: 20 }}>Henüz fotoğraf paylaşılmamış.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              {officialPhotos.map((photo) => (
                <Image
                  key={photo.id}
                  source={{ uri: photo.image_url }}
                  style={{ width: 140, height: 140, borderRadius: 14, marginRight: 12 }}
                />
              ))}
            </ScrollView>
          )}
        </View>
      ) : (
        <View style={{ paddingHorizontal: 20 }}>

          <View style={{ backgroundColor: '#FFF5F7', padding: 20, borderRadius: 20, marginBottom: 20, marginTop: 10, borderWidth: 1, borderColor: '#FCE7F3' }}>
            <Text style={{ textAlign: 'center', marginBottom: 10, fontWeight: 'bold', color: '#D8A7B1' }}>Deneyimini Puanla ✨</Text>

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 15 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setUserRating(star)}>
                  <Text style={{ fontSize: 35, color: star <= userRating ? '#FFD700' : '#D3D3D3', marginHorizontal: 5 }}>
                    {star <= userRating ? '★' : '☆'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={{
                backgroundColor: '#fff', borderWidth: 1, borderColor: '#F9A8D4', borderRadius: 15,
                padding: 15, height: 100, textAlignVertical: 'top', fontSize: 16
              }}
              placeholder="Mekan hakkında ne düşünüyorsun? 🌸"
              multiline
              value={comment}
              onChangeText={setComment}
            />

            <TouchableOpacity 
              style={[styles.allButton, { marginTop: 15, opacity: isSubmittingReview ? 0.6 : 1, alignItems: 'center', justifyContent: 'center' }]}
              onPress={handleSendReview}
              disabled={isSubmittingReview}
            >
              {isSubmittingReview ? <ActivityIndicator color="#fff" /> : <Text style={styles.allButtonText}>Yorumu Gönder</Text>}
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 19, fontWeight: 'bold', color: '#333', marginBottom: 12 }}>Yorumlar 💬</Text>
          {loadingReviews ? (
            <ActivityIndicator color="#FF69B4" style={{ marginVertical: 20 }} />
          ) : reviews.length === 0 ? (
            <Text style={{ color: '#999', marginBottom: 20 }}>Henüz yorum yapılmamış. İlk yorumu sen yaz!</Text>
          ) : (
            <View style={{ marginBottom: 20 }}>
              {reviews.map((review) => (
                <View
                  key={review.id}
                  style={{ backgroundColor: '#FAFAFA', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#EEEEEE' }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontWeight: 'bold', color: '#333' }}>{review.user_name || 'Gezgin'}</Text>
                    <Text style={{ color: '#FFD700' }}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text>
                  </View>
                  {review.comment ? <Text style={{ color: '#555', fontSize: 14 }}>{review.comment}</Text> : null}
                </View>
              ))}
            </View>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 19, fontWeight: 'bold', color: '#333' }}>Etiketleyenler 🏷️</Text>
            <TouchableOpacity onPress={() => setShowAddPhotoForm(!showAddPhotoForm)}>
              <Text style={{ color: '#FF69B4', fontWeight: 'bold' }}>
                {showAddPhotoForm ? 'İptal' : '+ Fotoğraf Ekle'}
              </Text>
            </TouchableOpacity>
          </View>

          {showAddPhotoForm && (
            <View style={{ backgroundColor: '#FFF5F7', borderRadius: 16, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#FCE7F3' }}>
              <TextInput
                style={{ backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#F9A8D4' }}
                placeholder="Fotoğraf linki (URL)"
                autoCapitalize="none"
                value={newPhotoUrl}
                onChangeText={setNewPhotoUrl}
              />
              <TextInput
                style={{ backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#F9A8D4' }}
                placeholder="Açıklama (opsiyonel)"
                value={newPhotoCaption}
                onChangeText={setNewPhotoCaption}
              />
              <TouchableOpacity
                style={[styles.allButton, { opacity: isSubmittingPhoto ? 0.6 : 1, alignItems: 'center' }]}
                onPress={handleAddPhoto}
                disabled={isSubmittingPhoto}
              >
                {isSubmittingPhoto ? <ActivityIndicator color="#fff" /> : <Text style={styles.allButtonText}>Paylaş</Text>}
              </TouchableOpacity>
            </View>
          )}

          {editingPhotoId && (
            <View style={{ backgroundColor: '#FFF5F7', borderRadius: 16, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#F9A8D4' }}>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#DB7093', marginBottom: 10 }}>Fotoğrafı Düzenle</Text>
              <TextInput
                style={{ backgroundColor: '#fff', borderRadius: 8, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: '#F9A8D4' }}
                placeholder="Fotoğraf linki (URL)"
                autoCapitalize="none"
                value={editPhotoUrl}
                onChangeText={setEditPhotoUrl}
              />
              <TextInput
                style={{ backgroundColor: '#fff', borderRadius: 8, padding: 8, marginBottom: 10, borderWidth: 1, borderColor: '#F9A8D4' }}
                placeholder="Açıklama"
                value={editPhotoCaption}
                onChangeText={setEditPhotoCaption}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#FF69B4', borderRadius: 8, paddingVertical: 10, alignItems: 'center', opacity: isSavingPhotoEdit ? 0.6 : 1 }}
                  onPress={handleSaveEditPhoto}
                  disabled={isSavingPhotoEdit}
                >
                  {isSavingPhotoEdit ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Kaydet</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#E5E7EB', borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
                  onPress={cancelEditPhoto}
                >
                  <Text style={{ color: '#374151', fontWeight: 'bold' }}>İptal</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {loadingPhotos ? (
            <ActivityIndicator color="#FF69B4" style={{ marginVertical: 20 }} />
          ) : taggedPhotos.length === 0 ? (
            <Text style={{ color: '#999', marginBottom: 20 }}>
              Henüz kimse etiketlememiş.
            </Text>
          ) : (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                marginBottom: 20,
                marginHorizontal: -2,
              }}
            >
              {taggedPhotos.map((photo) => {
                const isMyPhoto = currentUser && currentUser.id === photo.user_id;

                return (
                  <View
                    key={photo.id}
                    style={{
                      width: '33.33%',
                      padding: 2,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => isMyPhoto && startEditPhoto(photo)}
                      activeOpacity={isMyPhoto ? 0.7 : 1}
                    >
                      <Image
                        source={{ uri: photo.image_url }}
                        style={{
                          width: '100%',
                          aspectRatio: 1,
                          borderRadius: 6,
                        }}
                      />

                      {isMyPhoto && (
                        <TouchableOpacity
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                          onPress={() => handleDeletePhoto(photo.id)}
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
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}