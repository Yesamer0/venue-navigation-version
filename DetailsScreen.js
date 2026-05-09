import React, { useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, Linking, TextInput, ActivityIndicator, Alert } from 'react-native';
import { supabase } from './supabase'; 
import { styles } from './styles';

export default function DetailsScreen({ route }) {
  const { item } = route.params;
  const [userRating, setUserRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Yorum ve Puan Gönderme Fonksiyonu
  const handleSendReview = async () => {
    if (userRating === 0) {
      alert("Lütfen önce bir puan seçin! ⭐");
      return;
    }

    setIsSubmitting(true);

    try {
      // SADE VE ÇALIŞAN INSERT
      const { error } = await supabase
        .from('reviews')
        .insert([
          { 
            venue_id: item.id, 
            rating: userRating, 
            comment: comment,
            user_name: "Gezgin" 
          }
        ]);

      if (error) {
        // Eğer hata verirse ne olduğunu görelim
        alert("Hata: " + error.message);
      } else {
        // İSTEDİĞİN MESAJ
        alert("Başarılı! 🌸 Yorumunuz ve puanınız kaydedildi.");
        
        setComment(''); 
        setUserRating(0); 
      }
    } catch (err) {
      alert("Bir bağlantı sorunu oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }}>
      <Image source={{ uri: item.image_url }} style={{ width: '100%', height: 300 }} />
      
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#333' }}>{item.name}</Text>
        <Text style={{ color: '#666', fontSize: 18, marginBottom: 20 }}>{item.location}</Text>

        {/* Puanlama ve Yorum Alanı */}
        <View style={{ backgroundColor: '#FFF5F7', padding: 20, borderRadius: 20, marginBottom: 20, borderWeight: 1, borderColor: '#FCE7F3' }}>
          <Text style={{ textAlign: 'center', marginBottom: 10, fontWeight: 'bold', color: '#D8A7B1' }}>Deneyimini Puanla ✨</Text>
          
          {/* Yıldızlar */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 15 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setUserRating(star)}>
                <Text style={{ fontSize: 35, color: star <= userRating ? '#FFD700' : '#D3D3D3', marginHorizontal: 5 }}>
                  {star <= userRating ? '★' : '☆'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Yorum Girişi */}
          <TextInput
            style={{
              backgroundColor: '#fff',
              borderWidth: 1,
              borderColor: '#F9A8D4',
              borderRadius: 15,
              padding: 15,
              height: 100,
              textAlignVertical: 'top',
              fontSize: 16
            }}
            placeholder="Mekan hakkında ne düşünüyorsun? 🌸"
            multiline
            value={comment}
            onChangeText={setComment}
          />

          {/* Gönder Butonu */}
          <TouchableOpacity 
            style={[styles.allButton, { marginTop: 15, opacity: isSubmitting ? 0.6 : 1, alignItems: 'center', justifyContent: 'center' }]}
            onPress={handleSendReview}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.allButtonText}>Yorumu Gönder</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Özellikler (Varsa) */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            {item.has_wifi && (
                <View style={{ backgroundColor: '#F0F9FF', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#BAE6FD' }}>
                    <Text style={{ color: '#0369A1', fontWeight: 'bold' }}>📶 Wi-Fi</Text>
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
          style={[styles.allButton, { backgroundColor: '#4B5563', marginTop: 10 }]} // Yol tarifi için farklı renk
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