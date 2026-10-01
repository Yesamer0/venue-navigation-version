import React, { useState, useEffect, useRef } from 'react';import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, SafeAreaView, TextInput } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from './supabase'; 
import { styles } from './styles';

const PRICE_LEVELS = ['₺', '₺₺', '₺₺₺'];

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export default function HomeScreen({ navigation }) {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Hepsi');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = ['Hepsi', 'Kafe', 'Restoran', 'Bar', 'Etkinlik'];

  // Özellik / fiyat filtreleri
  const [filterWifi, setFilterWifi] = useState(false);
  const [filterOutdoor, setFilterOutdoor] = useState(false);
  const [selectedPriceLevels, setSelectedPriceLevels] = useState([]);

  // Sıralama
  const [sortMode, setSortMode] = useState('default'); // 'default' | 'rating' | 'distance'
  const [venueRatings, setVenueRatings] = useState({});
  const [userLocation, setUserLocation] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const mapRef = useRef(null);
  

  useEffect(() => {
    fetchVenues();
    fetchRatings();
  }, []);

  const fetchVenues = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('venues').select('*');
      if (error) throw error;
      setVenues(data || []);
    } catch (err) {
      console.error("Mekan çekme hatası:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRatings = async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select('venue_id, rating');

    if (error) {
      console.log('Puan ortalaması çekme hatası:', error);
      return;
    }

    const totals = {};
    const counts = {};
    (data || []).forEach((r) => {
      if (!totals[r.venue_id]) {
        totals[r.venue_id] = 0;
        counts[r.venue_id] = 0;
      }
      totals[r.venue_id] += r.rating;
      counts[r.venue_id] += 1;
    });

    const averages = {};
    Object.keys(totals).forEach((venueId) => {
      averages[venueId] = totals[venueId] / counts[venueId];
    });

    setVenueRatings(averages);
  };

  const togglePriceLevel = (level) => {
    setSelectedPriceLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };
  const goToMyLocation = async () => {
  try {
    let location = userLocation;

    if (!location) {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        alert('Konumunu gösterebilmek için konum izni vermelisin.');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});

      location = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };

      setUserLocation(location);
    }

    mapRef.current?.animateToRegion(
      {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      1000
    );
  } catch (err) {
    alert('Konum alınamadı: ' + err.message);
  }
};
  const handleSelectSort = async (mode) => {
    if (mode === 'distance') {
      try {
        setLoadingLocation(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          alert('Yakınlığa göre sıralamak için konum izni vermelisiniz.');
          setLoadingLocation(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        setSortMode('distance');
      } catch (err) {
        alert('Konum alınamadı: ' + err.message);
      } finally {
        setLoadingLocation(false);
      }
    } else {
      setSortMode(mode);
    }
  };

  // Kategori + arama + özellik + fiyat filtrelerini uygula, sonra seçilen moda göre sırala
  let filteredVenues = selectedCategory === 'Hepsi' 
    ? venues 
    : venues.filter(v => v.category === selectedCategory);

  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filteredVenues = filteredVenues.filter(
      (v) => v.name?.toLowerCase().includes(q) || v.location?.toLowerCase().includes(q)
    );
  }

  if (filterWifi) {
    filteredVenues = filteredVenues.filter((v) => v.has_wifi === true);
  }
  if (filterOutdoor) {
    filteredVenues = filteredVenues.filter((v) => v.is_outdoor === true);
  }
  if (selectedPriceLevels.length > 0) {
    filteredVenues = filteredVenues.filter((v) => selectedPriceLevels.includes(v.price_level));
  }

  if (sortMode === 'rating') {
    filteredVenues = [...filteredVenues].sort(
      (a, b) => (venueRatings[b.id] || 0) - (venueRatings[a.id] || 0)
    );
  } else if (sortMode === 'distance' && userLocation) {
  filteredVenues = [...filteredVenues]
    .filter((v) => v.latitude != null && v.longitude != null)
    .sort((a, b) => {
      const distA = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        a.latitude,
        a.longitude
      );

      const distB = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        b.latitude,
        b.longitude
      );

      return distA - distB;
    });
}

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#D8A7B1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Başlık */}
      <View style={{ alignItems: 'center', paddingTop: 18, paddingBottom: 4, backgroundColor: '#FFEAF2' }}>
        <Text
          style={{
            fontFamily: 'Chewy_400Regular',
            fontSize: 34,
            color: '#9B1B4D',
            textShadowColor: '#fff',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 1,
          }}
        >
          Nereye Gitsek? 🌸
        </Text>
      </View>

      {/* Arama Çubuğu — küçük ve ortalanmış */}
      <View style={{ alignItems: 'center', marginTop: 10, marginBottom: 12, backgroundColor: '#FFEAF2', paddingBottom: 14 }}>
        <View
          style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#fff', borderRadius: 18,
            borderWidth: 1.5, borderColor: '#F4B4CB',
            paddingHorizontal: 14, height: 34,
            width: '55%', minWidth: 190,
          }}
        >
          <Text style={{ fontSize: 12, marginRight: 6, color: '#C2185B' }}>🔍</Text>
          <TextInput
            style={{ flex: 1, fontSize: 12, color: '#7A2140', padding: 0, textAlign: 'center' }}
            placeholder="Mekan ara..."
            placeholderTextColor="#D999B5"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={{ color: '#D999B5', fontSize: 12, paddingHorizontal: 2 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Kategori Sekmeleri */}
      <View style={{ height: 54 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 15, alignItems: 'center', gap: 8 }}
          data={categories}
          keyExtractor={(item) => item}
          renderItem={({ item }) => {
            const isActive = selectedCategory === item;
            return (
              <TouchableOpacity 
                style={{
                  paddingVertical: 9, paddingHorizontal: 18, borderRadius: 20,
                  backgroundColor: isActive ? '#C2185B' : '#fff',
                  borderWidth: 1.5, borderColor: isActive ? '#C2185B' : '#F4B4CB',
                }}
                onPress={() => setSelectedCategory(item)}
              >
                <Text style={{ color: isActive ? '#fff' : '#9B1B4D', fontWeight: '700', fontSize: 13 }}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Özellik / Fiyat Filtreleri */}
      <View style={{ height: 46, marginBottom: 4 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 15, alignItems: 'center', gap: 8 }}
          data={[
            { key: 'wifi', label: '📶 Wi-Fi', active: filterWifi, onPress: () => setFilterWifi(!filterWifi) },
            { key: 'outdoor', label: '🌳 Açık Alan', active: filterOutdoor, onPress: () => setFilterOutdoor(!filterOutdoor) },
            ...PRICE_LEVELS.map((level) => ({
              key: `price-${level}`,
              label: level,
              active: selectedPriceLevels.includes(level),
              onPress: () => togglePriceLevel(level),
            })),
          ]}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={item.onPress}
              style={{
                paddingVertical: 7,
                paddingHorizontal: 14,
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: item.active ? '#C2185B' : '#F4B4CB',
                backgroundColor: item.active ? '#FDE4EE' : '#fff',
              }}
            >
              <Text style={{ color: item.active ? '#9B1B4D' : '#B37690', fontWeight: '700', fontSize: 13 }}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Sıralama */}
      <View style={{ height: 46, marginBottom: 8 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 15, alignItems: 'center', gap: 8 }}
          data={[
            { key: 'default', label: 'Varsayılan' },
            { key: 'rating', label: '⭐ Puana Göre' },
            { key: 'distance', label: '📍 Bana Yakına Göre' },
          ]}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => {
            const isActive = sortMode === item.key;
            const isLoadingThis = item.key === 'distance' && loadingLocation;
            return (
              <TouchableOpacity
                onPress={() => handleSelectSort(item.key)}
                style={{
                  paddingVertical: 7,
                  paddingHorizontal: 14,
                  borderRadius: 16,
                  backgroundColor: isActive ? '#C2185B' : '#fff',
                  borderWidth: 1.5,
                  borderColor: isActive ? '#C2185B' : '#F4B4CB',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                {isLoadingThis && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />}
                <Text style={{ color: isActive ? '#fff' : '#B37690', fontWeight: '700', fontSize: 13 }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <View
  style={{
    height: 250,
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  }}
>
  <MapView
    ref={mapRef}
    style={{ flex: 1 }}
    initialRegion={{
      latitude: 37.2153,
      longitude: 28.3636,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }}
  >
    {filteredVenues
      .filter(
        (venue) =>
          venue.latitude != null &&
          venue.longitude != null
      )
      .map((venue) => (
        <Marker
          key={venue.id}
          coordinate={{
            latitude: Number(venue.latitude),
            longitude: Number(venue.longitude),
          }}
          title={venue.name}
          description={venue.location}
          onPress={() =>
            navigation.navigate('Details', { item: venue })
          }
        />
      ))}
  </MapView>

  <TouchableOpacity
    onPress={goToMyLocation}
    style={{
      position: 'absolute',
      right: 12,
      bottom: 12,
      backgroundColor: '#fff',
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: 18,
      elevation: 4,
      zIndex: 10,
    }}
  >
    <Text
      style={{
        color: '#9B1B4D',
        fontWeight: '700',
        fontSize: 12,
      }}
    >
      📍 Konumuma Git
    </Text>
  </TouchableOpacity>
</View>

      <FlatList
        data={filteredVenues}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={{ padding: 30, alignItems: 'center' }}>
            <Text style={{ color: '#999', textAlign: 'center' }}>
              Bu filtrelere uygun mekan bulunamadı. Filtreleri değiştirmeyi dene.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.card}
            onPress={() => navigation.navigate('Details', { item })}
          >
            <Image source={{ uri: item.image_url }} style={styles.image} />
            <View style={styles.cardContent}>
              <Text style={styles.venueName}>{item.name}</Text>
              <Text style={styles.venueLocation}>{item.location}</Text>
              {userLocation &&
  item.latitude != null &&
  item.longitude != null && (
    <Text
      style={{
        color: '#B37690',
        fontSize: 12,
        marginTop: 3,
      }}
    >
      📍 {calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        item.latitude,
        item.longitude
      ).toFixed(1)} km uzakta
    </Text>
  )}
              {venueRatings[item.id] != null && (
                <Text style={{ color: '#C2185B', fontSize: 13, fontWeight: '700', marginTop: 2 }}>
                  ⭐ {venueRatings[item.id].toFixed(1)}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}