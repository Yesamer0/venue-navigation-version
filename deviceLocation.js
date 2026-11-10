import * as Location from 'expo-location';

export function isFreshAccurateLocation(position, now = Date.now()) {
  const { latitude, longitude, accuracy } = position?.coords || {};
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 &&
    Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= 50 &&
    Number.isFinite(position?.timestamp) && Math.abs(now - position.timestamp) <= 60000;
}

export async function getFreshLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Konum izni gerekiyor.');
  if (!(await Location.hasServicesEnabledAsync())) throw new Error('Telefonunun konum hizmetlerini aç.');
  let timer;
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Konum alınması uzun sürdü. Açık alanda yeniden dene.')), 20000);
      }),
    ]);
    if (!isFreshAccurateLocation(position)) {
      throw new Error('GPS konumun henüz yeterince net değil. Açık alanda yeniden dene.');
    }
    return position;
  } finally {
    clearTimeout(timer);
  }
}
