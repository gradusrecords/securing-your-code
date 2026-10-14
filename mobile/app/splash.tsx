import { Text, View } from 'react-native';
import { theme } from '../src/lib/theme';
import { t } from '../src/i18n';

export default function Splash() {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.black, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: theme.colors.gold, fontSize: 40, letterSpacing: 12 }}>ZAYA</Text>
      <Text style={{ color: theme.colors.cream, marginTop: 12, fontStyle: 'italic' }}>{t('slogan')}</Text>
    </View>
  );
}
