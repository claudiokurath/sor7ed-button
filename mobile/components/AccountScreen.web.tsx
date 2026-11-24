import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { ACCOUNT_URL } from '@/lib/account-navigation';

// The website prevents framing. Use its real first-party account, not an iframe
// or an imitation local session, in Expo's optional browser preview.
export default function AccountScreen() {
  const [error, setError] = React.useState('');
  return <View style={styles.root}>
    <Text style={styles.title}>YOUR SOR7ED ACCOUNT</Text>
    <Text style={styles.body}>Your links, WhatsApp connection and account settings, together in one place.</Text>
    <Pressable accessibilityRole="link" style={styles.button} onPress={() => {
      setError('');
      void Linking.openURL(ACCOUNT_URL).catch(() => setError('Could not open your account. Please try again.'));
    }}><Text style={styles.buttonText}>OPEN MY ACCOUNT</Text></Pressable>
    <Text style={styles.body}>Sign in with WhatsApp. Your existing saves are already there.</Text>
    {error ? <Text accessibilityRole="alert" style={styles.body}>{error}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, justifyContent: 'center', gap: 24, backgroundColor: '#000' },
  title: { fontFamily: 'Anton', color: '#FFBA2E', fontSize: 32 },
  body: { color: '#ccc', fontSize: 16, lineHeight: 24 },
  button: { backgroundColor: '#FFBA2E', padding: 18, alignSelf: 'flex-start' },
  buttonText: { color: '#000', fontWeight: '700' },
});
