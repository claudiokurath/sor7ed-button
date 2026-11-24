import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinkCard } from '@/components/LinkCard';
import { Screen, screenStyles } from '@/components/Screen';
import { useLibrary } from '@/context/LibraryContext';
import { useColors } from '@/hooks/useColors';

type Filter = 'all' | 'starred';

export default function LibraryScreen() {
  const colors = useColors();
  const { links, settings, toggleFavorite, isLoaded } = useLibrary();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const visibleLinks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return links
      .filter((item) => filter === 'all' || item.favorite)
      .filter(
        (item) =>
          !query ||
          item.title.toLowerCase().includes(query) ||
          item.url.toLowerCase().includes(query) ||
          item.note.toLowerCase().includes(query),
      )
      .sort((a, b) => {
        const direction = settings.sortOrder === 'newest' ? -1 : 1;
        return direction * a.createdAt.localeCompare(b.createdAt);
      });
  }, [filter, links, search, settings.sortOrder]);

  const favoritesCount = links.filter((item) => item.favorite).length;

  if (!isLoaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Screen>
      <View style={styles.topline}>
        <View style={styles.brand}>
          <Image
            source={require('../../assets/images/sor7ed-logo-white.png')}
            accessibilityLabel="SOR7ED"
            resizeMode="contain"
            style={styles.brandLogo}
          />
        </View>
        <View style={[styles.localPill, { borderColor: colors.input }]}>
          <View style={[styles.statusDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.localLabel, { color: colors.mutedForeground }]}>
            ON THIS DEVICE
          </Text>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={[screenStyles.eyebrow, { color: colors.primary }]}>
          DEVICE-ONLY LINKS
        </Text>
        <Text style={[screenStyles.title, { color: colors.foreground }]}>
          KEEP WHAT{'\n'}MATTERS.
        </Text>
        <Text style={[screenStyles.subtitle, { color: colors.mutedForeground }]}>
          Good things are worth finding again.
        </Text>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={[styles.statNumber, { color: colors.foreground }]}>
            {links.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
            SAVED
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.stat}>
          <Text style={[styles.statNumber, { color: colors.foreground }]}>
            {favoritesCount}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
            STARRED
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          testID="add-link"
          onPress={() => router.push('/add-link')}
          style={({ pressed }) => [
            styles.addButton,
             { backgroundColor: colors.primary, borderColor: colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <Feather name="plus" size={18} color={colors.primaryForeground} />
          <Text style={[styles.addButtonText, { color: colors.primaryForeground }]}>
            Save a link
          </Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.searchBox,
          { backgroundColor: colors.muted, borderColor: colors.input },
        ]}
      >
        <Feather name="search" size={18} color={colors.mutedForeground} />
        <TextInput
          accessibilityLabel="Search your saved links"
          testID="search-links"
          value={search}
          onChangeText={setSearch}
          placeholder="Search your links"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          returnKeyType="search"
          style={[styles.searchInput, { color: colors.foreground }]}
        />
        {search ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => setSearch('')}
            hitSlop={8}
          >
            <Feather name="x" size={17} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filters}>
        {(['all', 'starred'] as const).map((value) => {
          const selected = filter === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              testID={`filter-${value}`}
              onPress={() => setFilter(value)}
              style={({ pressed }) => [
                styles.filter,
                {
                  backgroundColor: selected ? colors.primary : colors.secondary,
                  borderColor: selected ? colors.primary : colors.input,
                },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  {
                    color: selected
                      ? colors.primaryForeground
                      : colors.foreground,
                  },
                ]}
              >
                {value === 'all' ? 'All links' : 'Starred'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.listHeader}>
        <Text style={[screenStyles.sectionTitle, { color: colors.foreground }]}>
          {search
            ? 'Search results'
            : filter === 'starred'
              ? 'Starred links'
              : 'Recently saved'}
        </Text>
        <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
          {visibleLinks.length}
        </Text>
      </View>

      {visibleLinks.length > 0 ? (
        <View style={styles.list}>
          {visibleLinks.map((item) => (
            <LinkCard
              key={item.id}
              item={item}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </View>
      ) : (
        <View
          style={[
            styles.emptyState,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
            <Feather
              name={search || filter === 'starred' ? 'search' : 'bookmark'}
              size={22}
              color={colors.primary}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {search
              ? 'Nothing found'
              : filter === 'starred'
                ? 'No starred links yet'
                : 'Your library starts here'}
          </Text>
          <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>
            {search
              ? 'Try another title, note, or website.'
              : filter === 'starred'
                ? 'Star a saved link to keep it close.'
                : 'Save a link you want to come back to.'}
          </Text>
          {!search && filter === 'all' ? (
            <Pressable
              accessibilityRole="button"
              testID="empty-add-link"
              onPress={() => router.push('/add-link')}
              style={({ pressed }) => [
                styles.emptyButton,
                 { backgroundColor: colors.primary, borderColor: colors.primary },
                pressed && styles.pressed,
              ]}
            >
              <Feather name="plus" size={17} color={colors.primaryForeground} />
              <Text
                style={[
                  styles.addButtonText,
                  { color: colors.primaryForeground },
                ]}
              >
                Save your first link
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
      <Text style={[styles.privacy, { color: colors.mutedForeground }]}>
        Saved links stay on this device. Make a backup anytime.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandLogo: { width: 106, height: 27 },
  localPill: {
    minHeight: 28,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
  },
  statusDot: { width: 6, height: 6 },
  localLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.65 },
  hero: { gap: 8, marginTop: 12 },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginTop: 2,
  },
  stat: { minWidth: 45, gap: 1 },
  statNumber: { fontSize: 23, lineHeight: 27, fontWeight: '700' },
  statLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.9 },
  statDivider: { width: 1, height: 34, marginHorizontal: 3 },
  addButton: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  addButtonText: { fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.72 },
  searchBox: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 10 },
  filters: { flexDirection: 'row', gap: 8 },
  filter: {
    borderWidth: 1,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: { fontSize: 12, fontWeight: '700' },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  resultCount: { fontSize: 12, fontWeight: '600' },
  list: { gap: 10 },
  emptyState: {
    borderWidth: 1,
    borderRadius: 0,
    padding: 18,
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptyCopy: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  emptyButton: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 15,
    marginTop: 4,
  },
  privacy: { fontSize: 12, textAlign: 'center', marginTop: -2 },
});
