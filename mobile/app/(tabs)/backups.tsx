import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Screen, screenStyles } from '@/components/Screen';
import { useLibrary } from '@/context/LibraryContext';
import { useColors } from '@/hooks/useColors';

function formatBackupDate(value: string | null) {
  if (!value) return 'No backup created yet';
  return `Last backup · ${new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

export default function BackupsScreen() {
  const colors = useColors();
  const { links, lastBackupAt, createBackup, restoreBackup, isLoaded } =
    useLibrary();
  const [backupText, setBackupText] = useState('');
  const [exportedText, setExportedText] = useState('');
  const [restoreCount, setRestoreCount] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const handleExport = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const json = createBackup();
      setExportedText(json);
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(json);
          setMessage('Backup copied. Save it somewhere safe.');
        } else {
          setMessage('Copy the backup text below and save it somewhere safe.');
        }
      } else {
        await Share.share({ title: 'SOR7ED library backup', message: json });
        setMessage('Choose a safe place to keep your backup.');
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError('The backup could not be shared. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handlePreviewRestore = () => {
    setError('');
    setMessage('');
    setRestoreCount(null);
    try {
      const parsed: unknown = JSON.parse(backupText);
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        (parsed as { version?: number }).version !== 1
      ) {
        throw new Error('Paste a valid SOR7ED backup to continue.');
      }
      const items = (parsed as { links?: unknown }).links;
      if (!Array.isArray(items)) {
        throw new Error('This backup does not contain a saved-link list.');
      }
      // Validate completely without changing the current library.
      JSON.parse(backupText);
      setRestoreCount(items.length);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Paste a valid SOR7ED backup to continue.',
      );
    }
  };

  const handleRestore = () => {
    try {
      const count = restoreBackup(backupText);
      setRestoreCount(null);
      setBackupText('');
      setError('');
      setMessage(`Restored ${count} ${count === 1 ? 'link' : 'links'}.`);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not restore backup.',
      );
      setRestoreCount(null);
    }
  };

  if (!isLoaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[screenStyles.eyebrow, { color: colors.primary }]}>
          KEEP IT SAFE
        </Text>
        <Text style={[screenStyles.title, { color: colors.foreground }]}>
          Your library,{'\n'}backed up.
        </Text>
        <Text style={[screenStyles.subtitle, { color: colors.mutedForeground }]}>
          Export your saved links to a file or restore them whenever you need.
        </Text>
      </View>

      <View
        style={[
          styles.statusCard,
          { backgroundColor: colors.secondary, borderColor: colors.border },
        ]}
      >
        <View style={[styles.statusIcon, { backgroundColor: colors.accent }]}>
          <Feather name="shield" size={20} color={colors.accentForeground} />
        </View>
        <View style={styles.statusText}>
          <Text style={[styles.statusTitle, { color: colors.foreground }]}>
            {formatBackupDate(lastBackupAt)}
          </Text>
          <Text style={[styles.smallText, { color: colors.mutedForeground }]}>
            {links.length} {links.length === 1 ? 'saved link' : 'saved links'} ·
            stored on this device
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[screenStyles.sectionTitle, { color: colors.foreground }]}>
          Export a backup
        </Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Create a portable copy of your links and preferences. Keep it in a
          place you trust.
        </Text>
        <Pressable
          accessibilityRole="button"
          testID="export-backup"
          onPress={handleExport}
          disabled={busy}
          style={({ pressed }) => [
            styles.primaryButton,
             { backgroundColor: colors.primary, borderColor: colors.primary },
            (pressed || busy) && styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Feather
              name="download"
              size={18}
              color={colors.primaryForeground}
            />
          )}
          <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
            {busy ? 'Preparing…' : 'Create backup'}
          </Text>
        </Pressable>
        {exportedText && Platform.OS === 'web' ? (
          <TextInput
            accessibilityLabel="Backup JSON"
            testID="backup-export-text"
            value={exportedText}
            editable={false}
            multiline
            selectTextOnFocus
            style={[
              styles.backupOutput,
              {
                 backgroundColor: colors.muted,
                 borderColor: colors.input,
                color: colors.foreground,
              },
            ]}
          />
        ) : null}
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.section}>
        <Text style={[screenStyles.sectionTitle, { color: colors.foreground }]}>
          Restore a backup
        </Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Paste the contents of a SOR7ED backup. Restoring replaces the links
          currently on this device.
        </Text>
        <TextInput
          accessibilityLabel="Paste backup JSON"
          testID="backup-import-text"
          value={backupText}
          onChangeText={(value) => {
            setBackupText(value);
            setRestoreCount(null);
            setError('');
          }}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Paste backup JSON here"
          placeholderTextColor={colors.mutedForeground}
          textAlignVertical="top"
          style={[
            styles.backupInput,
            {
               backgroundColor: colors.muted,
               borderColor: colors.input,
              color: colors.foreground,
            },
          ]}
        />
        {restoreCount === null ? (
          <Pressable
            accessibilityRole="button"
            testID="preview-restore"
            onPress={handlePreviewRestore}
            disabled={!backupText.trim()}
            style={({ pressed }) => [
              styles.secondaryButton,
               { borderColor: colors.input, backgroundColor: colors.background },
              (!backupText.trim() || pressed) && styles.pressed,
            ]}
          >
            <Feather name="upload" size={17} color={colors.primary} />
            <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
              Check backup
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
              Replace your current library with {restoreCount}{' '}
              {restoreCount === 1 ? 'link' : 'links'}?
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                accessibilityRole="button"
                testID="cancel-restore"
                onPress={() => setRestoreCount(null)}
                style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.mutedForeground }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                testID="confirm-restore"
                onPress={handleRestore}
                style={({ pressed }) => [
                  styles.primaryButton,
                  styles.restoreButton,
                   { backgroundColor: colors.primary, borderColor: colors.primary },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
                  Restore
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {error ? (
        <Text accessibilityRole="alert" style={[styles.feedback, { color: colors.destructive }]}>
          {error}
        </Text>
      ) : null}
      {message ? (
        <Text style={[styles.feedback, { color: colors.primary }]}>{message}</Text>
      ) : null}
      <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
        Backups are files you manage. SOR7ED does not upload or sync them in this
        prototype.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { gap: 8, marginBottom: 4 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderRadius: 0,
  },
  statusIcon: {
    height: 42,
    width: 42,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: { flex: 1, gap: 4 },
  statusTitle: { fontSize: 14, fontWeight: '700' },
  smallText: { fontSize: 12 },
  section: { gap: 12 },
  body: { fontSize: 14, lineHeight: 21 },
  primaryButton: {
    minHeight: 46,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 18,
  },
  primaryButtonText: { fontSize: 15, fontWeight: '700' },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 18,
    borderWidth: 1,
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.72 },
  divider: { height: 1, marginVertical: 2 },
  backupInput: {
    minHeight: 116,
    borderWidth: 1,
    borderRadius: 0,
    padding: 12,
    fontSize: 13,
  },
  backupOutput: {
    minHeight: 110,
    borderWidth: 1,
    borderRadius: 0,
    padding: 12,
    fontSize: 11,
  },
  confirmBox: { borderWidth: 1, borderRadius: 0, padding: 18, gap: 12 },
  confirmText: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  confirmActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  textAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  restoreButton: { minHeight: 44, paddingHorizontal: 18 },
  feedback: { fontSize: 13, fontWeight: '600', lineHeight: 19 },
  footnote: { fontSize: 12, lineHeight: 18, marginTop: 2 },
});
