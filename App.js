import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Platform, View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useFonts, Chewy_400Regular } from '@expo-google-fonts/chewy';

// Ekranları içeri aktar
import AuthScreen from './AuthScreen';
import MainTabs from './MainTabs'; // Home + Profil sekmelerini içeren alt menü (artık her sekmenin kendi iç stack'i var)

const Stack = createStackNavigator();

export default function App() {
  const [fontsLoaded] = useFonts({
    Chewy_400Regular,
  });

  // WEB İÇİN KRİTİK DÜZELTME: React Native'in flex:1 / ScrollView mantığının
  // web'de doğru çalışabilmesi için html, body ve #root elemanlarının da
  // yüksekliğinin %100 olması gerekiyor. Expo bunu otomatik ayarlamıyor,
  // bu yüzden hiçbir ekranda (Details, Chat, hiçbiri) iç ScrollView'ler
  // düzgün kaymıyordu. Bu efekt sadece web'de çalışır, native'de (telefon) etkisizdir.
  useEffect(() => {
    if (Platform.OS === 'web') {
      const style = document.createElement('style');
      style.innerHTML = `
        html, body, #root {
          height: 100%;
          margin: 0;
          padding: 0;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF0F5' }}>
        <ActivityIndicator size="large" color="#C2185B" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Auth"
        screenOptions={{
          headerStyle: { backgroundColor: '#fff' },
          headerTintColor: '#D8A7B1',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen 
          name="Auth" 
          component={AuthScreen} 
          options={{ headerShown: false }} 
        />

        {/* Home ve Profil artık ayrı Stack ekranları değil,
            MainTabs içindeki alt sekmeler. Giriş yapınca
            navigation.replace('Main') ile buraya geliniyor. */}
        <Stack.Screen 
          name="Main" 
          component={MainTabs} 
          options={{ headerShown: false }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}