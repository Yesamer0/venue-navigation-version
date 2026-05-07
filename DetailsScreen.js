import React from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { styles } from './styles';

export default function DetailsScreen({ route, navigation }) {
  // HomeScreen'den gönderdiğimiz 'item' paketini burada açıyoruz
  const { item } = route.params;

  return (
    <ScrollView style={[styles.container, { backgroundColor: '#fff' }]}>
      {/* 1. Büyük Mekan Fotoğrafı */}
      <Image 
        source={{ uri: item.image_url || 'https://via.placeholder.com/400' }} 
        style={{ width: '100%', height: 300 }} 
      />

      <View style={{ padding: 20 }}>
        {/* 2. Başlık ve Fiyat Satırı */}
        <View style={styles.row}>
          <Text style={[styles.headerTitle, { fontSize: 24, flex: 1 }]}>{item.name}</Text>
          <Text style={styles.priceText}>{item.price_level || '₺₺'}</Text>
        </View>

        {/* 3. Konum ve Puan */}
        <View style={[styles.row, { marginTop: 5 }]}>
          <Text style={styles.venueLocation}>📍 {item.location}</Text>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>⭐ {item.rating || '0.0'}</Text>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: '#eee', marginVertical: 20 }} />

        {/* 4. Mekan Açıklaması (Supabase'den geliyor) */}
        <Text style={{ fontWeight: 'bold', fontSize: 18, color: '#444', marginBottom: 10 }}>
          Mekan Hakkında
        </Text>
        <Text style={{ fontSize: 16, color: '#666', lineHeight: 24, marginBottom: 20 }}>
          {item.description || "Bu mekan için henüz bir açıklama eklenmemiş. Çok yakında burada olacak!"}
        </Text>

        {/* 5. Özellikler (Wi-Fi vb.) */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {item.has_wifi && (
            <View style={{ backgroundColor: '#F0F9FF', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#BAE6FD' }}>
              <Text style={{ color: '#0369A1', fontWeight: 'bold' }}>📶 Ücretsiz Wi-Fi</Text>
            </View>
          )}
          {item.is_outdoor && (
            <View style={{ backgroundColor: '#F0FDF4', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#BBF7D0' }}>
              <Text style={{ color: '#15803D', fontWeight: 'bold' }}>🌳 Açık Alan</Text>
            </View>
          )}
        </View>

        {/* 6. Rezervasyon / Git Butonu */}
        <TouchableOpacity 
          style={[styles.allButton, { marginTop: 30, width: '100%', alignItems: 'center' }]}
          onPress={() => alert('Rezervasyon sistemi yakında!')}
        >
          <Text style={styles.allButtonText}>Hadi Gidelim! 🚀</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}