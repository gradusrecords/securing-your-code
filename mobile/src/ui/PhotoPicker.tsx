import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadPhoto } from '../services/modelCardService';
import { supabase } from '../lib/supabase';
import { t } from '../i18n';
import { theme } from '../lib/theme';
import { Button } from './kit';

const MAX_PHOTOS = 6;

export function PhotoPicker({ photos, onChange }: { photos: string[]; onChange: (p: string[]) => void }) {
  const [error, setError] = useState('');

  const add = async () => {
    setError('');
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (res.canceled || !res.assets?.[0]) return;
      const path = await uploadPhoto(res.assets[0].uri, `${Date.now()}.jpg`);
      onChange([...photos, path]);
    } catch (e) {
      setError((e as Error).message || t('error.generic'));
    }
  };

  const urlFor = (path: string) => supabase.storage.from('model-photos').getPublicUrl(path).data.publicUrl;

  return (
    <View>
      <Text style={s.label}>{t('profile.photos')}</Text>
      <View style={s.row}>
        {photos.map((p) => (
          <Pressable key={p} onPress={() => onChange(photos.filter((x) => x !== p))}>
            <Image source={{ uri: urlFor(p) }} style={s.thumb} />
          </Pressable>
        ))}
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
      {photos.length < MAX_PHOTOS ? <Button label={t('profile.add_photo')} onPress={add} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  label: { color: theme.colors.gold, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginTop: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  thumb: { width: 72, height: 96, backgroundColor: theme.colors.green },
  error: { color: '#E8A08A' },
});
