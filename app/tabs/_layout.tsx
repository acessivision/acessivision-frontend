// app/tabs/_layout
import { Tabs, usePathname, useRouter, useGlobalSearchParams } from 'expo-router';
import { LayoutChangeEvent, View } from 'react-native';
import CustomHeader from '../../components/CustomHeader';
import { useTheme } from '../../components/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { toTitleCase } from '../../utils/toTitleCase';

import React, { useState } from 'react';
import { LayoutProvider, useLayout } from '../../components/LayoutContext';

function LayoutWithVoiceUI() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useGlobalSearchParams<{ titulo?: string }>();
  const { mudaTema, cores, getIconSize } = useTheme();
  const { setHeaderHeight } = useLayout();

  const getTitle = () => {
    if (pathname === '/tabs/conversa' && params.titulo) {
      return String(toTitleCase(params.titulo)); 
    }
    switch (pathname) {
      case '/tabs':
      case '/tabs/':
      case '/tabs/index':
        return 'Câmera';
      case '/tabs/historico':
        return 'Histórico';
      case '/tabs/menu':
        return 'Menu';
      case '/tabs/conversa':
        return 'Conversa';
      default:
        return 'App';
    }
  };

  const abreLogin = () => {
    router.push('/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: cores.barrasDeNavegacao }}>
      <CustomHeader
        title={getTitle()}
        mudaTema={mudaTema}
        abreLogin={abreLogin}
        onLayout={(event: LayoutChangeEvent) => {
          setHeaderHeight(event.nativeEvent.layout.height);
        }}
      />
      <View 
        style={{ flex: 1 }}
      >
        <Tabs
          initialRouteName="index"
          backBehavior="history"
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: cores.icone,
            tabBarInactiveTintColor: cores.icone,
            tabBarShowLabel: false,
            tabBarStyle: {
              backgroundColor: cores.barrasDeNavegacao,
              height: 80,
              paddingBottom: 10,
              borderTopWidth: 1,
              borderColor: cores.icone,
              elevation: 0,
              shadowOpacity: 0,
              shadowColor: 'transparent',
            },
            tabBarIconStyle: {
              height: 60,
              width: 60,
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Câmera',
              tabBarAccessibilityLabel: 'Câmera',
              tabBarIcon: ({ color }) => (
                <MaterialCommunityIcons name="camera" color={color} size={getIconSize('xlarge')} />
              ),
            }}
          />
          <Tabs.Screen
            name="historico"
            options={{
              title: 'Histórico',
              tabBarAccessibilityLabel: 'Histórico',
              tabBarIcon: ({ color }) => (
                <MaterialCommunityIcons name="history" color={color} size={getIconSize('xlarge')} />
              ),
            }}
          />
          <Tabs.Screen
            name="menu"
            options={{
              title: 'Menu',
              tabBarAccessibilityLabel: 'Menu',
              tabBarIcon: ({ color }) => (
                <MaterialCommunityIcons name="menu" color={color} size={getIconSize('xlarge')} />
              ),
            }}
          />
          <Tabs.Screen
            name="conversa"
            options={{
              href: null,
            }}
          />
        </Tabs>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <LayoutProvider>
      <LayoutWithVoiceUI />
    </LayoutProvider>
  );
}