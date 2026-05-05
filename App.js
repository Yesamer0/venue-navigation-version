import React, { useEffect, useState } from 'react';
// TouchableOpacity buraya eklendi!
import { StyleSheet, Text, View, FlatList, Image, SafeAreaView, ActivityIndicator, TouchableOpacity } from 'react-native'; 
import { supabase } from './supabaseClient'; 
import { styles } from './styles'; // Bu satırı ekle


export default function App() {
  const categories = ['Hepsi', 'Kafe', 'Restoran', 'Bar', 'Etkinlik']; 
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Hepsi'); 

  const handleCategoryChange = (category) => {
  setLoading(true); // Yükleme animasyonunu (pembe halka) başlatır
  setSelectedCategory(category); // Seçilen kategoriyi günceller
  
  // Yarım saniye (500ms) bekle ve yüklemeyi durdur
  setTimeout(() => {
    setLoading(false);
  }, 500);
};
  
  useEffect(() => {
    async function fetchVenues() {
      try {
        setLoading(true);
        const { data, error } = await supabase.from('venues').select('*');
        
        if (error) {
          console.error("Supabase Hatası:", error.message);
        } else {
          setVenues(data);
        }
      } catch (err) {
        console.error("Beklenmedik Hata:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchVenues();
  }, []);

  // Filtreleme mantığı: Eğer 'Hepsi' seçiliyse her şeyi göster, değilse sadece o kategoriyi süz.
  const filteredVenues = selectedCategory === 'Hepsi' 
    ? venues 
    : venues.filter(v => v.category === selectedCategory);

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => alert(`${item.name} detayları yakında!`)}
    >
      {/* Görsel */}
      <Image 
        source={{ uri: item.image_url || 'https://via.placeholder.com/150' }} 
        style={styles.image} 
      />
      
      {/* Kategori Rozeti (Görselin üzerinde sol üstte) */}
      <View style={styles.categoryBadge}>
        <Text style={styles.categoryBadgeText}>{item.category}</Text>
      </View>

      <View style={styles.cardContent}>
        {/* Üst Satır: İsim ve Fiyat */}
        <View style={styles.row}>
          <Text style={styles.venueName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.priceText}>{item.price_level || '₺₺'}</Text>
        </View>
        
        {/* Alt Satır: Konum ve Yıldız Puanı */}
        <View style={styles.row}>
          <Text style={styles.venueLocation} numberOfLines={1}>{item.location}</Text>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>⭐ {item.rating || '0.0'}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

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

      {/* Yükleme Ekranı, Boş Durum veya Ana Liste */}
      {loading ? (
        <ActivityIndicator size="large" color="#D8A7B1" style={{ marginTop: 50 }} />
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
  );}

