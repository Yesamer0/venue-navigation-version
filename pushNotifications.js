import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

import { supabase } from './supabase';

export const registerForPushNotificationsAsync = async (userId) => {
  // Skip unsupported platforms
  if (Platform.OS === 'web' || !Device.isDevice) {
    console.log('Push notifications require a physical mobile device.');
    return null;
  }

  // Expo Go does not support remote push notifications
  if (Constants.executionEnvironment === 'storeClient') {
    console.log('Remote push notifications require a development build.');
    return null;
  }

  if (!userId) {
    console.log('Cannot register push token without a user ID.');
    return null;
  }

  try {
    // Check notification permissions
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } =
        await Notifications.requestPermissionsAsync();

      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permission not granted.');
      return null;
    }

    // Get Expo project ID
    const projectId =
      Constants.easConfig?.projectId ??
      Constants.expoConfig?.extra?.eas?.projectId;

    if (!projectId) {
      console.log('Expo project ID is missing.');
      return null;
    }

    // Get Expo push token
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const token = tokenResponse.data;

    // Save token in Supabase
    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'token',
        }
      );

    if (error) {
      console.log('Push token save error:', error.message);
      return null;
    }

    console.log('Push token registered successfully.');
    return token;
  } catch (error) {
    console.log('Push registration error:', error);
    return null;
  }
};