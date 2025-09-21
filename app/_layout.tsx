import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../components/ThemeContext';
import { VoiceCommandProvider } from '../components/VoiceCommandContext'; // Importe o novo provider
import { useEffect } from 'react';
import * as NavigationBar from 'expo-navigation-bar';

// Componente interno para acessar o contexto do tema
function ThemedSystemBars() {
  const { temaAplicado } = useTheme();

  useEffect(() => {
    NavigationBar.setBackgroundColorAsync(temaAplicado === 'dark' ? '#151718' : '#fff');
    NavigationBar.setButtonStyleAsync(
      temaAplicado === 'dark' ? 'light' : 'dark'
    );
  }, [temaAplicado]);

  return <StatusBar style={temaAplicado === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    // Envolva com ambos os providers. ThemeProvider primeiro.
    <ThemeProvider>
      <VoiceCommandProvider>
        <SafeAreaProvider>
          <ThemedSystemBars />
          <Stack screenOptions={{ headerShown: false }} />
        </SafeAreaProvider>
      </VoiceCommandProvider>
    </ThemeProvider>
  );
}