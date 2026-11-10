import * as Location from 'expo-location';

export async function getFreshLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Konum izni gerekiyor.');
  if (!(await Location.hasServicesEnabledAsync())) throw new Error('Telefonunun konum hizmetlerini aç.');
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  const { latitude, longitude, accuracy } = position.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
      !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 50 ||
      !Number.isFinite(position.timestamp) || Math.abs(Date.now() - position.timestamp) > 60000) {
    throw new Error('GPS konumun henüz yeterince net değil. Açık alanda yeniden dene.');
  }
  return position;
}
