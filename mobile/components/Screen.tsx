import React, { ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

interface ScreenProps extends Omit<ScrollViewProps, 'contentContainerStyle'> {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export function Screen({ children, contentContainerStyle, ...props }: ScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        {...props}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: topInset + 16,
            paddingBottom: bottomInset + 102,
          },
          contentContainerStyle,
        ]}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export const screenStyles = StyleSheet.create({
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'Anton',
    textTransform: 'uppercase',
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '400',
    letterSpacing: 0,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  sectionTitle: {
    fontFamily: 'Anton',
    textTransform: 'uppercase',
    fontSize: 19,
    fontWeight: '400',
    letterSpacing: 0,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    gap: 20,
  },
});
