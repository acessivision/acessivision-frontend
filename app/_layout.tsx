import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../components/ThemeContext';
import { VoiceCommandProvider } from '../components/VoiceCommandContext';
import { TutorialProvider } from '../components/TutorialContext';
import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../components/AuthContext';
import { Platform } from 'react-native';
import React, { useEffect, useState } from 'react';
import { SplashScreen } from 'expo-router';
import SpeechManager from '../utils/speechManager';
import { MicrophoneProvider } from '../components/MicrophoneContext';

function ThemedSystemBars() {
  const { temaAplicado } = useTheme();
  
  useEffect(() => {
    if (Platform.OS === 'android') {
      const setupNavigationBar = async () => {
        try {
          await NavigationBar.setButtonStyleAsync(
            temaAplicado === 'dark' ? 'light' : 'dark'
          );
        } catch (error) {
          console.error('[Layout] Erro ao configurar barra de navegação:', error);
        }
      };
      setupNavigationBar();
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
        const granted = await SpeechManager.requestPermissions();
        setPermissionGranted(granted);
        if (!granted) {
          console.error("Permissão de microfone negada!");
        }
      } catch (e) {
        console.warn("[Layout] Erro ao pedir permissões:", e);
      } finally {
        setPermissionsReady(true);
        SplashScreen.hideAsync();
      }
    }
    prepareApp();
  }, []);
  
  if (!permissionsReady) {
    return null;
  }
  
  return (
    <AuthProvider>
      <ThemeProvider>
        <MicrophoneProvider>
          <TutorialProvider> 
            <VoiceCommandProvider>
              <SafeAreaProvider>
                <StatusBar 
                  style="auto" 
                  translucent 
                  backgroundColor="transparent" 
                />
                <ThemedSystemBars /> 
                <Stack 
                  screenOptions={{ 
                    headerShown: false,
                    contentStyle: { backgroundColor: 'transparent' }
                  }} 
                />
              </SafeAreaProvider>
            </VoiceCommandProvider>
          </TutorialProvider>
        </MicrophoneProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}