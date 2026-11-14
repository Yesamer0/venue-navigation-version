import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from './supabase';
import { palette } from './theme';

function CampaignButton({ children, onPress, disabled }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && styles.disabled]}
    >
      <Text style={styles.action}>{children}</Text>
    </TouchableOpacity>
  );
}

export default function VenueCampaign({ venueId, canManage }) {
  const [campaign, setCampaign] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [retry, setRetry] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const submitting = useRef(false);
  const revision = useRef(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    const loadRevision = revision.current;
    const load = async () => {
      setLoadState('loading');
      try {
        const { data, error } = await supabase.rpc('get_venue_campaign', { p_venue_id: String(venueId) });
        if (error) throw error;
        if (active && loadRevision === revision.current) {
          setCampaign(data);
          setLoadState('ready');
        }
      } catch {
        if (active && loadRevision === revision.current) setLoadState('error');
      }
    };
    void load();
    return () => { active = false; };
  }, [venueId, retry]));

  const openEditor = () => {
    setTitle(campaign?.title ?? '');
    setDescription(campaign?.description ?? '');
    setSaveError('');
    setConfirmRemoval(false);
    setEditing(true);
  };

  const save = async (remove = false) => {
    if (submitting.current || !canManage) return;
    const nextTitle = title.trim();
    const nextDescription = description.trim();
    if (!remove && (!nextTitle || !nextDescription)) {
      setSaveError('Başlık ve kampanya açıklamasını yaz.');
      return;
    }

    submitting.current = true;
    setSaving(true);
    setSaveError('');
    try {
      const { data, error } = await supabase.rpc('set_venue_campaign', {
        p_venue_id: String(venueId),
        p_title: remove ? null : nextTitle,
        p_description: remove ? null : nextDescription,
      });
      if (error) throw error;
      revision.current += 1;
      setCampaign(data);
      setLoadState('ready');
      setEditing(false);
      setExpanded(false);
      setConfirmRemoval(false);
    } catch {
      setSaveError('Kampanya kaydedilemedi. Tekrar dene.');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <>
      {campaign && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(value => !value)}
          style={styles.banner}
        >
          <Text style={styles.icon} accessible={false}>%</Text>
          <View style={styles.copy}>
            <Text style={styles.title} numberOfLines={expanded ? undefined : 1}>{campaign.title}</Text>
            <Text style={styles.description} numberOfLines={expanded ? undefined : 2}>
              {campaign.description}
            </Text>
          </View>
          <Text style={styles.action} accessible={false}>{expanded ? '−' : '+'}</Text>
        </TouchableOpacity>
      )}
      {loadState === 'error' && (
        <CampaignButton onPress={() => setRetry(value => value + 1)}>
          Kampanya yüklenemedi · Tekrar dene
        </CampaignButton>
      )}
      {canManage && loadState === 'ready' && !editing && (
        <CampaignButton onPress={openEditor}>
          {campaign ? 'Kampanyayı düzenle' : '+ Kampanya oluştur'}
        </CampaignButton>
      )}
      {canManage && editing && (
        <View style={styles.editor}>
          <Text style={styles.title}>{campaign ? 'Kampanyayı düzenle' : 'Kampanya oluştur'}</Text>
          <TextInput
            accessibilityLabel="Kampanya başlığı"
            placeholder="Kampanya başlığı"
            placeholderTextColor={palette.muted}
            maxLength={60}
            value={title}
            onChangeText={setTitle}
            editable={!saving}
            style={styles.input}
          />
          <TextInput
            accessibilityLabel="Kampanya açıklaması"
            placeholder="Kampanya açıklaması"
            placeholderTextColor={palette.muted}
            maxLength={180}
            value={description}
            onChangeText={setDescription}
            editable={!saving}
            multiline
            style={[styles.input, styles.multiline]}
          />
          {!!saveError && <Text accessibilityLiveRegion="polite" style={styles.action}>{saveError}</Text>}
          {confirmRemoval && <Text style={styles.description}>Kampanya kafe sayfasından kaldırılsın mı?</Text>}
          <View style={styles.actions}>
            {confirmRemoval ? (
              <CampaignButton disabled={saving} onPress={() => save(true)}>{saving ? 'Kaldırılıyor…' : 'Kaldır'}</CampaignButton>
            ) : (
              <CampaignButton disabled={saving} onPress={() => save()}>{saving ? 'Kaydediliyor…' : 'Yayınla'}</CampaignButton>
            )}
            <CampaignButton disabled={saving} onPress={() => {
              if (confirmRemoval) setConfirmRemoval(false);
              else setEditing(false);
              setSaveError('');
            }}>Vazgeç</CampaignButton>
            {campaign && !confirmRemoval && (
              <CampaignButton disabled={saving} onPress={() => {
                setSaveError('');
                setConfirmRemoval(true);
              }}>Kampanyayı kaldır</CampaignButton>
            )}
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, marginBottom: 10,
    borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.blush,
  },
  icon: {
    color: palette.accentPressed, backgroundColor: palette.roseTint, fontWeight: '800',
    borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5,
  },
  copy: { flex: 1 },
  title: { color: palette.ink, fontWeight: '800', fontSize: 15 },
  description: { color: palette.muted, fontSize: 13 },
  action: { color: palette.accentPressed, fontWeight: '700', fontSize: 13 },
  button: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 8 },
  disabled: { opacity: 0.5 },
  editor: {
    gap: 8, padding: 12, marginBottom: 12, borderRadius: 14, borderWidth: 1,
    borderColor: palette.border, backgroundColor: palette.surface,
  },
  input: {
    color: palette.ink, borderColor: palette.border, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, minHeight: 44,
  },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
});
