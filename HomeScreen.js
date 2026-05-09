import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, SafeAreaView } from 'react-native';
import { supabase } from './supabase'; 
import { styles } from './styles';

export default function HomeScreen({ navigation }) {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Hepsi');

  const categories = ['Hepsi', 'Kafe', 'Restoran', 'Bar', 'Etkinlik'];

  useEffect(() => {
    fetchVenues();
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

  const filteredVenues = selectedCategory === 'Hepsi' 
    ? venues 
    : venues.filter(v => v.category === selectedCategory);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#D8A7B1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nereye gitsek? 🌸</Text>
      </View>

      <View style={{ height: 60 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.categoryButton, selectedCategory === item && styles.selectedCategoryButton]}
              onPress={() => setSelectedCategory(item)}
            >
              <Text style={[styles.categoryText, selectedCategory === item && styles.selectedCategoryText]}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={filteredVenues}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.card}
            onPress={() => navigation.navigate('Details', { item })}
          >
            <Image source={{ uri: item.image_url }} style={styles.image} />
            <View style={styles.cardContent}>
              <Text style={styles.venueName}>{item.name}</Text>
              <Text style={styles.venueLocation}>{item.location}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}