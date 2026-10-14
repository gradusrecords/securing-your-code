import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { theme } from '../lib/theme';
import { setLanguage, type Language } from '../i18n';

export function Screen({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={s.screen}>
      {title ? <Text style={s.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

export function Button({ label, onPress, filled = false, testID }: { label: string; onPress: () => void; filled?: boolean; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[s.btn, filled && s.btnFilled]} accessibilityRole="button">
      <Text style={[s.btnText, filled && s.btnTextFilled]}>{label}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps) {
  return <TextInput placeholderTextColor="#6b665c" style={s.input} autoCapitalize="none" {...props} />;
}

export function LangSwitch() {
  return (
    <View style={s.lang}>
      {(['ru', 'uz', 'en'] as Language[]).map((l) => (
        <Pressable key={l} onPress={() => setLanguage(l)} accessibilityRole="button">
          <Text style={s.langText}>{l.toUpperCase()}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const ErrorText = ({ text }: { text: string }) => (text ? <Text style={s.error}>{text}</Text> : null);

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.black, padding: 24, paddingTop: 64 },
  title: { color: theme.colors.gold, fontSize: 32, marginBottom: 16, fontWeight: '300' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: theme.colors.cream, opacity: 0.7, fontSize: 16, textAlign: 'center' },
  btn: { borderWidth: 1, borderColor: theme.colors.gold, paddingVertical: 14, alignItems: 'center', marginVertical: 6 },
  btnFilled: { backgroundColor: theme.colors.gold },
  btnText: { color: theme.colors.gold, letterSpacing: 2, textTransform: 'uppercase', fontSize: 12 },
  btnTextFilled: { color: theme.colors.black },
  input: { borderBottomWidth: 1, borderBottomColor: theme.colors.gold, color: theme.colors.cream, fontSize: 16, paddingVertical: 10, marginBottom: 14 },
  lang: { flexDirection: 'row', gap: 14, justifyContent: 'center', marginTop: 24 },
  langText: { color: theme.colors.gold, letterSpacing: 2 },
  error: { color: '#E8A08A', marginBottom: 8 },
});
