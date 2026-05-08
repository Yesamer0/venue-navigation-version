import React, { useState } from 'react';
// Eksik olan bileşenleri buraya ekledik:
import { View, Text, Image, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { styles } from './styles';

export default function DetailsScreen({ route, navigation }) {
  const { item } = route.params;
  const [isFavorite, setIsFavorite] = useState(false);
  const [userRating, setUserRating] = useState(0);
  return (
    <ScrollView style={[styles.container, { backgroundColor: '#fff' }]}>
      {/* 3. GÖRSEL VE KALP İKONU BÖLÜMÜ */}
      <View>
        <Image 
          source={{ uri: item.image_url || 'https://via.placeholder.com/400' }} 
          style={{ width: '100%', height: 300 }} 
        />
        
        <TouchableOpacity 
          style={{ 
            position: 'absolute', 
            top: 20, 
            right: 20, 
            backgroundColor: 'rgba(255, 255, 255, 0.8)', 
            padding: 10, 
            borderRadius: 25,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            elevation: 5,
          }}
          onPress={() => setIsFavorite(!isFavorite)}
        >
          <Text style={{ fontSize: 22 }}>{isFavorite ? '❤️' : '🤍'}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ padding: 20 }}>
        {/* Başlık ve Fiyat Satırı */}
        <View style={styles.row}>
          <Text style={[styles.headerTitle, { fontSize: 24, flex: 1 }]}>{item.name}</Text>
          <Text style={styles.priceText}>{item.price_level || '₺₺'}</Text>
        </View>

        {/* Konum ve Puan */}
        <View style={[styles.row, { marginTop: 5 }]}>
          <Text style={styles.venueLocation}>📍 {item.location}</Text>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>⭐ {item.rating || '0.0'}</Text>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: '#eee', marginVertical: 20 }} />

        {/* Mekan Hakkında */}
        <Text style={{ fontWeight: 'bold', fontSize: 18, color: '#444', marginBottom: 10 }}>
          Mekan Hakkında
        </Text>
        <Text style={{ fontSize: 16, color: '#666', lineHeight: 24, marginBottom: 20 }}>
          {item.description || "Bu mekan hakkında henüz bir açıklama girilmemiş."}
        </Text>

        {/* BURAYA YAPIŞTIR: Yıldız Oylama Alanı */}
        <View style={{ marginVertical: 20, alignItems: 'center', backgroundColor: '#FFF5F7', padding: 15, borderRadius: 15 }}>
          <Text style={{ fontWeight: 'bold', color: '#D8A7B1', marginBottom: 10 }}>Bu mekanı puanla:</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setUserRating(star)}>
                <Text style={{ fontSize: 30 }}>
                  {star <= userRating ? '⭐' : '☆'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {userRating > 0 && (
            <Text style={{ marginTop: 10, color: '#666', fontStyle: 'italic' }}>
              Puanın için teşekkürler! ✨
            </Text>
          )}
        </View>

        {/* Özellikler */}
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

        {/* Yol Tarifi Butonu */}
        <TouchableOpacity 
          style={[styles.allButton, { marginTop: 30, width: '100%', alignItems: 'center' }]}
          onPress={() => {
            const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + ' ' + item.location)}`;
            Linking.openURL(mapUrl);
          }}
        >
          <Text style={styles.allButtonText}>Yol Tarifi Al 📍</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}