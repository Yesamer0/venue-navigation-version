import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, SafeAreaView } from 'react-native';
import { styles } from './styles'; 
import { supabase } from './supabase'; 

export default function HomeScreen({ navigation }) { 
  // 1. Durum (State) Tanımlamaları
  const categories = ['Hepsi', 'Kafe', 'Restoran', 'Bar', 'Etkinlik']; 
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Hepsi');

  // 2. Veri Çekme (Supabase)
  useEffect(() => {
    async function fetchVenues() {
      try {
        setLoading(true);
        const { data, error } = await supabase.from('venues').select('*');
        if (error) {
          console.error("Supabase Hatası:", error.message);
        } else {
          setVenues(data || []);
        }
      } catch (err) {
        console.error("Bağlantı Hatası:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchVenues();
  }, []);

  // 3. Kategori Değiştirme Fonksiyonu
  const handleCategoryChange = (category) => {
    setLoading(true);
    setSelectedCategory(category);
    // Küçük bir gecikme ile loading simgesini gösterip kapatıyoruz
    setTimeout(() => {
      setLoading(false);
    }, 500);
  };

  // 4. Filtreleme Mantığı
  const filteredVenues = selectedCategory === 'Hepsi' 
    ? venues 
    : venues.filter(v => v.category === selectedCategory);

  // 5. Her Bir Kartın Tasarımı (renderItem)
  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => navigation.navigate('Details', { item })} 
    >
      <Image 
        source={{ uri: item.image_url || 'https://via.placeholder.com/150' }} 
        style={styles.image} 
      />
      
      {/* Kategori Rozeti */}
      <View style={styles.categoryBadge}>
        <Text style={styles.categoryBadgeText}>{item.category}</Text>
      </View>

      <View style={styles.cardContent}>
        {/* İsim ve Fiyat */}
        <View style={styles.row}>
          <Text style={styles.venueName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.priceText}>{item.price_level || '₺₺'}</Text>
        </View>
        
        {/* Konum ve Yıldız */}
        <View style={styles.row}>
          <Text style={styles.venueLocation} numberOfLines={1}>{item.location}</Text>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>⭐ {item.rating || '0.0'}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  // 6. Ana Sayfa Görünümü
  return (
    <SafeAreaView style={styles.container}>
      {/* Başlık Bölümü */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nereye gitsek?</Text>
      </View>

      {/* Yatay Kategori Listesi */}
      <View style={styles.categoryContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[
                styles.categoryButton, 
                selectedCategory === item && styles.selectedCategoryButton 
              ]}
              onPress={() => handleCategoryChange(item)}
            >
              <Text style={[
                styles.categoryText, 
                selectedCategory === item && styles.selectedCategoryText
              ]}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Liste veya Yükleniyor Durumu */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#D8A7B1" />
        </View>
      ) : filteredVenues.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={{ fontSize: 50, marginBottom: 20 }}>🌸</Text> 
          <Text style={styles.emptyText}>Bu kategoride henüz mekan keşfedilmedi.</Text>
          <TouchableOpacity 
            style={styles.allButton} 
            onPress={() => handleCategoryChange('Hepsi')}
          >
            <Text style={styles.allButtonText}>Tüm Mekanları Gör</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredVenues}
          renderItem={renderItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}