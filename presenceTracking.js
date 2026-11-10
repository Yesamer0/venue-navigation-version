import * as Location from 'expo-location';
import { AppState } from 'react-native';
import { supabase } from './supabase';
import { getFreshLocation, isFreshAccurateLocation } from './deviceLocation';

const listeners = new Set();
export function refreshPresenceTracking() { listeners.forEach(refresh => refresh()); }

export function presenceAction(position, venue) {
  if (!isFreshAccurateLocation(position) || venue?.latitude == null || venue?.longitude == null) return null;
  const lat = Number(venue.latitude), lon = Number(venue.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const rad = n => n * Math.PI / 180;
  const a = Math.sin(rad(lat - position.coords.latitude) / 2) ** 2 +
    Math.cos(rad(lat)) * Math.cos(rad(position.coords.latitude)) * Math.sin(rad(lon - position.coords.longitude) / 2) ** 2;
  const distance = 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
  if (distance - position.coords.accuracy > 150) return 'leave';
  if (distance + position.coords.accuracy <= 100) return 'refresh';
  return null;
}

// One foreground tracker per authenticated account, independent of navigation.
export function startPresenceTracking(userId) {
  let stopped = false, generation = 0, subscription = null, busy = false;
  let rows = [], venues = new Map();
  const active = () => !stopped && AppState.currentState === 'active';
  const stopWatch = () => { generation++; subscription?.remove(); subscription = null; };
  const process = async position => {
    if (!active() || busy || !isFreshAccurateLocation(position)) return;
    busy = true;
    const version = generation;
    try {
      for (const row of rows) {
        if (!active() || version !== generation) return;
        const action = presenceAction(position, venues.get(row.venue_id));
        if (action === 'leave') {
          const { error } = await supabase.from('venue_presence').delete().eq('user_id', userId).eq('venue_id', row.venue_id);
          if (!error) rows = rows.filter(value => value !== row);
        } else if (action === 'refresh' && Date.now() - Date.parse(row.last_seen_at) >= 5 * 60000) {
          const timestamp = new Date().toISOString();
          const { error } = await supabase.from('venue_presence').update({ last_seen_at: timestamp })
            .eq('user_id', userId).eq('venue_id', row.venue_id)
            .gte('last_seen_at', new Date(Date.now() - 30 * 60000).toISOString());
          if (!error) row.last_seen_at = timestamp;
        }
      }
      if (!rows.length) stopWatch();
    } finally { busy = false; }
  };
  let syncing = false;
  const sync = async () => {
    if (!active() || syncing) return;
    syncing = true;
    const version = generation;
    try {
      const cutoff = new Date(Date.now() - 30 * 60000).toISOString();
      const { data, error } = await supabase.from('venue_presence').select('venue_id,last_seen_at').eq('user_id', userId).gte('last_seen_at', cutoff);
      if (!active() || version !== generation || error) return;
      rows = data || [];
      if (!rows.length) { stopWatch(); return; }
      const result = await supabase.from('venues').select('id,latitude,longitude').in('id', rows.map(row => row.venue_id));
      if (!active() || version !== generation || result.error) return;
      venues = new Map((result.data || []).map(venue => [venue.id, venue]));
      // Existing permission only: never open a permission dialog during navigation.
      const permission = await Location.getForegroundPermissionsAsync();
      if (!active() || version !== generation) return;
      if (permission.status !== 'granted') { stopWatch(); return; }
      if (!subscription) {
        const watch = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 20 }, position => { void process(position).catch(() => {}); });
        if (!active() || version !== generation) { watch.remove(); return; }
        subscription = watch;
      }
      // Also obtains a fresh fix while stationary and immediately on resume.
      const position = await getFreshLocation();
      if (active() && version === generation) await process(position);
    } catch { /* Retry on next foreground tick; never report a failed delete as success. */ }
    finally { syncing = false; }
  };
  listeners.add(sync);
  const appState = AppState.addEventListener('change', state => {
    stopWatch();
    if (state === 'active') void sync();
  });
  const timer = setInterval(() => { void sync(); }, 30000);
  void sync();
  return () => { stopped = true; stopWatch(); clearInterval(timer); appState.remove(); listeners.delete(sync); rows = []; venues.clear(); };
}
