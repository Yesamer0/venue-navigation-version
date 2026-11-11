import * as Location from 'expo-location';

export function isFreshAccurateLocation(position, now = Date.now()) {
  const { latitude, longitude, accuracy } = position?.coords || {};
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 &&
    Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= 50 &&
    Number.isFinite(position?.timestamp) && Math.abs(now - position.timestamp) <= 60000;
}

export async function getFreshLocation() {
  let timer;
  try {
    // Permission/service checks can also stall on a physical device.
    return await Promise.race([
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') throw new Error('Konum izni gerekiyor.');
        if (!(await Location.hasServicesEnabledAsync())) throw new Error('Telefonunun konum hizmetlerini aç.');
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (!isFreshAccurateLocation(position)) {
          throw new Error('GPS konumun henüz yeterince net değil. Açık alanda yeniden dene.');
        }
        return position;
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Konum alınması uzun sürdü. Konum iznini kontrol edip açık alanda yeniden dene.')), 20000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
