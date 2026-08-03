import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import ProfileOrVenueScreen from './ProfileOrVenueScreen';
import DetailsScreen from './DetailsScreen';
import AddVenueScreen from './AddVenueScreen';
import VenueChatScreen from './VenueChatScreen';

const Stack = createStackNavigator();

// Profil sekmesinin kendi iç gezinmesi: Profil/Mekan Paneli -> Mekan Detayı
// (menü/foto yönetimi) -> Yeni Mekan Ekle -> Sohbet.
// Bu bir Tab.Screen'in İÇİNDE olduğu için, buraya girip çıksan bile
// alttaki sekme çubuğu (Ana Sayfa / Profil) her zaman görünür kalır.
export default function ProfileStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#D8A7B1',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen name="ProfileMain" component={ProfileOrVenueScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Details" component={DetailsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AddVenue" component={AddVenueScreen} options={{ headerShown: true, title: 'Yeni Mekan Ekle' }} />
      <Stack.Screen name="VenueChat" component={VenueChatScreen} options={{ headerShown: true, title: 'Sohbet' }} />
    </Stack.Navigator>
  );
}