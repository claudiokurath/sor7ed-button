import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ACCOUNT_URL, navigationTarget, whatsappTarget, WHATSAPP_BRIDGE } from '@/lib/account-navigation';

export default function AccountScreen() {
  const web = useRef<WebView<Record<never, never>>>(null);
  const insets = useSafeAreaInsets();
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(useCallback(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) return false;
      web.current?.goBack();
      return true;
    });
    return () => handler.remove();
  }, [canGoBack]));

  const openExternal = useCallback(async (url: string) => {
    if (navigationTarget(url) === 'blocked') return;
    setNotice('');
    try { await Linking.openURL(url); }
    catch { setNotice('Could not open that link. Check your connection and try again.'); }
  }, []);

  function onMessage(event: WebViewMessageEvent) {
    // The bridge is not an authentication channel. Only accept a WhatsApp launch
    // from our own pages, never account instructions from an arbitrary website.
    if (navigationTarget(event.nativeEvent.url) !== 'account') return;
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type !== 'sor7ed:whatsapp' || typeof message.url !== 'string') return;
      const target = whatsappTarget(message.url);
      if (target) void openExternal(target);
    } catch { /* Ignore unrecognized page messages. */ }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.toolbar}>
        <Text style={styles.heading}>YOUR SOR7ED ACCOUNT</Text>
        <Pressable accessibilityRole="button" onPress={() => void openExternal(ACCOUNT_URL)} style={styles.browserButton}>
          <Text style={styles.browserText}>OPEN IN BROWSER</Text>
        </Pressable>
      </View>
      {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
      {failed ? (
        <View style={styles.error}>
          <Text style={styles.heading}>LET’S RECONNECT</Text>
          <Text style={styles.body}>Your account could not load. Your saved items are still in your SOR7ED account.</Text>
          <Pressable accessibilityRole="button" style={styles.retry} onPress={() => { setFailed(false); setAttempt((value) => value + 1); }}>
            <Text style={styles.retryText}>TRY AGAIN</Text>
          </Pressable>
        </View>
      ) : (
        <WebView<Record<never, never>>
          ref={web}
          key={attempt}
          source={{ uri: ACCOUNT_URL }}
          style={styles.web}
          originWhitelist={['*']}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled={false}
          mixedContentMode="never"
          allowFileAccess={false}
          javaScriptCanOpenWindowsAutomatically
          injectedJavaScriptBeforeContentLoaded={WHATSAPP_BRIDGE}
          injectedJavaScript={WHATSAPP_BRIDGE}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={(request) => {
            const target = navigationTarget(request.url);
            if (target === 'external') void openExternal(request.url);
            return target === 'account';
          }}
          onOpenWindow={({ nativeEvent }) => {
            if (navigationTarget(nativeEvent.targetUrl) !== 'blocked') void openExternal(nativeEvent.targetUrl);
          }}
          onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
          onError={() => setFailed(true)}
          onHttpError={({ nativeEvent }) => { if (nativeEvent.statusCode >= 500) setFailed(true); }}
          startInLoadingState
          renderLoading={() => <View style={styles.loading}><ActivityIndicator color="#FFBA2E" accessibilityLabel="Loading your account" /></View>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingBottom: 70 },
  toolbar: { padding: 14, gap: 10, backgroundColor: '#141414', borderBottomWidth: 1, borderBottomColor: '#383838' },
  heading: { color: '#FFBA2E', fontFamily: 'Anton', fontSize: 20 },
  browserButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  browserText: { color: '#fff', fontSize: 12, textDecorationLine: 'underline' },
  web: { flex: 1, backgroundColor: '#000' },
  loading: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'center', backgroundColor: '#000' },
  error: { flex: 1, justifyContent: 'center', padding: 24, gap: 20 },
  body: { color: '#ccc', fontSize: 16, lineHeight: 24 },
  notice: { color: '#FFBA2E', padding: 12 },
  retry: { backgroundColor: '#FFBA2E', padding: 16, alignSelf: 'flex-start' },
  retryText: { color: '#000', fontWeight: '700' },
});
