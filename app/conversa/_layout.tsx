// app/(conversa)/_layout.tsx - SIMPLIFICADO

import { Stack } from 'expo-router';
import { View, LayoutChangeEvent } from 'react-native';
import CustomHeader from '../../components/CustomHeader';
import { useTheme } from '../../components/ThemeContext';
import { useRouter, useGlobalSearchParams } from 'expo-router';
import { toTitleCase } from '../../utils/toTitleCase';
import React, { useState, useEffect } from 'react';

export default function ConversaLayout() {
  const router = useRouter();
  const params = useGlobalSearchParams<{ titulo?: string }>();
  const { mudaTema, cores } = useTheme();
  const [headerHeight, setHeaderHeight] = useState(0);
  const [headerKey, setHeaderKey] = useState(0);
  
  // ✅ Força re-render do CustomHeader quando o título muda
  useEffect(() => {
    setHeaderKey(prev => prev + 1);
    console.log('[ConversaLayout] 🔄 Título mudou, forçando re-render do CustomHeader');
  }, [params.titulo]);
  
  const getTitle = () => {
    if (params.titulo) {
      return String(toTitleCase(params.titulo));
    }
    return 'Conversa';
  };

  const abreLogin = () => {
    router.push('/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: cores.barrasDeNavegacao }}>
      <CustomHeader
        key={headerKey}
        title={getTitle()}
        mudaTema={mudaTema}
        abreLogin={abreLogin}
        onLayout={(event: LayoutChangeEvent) => {
          setHeaderHeight(event.nativeEvent.layout.height);
        }}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: cores.fundo },
        }}
      />
    </View>
  );
}