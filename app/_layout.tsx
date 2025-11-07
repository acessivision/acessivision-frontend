import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../components/ThemeContext';
import { VoiceCommandProvider } from '../components/VoiceCommandContext';
import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { VoicePageAnnouncer } from '../utils/voicePageAnnouncer';
import { AuthProvider } from '../components/AuthContext';
import { Platform } from 'react-native';
import React, { useEffect, useState } from 'react';
import { SplashScreen } from 'expo-router';
import SpeechManager from '../utils/speechManager';

// Componente interno para acessar o contexto do tema
function ThemedSystemBars() {
  const { temaAplicado } = useTheme();

  useEffect(() => {
    // Configuração apenas para Android
    if (Platform.OS === 'android') {
      const setupFullscreen = async () => {
        try {
          // ✅ FULLSCREEN: Esconder a barra de navegação
          await NavigationBar.setVisibilityAsync('hidden');
          
          // ✅ FULLSCREEN: Barra transparente
          await NavigationBar.setBackgroundColorAsync('#00000000');
          
          // ✅ FULLSCREEN: Comportamento - aparece ao deslizar, desaparece automaticamente
          await NavigationBar.setBehaviorAsync('overlay-swipe');
          
          // ✅ Estilo dos botões baseado no tema
          await NavigationBar.setButtonStyleAsync(
            temaAplicado === 'dark' ? 'light' : 'dark'
          );
          
        } catch (error) {
          console.error('[Layout] Erro ao configurar fullscreen:', error);
        }
      };
      
      setupFullscreen();
    }
  }, [temaAplicado]);

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
      {/* ✅ CORREÇÃO: ThemeProvider deve envolver VoiceCommandProvider */}
      <ThemeProvider>
        <VoiceCommandProvider>
          <SafeAreaProvider>
            {/* ✅ Status bar transparente e translúcida */}
            <StatusBar 
              style="auto" 
              translucent 
              backgroundColor="transparent" 
            />
            {/* ThemedSystemBars agora está corretamente dentro do ThemeProvider */}
            <ThemedSystemBars /> 
            <VoicePageAnnouncer />
            <Stack 
              screenOptions={{ 
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' }
              }} 
            />
          </SafeAreaProvider>
        </VoiceCommandProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}