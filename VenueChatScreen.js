import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { supabase } from './supabase';

const PROXIMITY_METERS = 100;
const HISTORY_HOURS = 3;
const HEARTBEAT_MS = 5 * 60 * 1000; // 5 dakikada bir "hâlâ buradayım" tazeleme

// ⚠️ GEÇİCİ TEST MODU ⚠️
// true iken konum kontrolü tamamen atlanır, herkes sohbete girebilir.
// Gerçek konumdan uzakken test edebilmen için var. Yayına almadan
// önce (veya gerçek konum testine geçince) MUTLAKA false yap!
const DEV_SKIP_LOCATION_CHECK = false;

const ANON_ADJECTIVES = ['Gizemli', 'Sessiz', 'Meraklı', 'Neşeli', 'Uykulu', 'Hızlı', 'Tembel', 'Cesur'];
const ANON_NOUNS = ['Kedi', 'Baykuş', 'Tilki', 'Panda', 'Yunus', 'Kaplan', 'Tavşan', 'Kartal'];

function generateAnonName() {
  const adj = ANON_ADJECTIVES[Math.floor(Math.random() * ANON_ADJECTIVES.length)];
  const noun = ANON_NOUNS[Math.floor(Math.random() * ANON_NOUNS.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `Anonim ${adj} ${noun}${num}`;
}

// İki koordinat arası mesafeyi metre cinsinden hesaplar (Haversine formülü).
// 100 metre gibi küçük bir eşik için basit Pisagor yaklaşımı yeterince hassas değil, bu yüzden gerçek formülü kullanıyoruz.
function distanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Dünya yarıçapı (metre)
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function VenueChatScreen({ route, navigation }) {
  const { item } = route.params;

  const [currentUser, setCurrentUser] = useState(null); // { id, username }
  const [checkingLocation, setCheckingLocation] = useState(true);
  const [isNearVenue, setIsNearVenue] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [distance, setDistance] = useState(null);

  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [sendAnonymous, setSendAnonymous] = useState(false);
  const [anonName, setAnonName] = useState(generateAnonName());
  const [isSending, setIsSending] = useState(false);

  const flatListRef = useRef(null);
  const channelRef = useRef(null);
  const heartbeatRef = useRef(null);
  const locationWatcherRef = useRef(null);
  const isCheckingOutRef = useRef(false);

  useEffect(() => {
    init();
    return () => {
  // Stop Supabase Realtime subscription
  if (channelRef.current) {
    supabase.removeChannel(channelRef.current);
    channelRef.current = null;
  }

  // Stop heartbeat timer
  if (heartbeatRef.current) {
    clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
  }

  // Stop GPS tracking
  if (locationWatcherRef.current) {
    locationWatcherRef.current.remove();
    locationWatcherRef.current = null;
  }
};
  }, []);

  const init = async () => {
    const user = await loadCurrentUser();
    await checkLocation(user);
  };

  const loadCurrentUser = async () => {
    const { data } = await supabase.auth.getUser();
    const authUser = data?.user;
    if (!authUser) return null;

    const { data: profile } = await supabase
      .from('users')
      .select('username')
      .eq('id', authUser.id)
      .maybeSingle();

    const userObj = { id: authUser.id, username: profile?.username || 'Gezgin', email: authUser.email };
    setCurrentUser(userObj);
    return userObj;
  };

  // "Buradayım" kaydını oluşturur/tazeler — Mekan Detay sayfasındaki
  // canlı "kaç kişi burada" göstergesi bu tabloyu okuyor.
  const markPresence = async (user) => {
    if (!user) return;
    try {
      await supabase
        .from('venue_presence')
        .upsert(
          { venue_id: item.id, user_id: user.id, last_seen_at: new Date().toISOString() },
          { onConflict: 'venue_id,user_id' }
        );
    } catch (err) {
      console.log('Presence güncellenemedi:', err);
    }
  };

const removePresence = async (userId) => {
  if (!userId) return false;

  const { error } = await supabase
    .from('venue_presence')
    .delete()
    .eq('venue_id', item.id)
    .eq('user_id', userId);

  if (error) {
    console.log('Presence removal error:', error.message);
    return false;
  }

  return true;
};


  const startLocationTracking = async (userId) => {
  if (locationWatcherRef.current) return;

  locationWatcherRef.current = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 20,
    },
    async (location) => {
      const newDistance = distanceInMeters(
        location.coords.latitude,
        location.coords.longitude,
        Number(item.latitude),
        Number(item.longitude)
      );

      setDistance(Math.round(newDistance));

      // Check if the user has left the venue
      if (newDistance > 150 && !isCheckingOutRef.current) {
        if (!userId) {
          console.log('Cannot check out: user ID is missing');
          return;
        }

        isCheckingOutRef.current = true;

        try {
          const removed = await removePresence(userId);

          if (!removed) {
            console.log('Check-out failed. Waiting for next GPS update.');
            return;
          }

          // Close chat access
          setIsNearVenue(false);

          // Stop Realtime subscription
          if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
          }

          // Stop presence heartbeat
          if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
          }

          // Stop GPS tracking
          locationWatcherRef.current?.remove();
          locationWatcherRef.current = null;
        } catch (error) {
          console.log('Check-out error:', error);
        } finally {
          isCheckingOutRef.current = false;
        }

        return;
      }

      // Keep chat access while the user is near the venue
      if (newDistance <= 150) {
        setIsNearVenue(true);
      }
    }
  );
};

  const checkLocation = async (user) => {
    setCheckingLocation(true);
    setLocationError(null);

    // ⚠️ TEST MODU: konum kontrolünü tamamen atla
    if (DEV_SKIP_LOCATION_CHECK) {
      setIsNearVenue(true);
      fetchMessages();
      subscribeToMessages();
      await markPresence(user || currentUser);
      heartbeatRef.current = setInterval(() => {
        markPresence(user || currentUser);
      }, HEARTBEAT_MS);
      setCheckingLocation(false);
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Sohbete katılabilmek için konum izni vermelisin.');
        setCheckingLocation(false);
        return;
      }

      if (item.latitude == null || item.longitude == null) {
        setLocationError('Bu mekanın konum bilgisi eksik, yakınlık kontrolü yapılamıyor.');
        setCheckingLocation(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const dist = distanceInMeters(
        loc.coords.latitude,
        loc.coords.longitude,
        item.latitude,
        item.longitude
      );

      setDistance(Math.round(dist));

      if (dist <= PROXIMITY_METERS) {
        setIsNearVenue(true);
        fetchMessages();
        subscribeToMessages();
        await startLocationTracking(user?.id);

        // Konum doğrulandı: "buradayım" kaydını oluştur ve
        // sohbet açık kaldığı sürece her 5 dakikada bir tazele.
        await markPresence(user || currentUser);
        heartbeatRef.current = setInterval(() => {
          markPresence(user || currentUser);
        }, HEARTBEAT_MS);
      } else {
        setIsNearVenue(false);
      }
    } catch (err) {
      setLocationError('Konum alınamadı: ' + err.message);
    } finally {
      setCheckingLocation(false);
    }
  };

  const fetchMessages = async () => {
    setLoadingMessages(true);
    const cutoff = new Date(Date.now() - HISTORY_HOURS * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('venue_id', item.id)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: true });

    if (error) {
      console.log('Mesaj çekme hatası:', error);
    } else {
      setMessages(data || []);
    }
    setLoadingMessages(false);
  };

  const subscribeToMessages = () => {
  // Prevent multiple Realtime subscriptions
  if (channelRef.current) return;

  const channel = supabase
    .channel(`venue-chat-${item.id}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `venue_id=eq.${item.id}`,
      },
      (payload) => {
        setMessages((prev) => {
          // Check whether the message already exists
          const alreadyExists = prev.some(
            (msg) => msg.id === payload.new.id
          );

          if (alreadyExists) {
            return prev;
          }

          // Add the new message
          return [...prev, payload.new];
        });
      }
    )
    .subscribe();

  channelRef.current = channel;
};

  
const handleSend = async () => {
  const text = messageText.trim();

  if (!text || isSending) return;

  if (!currentUser) {
    alert('Mesaj gönderebilmek için giriş yapmalısın.');
    return;
  }

  if (!isNearVenue) {
    alert('Mesaj göndermek için mekanda bulunmalısın.');
    return;
  }

  setIsSending(true);

  try {
    // Save the message and get its ID
    const { data: savedMessage, error } = await supabase
      .from('messages')
      .insert([
        {
          venue_id: item.id,
          user_id: currentUser.id,
          display_name: sendAnonymous
            ? anonName
            : currentUser.username,
          is_anonymous: sendAnonymous,
          message: text,
        },
      ])
      .select('id')
      .single();

    if (error) {
      alert('Mesaj Hatası: ' + error.message);
      return;
    }

    setMessageText('');

    // Request a push notification
    try {
      const { error: notificationError } =
        await supabase.functions.invoke(
          'notify-venue-message',
          {
            body: {
              message_id: savedMessage.id,
            },
          }
        );

      if (notificationError) {
        console.log(
          'Notification error:',
          notificationError.message
        );
      }
    } catch (notificationError) {
      console.log(
        'Notification request failed:',
        notificationError
      );
    }
  } catch (err) {
    console.log('Message send error:', err);
    alert('Bir bağlantı sorunu oluştu.');
  } finally {
    setIsSending(false);
  }
};


  // --- Konum kontrol ekranı ---
  if (checkingLocation) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 20 }}>
        <ActivityIndicator size="large" color="#FF69B4" />
        <Text style={{ marginTop: 15, color: '#666' }}>Konumun kontrol ediliyor...</Text>
      </View>
    );
  }

  if (locationError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 30 }}>
        <Text style={{ fontSize: 40, marginBottom: 15 }}>📍</Text>
        <Text style={{ textAlign: 'center', color: '#666', marginBottom: 20 }}>{locationError}</Text>
        <TouchableOpacity
          style={{ backgroundColor: '#FF69B4', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 }}
          onPress={() => checkLocation(currentUser)}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isNearVenue) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 30 }}>
        <Text style={{ fontSize: 40, marginBottom: 15 }}>🚫</Text>
        <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#333', marginBottom: 8, textAlign: 'center' }}>
          Bu sohbete katılamazsın
        </Text>
        <Text style={{ textAlign: 'center', color: '#666', marginBottom: 6 }}>
          {item.name} sohbetine sadece mekanda bulunanlar katılabilir.
        </Text>
        {distance != null && (
          <Text style={{ textAlign: 'center', color: '#999', fontSize: 13, marginBottom: 20 }}>
            Şu an mekana yaklaşık {distance} metre uzaktasın (izin verilen: {PROXIMITY_METERS}m).
          </Text>
        )}
        <TouchableOpacity
          style={{ backgroundColor: '#FF69B4', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 }}
          onPress={() => checkLocation(currentUser)}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Konumu Yeniden Kontrol Et</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- Sohbet ekranı (konum doğrulandı) ---
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={{ paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3D9E4', backgroundColor: '#FFF5F7' }}>
        <Text style={{ fontWeight: 'bold', color: '#333', fontSize: 15 }}>{item.name} — Anlık Sohbet 💬</Text>
        <Text style={{ color: '#999', fontSize: 11 }}>Sadece şu an mekanda olanlar görebilir ve yazabilir · son {HISTORY_HOURS} saat</Text>
      </View>

      {loadingMessages ? (
        <ActivityIndicator color="#FF69B4" style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(msg) => msg.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 15, paddingBottom: 20 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', color: '#999', marginTop: 30 }}>
              Henüz kimse yazmamış, ilk mesajı sen at! 👋
            </Text>
          }
          renderItem={({ item: msg }) => {
  const isMine = currentUser && msg.user_id === currentUser.id;

  const messageTime = msg.created_at
    ? new Date(msg.created_at).toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <View
      style={{
        alignSelf: isMine ? 'flex-end' : 'flex-start',
        backgroundColor: isMine ? '#FF69B4' : '#F3F3F3',
        borderRadius: 14,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginBottom: 8,
        maxWidth: '78%',
      }}
    >
      {!isMine && (
        <Text
          style={{
            fontSize: 11,
            fontWeight: 'bold',
            color: msg.is_anonymous ? '#999' : '#DB7093',
            marginBottom: 2,
          }}
        >
          {msg.display_name}
        </Text>
      )}

      <Text
        style={{
          color: isMine ? '#fff' : '#333',
          fontSize: 14,
        }}
      >
        {msg.message}
      </Text>

      <Text
        style={{
          color: isMine ? '#FFE4E1' : '#999',
          fontSize: 10,
          textAlign: 'right',
          marginTop: 4,
        }}
      >
        {messageTime}
      </Text>
    </View>
  );
}}
        />
      )}

      {/* Mesaj Yazma Alanı */}
      <View style={{ borderTopWidth: 1, borderTopColor: '#F3D9E4', padding: 10 }}>
        <TouchableOpacity
          onPress={() => setSendAnonymous(!sendAnonymous)}
          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
        >
          <View
            style={{
              width: 18, height: 18, borderRadius: 4, borderWidth: 2,
              borderColor: '#FF69B4', marginRight: 8,
              backgroundColor: sendAnonymous ? '#FF69B4' : 'transparent',
            }}
          />
          <Text style={{ fontSize: 12, color: '#666' }}>
            {sendAnonymous ? `Anonim olarak gönderiliyor (${anonName})` : 'Anonim olarak gönder'}
          </Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput
            style={{
              flex: 1, backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#FFE4E1',
              borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, fontSize: 14,
            }}
            placeholder="Bir şeyler yaz..."
            value={messageText}
            onChangeText={setMessageText}
            multiline
          />
          <TouchableOpacity
            style={{
              backgroundColor: '#FF69B4', width: 42, height: 42, borderRadius: 21,
              justifyContent: 'center', alignItems: 'center', opacity: isSending ? 0.6 : 1,
            }}
            onPress={handleSend}
            disabled={isSending}
          >
            {isSending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontSize: 16 }}>➤</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}