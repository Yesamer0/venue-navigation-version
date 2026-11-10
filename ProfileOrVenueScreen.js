import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from './AuthProvider';
import ProfileScreen from './ProfileScreen';
import VenueOwnerScreen from './VenueOwnerScreen';

export default function ProfileOrVenueScreen({ navigation, route }) {
  const { profile } = useAuth();
  if (!profile) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#C2185B" /></View>;
  return profile.is_venue
    ? <VenueOwnerScreen navigation={navigation} route={route} />
    : <ProfileScreen navigation={navigation} route={route} />;
}
