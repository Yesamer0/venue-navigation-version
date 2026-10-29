import * as Location from 'expo-location';
import { supabase } from './supabase';

export const PHOTO_BUCKET = 'venue-moments';
export const PAGE_SIZE = 20;

export function distanceMeters(a, b) {
  const rad = (n) => n * Math.PI / 180;
  const x = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) *
    Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, x)));
}

export async function verifyVenueLocation(venue) {
  if (venue.latitude == null || venue.longitude == null ||
      !Number.isFinite(Number(venue.latitude)) || !Number.isFinite(Number(venue.longitude))) {
    throw new Error('Bu mekânın konumu henüz eklenmemiş.');
  }
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Fotoğraf paylaşmak için konum izni gerekiyor.');
  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  const { latitude, longitude, accuracy } = location.coords;
  if (!Number.isFinite(accuracy) || accuracy > 50 || Date.now() - location.timestamp > 60000) {
    throw new Error('Konum yeterince net değil. Biraz bekleyip yeniden dene.');
  }
  if (distanceMeters({ latitude, longitude }, {
    latitude: Number(venue.latitude), longitude: Number(venue.longitude),
  }) + accuracy > 100) throw new Error('Fotoğraf paylaşmak için mekânın 100 metre yakınında olmalısın.');
  return { latitude, longitude, accuracy, capturedAt: new Date(location.timestamp).toISOString() };
}

// React Native Storage uploads need an ArrayBuffer, not a local file URI/Blob.
export function decodePhoto(base64) {
  if (!base64 || base64.length > 11200000) throw new Error('Fotoğraf en fazla 8 MB olabilir.');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const data = base64.replace(/=+$/, '');
  const bytes = new Uint8Array(Math.floor(data.length * 6 / 8));
  let bits = 0; let value = 0; let offset = 0;
  for (const char of data) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) throw new Error('Fotoğraf okunamadı. Yeniden seç.');
    value = (value << 6) | digit;
    bits += 6;
    if (bits >= 8) { bits -= 8; bytes[offset++] = (value >>> bits) & 255; }
  }
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error('Fotoğraf en fazla 8 MB olabilir.');
  const jpeg = bytes[0] === 255 && bytes[1] === 216;
  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  if (!jpeg && !png) throw new Error('Lütfen JPEG veya PNG fotoğraf seç.');
  return { buffer: bytes.buffer, extension: jpeg ? 'jpg' : 'png', contentType: jpeg ? 'image/jpeg' : 'image/png' };
}

export function photoUrl(path) {
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function friendlyError(error) {
  if (['PGRST202', '42P01'].includes(error?.code)) return 'Fotoğraf paylaşımı henüz kullanıma hazır değil. Lütfen daha sonra tekrar dene.';
  return error?.message || 'Bağlantı kurulamadı. Yeniden dene.';
}
