import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { palette } from './theme';

import HomeStack from './HomeStack';
import ProfileStack from './ProfileStack';

const Tab = createBottomTabNavigator();

// Alt sekme menüsü: Ana Sayfa ve Profil arasında geçiş.
// Profil sekmesi, kullanıcının rolüne göre (mekan sahibi / normal kullanıcı)
// otomatik olarak doğru ekranı gösterir (bkz. ProfileOrVenueScreen.js).
export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{
          tabBarLabel: 'Keşfet',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size ? size - 4 : 20, color }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size ? size - 4 : 20, color }}>👤</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}