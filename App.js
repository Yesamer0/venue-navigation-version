import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { supabase } from './supabaseClient'; // Oluşturduğun bağlantı dosyası

export default function App() {
  const [status, setStatus] = useState("Bağlanıyor...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSupabaseConnection() {
      try {
        // image_b292e1.png dosyasındaki 'venues' tablosunu test ediyoruz
        const { data, error } = await supabase.from('venues').select('*').limit(1);
        
        if (error) {
          setStatus("Hata: " + error.message);
        } else {
          setStatus("Venue: Supabase Bağlantısı Başarılı!");
          console.log("Veritabanından gelen veri örneği:", data);
        }
      } catch (err) {
        setStatus("Beklenmedik bir hata oluştu.");
      } finally {
        setLoading(false);
      }
    }

    checkSupabaseConnection();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>VENUE</Text>
      
      {loading ? (
        <ActivityIndicator size="large" color="#FFB7C5" />
      ) : (
        <View style={styles.statusBox}>
          <Text style={status.includes("Başarılı") ? styles.successText : styles.errorText}>
            {status}
          </Text>
        </View>
      )}

      <Text style={styles.footer}>8 Aylık Proje Süreci: 4. Gün Tamamlanıyor</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5F5', // programarayüz.jpeg'deki pastel tonlara uygun
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#D8A7B1', // Misty Rose tonu
    marginBottom: 20,
    letterSpacing: 2,
  },
  statusBox: {
    padding: 20,
    borderRadius: 15,
    backgroundColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  successText: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    color: '#F44336',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    fontSize: 12,
    color: '#999',
  },
});