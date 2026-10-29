import React from 'react';
import { Image, View } from 'react-native';
import { photoUrl } from './momentApi';

export default function MomentPhotoScreen({ route }) {
  return <View style={{ flex: 1, backgroundColor: '#111' }}>
    <Image source={{ uri: photoUrl(route.params.path) }} resizeMode="contain" style={{ width: '100%', height: '100%' }} accessibilityLabel="Paylaşılan fotoğraf" />
  </View>;
}
