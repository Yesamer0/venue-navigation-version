import { createClient } from 'npm:@supabase/supabase-js@2.110.1';

Deno.serve(async (request) => {
  const expected = Deno.env.get('PHOTO_CLEANUP_TOKEN');
  if (request.method !== 'POST' || !expected || request.headers.get('X-Cleanup-Token') !== expected) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { error: queueError } = await client.rpc('queue_expired_visitor_photos');
    if (queueError) throw queueError;
    const { data, error } = await client.from('expired_visitor_photo_files').select('storage_path').order('queued_at').limit(100);
    if (error) throw error;
    const queued = (data || []).map(photo => photo.storage_path);
    // A surviving post must never lose its image, even if an old expiry queued the path.
    const { data: living, error: livingError } = queued.length
      ? await client.from('venue_moments').select('storage_path').in('storage_path', queued)
      : { data: [], error: null };
    if (livingError) throw livingError;
    const protectedPaths = new Set((living || []).map(photo => photo.storage_path));
    const paths = queued.filter(path => !protectedPaths.has(path));
    if (protectedPaths.size) {
      const { error: unqueueError } = await client.from('expired_visitor_photo_files').delete().in('storage_path', [...protectedPaths]);
      if (unqueueError) throw unqueueError;
    }
    if (paths.length) {
      const { error: storageError } = await client.storage.from('venue-moments').remove(paths);
      if (storageError) throw storageError;
      const { error: deleteError } = await client.from('expired_visitor_photo_files').delete().in('storage_path', paths);
      if (deleteError) throw deleteError;
    }
    return Response.json({ deleted: paths.length });
  } catch {
    // Leave failed object deletions queued for the next scheduled retry.
    return Response.json({ error: 'Cleanup failed; queued files will be retried.' }, { status: 500 });
  }
});
