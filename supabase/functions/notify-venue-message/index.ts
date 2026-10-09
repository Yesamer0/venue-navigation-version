
import { createClient } from 'npm:@supabase/supabase-js@2';

type NotificationPayload = {
  message_id: string;
};

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return Response.json(
      { error: 'Method not allowed' },
      { status: 405 }
    );
  }

  try {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const token = authHeader.replace('Bearer ', '');

    const { data: userData, error: userError } =
      await userClient.auth.getUser(token);

    if (userError || !userData.user) {
      return Response.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    const { message_id }: NotificationPayload = await request.json();

    if (!message_id || typeof message_id !== 'string') {
      return Response.json(
        { error: 'message_id is required' },
        { status: 400 }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Load the message from the database
    const { data: message, error: messageError } = await admin
      .from('messages')
      .select('id, venue_id, user_id')
      .eq('id', message_id)
      .single();

    if (messageError || !message) {
      return Response.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // Only the sender can request a notification
    if (message.user_id !== userData.user.id) {
      return Response.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Prevent duplicate notification requests
    const { error: dispatchError } = await admin
      .from('notification_dispatches')
      .insert({ message_id });

    if (dispatchError) {
      if (dispatchError.code === '23505') {
        return Response.json({
          success: true,
          sent: 0,
          reason: 'Notification already processed',
        });
      }

      throw dispatchError;
    }

    // Find users currently present at the venue
    const cutoff = new Date(
      Date.now() - 10 * 60 * 1000
    ).toISOString();

    const { data: presence, error: presenceError } = await admin
      .from('venue_presence')
      .select('user_id')
      .eq('venue_id', message.venue_id)
      .gte('last_seen_at', cutoff);

    if (presenceError) throw presenceError;

    const recipientIds = [
      ...new Set(
        (presence ?? [])
          .map((entry) => entry.user_id)
          .filter((id) => id !== message.user_id)
      ),
    ];

    if (recipientIds.length === 0) {
      return Response.json({
        success: true,
        sent: 0,
        reason: 'No active recipients',
      });
    }

    // Load registered Expo push tokens
    const { data: tokenRows, error: tokenError } = await admin
      .from('push_tokens')
      .select('token')
      .in('user_id', recipientIds);

    if (tokenError) throw tokenError;

    const tokens = [
      ...new Set((tokenRows ?? []).map((row) => row.token)),
    ];

    if (tokens.length === 0) {
      return Response.json({
        success: true,
        sent: 0,
        reason: 'No registered push tokens',
      });
    }

    const notifications = tokens.map((pushToken) => ({
      to: pushToken,
      title: 'Venue',
      body: 'Bulunduğun mekânda yeni bir mesaj var!',
      sound: 'default',
      data: {
        type: 'venue_message',
        venue_id: message.venue_id,
      },
    }));

    // Expo accepts up to 100 notifications per request
    const batches = [];

    for (let i = 0; i < notifications.length; i += 100) {
      batches.push(notifications.slice(i, i + 100));
    }

    let submitted = 0;

    for (const batch of batches) {
      const expoResponse = await fetch(
        'https://exp.host/--/api/v2/push/send',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batch),
        }
      );

      if (!expoResponse.ok) {
        throw new Error(
          `Expo push request failed: ${expoResponse.status}`
        );
      }

      const expoResult = await expoResponse.json();

      console.log('Expo push result:', expoResult);
      submitted += batch.length;
    }

    return Response.json({
      success: true,
      submitted,
    });
  } catch (error) {
    console.error('Notification function error:', error);

    return Response.json(
      { error: 'Notification processing failed' },
      { status: 500 }
    );
  }
});
