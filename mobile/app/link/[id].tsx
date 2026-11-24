import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, screenStyles } from '@/components/Screen';
import { SavedLink, useLibrary } from '@/context/LibraryContext';
import { useColors } from '@/hooks/useColors';

function domainFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function LinkDetailScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { links, updateLink, removeLink, toggleFavorite, isLoaded } =
    useLibrary();
  const item = links.find((link) => link.id === id);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!item) return;
    setTitle(item.title);
    setNote(item.note);
  }, [item?.id, item?.title, item?.note]);

  if (!isLoaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!item) {
    return (
      <Screen>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(tabs)')}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: colors.background, borderColor: colors.input },
            pressed && styles.pressed,
          ]}
        >
          <Feather name="arrow-left" size={19} color={colors.foreground} />
        </Pressable>
        <View style={styles.missing}>
          <Feather name="bookmark" size={28} color={colors.primary} />
          <Text style={[styles.title, { color: colors.foreground }]}>
            Link not found
          </Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            It may have been removed from this device.
          </Text>
        </View>
      </Screen>
    );
  }

  const saveEdits = () => {
    const safeTitle = title.trim() || domainFromUrl(item.url);
    updateLink({ ...item, title: safeTitle, note: note.trim() });
    setFeedback('Changes saved');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const openPage = async () => {
    setFeedback('');
    try {
      await Linking.openURL(item.url);
    } catch {
      setFeedback('This link could not be opened.');
    }
  };

  const deleteItem = () => {
    removeLink(item.id);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    router.replace('/(tabs)');
  };

  const isEdited = title.trim() !== item.title || note.trim() !== item.note;
  const savedDate = new Date(item.createdAt).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        testID="back-from-detail"
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
          SAVED {savedDate.toUpperCase()}
        </Text>
        <Text style={[screenStyles.title, { color: colors.foreground }]}>
          Your link.
        </Text>
        <Text style={[styles.domain, { color: colors.mutedForeground }]}>
          {domainFromUrl(item.url)}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          testID="open-saved-link"
          onPress={openPage}
          style={({ pressed }) => [
            styles.primaryButton,
           { backgroundColor: colors.primary, borderColor: colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <Feather name="external-link" size={17} color={colors.primaryForeground} />
          <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>
            Open page
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.favorite ? 'Unstar link' : 'Star link'}
          testID="toggle-link-favorite"
          onPress={() => toggleFavorite(item.id)}
          style={({ pressed }) => [
            styles.starButton,
            { backgroundColor: colors.background, borderColor: colors.input },
            pressed && styles.pressed,
          ]}
        >
          <Feather
            name="star"
            size={18}
            color={item.favorite ? colors.primary : colors.foreground}
            fill={item.favorite ? colors.accent : 'transparent'}
          />
        </Pressable>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>Title</Text>
        <TextInput
          accessibilityLabel="Saved link title"
          testID="edit-link-title"
          value={title}
          onChangeText={setTitle}
          style={[
            styles.textInput,
            { backgroundColor: colors.muted, borderColor: colors.input, color: colors.foreground },
          ]}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>Personal note</Text>
        <TextInput
          accessibilityLabel="Edit personal note"
          testID="edit-link-note"
          value={note}
          onChangeText={setNote}
          placeholder="Add a note to remember why you saved it"
          placeholderTextColor={colors.mutedForeground}
          multiline
          textAlignVertical="top"
          style={[
            styles.noteInput,
            { backgroundColor: colors.muted, borderColor: colors.input, color: colors.foreground },
          ]}
        />
      </View>

      <View
        style={[
          styles.urlCard,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      >
        <Feather name="link" size={16} color={colors.primary} />
        <Text numberOfLines={2} style={[styles.urlText, { color: colors.foreground }]}>
          {item.url}
        </Text>
      </View>

      {isEdited ? (
        <Pressable
          accessibilityRole="button"
          testID="save-link-edits"
          onPress={saveEdits}
          style={({ pressed }) => [
            styles.primaryButton,
             { backgroundColor: colors.primary, borderColor: colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <Feather name="check" size={17} color={colors.primaryForeground} />
          <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>
            Save changes
          </Text>
        </Pressable>
      ) : null}

      {feedback ? (
        <Text
          style={[
            styles.feedback,
            {
              color:
                feedback === 'This link could not be opened.'
                  ? colors.destructive
                  : colors.mutedForeground,
            },
          ]}
        >
          {feedback}
        </Text>
      ) : null}

      {!confirmDelete ? (
        <Pressable
          accessibilityRole="button"
          testID="delete-saved-link"
          onPress={() => setConfirmDelete(true)}
          style={({ pressed }) => [
            styles.deleteButton,
            { borderColor: colors.input },
            pressed && styles.pressed,
          ]}
        >
          <Feather name="trash-2" size={16} color={colors.destructive} />
          <Text style={[styles.deleteText, { color: colors.destructive }]}>
            Remove from library
          </Text>
        </Pressable>
      ) : (
        <View
          style={[
            styles.confirmBox,
            { backgroundColor: colors.secondary, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.confirmText, { color: colors.foreground }]}>
            Remove this saved link from your device?
          </Text>
          <View style={styles.confirmActions}>
            <Pressable
              accessibilityRole="button"
              testID="cancel-delete-link"
              onPress={() => setConfirmDelete(false)}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
            >
              <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>
                Keep it
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              testID="confirm-delete-link"
              onPress={deleteItem}
              style={({ pressed }) => [
                styles.deleteConfirm,
                   { backgroundColor: colors.destructive, borderColor: colors.destructive },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.deleteConfirmText, { color: colors.destructiveForeground }]}>
                Remove
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  title: { fontSize: 22, fontWeight: '700' },
  domain: { fontSize: 14, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10 },
  primaryButton: {
    minHeight: 46,
    flex: 1,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  primaryText: { fontSize: 14, fontWeight: '700' },
  starButton: {
    width: 46,
    height: 46,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '700' },
  textInput: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  noteInput: {
    minHeight: 108,
    borderWidth: 1,
    borderRadius: 0,
    padding: 14,
    fontSize: 15,
  },
  urlCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderRadius: 0,
  },
  urlText: { flex: 1, fontSize: 13, lineHeight: 19 },
  feedback: { fontSize: 13, textAlign: 'center' },
  deleteButton: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteText: { fontSize: 14, fontWeight: '600' },
  confirmBox: { borderWidth: 1, borderRadius: 0, padding: 18, gap: 12 },
  confirmText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  confirmActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  cancelText: { fontSize: 14, fontWeight: '700' },
  deleteConfirm: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 0,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  deleteConfirmText: { fontSize: 13, fontWeight: '700' },
  missing: { alignItems: 'center', gap: 10, paddingVertical: 60 },
  body: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
