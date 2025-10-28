// app/_layout

import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../components/ThemeContext';
import { VoiceCommandProvider } from '../components/VoiceCommandContext';
import * as NavigationBar from 'expo-navigation-bar';
import { VoicePageAnnouncer } from '../utils/voicePageAnnouncer';
import { AuthProvider } from '../components/AuthContext';
import { Platform } from 'react-native';
import React, { useEffect, useState } from 'react';
import { SplashScreen, Slot } from 'expo-router';
import SpeechManager from '../utils/speechManager'; // Ajuste o caminho

// Componente interno para acessar o contexto do tema
function ThemedSystemBars() {
  const { temaAplicado, cores } = useTheme(); // Get 'cores' as well

  useEffect(() => {
    // Only run on Android
    if (Platform.OS === 'android') {
      
      // REMOVE this line:
      // NavigationBar.setBackgroundColorAsync(
      //   temaAplicado === 'dark' ? '#151718' : '#fff' // Or use cores.barrasDeNavegacao
      // );

      // KEEP this line (test if it works as expected):
      NavigationBar.setButtonStyleAsync(
        temaAplicado === 'dark' ? 'light' : 'dark'
      );
    }
  }, [temaAplicado, cores]); // Add cores if used for background elsewhere

  // This component doesn't need to render anything visual
  return null; 
}

export default function RootLayout() {
  const [permissionsReady, setPermissionsReady] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    async function prepareApp() {
      try {
        // 1. Pedir permissão de microfone PRIMEIRO
        const granted = await SpeechManager.requestPermissions();
        setPermissionGranted(granted);
        
        if (!granted) {
          console.error("Permissão de microfone negada!");
          // Aqui você poderia mostrar um Alert para o usuário
        }
        
      } catch (e) {
        console.warn("[Layout] Erro ao pedir permissões:", e);
      } finally {
        // 2. Informar ao app que as permissões foram tratadas
        setPermissionsReady(true);
        SplashScreen.hideAsync();
      }
    }

    prepareApp();
  }, []);

  // 3. Não renderizar nada até que a verificação de permissão esteja completa
  if (!permissionsReady) {
    return null;
  }

  return (
    <AuthProvider>
      <VoiceCommandProvider>
        <ThemeProvider>
          <SafeAreaProvider>
            <ThemedSystemBars />
            <VoicePageAnnouncer />
            <Stack screenOptions={{ headerShown: false }} />
          </SafeAreaProvider>
        </ThemeProvider>
      </VoiceCommandProvider>
    </AuthProvider>
  );
}