import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import HomeScreen from './HomeScreen';
import DetailsScreen from './DetailsScreen';
import VenueChatScreen from './VenueChatScreen';

const Stack = createStackNavigator();

// Home sekmesinin kendi iç gezinmesi: Ana Sayfa -> Mekan Detayı -> Sohbet.
// Bu bir Tab.Screen'in İÇİNDE olduğu için, buraya girip çıksan bile
// alttaki sekme çubuğu (Ana Sayfa / Profil) her zaman görünür kalır.
export default function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#D8A7B1',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Details" component={DetailsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="VenueChat" component={VenueChatScreen} options={{ headerShown: true, title: 'Sohbet' }} />
    </Stack.Navigator>
  );
}