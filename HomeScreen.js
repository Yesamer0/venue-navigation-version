
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { getFreshLocation } from './deviceLocation';
import DemoCafeButton from './DemoCafeButton';
import VenueMap, { supportsVenueMap } from './VenueMap';
import { supabase } from './supabase';
import { useFocusEffect } from '@react-navigation/native';
import { styles } from './styles';

const COLORS = {
  background: '#FFF9FC',
  pinkLight: '#FFEAF2',
  pinkSoft: '#FDE4EE',
  pinkBorder: '#F4B4CB',
  pink: '#C2185B',
  pinkDark: '#9B1B4D',
  muted: '#B37690',
  white: '#FFFFFF',
};

const PRICE_LEVELS = ['₺', '₺₺', '₺₺₺'];

const CATEGORIES = [
  { name: 'Hepsi', icon: '✨' },
  { name: 'Kafe', icon: '☕' },
  { name: 'Restoran', icon: '🍽️' },
  { name: 'Bar', icon: '🍹' },
  { name: 'Etkinlik', icon: '🎉' },
];

const MAP_HEIGHTS = [120, 180, 260];

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

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export default function HomeScreen({ navigation, guest = false, onSignIn }) {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const venuesRequestRef = useRef(0);
  const [selectedCategory, setSelectedCategory] = useState('Hepsi');
  const [searchQuery, setSearchQuery] = useState('');

  const [filterWifi, setFilterWifi] = useState(false);
  const [filterOutdoor, setFilterOutdoor] = useState(false);
  const [selectedPriceLevels, setSelectedPriceLevels] = useState([]);

  const [sortMode, setSortMode] = useState('default');
  const [venueRatings, setVenueRatings] = useState({});
  const [userLocation, setUserLocation] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locatingMap, setLocatingMap] = useState(false);
  const locatingMapRef = useRef(false);

  const [mapRegion, setMapRegion] = useState({ latitude: 37.2153, longitude: 28.3636, latitudeDelta: 0.05, longitudeDelta: 0.05 });
  const [mapLocationError, setMapLocationError] = useState('');
  const [mapSizeIndex, setMapSizeIndex] = useState(1);
  const [mapVisible, setMapVisible] = useState(true);


  useFocusEffect(useCallback(() => {
    fetchVenues();
    fetchRatings();
  }, []));

  const fetchVenues = async () => {
    const request = ++venuesRequestRef.current;
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('venues')
        .select('*');

      if (error) throw error;

      if (request !== venuesRequestRef.current) return;
      setVenues(data || []);
      setLoadError(false);
    } catch (error) {
      if (request === venuesRequestRef.current) setLoadError(true);
    } finally {
      if (request === venuesRequestRef.current) setLoading(false);
    }
  };

  const fetchRatings = async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select('venue_id, rating');

    if (error) {
      console.log('Rating fetch error:', error);
      return;
    }

    const totals = {};
    const counts = {};

    (data || []).forEach((review) => {
      const id = review.venue_id;

      if (!totals[id]) {
        totals[id] = 0;
        counts[id] = 0;
      }

      totals[id] += review.rating;
      counts[id] += 1;
    });

    const averages = {};

    Object.keys(totals).forEach((id) => {
      averages[id] = totals[id] / counts[id];
    });

    setVenueRatings(averages);
  };

  const togglePriceLevel = (level) => {
    setSelectedPriceLevels((previous) =>
      previous.includes(level)
        ? previous.filter((item) => item !== level)
        : [...previous, level]
    );
  };

  const goToMyLocation = async () => {
    if (locatingMapRef.current) return;
    locatingMapRef.current = true;
    setLocatingMap(true);
    setMapLocationError('');
    try {
      const position = await getFreshLocation();
      const location = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy };
      setUserLocation(location);

      setMapRegion({ latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.004, longitudeDelta: 0.004 });
    } catch (error) {
      setMapLocationError(error.message || 'Konum alınamadı. Yeniden dene.');
    } finally {
      locatingMapRef.current = false;
      setLocatingMap(false);
    }
  };

  const handleSelectSort = async (mode) => {
    if (mode !== 'distance') {
      setSortMode(mode);
      return;
    }

    try {
      setLoadingLocation(true);

      const location = await getFreshLocation();

      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      });

      setSortMode('distance');
    } catch (error) {
      alert('Konum alınamadı: ' + error.message);
    } finally {
      setLoadingLocation(false);
    }
  };

  const resetFilters = () => {
    setSelectedCategory('Hepsi');
    setSearchQuery('');
    setFilterWifi(false);
    setFilterOutdoor(false);
    setSelectedPriceLevels([]);
    setSortMode('default');
  };

  let filteredVenues =
    selectedCategory === 'Hepsi'
      ? venues
      : venues.filter((venue) => venue.category === selectedCategory);

  if (searchQuery.trim()) {
    const query = searchQuery.trim().toLowerCase();

    filteredVenues = filteredVenues.filter(
      (venue) =>
        venue.name?.toLowerCase().includes(query) ||
        venue.location?.toLowerCase().includes(query)
    );
  }

  if (filterWifi) {
    filteredVenues = filteredVenues.filter(
      (venue) => venue.has_wifi === true
    );
  }

  if (filterOutdoor) {
    filteredVenues = filteredVenues.filter(
      (venue) => venue.is_outdoor === true
    );
  }

  if (selectedPriceLevels.length > 0) {
    filteredVenues = filteredVenues.filter((venue) =>
      selectedPriceLevels.includes(venue.price_level)
    );
  }

  if (sortMode === 'rating') {
    filteredVenues = [...filteredVenues].sort(
      (a, b) =>
        (venueRatings[b.id] || 0) - (venueRatings[a.id] || 0)
    );
  } else if (sortMode === 'distance' && userLocation) {
    filteredVenues = [...filteredVenues]
      .filter(
        (venue) =>
          venue.latitude != null &&
          venue.longitude != null
      )
      .sort((a, b) => {
        const distanceA = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          Number(a.latitude),
          Number(a.longitude)
        );

        const distanceB = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          Number(b.latitude),
          Number(b.longitude)
        );

        return distanceA - distanceB;
      });
  }

  const mapVenues = filteredVenues.filter(
    (venue) =>
      venue.latitude != null &&
      venue.longitude != null &&
      Number.isFinite(Number(venue.latitude)) &&
      Number.isFinite(Number(venue.longitude))
  );

  const featureFilters = [
    {
      key: 'wifi',
      label: '📶 Wi-Fi',
      active: filterWifi,
      onPress: () => setFilterWifi((value) => !value),
    },
    {
      key: 'outdoor',
      label: '🌿 Açık Alan',
      active: filterOutdoor,
      onPress: () => setFilterOutdoor((value) => !value),
    },
    ...PRICE_LEVELS.map((level) => ({
      key: `price-${level}`,
      label: level,
      active: selectedPriceLevels.includes(level),
      onPress: () => togglePriceLevel(level),
    })),
  ];

  const sortOptions = [
    { key: 'default', label: 'Önerilen' },
    { key: 'rating', label: '⭐ En yüksek puan' },
    { key: 'distance', label: '📍 En yakın' },
  ];

  const renderHeader = () => (
    <View>
      {loadError && (
        <View style={localStyles.emptyContainer} accessibilityLiveRegion="polite">
          <Text style={localStyles.emptyTitle}>Mekânlar yüklenemedi</Text>
          <Text style={localStyles.emptyDescription}>
            Bağlantını kontrol edip yeniden dene.{venues.length > 0 ? ' Son yüklenen mekânlar gösteriliyor.' : ''}
          </Text>
          <TouchableOpacity accessibilityRole="button" disabled={loading} onPress={fetchVenues} style={localStyles.emptyResetButton}>
            <Text style={localStyles.emptyResetText}>{loading ? 'Yükleniyor…' : 'Yeniden dene'}</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={localStyles.header}>
        <Text style={localStyles.brand}>VENUE · MEKSO</Text>
        <Text style={localStyles.subtitle}>
          Keşfet · Deneyimle · Paylaş
        </Text>
      </View>

      {guest ? (
        <TouchableOpacity accessibilityRole="button" onPress={onSignIn} style={{ padding: 16 }}>
          <Text style={{ color: '#9B1B4D', fontWeight: '700' }}>Giriş yap / Kayıt ol</Text>
        </TouchableOpacity>
      ) : <DemoCafeButton navigation={navigation} />}
      <View style={localStyles.searchSection}>
        <View style={localStyles.searchBar}>
          <Text style={localStyles.searchIcon}>⌕</Text>

          <TextInput
            style={localStyles.searchInput}
            placeholder="Mekân veya konum ara..."
            placeholderTextColor="#B88A9D"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            returnKeyType="search"
          />

          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={localStyles.clearButton}
            >
              <Text style={localStyles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={localStyles.section}>
        <Text style={localStyles.sectionTitle}>
          Ne keşfetmek istersin?
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={localStyles.horizontalContent}
        >
          {CATEGORIES.map((category) => {
            const active = selectedCategory === category.name;

            return (
              <TouchableOpacity
                key={category.name}
                onPress={() => setSelectedCategory(category.name)}
                style={[
                  localStyles.categoryButton,
                  active && localStyles.categoryButtonActive,
                ]}
              >
                <Text style={localStyles.categoryIcon}>
                  {category.icon}
                </Text>

                <Text
                  style={[
                    localStyles.categoryText,
                    active && localStyles.categoryTextActive,
                  ]}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={localStyles.section}>
        <View style={localStyles.sectionHeadingRow}>
          <Text style={localStyles.sectionTitle}>Filtreler</Text>

          <TouchableOpacity onPress={resetFilters}>
            <Text style={localStyles.resetText}>Temizle</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={localStyles.horizontalContent}
        >
          {featureFilters.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              onPress={filter.onPress}
              style={[
                localStyles.filterButton,
                filter.active && localStyles.filterButtonActive,
              ]}
            >
              <Text
                style={[
                  localStyles.filterText,
                  filter.active && localStyles.filterTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={localStyles.section}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={localStyles.horizontalContent}
        >
          {sortOptions.map((option) => {
            const active = sortMode === option.key;
            const isLoading =
              option.key === 'distance' && loadingLocation;

            return (
              <TouchableOpacity
                key={option.key}
                onPress={() => handleSelectSort(option.key)}
                disabled={isLoading}
                style={[
                  localStyles.sortButton,
                  active && localStyles.sortButtonActive,
                ]}
              >
                {isLoading && (
                  <ActivityIndicator
                    size="small"
                    color={active ? '#FFFFFF' : COLORS.pink}
                    style={{ marginRight: 5 }}
                  />
                )}

                <Text
                  style={[
                    localStyles.sortText,
                    active && localStyles.sortTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {supportsVenueMap && (
        <View style={localStyles.mapSection}>
          <View style={localStyles.mapHeading}>
            <View>
              <Text style={localStyles.sectionTitle}>
                Haritada keşfet
              </Text>
              <Text style={localStyles.mapSubtitle}>
                Yakınındaki mekânları incele
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setMapVisible((value) => !value)}
              style={localStyles.mapToggle}
            >
              <Text style={localStyles.mapToggleText}>
                {mapVisible ? 'Gizle −' : 'Göster +'}
              </Text>
            </TouchableOpacity>
          </View>

          {mapVisible && (
            <>
              <View style={localStyles.mapControls}>
                <TouchableOpacity
                  onPress={() =>
                    setMapSizeIndex((index) => Math.max(0, index - 1))
                  }
                  disabled={mapSizeIndex === 0}
                  style={[
                    localStyles.mapSizeButton,
                    mapSizeIndex === 0 && localStyles.disabledButton,
                  ]}
                >
                  <Text style={localStyles.mapSizeText}>− Küçült</Text>
                </TouchableOpacity>

                <Text style={localStyles.mapSizeLabel}>
                  {['Küçük', 'Orta', 'Büyük'][mapSizeIndex]}
                </Text>

                <TouchableOpacity
                  onPress={() =>
                    setMapSizeIndex((index) => Math.min(2, index + 1))
                  }
                  disabled={mapSizeIndex === 2}
                  style={[
                    localStyles.mapSizeButton,
                    mapSizeIndex === 2 && localStyles.disabledButton,
                  ]}
                >
                  <Text style={localStyles.mapSizeText}>+ Büyüt</Text>
                </TouchableOpacity>
              </View>

              <Text accessibilityLiveRegion="polite" style={{ color: COLORS.pinkDark, marginBottom: 8, lineHeight: 20 }}>
                {locatingMap ? 'Telefonundan güncel konum alınıyor…' : mapLocationError || (userLocation ? `Mavi işaret son konumun · GPS hata payı yaklaşık ±${Math.ceil(userLocation.accuracy)} m` : 'Konumunu göstermek için Konumum düğmesine dokun.')}
              </Text>
              <View
                style={[
                  localStyles.mapContainer,
                  { height: MAP_HEIGHTS[mapSizeIndex] },
                ]}
              >
                <VenueMap
                  mapRegion={mapRegion}
                  setMapRegion={setMapRegion}
                  userLocation={userLocation}
                  mapVenues={mapVenues}
                  onSelectVenue={(venue) => navigation.navigate('Details', { item: venue })}
                />

                <TouchableOpacity
                  onPress={goToMyLocation}
                  disabled={locatingMap}
                  accessibilityRole="button"
                  accessibilityLabel="Haritayı güncel konumuma götür"
                  style={localStyles.locationButton}
                >
                  <Text style={localStyles.locationButtonText}>
                    {locatingMap ? 'Konum alınıyor…' : '📍 Konumum'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}

      <View style={localStyles.resultsHeading}>
        <Text style={localStyles.sectionTitle}>
          Senin için mekânlar
        </Text>

        <Text style={localStyles.resultsCount}>
          {filteredVenues.length} mekân
        </Text>
      </View>
    </View>
  );

  const renderVenue = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('Details', { item })}
    >
      <Image
        source={{ uri: item.image_url }}
        style={styles.image}
      />

      <View style={styles.cardContent}>
        <Text style={styles.venueName}>{item.name}</Text>

        <Text style={styles.venueLocation}>
          {item.location}
        </Text>

        {userLocation &&
          item.latitude != null &&
          item.longitude != null && (
            <Text style={localStyles.distanceText}>
              📍{' '}
              {calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                Number(item.latitude),
                Number(item.longitude)
              ).toFixed(1)}{' '}
              km uzakta
            </Text>
          )}

        {venueRatings[item.id] != null && (
          <Text style={localStyles.ratingText}>
            ⭐ {venueRatings[item.id].toFixed(1)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading && venues.length === 0 && !loadError) {
    return (
      <View style={localStyles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.pink} />
        <Text style={localStyles.loadingText}>
          Mekânlar yükleniyor...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={localStyles.container}>
      <FlatList
        refreshing={loading}
        onRefresh={() => { fetchVenues(); fetchRatings(); }}
        data={filteredVenues}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderVenue}
        ListHeaderComponent={renderHeader()}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={localStyles.listContent}
        ListEmptyComponent={loadError ? null :
          <View style={localStyles.emptyContainer}>
            <Text style={localStyles.emptyTitle}>
              Henüz mekân bulunamadı
            </Text>

            <Text style={localStyles.emptyDescription}>
              Filtrelerini değiştirmeyi veya arama kelimeni
              düzenlemeyi deneyebilirsin.
            </Text>

            <TouchableOpacity
              onPress={resetFilters}
              style={localStyles.emptyResetButton}
            >
              <Text style={localStyles.emptyResetText}>
                Filtreleri temizle
              </Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.muted,
    fontSize: 13,
  },
  listContent: {
    paddingBottom: 30,
  },
  header: {
    backgroundColor: COLORS.pinkLight,
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  brand: {
    fontFamily: 'Chewy_400Regular',
    fontSize: 34,
    color: COLORS.pinkDark,
    letterSpacing: 1,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: COLORS.muted,
  },
  searchSection: {
    backgroundColor: COLORS.pinkLight,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  searchBar: {
    height: 48,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.pinkBorder,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    shadowColor: '#9B1B4D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    fontSize: 27,
    color: COLORS.pink,
    marginRight: 10,
    marginTop: -3,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.pinkDark,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 7,
  },
  clearText: {
    color: COLORS.muted,
    fontSize: 14,
  },
  section: {
    marginTop: 17,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.pinkDark,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  horizontalContent: {
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 9,
    paddingVertical: 3,
  },
  categoryButton: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.pinkBorder,
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  categoryButtonActive: {
    backgroundColor: COLORS.pink,
    borderColor: COLORS.pink,
  },
  categoryIcon: {
    fontSize: 15,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.pinkDark,
  },
  categoryTextActive: {
    color: COLORS.white,
  },
  filterButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.pinkBorder,
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterButtonActive: {
    backgroundColor: COLORS.pinkSoft,
    borderColor: COLORS.pink,
  },
  filterText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  filterTextActive: {
    color: COLORS.pinkDark,
  },
  resetText: {
    color: COLORS.pink,
    fontSize: 12,
    fontWeight: '700',
  },
  sortButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.pinkBorder,
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortButtonActive: {
    backgroundColor: COLORS.pink,
    borderColor: COLORS.pink,
  },
  sortText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  sortTextActive: {
    color: COLORS.white,
  },
  mapSection: {
    marginTop: 20,
    marginHorizontal: 16,
  },
  mapHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  mapSubtitle: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 3,
  },
  mapToggle: {
    backgroundColor: COLORS.pinkSoft,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 13,
  },
  mapToggleText: {
    color: COLORS.pinkDark,
    fontSize: 12,
    fontWeight: '700',
  },
  mapControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  mapSizeButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.pinkBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  disabledButton: {
    opacity: 0.4,
  },
  mapSizeText: {
    color: COLORS.pinkDark,
    fontSize: 12,
    fontWeight: '700',
  },
  mapSizeLabel: {
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: '600',
  },
  mapContainer: {
    borderRadius: 19,
    overflow: 'hidden',
    backgroundColor: COLORS.pinkSoft,
    position: 'relative',
  },
  locationButton: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 13,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  locationButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.pinkDark,
  },
  resultsHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 18,
    marginTop: 24,
    marginBottom: 13,
  },
  resultsCount: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  distanceText: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 3,
  },
  ratingText: {
    color: COLORS.pink,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 35,
  },
  emptyTitle: {
    color: COLORS.pinkDark,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyDescription: {
    color: COLORS.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  emptyResetButton: {
    backgroundColor: COLORS.pink,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 11,
    marginTop: 16,
  },
  emptyResetText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13,
  },
});
