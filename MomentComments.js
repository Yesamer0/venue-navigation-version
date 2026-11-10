import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from './supabase';

export default function MomentComments({ momentId }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [more, setMore] = useState(false);
  const requestId = useRef(null);
  const lock = useRef(false);
  const generation = useRef(0);
  const load = useCallback(async (append = false) => {
    const version = ++generation.current;
    setLoading(true); setError('');
    try {
      const { data, error: failure } = await supabase.rpc('list_venue_moment_comments', {
        p_moment_id: momentId, p_offset: append ? comments.length : 0, p_limit: 20,
      });
      if (failure) throw failure;
      if (version !== generation.current) return;
      setComments(previous => append ? [...previous, ...(data || []).filter(c => !previous.some(old => old.id === c.id))] : data || []);
      setMore(data?.length === 20);
    } catch (failure) { if (version === generation.current) setError(failure.message || 'Yorumlar yüklenemedi.'); }
    finally { if (version === generation.current) setLoading(false); }
  }, [momentId, comments.length]);
  const loadRef = useRef(load); loadRef.current = load;
  useFocusEffect(useCallback(() => {
    if (!open) return;
    loadRef.current();
    const timer = setInterval(() => loadRef.current(), 30000);
    return () => { clearInterval(timer); generation.current++; };
  }, [open, momentId]));

  const send = async () => {
    if (lock.current || !text.trim()) return;
    lock.current = true; setSending(true); setError('');
    requestId.current ||= `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const { error: failure } = await supabase.rpc('add_venue_moment_comment', {
        p_moment_id: momentId, p_body: text.trim(), p_request_id: requestId.current,
      });
      if (failure) throw failure;
      setText(''); requestId.current = null;
      await loadRef.current();
    } catch (failure) { setError(failure.message || 'Yorum gönderilemedi. Yazdığın yorum korunuyor.'); }
    finally { lock.current = false; setSending(false); }
  };
  const remove = comment => Alert.alert('Yorumu sil', 'Yorumun bu fotoğrafın tüm görünümlerinden kaldırılacak.', [
    { text: 'Vazgeç', style: 'cancel' }, { text: 'Sil', style: 'destructive', onPress: async () => {
      if (lock.current) return;
      lock.current = true;
      try {
        const { data, error: failure } = await supabase.from('venue_moment_comments').delete().eq('id', comment.id).select('id');
        if (failure) throw failure;
        if (!data?.length) throw new Error('Yalnızca kendi yorumunu silebilirsin.');
        setComments(previous => previous.filter(c => c.id !== comment.id));
      } catch (failure) { setError(failure.message); }
      finally { lock.current = false; }
    } },
  ]);
  return <View style={{ borderTopWidth: 1, borderColor: '#F3E4EB', paddingTop: 6 }}>
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)}>
      <Text style={{ color: '#9B1B4D', fontWeight: '600', paddingVertical: 12 }}>💬 {open ? 'Yorumları kapat' : 'Yorumlar'}</Text>
    </TouchableOpacity>
    {open && <>
      <TextInput accessibilityLabel="Fotoğrafa yorum yaz" placeholder="Bu fotoğrafa yorum yaz…" value={text}
        onChangeText={value => { setText(value); requestId.current = null; }} maxLength={500} multiline editable={!sending}
        style={{ backgroundColor: '#FFF8FB', borderRadius: 12, borderWidth: 1, borderColor: '#E8CFDB', padding: 12, minHeight: 60 }} />
      <TouchableOpacity accessibilityRole="button" disabled={sending || !text.trim()} onPress={send}>
        <Text style={{ color: '#9B1B4D', fontWeight: '700', paddingVertical: 12, opacity: sending || !text.trim() ? 0.5 : 1 }}>{sending ? 'Gönderiliyor…' : 'Yorumu gönder'}</Text>
      </TouchableOpacity>
      {!!error && <Text accessibilityRole="alert" style={{ color: '#B42318', paddingVertical: 8 }}>{error}</Text>}
      <TouchableOpacity accessibilityRole="button" disabled={loading} onPress={() => load()}><Text style={{ color: '#9B1B4D', paddingVertical: 8 }}>Yorumları yenile</Text></TouchableOpacity>
      {!loading && !comments.length && !error && <Text style={{ color: '#777', paddingVertical: 10 }}>İlk yorumu sen yaz.</Text>}
      {comments.map(comment => <View key={comment.id} style={{ backgroundColor: '#FFF8FB', padding: 12, borderRadius: 12, marginBottom: 8 }}>
        <Text style={{ color: '#9B1B4D', fontWeight: '700' }}>@{comment.username}</Text>
        <Text style={{ color: '#333', lineHeight: 21, marginTop: 6 }}>{comment.body}</Text>
        {comment.is_mine && <TouchableOpacity accessibilityRole="button" onPress={() => remove(comment)}><Text style={{ color: '#777', paddingTop: 10 }}>Yorumumu sil</Text></TouchableOpacity>}
      </View>)}
      {loading && <ActivityIndicator color="#9B1B4D" />}
      {more && !loading && <TouchableOpacity onPress={() => load(true)}><Text style={{ color: '#9B1B4D', paddingVertical: 12 }}>Daha fazla yorum</Text></TouchableOpacity>}
    </>}
  </View>;
}
