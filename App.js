import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Platform, View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useFonts, Chewy_400Regular } from '@expo-google-fonts/chewy';

import * as Notifications from 'expo-notifications';

// Screens
import AuthScreen from './AuthScreen';
import MainTabs from './MainTabs';
import { AuthProvider, useAuth } from './AuthProvider';
import { signOutVenue } from './authService';
import { startPresenceTracking } from './presenceTracking';

const Stack = createStackNavigator();

// Configure notification behavior
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function RootNavigator() {
  const { session, profile, loading, error, retry } = useAuth();
  useEffect(() => {
    if (session?.user?.id && profile) return startPresenceTracking(session.user.id);
  }, [session?.user?.id, profile?.id]);
  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0F5' }}><ActivityIndicator color="#C2185B" /><Text style={{ marginTop: 12 }}>Hesabın hazırlanıyor…</Text></View>;
  if (error) return <View style={{ flex: 1, justifyContent: 'center', padding: 28, backgroundColor: '#FFF0F5' }}>
    <Text accessibilityRole="alert" style={{ color: '#9B1B4D', lineHeight: 23 }}>{error}</Text>
    <TouchableOpacity onPress={retry}><Text style={{ color: '#9B1B4D', fontWeight: '700', paddingVertical: 18 }}>Tekrar dene</Text></TouchableOpacity>
    <TouchableOpacity onPress={() => signOutVenue().catch(failure => Alert.alert('Çıkış yapılamadı', failure.message))}><Text style={{ color: '#666', paddingVertical: 12 }}>Çıkış yap</Text></TouchableOpacity>
  </View>;
  return <NavigationContainer>
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {session && profile ? <Stack.Screen name="Main" component={MainTabs} navigationKey={session.user.id} /> : <Stack.Screen name="Auth" component={AuthScreen} />}
    </Stack.Navigator>
  </NavigationContainer>;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Chewy_400Regular,
  });

  // Keep web layout working correctly
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

      return () => {
        document.head.removeChild(style);
      };
    }
  }, []);

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#FFF0F5',
        }}
      >
        <ActivityIndicator size="large" color="#C2185B" />
      </View>
    );
  }

  return <AuthProvider><RootNavigator /></AuthProvider>;
}
