import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import HomeScreen from './HomeScreen';
import DetailsScreen from './DetailsScreen';
import VenueChatScreen from './VenueChatScreen';
import PublicProfileScreen from './PublicProfileScreen';
import MomentPhotoScreen from './MomentPhotoScreen';

const Stack = createStackNavigator();

// Home sekmesinin kendi iç gezinmesi: Ana Sayfa -> Mekan Detayı -> Sohbet.
// Bu bir Tab.Screen'in İÇİNDE olduğu için, buraya girip çıksan bile
// alttaki sekme çubuğu (Ana Sayfa / Profil) her zaman görünür kalır.
export default function HomeStack({ navigation, guest = false }) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#D8A7B1',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      {guest ? <>
        <Stack.Screen name="GuestHome" options={{ headerShown: false }}>
          {props => <HomeScreen {...props} guest onSignIn={() => navigation.goBack()} />}
        </Stack.Screen>
        <Stack.Screen name="Details" options={{ title: 'Mekân' }}>
          {props => <DetailsScreen {...props} guest />}
        </Stack.Screen>
        <Stack.Screen name="MomentPhoto" component={MomentPhotoScreen} options={{ title: 'Fotoğraf' }} />
      </> : <>
        <Stack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="PublicProfile" component={PublicProfileScreen} options={{ title: 'Profil' }} />
        <Stack.Screen name="MomentPhoto" component={MomentPhotoScreen} options={{ title: 'Fotoğraf' }} />
        <Stack.Screen name="Details" component={DetailsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="VenueChat" component={VenueChatScreen} options={{ headerShown: true, title: 'Sohbet' }} />
      </>}
    </Stack.Navigator>
  );
}
