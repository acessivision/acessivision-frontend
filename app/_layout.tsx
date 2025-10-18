// app/_layout

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../components/ThemeContext';
import { VoiceCommandProvider } from '../components/VoiceCommandContext';
import { useEffect } from 'react';
import * as NavigationBar from 'expo-navigation-bar';
import { VoicePageAnnouncer } from '../components/VoicePageAnnouncer';
import { AuthProvider } from '../components/AuthContext';

// Componente interno para acessar o contexto do tema
function ThemedSystemBars() {
  const { temaAplicado } = useTheme();

  useEffect(() => {
    NavigationBar.setBackgroundColorAsync(
      temaAplicado === 'dark' ? '#151718' : '#fff'
    );
    NavigationBar.setButtonStyleAsync(
      temaAplicado === 'dark' ? 'light' : 'dark'
    );
  }, [temaAplicado]);

  return <StatusBar style={temaAplicado === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <VoiceCommandProvider>
          <SafeAreaProvider>
            <ThemedSystemBars />
            <VoicePageAnnouncer />
            <Stack screenOptions={{ headerShown: false }} />
          </SafeAreaProvider>
        </VoiceCommandProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}