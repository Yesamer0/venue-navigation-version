import { createClient } from 'npm:@supabase/supabase-js@2.110.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (message: string, status: number) => Response.json({ message }, { status, headers: cors });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return reply('POST gerekiyor.', 405);
  try {
    const token = request.headers.get('Authorization');
    if (!token?.startsWith('Bearer ')) return reply('Yeniden giriş yapmalısın.', 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, options);
    const { data: { user }, error: authError } = await client.auth.getUser(token.slice(7));
    if (authError || !user) return reply('Yeniden giriş yapmalısın.', 401);

    const { applicationId, password } = await request.json();
    if (applicationId !== undefined) {
      if (typeof applicationId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(applicationId)) {
        return reply('Başvuru kimliği geçersiz.', 400);
      }
      if (user.app_metadata.venue_applications_admin !== true) return reply('Yönetici yetkisi gerekiyor.', 403);
    } else {
      if (!user.email || typeof password !== 'string' || !password || password.length > 1024) {
        return reply('Mevcut şifreni yaz.', 400);
      }
      const { data, error } = await client.auth.signInWithPassword({ email: user.email, password });
      if (error?.status === 429) return reply('Çok fazla deneme yapıldı. Biraz sonra tekrar dene.', 429);
      if (error || data.user?.id !== user.id) return reply('Şifre doğrulanamadı.', 403);
    }

    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, options);
    const { data: target, error: targetError } = await service.rpc('prepare_account_deletion', {
      p_actor: user.id, p_application: applicationId ?? null,
    });
    if (targetError) throw targetError;
    if (!target) return reply('Silinebilecek bir hesap bulunamadı.', 404);

    // Storage deletes are retryable. The database trigger verifies that no owned files remain.
    for (let batch = 0; batch < 30; batch++) {
      const { data: files, error } = await service.rpc('account_deletion_files', { p_user: target });
      if (error) throw error;
      if (!files.length) {
        const { error: failure } = await service.auth.admin.deleteUser(target);
        if (failure && failure.code !== 'user_not_found') throw failure;
        return reply('Hesap kalıcı olarak silindi.', 200);
      }
      const buckets = new Map<string, string[]>();
      for (const { bucket_id, name } of files) {
        if (!buckets.has(bucket_id)) buckets.set(bucket_id, []);
        buckets.get(bucket_id)!.push(name);
      }
      for (const [bucket, paths] of buckets) {
        const { error: failure } = await service.storage.from(bucket).remove(paths);
        if (failure) throw failure;
      }
    }
  } catch {
    // The deletion marker keeps new uploads blocked while the owner or admin retries.
  }
  return reply('Hesap silme tamamlanamadı. Biraz sonra tekrar dene.', 503);
});
