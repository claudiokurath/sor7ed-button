import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { screenStyles } from '@/components/Screen';
import { useLibrary } from '@/context/LibraryContext';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';

export default function AddLinkScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addLink, isLoaded } = useLibrary();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleSave = () => {
    setError('');
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError('Add a web address first.');
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(
        /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`,
      );
    } catch {
      setError('Enter a valid website address.');
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      setError('Only web links can be saved.');
      return;
    }
    const normalizedUrl = parsed.toString();
    addLink({
      url: normalizedUrl,
      title: title.trim() || parsed.hostname.replace(/^www\./, ''),
      note: note.trim(),
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        bottomOffset={24}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: topInset + 14,
            paddingBottom: bottomInset + 28,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          testID="back-from-add"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: colors.background, borderColor: colors.input },
            pressed && styles.pressed,
          ]}
        >
          <Feather name="arrow-left" size={19} color={colors.foreground} />
        </Pressable>

        <View style={styles.header}>
          <Text style={[screenStyles.eyebrow, { color: colors.primary }]}>
            SAVE FOR LATER
          </Text>
          <Text style={[screenStyles.title, { color: colors.foreground }]}>
            Add a link.
          </Text>
          <Text style={[screenStyles.subtitle, { color: colors.mutedForeground }]}>
            Keep the good stuff close. You can add a note to remember why it
            matters.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              Website address
            </Text>
            <View
              style={[
                styles.inputWrap,
                { backgroundColor: colors.muted, borderColor: colors.input },
              ]}
            >
              <Feather name="link" size={17} color={colors.mutedForeground} />
              <TextInput
                accessibilityLabel="Website address"
                testID="link-url"
                value={url}
                onChangeText={(value) => {
                  setUrl(value);
                  setError('');
                }}
                placeholder="example.com/article"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="next"
                style={[styles.input, { color: colors.foreground }]}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              Title <Text style={{ color: colors.mutedForeground }}>· optional</Text>
            </Text>
            <TextInput
              accessibilityLabel="Link title"
              testID="link-title"
              value={title}
              onChangeText={setTitle}
              placeholder="A name you’ll recognize"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="next"
              style={[
                styles.textInput,
                { backgroundColor: colors.muted, borderColor: colors.input, color: colors.foreground },
              ]}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              Note <Text style={{ color: colors.mutedForeground }}>· optional</Text>
            </Text>
            <TextInput
              accessibilityLabel="Personal note"
              testID="link-note"
              value={note}
              onChangeText={setNote}
              placeholder="What do you want to remember?"
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
              style={[
                styles.noteInput,
                { backgroundColor: colors.muted, borderColor: colors.input, color: colors.foreground },
              ]}
            />
          </View>
        </View>

        {error ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>
            {error}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          testID="save-link-submit"
          onPress={handleSave}
          disabled={!isLoaded}
          style={({ pressed }) => [
            styles.saveButton,
             { backgroundColor: colors.primary, borderColor: colors.primary },
            (!isLoaded || pressed) && styles.pressed,
          ]}
        >
          {!isLoaded ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Feather name="bookmark" size={17} color={colors.primaryForeground} />
          )}
          <Text style={[styles.saveButtonText, { color: colors.primaryForeground }]}>
            {isLoaded ? 'Save link' : 'Loading library…'}
          </Text>
        </Pressable>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 20, gap: 24 },
  backButton: {
    width: 46,
    height: 46,
    borderWidth: 1,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.72 },
  header: { gap: 8 },
  form: { gap: 18 },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '700' },
  inputWrap: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 12 },
  textInput: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  noteInput: {
    minHeight: 106,
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingTop: 13,
    fontSize: 15,
  },
  error: { fontSize: 13, fontWeight: '600' },
  saveButton: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 'auto',
  },
  saveButtonText: { fontSize: 15, fontWeight: '700' },
});
