import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Screen, screenStyles } from '@/components/Screen';
import { useLibrary } from '@/context/LibraryContext';
import { useColors } from '@/hooks/useColors';

export default function SettingsScreen() {
  const colors = useColors();
  const { links, settings, setSortOrder, clearLibrary, isLoaded } = useLibrary();
  const [confirmClear, setConfirmClear] = useState(false);

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
          YOUR SPACE
        </Text>
        <Text style={[screenStyles.title, { color: colors.foreground }]}>
          Settings
        </Text>
        <Text style={[screenStyles.subtitle, { color: colors.mutedForeground }]}>
          Make your local library work the way you do.
        </Text>
      </View>

      <View
        style={[
          styles.accountCard,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      >
        <View style={[styles.accountIcon, { backgroundColor: colors.accent }]}>
          <Feather name="smartphone" size={20} color={colors.accentForeground} />
        </View>
        <View style={styles.accountText}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            Local prototype
          </Text>
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            {links.length} {links.length === 1 ? 'link' : 'links'} on this device
          </Text>
        </View>
        <View style={[styles.localBadge, { borderColor: colors.input }]}>
          <Text style={[styles.badgeText, { color: colors.primary }]}>LOCAL</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[screenStyles.sectionTitle, { color: colors.foreground }]}>
          Library
        </Text>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          Default order
        </Text>
        <View
          style={[
            styles.segmented,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          {(['newest', 'oldest'] as const).map((order) => {
            const active = settings.sortOrder === order;
            return (
              <Pressable
                key={order}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                testID={`sort-${order}`}
                onPress={() => setSortOrder(order)}
                style={({ pressed }) => [
                  styles.segment,
                  active && { backgroundColor: colors.primary },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  {order === 'newest' ? 'Newest first' : 'Oldest first'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="info" size={18} color={colors.primary} />
        <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
          Google sign-in and cloud sync are not connected in this prototype.
          Export a backup before changing or replacing this device.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[screenStyles.sectionTitle, { color: colors.foreground }]}>
          Clear local data
        </Text>
        <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
          Remove all {links.length} saved {links.length === 1 ? 'link' : 'links'} from this device.
        </Text>
        {!confirmClear ? (
          <Pressable
            accessibilityRole="button"
            testID="clear-library"
            onPress={() => setConfirmClear(true)}
            disabled={links.length === 0}
            style={({ pressed }) => [
              styles.dangerButton,
              { borderColor: colors.destructive },
              (links.length === 0 || pressed) && styles.pressed,
            ]}
          >
            <Feather name="trash-2" size={17} color={colors.destructive} />
            <Text style={[styles.dangerText, { color: colors.destructive }]}>
              Clear saved links
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
              This removes every saved link on this device. This cannot be undone
              unless you have a backup.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                accessibilityRole="button"
                testID="cancel-clear"
                onPress={() => setConfirmClear(false)}
                style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}
              >
                <Text style={[styles.actionText, { color: colors.mutedForeground }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                testID="confirm-clear"
                onPress={() => {
                  clearLibrary();
                  setConfirmClear(false);
                }}
                style={({ pressed }) => [
                  styles.confirmButton,
                   { backgroundColor: colors.destructive, borderColor: colors.destructive },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.confirmButtonText, { color: colors.destructiveForeground }]}>
                  Clear links
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { gap: 8, marginBottom: 4 },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderRadius: 0,
  },
  accountIcon: {
    width: 42,
    height: 42,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountText: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardBody: { fontSize: 13, lineHeight: 20 },
  localBadge: { borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  section: { gap: 12 },
  label: { fontSize: 13, fontWeight: '600' },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 0,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  segmentText: { fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.72 },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    borderWidth: 1,
    borderRadius: 0,
    padding: 15,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 20 },
  dangerButton: {
    minHeight: 50,
    borderRadius: 0,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dangerText: { fontSize: 14, fontWeight: '700' },
  confirmBox: { borderWidth: 1, borderRadius: 0, padding: 18, gap: 12 },
  confirmText: { fontSize: 13, lineHeight: 20 },
  confirmActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  textAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  actionText: { fontSize: 14, fontWeight: '700' },
  confirmButton: {
    minHeight: 46,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'transparent',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  confirmButtonText: { fontSize: 13, fontWeight: '700' },
});
