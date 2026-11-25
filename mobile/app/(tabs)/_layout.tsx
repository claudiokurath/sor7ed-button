import React from 'react';
import { Platform } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  const colors = useColors();
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : { height: 62 }),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarItemStyle: { paddingTop: 5 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Account',
          tabBarIcon: ({ focused }) => (
            <Feather
              name="user"
              size={21}
              color={focused ? colors.primary : colors.mutedForeground}
            />
          ),
        }}
      />
      <Tabs.Screen name="local" options={{ title: 'On device', tabBarIcon: ({ focused }) => <Feather name="smartphone" size={21} color={focused ? colors.primary : colors.mutedForeground} /> }} />
      <Tabs.Screen
        name="backups"
        options={{
          title: 'Backups',
          tabBarIcon: ({ focused }) => (
            <Feather
              name="archive"
              size={21}
              color={focused ? colors.primary : colors.mutedForeground}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => (
            <Feather
              name="settings"
              size={21}
              color={focused ? colors.primary : colors.mutedForeground}
            />
          ),
        }}
      />
    </Tabs>
  );
}
