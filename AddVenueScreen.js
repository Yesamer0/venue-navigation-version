import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { supabase } from './supabase';

// Varsayılan harita merkezi: Köyceğiz, Muğla
const DEFAULT_LAT = 36.9667;
const DEFAULT_LNG = 28.6833;

const CATEGORIES = ['Kafe', 'Restoran', 'Bar', 'Etkinlik'];
const PRICE_LEVELS = ['₺', '₺₺', '₺₺₺'];

// Haritayı gösteren HTML (Leaflet + OpenStreetMap, API key gerektirmez).
// Kullanıcı haritaya tıkladığında seçilen koordinatı React Native tarafına postMessage ile gönderir.
const buildMapHtml = (lat, lng) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map').setView([${lat}, ${lng}], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    var marker = null;

    function dropMarker(lat, lng) {
      if (marker) { map.removeLayer(marker); }
      marker = L.marker([lat, lng]).addTo(map);
    }

    map.on('click', function (e) {
      var lat = e.latlng.lat;
      var lng = e.latlng.lng;
      dropMarker(lat, lng);
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat: lat, lng: lng }));
    });
  </script>
</body>
</html>
`;

// Google'dan kopyalanan menü metnini satır satır ayrıştırır.
// Her satırda bir ürün adı ve genelde sonda bir fiyat olduğunu varsayar.
// Örnek desteklenen satırlar:
//   "Türk Kahvesi 45 TL"
//   "Cappuccino ......... 60"
//   "Limonata - 55"
function parseMenuText(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => {
      // Başındaki madde işareti/numaralandırmayı temizle
      let cleaned = line.replace(/^[-•*\d.]+\s*/, '');

      // Satırın sonundaki sayıyı fiyat olarak yakala (45, 45.50, 45,50, 45 TL, 45₺ gibi)
      const priceMatch = cleaned.match(/(\d+[.,]?\d*)\s*(?:₺|tl|TL)?\s*$/);
      let price = null;
      let name = cleaned;

      if (priceMatch && priceMatch[1]) {
        price = parseFloat(priceMatch[1].replace(',', '.'));
        name = cleaned.slice(0, priceMatch.index).trim();
        // Kalan noktalar, tireler gibi ayraçları temizle
        name = name.replace(/[.\-–—:]+$/, '').trim();
      }

      return {
        id: `parsed-${Date.now()}-${index}`,
        name: name || cleaned,
        price: price != null && !isNaN(price) ? String(price) : '',
      };
    })
    .filter((item) => item.name.length > 0);
}

export default function AddVenueScreen({ navigation }) {
  const webviewRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Kafe');
  const [priceLevel, setPriceLevel] = useState(null);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [hasWifi, setHasWifi] = useState(false);
  const [isOutdoor, setIsOutdoor] = useState(false);

  const [selectedLat, setSelectedLat] = useState(null);
  const [selectedLng, setSelectedLng] = useState(null);

  const [rawMenuText, setRawMenuText] = useState('');
  const [parsedMenuItems, setParsedMenuItems] = useState([]);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setCurrentUser(data.user);
    });
  }, []);

  const handleMapMessage = (event) => {
    try {
      const { lat, lng } = JSON.parse(event.nativeEvent.data);
      setSelectedLat(lat);
      setSelectedLng(lng);
    } catch (err) {
      console.log('Harita mesajı okunamadı:', err);
    }
  };

  const useMyLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Konumunuzu kullanabilmek için izin vermelisiniz.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;

      setSelectedLat(latitude);
      setSelectedLng(longitude);

      webviewRef.current?.injectJavaScript(`
        map.setView([${latitude}, ${longitude}], 15);
        dropMarker(${latitude}, ${longitude});
        true;
      `);
    } catch (err) {
      alert('Konum alınamadı: ' + err.message);
    }
  };

  const handleParseMenu = () => {
    if (!rawMenuText.trim()) {
      alert('Önce yapıştıracağın menü metnini gir.');
      return;
    }
    const parsed = parseMenuText(rawMenuText);
    if (parsed.length === 0) {
      alert('Metinden ürün ayrıştırılamadı, formatı kontrol et.');
      return;
    }
    setParsedMenuItems(parsed);
  };

  const updateParsedItem = (id, field, value) => {
    setParsedMenuItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const removeParsedItem = (id) => {
    setParsedMenuItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSaveVenue = async () => {
    if (!name.trim()) {
      alert('Mekan adı boş olamaz.');
      return;
    }
    if (selectedLat == null || selectedLng == null) {
      alert('Lütfen haritadan bir konum seç veya "Konumumu Kullan" butonuna bas.');
      return;
    }
    if (!currentUser) {
      alert('Mekan ekleyebilmek için giriş yapmış olmalısın.');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Mekanı oluştur
      const { data: venueData, error: venueError } = await supabase
        .from('venues')
        .insert([{
          name: name.trim(),
          category,
          price_level: priceLevel,
          description: description.trim() || null,
          image_url: imageUrl.trim() || null,
          has_wifi: hasWifi,
          is_outdoor: isOutdoor,
          latitude: selectedLat,
          longitude: selectedLng,
          owner_id: currentUser.id,
        }])
        .select()
        .single();

      if (venueError) {
        alert('Mekan Kaydetme Hatası: ' + venueError.message);
        setIsSaving(false);
        return;
      }

      // 2. Ayrıştırılmış menü ürünleri varsa, hepsini tek seferde ekle
      if (parsedMenuItems.length > 0) {
        const rowsToInsert = parsedMenuItems.map((item) => ({
          venue_id: venueData.id,
          name: item.name,
          price: item.price ? parseFloat(item.price) : null,
        }));

        const { error: menuError } = await supabase
          .from('menu_items')
          .insert(rowsToInsert);

        if (menuError) {
          alert(
            'Mekan kaydedildi fakat menü eklenirken hata oluştu: ' + menuError.message
          );
          setIsSaving(false);
          navigation.goBack();
          return;
        }
      }

      alert('Mekan başarıyla eklendi! 🎉');
      navigation.goBack();
    } catch (err) {
      alert('Bir bağlantı sorunu oluştu: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Yeni Mekan Ekle 🏢</Text>

      {/* Temel Bilgiler */}
      <Text style={styles.label}>Mekan Adı</Text>
      <TextInput
        style={styles.input}
        placeholder="Örn: Luna Cafe"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Kategori</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 }}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Fiyat Seviyesi (opsiyonel)</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 15 }}>
        {PRICE_LEVELS.map((level) => (
          <TouchableOpacity
            key={level}
            style={[styles.categoryChip, priceLevel === level && styles.categoryChipActive]}
            onPress={() => setPriceLevel(priceLevel === level ? null : level)}
          >
            <Text style={[styles.categoryChipText, priceLevel === level && styles.categoryChipTextActive]}>
              {level}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Açıklama (opsiyonel)</Text>
      <TextInput
        style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
        placeholder="Mekan hakkında kısa bir açıklama..."
        multiline
        value={description}
        onChangeText={setDescription}
      />

      <Text style={styles.label}>Kapak Fotoğrafı Linki (opsiyonel)</Text>
      <TextInput
        style={styles.input}
        placeholder="https://..."
        autoCapitalize="none"
        value={imageUrl}
        onChangeText={setImageUrl}
      />

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        <TouchableOpacity
          style={[styles.toggleChip, hasWifi && styles.toggleChipActive]}
          onPress={() => setHasWifi(!hasWifi)}
        >
          <Text style={[styles.toggleChipText, hasWifi && styles.toggleChipTextActive]}>📶 Wi-Fi</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleChip, isOutdoor && styles.toggleChipActive]}
          onPress={() => setIsOutdoor(!isOutdoor)}
        >
          <Text style={[styles.toggleChipText, isOutdoor && styles.toggleChipTextActive]}>🌳 Açık Alan</Text>
        </TouchableOpacity>
      </View>

      {/* Konum Seçimi */}
      <Text style={styles.label}>Konum (haritaya tıkla)</Text>
      <View style={styles.mapContainer}>
        <WebView
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html: buildMapHtml(DEFAULT_LAT, DEFAULT_LNG) }}
          onMessage={handleMapMessage}
          style={{ flex: 1 }}
        />
      </View>
      <TouchableOpacity style={styles.gpsButton} onPress={useMyLocation}>
        <Text style={styles.gpsButtonText}>📍 Konumumu Kullan</Text>
      </TouchableOpacity>
      {selectedLat != null && (
        <Text style={styles.coordText}>
          Seçilen konum: {selectedLat.toFixed(5)}, {selectedLng.toFixed(5)}
        </Text>
      )}

      {/* Menü Yapıştırma */}
      <Text style={[styles.label, { marginTop: 25 }]}>Menü (Google'dan kopyala, buraya yapıştır)</Text>
      <TextInput
        style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
        placeholder={'Örn:\nTürk Kahvesi 45 TL\nCappuccino 60\nLimonata - 55'}
        multiline
        value={rawMenuText}
        onChangeText={setRawMenuText}
      />
      <TouchableOpacity style={styles.parseButton} onPress={handleParseMenu}>
        <Text style={styles.parseButtonText}>Menüyü Ayır</Text>
      </TouchableOpacity>

      {parsedMenuItems.length > 0 && (
        <View style={styles.parsedContainer}>
          <Text style={styles.parsedTitle}>Önizleme — Kontrol et, gerekirse düzelt:</Text>
          {parsedMenuItems.map((item) => (
            <View key={item.id} style={styles.parsedRow}>
              <TextInput
                style={[styles.parsedInput, { flex: 2 }]}
                value={item.name}
                onChangeText={(text) => updateParsedItem(item.id, 'name', text)}
              />
              <TextInput
                style={[styles.parsedInput, { flex: 1, marginLeft: 8 }]}
                value={item.price}
                onChangeText={(text) => updateParsedItem(item.id, 'price', text)}
                keyboardType="numeric"
                placeholder="Fiyat"
              />
              <TouchableOpacity onPress={() => removeParsedItem(item.id)} style={styles.removeRowButton}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Kaydet */}
      <TouchableOpacity
        style={[styles.saveButton, { opacity: isSaving ? 0.6 : 1 }]}
        onPress={handleSaveVenue}
        disabled={isSaving}
      >
        {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Mekanı Kaydet</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#FFE4E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#FAFAFA',
    color: '#333',
    marginBottom: 15,
  },
  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FFE4E1',
    backgroundColor: '#FAFAFA',
  },
  categoryChipActive: { backgroundColor: '#FF69B4', borderColor: '#FF69B4' },
  categoryChipText: { color: '#666', fontWeight: '500' },
  categoryChipTextActive: { color: '#fff' },
  toggleChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE4E1',
    backgroundColor: '#FAFAFA',
  },
  toggleChipActive: { backgroundColor: '#FFF0F5', borderColor: '#FF69B4' },
  toggleChipText: { color: '#999', fontWeight: '600' },
  toggleChipTextActive: { color: '#DB7093' },
  mapContainer: {
    height: 260,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FFE4E1',
    marginBottom: 10,
  },
  gpsButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#FF69B4',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  gpsButtonText: { color: '#DB7093', fontWeight: '600' },
  coordText: { fontSize: 12, color: '#999', marginBottom: 10 },
  parseButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#4B5563',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 15,
  },
  parseButtonText: { color: '#fff', fontWeight: 'bold' },
  parsedContainer: {
    backgroundColor: '#FFF5F7',
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FCE7F3',
  },
  parsedTitle: { fontSize: 13, fontWeight: 'bold', color: '#DB7093', marginBottom: 10 },
  parsedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  parsedInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#F9A8D4',
    fontSize: 14,
  },
  removeRowButton: {
    backgroundColor: '#EF4444',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: '#FF69B4',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});