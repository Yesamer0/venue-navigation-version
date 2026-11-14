import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
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

function isValidDate(value) {
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export default function VenueCampaign({
  venueId, canManage, manageExisting = false, venueName, onClose, onSaved, refreshVersion,
}) {
  const cardEditor = Boolean(onClose);
  const managesSchedule = canManage && (manageExisting || cardEditor);
  const [campaign, setCampaign] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [retry, setRetry] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [photoDraft, setPhotoDraft] = useState(undefined);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const submitting = useRef(false);
  const revision = useRef(0);

  const openEditor = useCallback((current) => {
    setTitle(current?.title ?? '');
    setDescription(current?.description ?? '');
    setStartsOn(current?.starts_on ?? '');
    setEndsOn(current?.ends_on ?? '');
    setPhotoDraft(undefined);
    setSaveError('');
    setConfirmRemoval(false);
    setEditing(true);
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    const load = async () => {
      const loadRevision = revision.current;
      try {
        const { data, error } = await supabase.rpc('get_venue_campaign', {
          p_venue_id: String(venueId), p_manage: managesSchedule,
        });
        if (error) throw error;
        if (active && loadRevision === revision.current) {
          setCampaign(data);
          setLoadState('ready');
          if (cardEditor) openEditor(data);
        }
      } catch {
        if (active && loadRevision === revision.current) setLoadState('error');
      }
    };
    setLoadState('loading');
    void load();
    const timer = !canManage ? setInterval(load, 30_000) : null;
    return () => {
      active = false;
      if (timer !== null) clearInterval(timer);
    };
  }, [venueId, retry, managesSchedule, cardEditor, openEditor, canManage, refreshVersion]));

  const pickPhoto = async () => {
    setPicking(true);
    setSaveError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
      if (result.canceled) return;
      const asset = result.assets[0];
      const context = ImageManipulator.manipulate(asset.uri);
      try {
        context.resize(asset.width >= asset.height ? { width: 420 } : { height: 420 });
        const image = await context.renderAsync();
        try {
          const jpeg = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.65, base64: true });
          if (Platform.OS === 'web') URL.revokeObjectURL(jpeg.uri);
          if (!jpeg.base64 || jpeg.base64.length > 131072) throw new Error('Invalid photo size');
          setPhotoDraft(jpeg.base64);
        } finally {
          image.release();
        }
      } finally {
        context.release();
      }
    } catch {
      setSaveError('Fotoğraf hazırlanamadı. Başka bir fotoğraf seç.');
    } finally {
      setPicking(false);
    }
  };

  const save = async (remove = false) => {
    if (submitting.current || picking || !canManage) return;
    const nextTitle = title.trim();
    const nextDescription = description.trim();
    if (!remove && (!nextTitle || !nextDescription)) {
      setSaveError('Başlık ve kampanya açıklamasını yaz.');
      return;
    }
    if (!remove && (!isValidDate(startsOn) || !isValidDate(endsOn) || startsOn > endsOn)) {
      setSaveError('Geçerli bir başlangıç ve bitiş tarihi gir (YYYY-AA-GG).');
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
        p_photo_base64: photoDraft ?? null,
        p_replace_photo: photoDraft !== undefined,
        p_existing_only: manageExisting || Boolean(campaign),
        p_starts_on: remove ? null : startsOn,
        p_ends_on: remove ? null : endsOn,
      });
      if (error) throw error;
      revision.current += 1;
      setCampaign(data);
      setLoadState('ready');
      setEditing(false);
      setExpanded(false);
      setConfirmRemoval(false);
      onSaved?.();
      onClose?.();
    } catch {
      setSaveError(remove ? 'Kampanya silinemedi. Tekrar dene.' : 'Kampanya kaydedilemedi. Tekrar dene.');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  const busy = saving || picking;
  const previewPhoto = photoDraft === undefined ? campaign?.photo_base64 : photoDraft;
  const photoSource = photo => ({ uri: `data:image/jpeg;base64,${photo}` });
  const range = campaign?.starts_on
    ? [campaign.starts_on, campaign.ends_on].map(date => date.split('-').reverse().join('.')).join(' – ')
    : 'Tarih belirtilmedi';

  return (
    <>
      {cardEditor && !editing && (
        <View style={styles.actions}>
          {loadState === 'loading' && <ActivityIndicator color={palette.accent} />}
          <CampaignButton onPress={onClose}>Vazgeç</CampaignButton>
        </View>
      )}
      {!cardEditor && campaign && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(value => !value)}
          style={styles.banner}
        >
          {campaign.photo_base64 ? (
            <Image source={photoSource(campaign.photo_base64)} style={styles.thumbnail} />
          ) : <Text style={styles.icon} accessible={false}>%</Text>}
          <View style={styles.copy}>
            {manageExisting && <Text style={styles.venueName}>{venueName}</Text>}
            <Text style={styles.title} numberOfLines={expanded ? undefined : 1}>{campaign.title}</Text>
            {manageExisting
              ? <Text style={styles.description}>{range}</Text>
              : <Text style={styles.description} numberOfLines={expanded ? undefined : 2}>{campaign.description}</Text>}
            {manageExisting && expanded && <Text style={styles.description}>{campaign.description}</Text>}
          </View>
          <Text style={styles.action} accessible={false}>{expanded ? '−' : '+'}</Text>
        </TouchableOpacity>
      )}
      {loadState === 'error' && (canManage || !campaign) && (
        <CampaignButton onPress={() => setRetry(value => value + 1)}>
          Kampanya yüklenemedi · Tekrar dene
        </CampaignButton>
      )}
      {manageExisting && expanded && canManage && campaign && loadState === 'ready' && !editing && !confirmRemoval && (
        <View style={styles.actions}>
          <CampaignButton onPress={() => openEditor(campaign)}>Düzenle</CampaignButton>
          <CampaignButton onPress={() => {
            setSaveError('');
            setConfirmRemoval(true);
          }}>Sil</CampaignButton>
        </View>
      )}
      {canManage && confirmRemoval && (
        <View style={styles.editor}>
          <Text style={styles.description}>{venueName ? `${venueName} kampanyası silinsin mi?` : 'Kampanya kafe sayfasından silinsin mi?'}</Text>
          {!!saveError && <Text accessibilityLiveRegion="polite" style={styles.action}>{saveError}</Text>}
          <View style={styles.actions}>
            <CampaignButton disabled={busy} onPress={() => save(true)}>{saving ? 'Siliniyor…' : 'Sil'}</CampaignButton>
            <CampaignButton disabled={busy} onPress={() => setConfirmRemoval(false)}>Vazgeç</CampaignButton>
          </View>
        </View>
      )}
      {canManage && editing && (
        <View style={styles.editor}>
          <Text style={styles.title}>{campaign || manageExisting ? 'Kampanyayı düzenle' : 'Kampanya oluştur'}</Text>
          <TextInput
            accessibilityLabel="Kampanya başlığı"
            placeholder="Kampanya başlığı"
            placeholderTextColor={palette.muted}
            maxLength={60}
            value={title}
            onChangeText={setTitle}
            editable={!busy}
            style={styles.input}
          />
          <TextInput
            accessibilityLabel="Kampanya açıklaması"
            placeholder="Kampanya açıklaması"
            placeholderTextColor={palette.muted}
            maxLength={180}
            value={description}
            onChangeText={setDescription}
            editable={!busy}
            multiline
            style={[styles.input, styles.multiline]}
          />
          <View style={styles.dates}>
            {[
              ['Başlangıç tarihi', startsOn, setStartsOn],
              ['Bitiş tarihi', endsOn, setEndsOn],
            ].map(([label, value, setValue]) => (
              <View key={label} style={styles.copy}>
                <Text style={styles.description}>{label}</Text>
                <TextInput
                  accessibilityLabel={label}
                  placeholder="YYYY-AA-GG"
                  placeholderTextColor={palette.muted}
                  autoCorrect={false}
                  maxLength={10}
                  value={value}
                  onChangeText={setValue}
                  editable={!busy}
                  style={styles.input}
                />
              </View>
            ))}
          </View>
          {!!previewPhoto && <Image source={photoSource(previewPhoto)} style={styles.preview} />}
          <View style={styles.actions}>
            <CampaignButton disabled={busy} onPress={pickPhoto}>
              {picking ? 'Fotoğraf hazırlanıyor…' : previewPhoto ? 'Fotoğrafı değiştir' : 'Fotoğraf ekle'}
            </CampaignButton>
            {!!previewPhoto && <CampaignButton disabled={busy} onPress={() => setPhotoDraft(null)}>Fotoğrafı kaldır</CampaignButton>}
          </View>
          {!!saveError && <Text accessibilityLiveRegion="polite" style={styles.action}>{saveError}</Text>}
          <View style={styles.actions}>
            <CampaignButton disabled={busy} onPress={() => save()}>
              {saving ? 'Kaydediliyor…' : campaign || manageExisting ? 'Kaydet' : 'Yayınla'}
            </CampaignButton>
            <CampaignButton disabled={busy} onPress={onClose || (() => setEditing(false))}>Vazgeç</CampaignButton>
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
  thumbnail: { width: 48, height: 48, borderRadius: 9 },
  preview: { width: 130, height: 96, borderRadius: 9 },
  venueName: { color: palette.accentPressed, fontWeight: '700', marginBottom: 5 },
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
  dates: { flexDirection: 'row', gap: 8 },
});
