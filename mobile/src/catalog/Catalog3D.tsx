import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { listCatalog } from '../services/catalogService';
import { supabase } from '../lib/supabase';
import { currentLanguage, t } from '../i18n';
import { catalogHtml } from './catalogHtml';
import { toCatalogPayload, type CatalogPayload } from './payload';
import { theme } from '../lib/theme';

async function signedUrls(models: Awaited<ReturnType<typeof listCatalog>>): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  await Promise.all(models.map(async (m) => {
    const urls = await Promise.all(m.photos.slice(0, 3).map(async (p) => {
      const { data } = await supabase.storage.from('model-photos').createSignedUrl(p, 3600);
      return data?.signedUrl ?? '';
    }));
    out[m.model_id] = urls.filter(Boolean);
  }));
  return out;
}

export function Catalog3D() {
  const [payload, setPayload] = useState<CatalogPayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const models = await listCatalog();
        const urls = await signedUrls(models);
        if (alive) setPayload(toCatalogPayload(models, urls));
      } catch {
        if (alive) setError(t('error.generic'));
      }
    })();
    return () => { alive = false; };
  }, []);

  if (error) return <Text style={{ color: '#E8A08A' }}>{error}</Text>;
  if (!payload) return <View style={{ flex: 1 }} />;

  const lang = currentLanguage() === 'uz' ? 'uz' : 'ru';
  const injected = `window.ZAYA_CATALOG=${JSON.stringify(payload).replace(/\u2028|\u2029/g, '')};try{localStorage.setItem('zaya-lang','${lang}')}catch(e){};true;`;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.black }}>
      <WebView
        originWhitelist={['*']}
        source={{ html: catalogHtml, baseUrl: 'https://zaya.local/' }}
        injectedJavaScriptBeforeContentLoaded={injected}
        javaScriptEnabled
        style={{ flex: 1, backgroundColor: theme.colors.black }}
      />
    </View>
  );
}
