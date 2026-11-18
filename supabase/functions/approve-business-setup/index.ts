import { createClient } from 'npm:@supabase/supabase-js@2.110.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(message: string, status: number) {
  return Response.json({ message }, { status, headers: cors });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return reply('POST gerekiyor.', 405);

  try {
    const token = request.headers.get('Authorization');
    if (!token?.startsWith('Bearer ')) return reply('Giriş yapmalısın.', 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, options);
    const { data: { user }, error: authError } = await client.auth.getUser(token.slice(7));
    if (authError || !user) return reply('Yeniden giriş yapmalısın.', 401);
    if (user.app_metadata.venue_applications_admin !== true) return reply('Yönetici yetkisi gerekiyor.', 403);

    const { applicationId } = await request.json();
    if (typeof applicationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(applicationId)) {
      return reply('Başvuru kimliği geçersiz.', 400);
    }

    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, options);
    const { data: application, error: lookupError } = await service.from('business_applications')
      .select('email, details, status').eq('id', applicationId).maybeSingle();
    if (lookupError) return reply('Başvuru okunamadı.', 500);
    if (application?.status !== 'approved') return reply('Başvurunun önce onaylanması gerekiyor.', 409);

    const { data: existing, error: existingError } = await service.rpc('find_application_account', { p_id: applicationId });
    if (existingError) return reply('Hesap kontrol edilemedi.', 500);
    if (existing?.kind === 'other') return reply('Bu e-postada mevcut bir VENUE hesabı var. Yetki değişikliği yapılmadı.', 409);
    if (existing?.kind !== 'application') {
      const { error: createError } = await service.auth.admin.createUser({
        email: application.email,
        email_confirm: true,
        password: crypto.randomUUID() + crypto.randomUUID(),
        app_metadata: { venue_business_approved: true, venue_application_id: applicationId },
        user_metadata: { business_signup: { address: application.details.address } },
      });
      if (createError) return reply('Hesap oluşturulamadı. Başvuruyu yenileyip tekrar dene.', 409);
    }

    const { error: emailError } = await client.auth.resetPasswordForEmail(application.email);
    if (emailError) return reply('E-posta gönderilemedi. Biraz sonra kodu yeniden gönder.', 502);
    return reply('Hesap kurulum kodu gönderildi.', 200);
  } catch {
    return reply('İşlem tamamlanamadı.', 500);
  }
});
