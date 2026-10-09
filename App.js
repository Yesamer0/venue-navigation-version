import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Platform, View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useFonts, Chewy_400Regular } from '@expo-google-fonts/chewy';

import * as Notifications from 'expo-notifications';

// Screens
import AuthScreen from './AuthScreen';
import MainTabs from './MainTabs';

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

// Request notification permission
const requestNotificationPermission = async () => {
  if (Platform.OS === 'web') {
    return false;
  }

  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } =
        await Notifications.requestPermissionsAsync();

      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permission denied');
      return false;
    }

    console.log('Notification permission granted');
    return true;
  } catch (error) {
    console.log('Notification permission error:', error);
    return false;
  }
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Chewy_400Regular,
  });

  // Request permission when the app starts
  useEffect(() => {
    requestNotificationPermission();
  }, []);

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

        <Stack.Screen
          name="Main"
          component={MainTabs}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}