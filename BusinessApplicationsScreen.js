import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from './supabase';
import { signOutVenue } from './authService';
import { businessSignupFields } from './businessSignup';
import { palette } from './theme';

const sections = [
  { title: 'Bekleyenler', statuses: ['pending'] },
  { title: 'Düzeltme Bekleyenler', statuses: ['changes'] },
  { title: 'Sonuçlananlar', statuses: ['approved', 'rejected'] },
];
const labels = { pending: 'Onay bekliyor', changes: 'Eksik bilgi istendi', approved: 'Onaylandı', rejected: 'Reddedildi' };

export default function BusinessApplicationsScreen() {
  const [section, setSection] = useState(0);
  const [applications, setApplications] = useState([]);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);

  const run = useCallback(async (action) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    try { await action(); }
    catch { setMessage('İşlem tamamlanamadı. Yenileyip tekrar dene.'); }
    finally { lock.current = false; setBusy(false); }
  }, []);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('list_business_applications');
    if (error) throw error;
    setApplications(data);
  }, []);

  useEffect(() => { void run(load); }, [run, load]);

  const review = (application, status) => {
    if (status === 'changes' && !feedback.trim()) {
      setMessage('İşletmenin tamamlaması gereken bilgiyi yaz.');
      return;
    }
    void run(async () => {
      const { error } = await supabase.rpc('review_business_application', {
        p_id: application.id, p_status: status, p_feedback: feedback.trim(),
      });
      if (error) throw error;
      setSelected(null);
      setFeedback('');
      await load();
      setMessage(labels[status]);
    });
  };

  const sendSetupCode = (applicationId) => run(async () => {
    const { error } = await supabase.functions.invoke('approve-business-setup', { body: { applicationId } });
    if (error) {
      const response = await error.context?.json().catch(() => null);
      if (response?.message) {
        setMessage(response.message);
        return;
      }
      throw error;
    }
    setMessage('Hesap kurulum kodu gönderildi.');
  });

  const sendFeedback = (application) => {
    const subject = 'VENUE işletme başvurusu — ' + labels[application.status];
    const body = application.feedback || labels[application.status];
    Linking.openURL('mailto:' + encodeURIComponent(application.email) + '?subject=' +
      encodeURIComponent(subject) + '&body=' + encodeURIComponent(body))
      .catch(() => Alert.alert('E-posta uygulaması açılamadı'));
  };

  const rows = applications.filter((application) => sections[section].statuses.includes(application.status));

  return <SafeAreaView style={styles.page}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={styles.title}>Başvurular</Text>
      <View style={styles.row}>
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => run(load)}><Text style={styles.link}>Yenile</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => run(signOutVenue)}><Text style={styles.link}>Çıkış yap</Text></TouchableOpacity>
      </View>
      <View style={styles.row}>
        {sections.map(({ title }, index) => (
          <TouchableOpacity key={title} accessibilityRole="tab" accessibilityState={{ selected: section === index }}
            disabled={busy} onPress={() => { setSection(index); setSelected(null); setFeedback(''); }}>
            <Text style={[styles.tab, section === index && styles.active]}>{title}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {!!message && <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}
      {busy && <Text>İşleniyor…</Text>}
      {!busy && rows.length === 0 && <Text style={styles.message}>Bu bölümde başvuru yok.</Text>}
      {rows.map((application) => (
        <View key={application.id} style={styles.card}>
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: selected === application.id }}
            disabled={busy} onPress={() => { setSelected(selected === application.id ? null : application.id); setFeedback(''); }}>
            <Text style={styles.name}>{application.details.sign_name}</Text>
            <Text>{labels[application.status]}</Text>
          </TouchableOpacity>
          {selected === application.id && <View style={styles.details}>
            <Text>{application.email}</Text>
            <Text>Başvuru: {new Date(application.created_at).toLocaleString('tr-TR')}</Text>
            {application.reviewed_at && <Text>Karar: {new Date(application.reviewed_at).toLocaleString('tr-TR')}</Text>}
            {businessSignupFields.filter(({ key }) => key !== 'sign_name').map(({ key, label }) => (
              <Text key={key}>{label}: {application.details[key] ?? '—'}</Text>
            ))}
            {application.status === 'approved' && <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => sendSetupCode(application.id)}>
              <Text style={styles.link}>Hesap kurulum kodu gönder</Text>
            </TouchableOpacity>}
            {!!application.feedback && <Text>Geri bildirim: {application.feedback}</Text>}
            {application.status === 'pending' ? <>
              <TextInput accessibilityLabel="Geri bildirim" placeholder="Geri bildirim" style={styles.input}
                editable={!busy} multiline maxLength={2000} value={feedback} onChangeText={setFeedback} />
              <View style={styles.row}>
                {[['approved', 'Onayla'], ['rejected', 'Reddet'], ['changes', 'Eksik Bilgi İste']].map(([status, label]) => (
                  <TouchableOpacity key={status} accessibilityRole="button" disabled={busy} onPress={() => review(application, status)}>
                    <Text style={styles.link}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </> : <TouchableOpacity accessibilityRole="button" onPress={() => sendFeedback(application)}>
              <Text style={styles.link}>E-posta taslağı aç</Text>
            </TouchableOpacity>}
          </View>}
        </View>
      ))}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.canvas },
  content: { padding: 20, gap: 14 },
  title: { fontSize: 28, color: palette.ink, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tab: { padding: 10, color: palette.ink, borderRadius: 8 },
  active: { backgroundColor: palette.blush, fontWeight: '700' },
  link: { paddingVertical: 10, color: palette.ink, fontWeight: '700' },
  message: { color: palette.ink },
  card: { backgroundColor: palette.surface, padding: 14, borderRadius: 12 },
  name: { fontSize: 16, fontWeight: '700', color: palette.ink },
  details: { marginTop: 12, gap: 8 },
  input: { borderWidth: 1, borderColor: palette.border, borderRadius: 8, minHeight: 72, padding: 10 },
});
