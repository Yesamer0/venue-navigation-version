import React from 'react';
import MapView, { Marker, Circle } from 'react-native-maps';

export const supportsVenueMap = true;

export default function VenueMap({ mapRegion, setMapRegion, userLocation, mapVenues, onSelectVenue }) {
  return (
    <MapView
      style={{ width: '100%', height: '100%' }}
      region={mapRegion}
      onRegionChangeComplete={setMapRegion}
    >
      {userLocation && <>
        <Circle center={userLocation} radius={userLocation.accuracy} strokeColor="#2563EB" fillColor="rgba(37, 99, 235, 0.12)" />
        <Marker coordinate={userLocation} pinColor="#2563EB" title="Konumun" description={`Son GPS ölçümü · yaklaşık ±${Math.ceil(userLocation.accuracy)} m`} zIndex={10} />
      </>}
      {mapVenues.map((venue) => (
        <Marker
          key={venue.id}
          coordinate={{
            latitude: Number(venue.latitude),
            longitude: Number(venue.longitude),
          }}
          title={venue.name}
          description={venue.location}
          onPress={() => onSelectVenue(venue)}
        />
      ))}
    </MapView>
  );
}
