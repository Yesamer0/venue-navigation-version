import { supabase } from './supabase';

export async function hasPhotoTestAccess(venueId) {
  const { data, error } = await supabase.rpc('has_photo_test_access', { p_venue_id: String(venueId) });
  // An unavailable/expired test allowance always falls back to normal location rules.
  return !error && data === true;
}
