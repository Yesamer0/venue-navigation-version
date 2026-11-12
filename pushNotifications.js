import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';

const tokenStorageKey = 'venue:push-registration';
const channelId = 'venue-messages';
let pendingRegistration = Promise.resolve();

function getProjectId() {
  if (Platform.OS === 'web' || !Device.isDevice || Constants.executionEnvironment === 'storeClient') return null;
  return Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId ?? null;
}

async function register(userId) {
  const projectId = getProjectId();
  if (!projectId || !userId) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: 'Mekân mesajları',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const permission = await Notifications.getPermissionsAsync();
  const status = permission.status === 'granted' || !permission.canAskAgain
    ? permission.status
    : (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') {
    await removeRegistration(userId);
    return null;
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user.id !== userId) return null;

  const previous = await AsyncStorage.getItem(tokenStorageKey);
  if (previous && previous !== token) await removeRegistration(userId);
  // Remember the token before the request so even a lost response can be cleaned up on sign-out.
  await AsyncStorage.setItem(tokenStorageKey, token);
  const { error } = await supabase.from('push_tokens').upsert({
    user_id: userId,
    token,
    platform: Platform.OS,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'token' });
  if (error) throw error;
  return token;
}

async function removeRegistration(userId) {
  const token = await AsyncStorage.getItem(tokenStorageKey);
  if (!token) return;
  const { error } = await supabase.from('push_tokens').delete().eq('user_id', userId).eq('token', token);
  if (error) throw error;
  await AsyncStorage.removeItem(tokenStorageKey);
}

export function registerForPushNotificationsAsync(userId) {
  const registration = pendingRegistration.then(() => register(userId));
  pendingRegistration = registration.catch(() => {});
  return registration;
}

export async function unregisterPushNotificationsAsync(userId) {
  if (Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') return;
  await pendingRegistration;
  await removeRegistration(userId);
}
