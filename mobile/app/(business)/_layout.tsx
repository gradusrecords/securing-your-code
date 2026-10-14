import { Tabs } from 'expo-router';
import { t } from '../../src/i18n';
import { theme } from '../../src/lib/theme';

export default function Layout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { backgroundColor: theme.colors.black, borderTopColor: theme.colors.green2 }, tabBarActiveTintColor: theme.colors.gold, tabBarInactiveTintColor: '#8E887D' }}>
      <Tabs.Screen name="orders" options={{ title: t('tab.orders') }} />
      <Tabs.Screen name="catalog" options={{ title: t('tab.catalog') }} />
      <Tabs.Screen name="ideas" options={{ title: t('tab.ideas') }} />
    </Tabs>
  );
}
