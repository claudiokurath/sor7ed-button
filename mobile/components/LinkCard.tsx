import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { SavedLink } from '@/context/LibraryContext';
import { useColors } from '@/hooks/useColors';

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function LinkCard({
  item,
  onToggleFavorite,
}: {
  item: SavedLink;
  onToggleFavorite: (id: string) => void;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Link href={`/link/${item.id}`} asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${item.title}`}
          testID={`saved-link-${item.id}`}
          style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
            <Feather name="link" size={17} color={colors.primary} />
          </View>
          <View style={styles.textBlock}>
            <Text
              numberOfLines={1}
              style={[styles.title, { color: colors.foreground }]}
            >
              {item.title}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.meta, { color: colors.mutedForeground }]}
            >
              {getDomain(item.url)} · {formatDate(item.createdAt)}
            </Text>
            {item.note ? (
              <Text
                numberOfLines={1}
                style={[styles.note, { color: colors.mutedForeground }]}
              >
                {item.note}
              </Text>
            ) : null}
          </View>
          <Feather
            name="chevron-right"
            size={18}
            color={colors.mutedForeground}
          />
        </Pressable>
      </Link>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.favorite ? 'Remove from starred' : 'Add to starred'}
        testID={`favorite-${item.id}`}
        onPress={() => onToggleFavorite(item.id)}
        hitSlop={10}
        style={({ pressed }) => [styles.star, pressed && styles.pressed]}
      >
        <Feather
          name={item.favorite ? 'star' : 'star'}
          size={17}
          color={item.favorite ? colors.primary : colors.mutedForeground}
          fill={item.favorite ? colors.accent : 'transparent'}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 0,
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 14,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  pressed: { opacity: 0.72 },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { flex: 1, gap: 3 },
  title: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, fontWeight: '500' },
  note: { fontSize: 12 },
  star: {
    padding: 8,
  },
});
