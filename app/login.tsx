// app/login.tsx - ATUALIZADO COM COMANDO DE VOZ

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Alert, 
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  findNodeHandle,
  AccessibilityInfo,
  InteractionManager
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../components/ThemeContext';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '../components/AuthContext';
import { useIsFocused } from '@react-navigation/native';
import { useSpeech } from '../hooks/useSpeech';
// ✅ 1. Importar Contexto do Microfone (igual ao histórico)
import { useMicrophone } from '../components/MicrophoneContext';

export default function LoginScreen() {
  const titleRef = useRef(null);
  const router = useRouter();
  const { temaAplicado, cores, getIconSize, getFontSize } = useTheme();
  const [loading, setLoading] = useState(false);
  const { loginWithGoogle, user, isLoading: isAuthLoading } = useAuth();
  
  // ✅ 2. Pegar estado do microfone
  const { isMicrophoneEnabled } = useMicrophone();

  const isFocused = useIsFocused();
  
  // ✅ 3. Hook configurado como 'global' para ouvir comandos
  const { 
    speak, 
    recognizedText, 
    setRecognizedText, 
    stopListening 
  } = useSpeech({
    // Só escuta se a tela estiver focada E o microfone global estiver ligado
    enabled: isFocused && isMicrophoneEnabled,
    mode: 'global',
  });
  
  const hasSetInitialFocusRef = useRef(false);

  // ===================================================================
  // Lógica de Foco Inicial (Mantida igual)
  // ===================================================================
  useEffect(() => {
    if (!isFocused) {
      hasSetInitialFocusRef.current = false;
      return;
    }

    if (hasSetInitialFocusRef.current) return;

    const setInitialFocus = async () => {
      try {
        await new Promise(resolve => {
          InteractionManager.runAfterInteractions(() => {
            resolve(undefined);
          });
        });

        await new Promise(resolve => setTimeout(resolve, 1200));

        const isScreenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
        
        if (isScreenReaderEnabled && titleRef.current) {
          const reactTag = findNodeHandle(titleRef.current);
          if (reactTag) {
            AccessibilityInfo.setAccessibilityFocus(reactTag);
            hasSetInitialFocusRef.current = true;
          }
        }
      } catch (error) {
        console.error('[Login] ❌ Erro ao definir foco:', error);
      }
    };

    setInitialFocus();
  }, [isFocused]);

  // ===================================================================
  // ✅ 4. DETECÇÃO DE COMANDO DE VOZ (Lógica Nova)
  // ===================================================================
  useEffect(() => {
    // Se não tiver texto, ou se a tela não estiver focada, ou se já estiver carregando, ignora
    if (!recognizedText.trim() || !isFocused || loading || isAuthLoading || user) return;

    const textoAtual = recognizedText.trim();
    const textoLower = textoAtual.toLowerCase();

    console.log(`[Login] 🗣️ Texto reconhecido: "${textoAtual}"`);

    // Palavras-chave: "google", "entrar", "login"
    // Ex: "Entrar com Google", "Fazer login Google", "Google"
    const querLogar = textoLower.includes('google') && 
                     (textoLower.includes('entrar') || textoLower.includes('login') || textoLower.includes('fazer') || textoLower === 'google');

    if (querLogar) {
      console.log('[Login] 🎯 Comando de login detectado!');
      
      // Limpa o texto para não disparar 2x
      setRecognizedText('');
      
      // Para de ouvir para não interferir no processo
      stopListening();
      
      speak("Escolha uma conta na tela para fazer o login", () => {
        handleGoogleLogin();
      });
    }

  }, [recognizedText, isFocused, loading, isAuthLoading, user]);

  // ===================================================================
  // Funções de navegação e login
  // ===================================================================
  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/tabs');
    }
  };

  const handleGoogleLogin = async () => {
    if (loading || isAuthLoading) return;
    
    setLoading(true);
    
    try {
      const result = await loginWithGoogle();

      if (result.success) {
        await speak('Login realizado com sucesso!');
        router.replace('/tabs');
      } else {
        const errorMessage = result.message || 'Falha ao autenticar com o Google.';
        await speak(`Erro. ${errorMessage}`);
      }
    } catch (error) {
      console.error("Erro no login com Google:", error);
      await speak('Erro. Ocorreu um erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  // ===================================================================
  // Estilos
  // ===================================================================
  const styles = StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 40,
      marginLeft: 40,
      backgroundColor: cores.barrasDeNavegacao,
    },
    backButton: {
      marginRight: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },
    backIcon: {
      marginRight: 16,
    },
    headerTitle: {
      fontSize: getFontSize('large'),
      fontWeight: 'bold',
      color: cores.texto,
    },
    container: {
      flex: 1,
      backgroundColor: cores.barrasDeNavegacao,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: 24,
      justifyContent: 'center',
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: 40,
    },
    logo: {
      width: 160,
      height: 110,
      marginBottom: 10,
    },
    title: {
      fontSize: 36,
      fontWeight: 'bold',
      textAlign: 'center',
      color: cores.texto,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      textAlign: 'center',
      color: cores.texto,
      marginBottom: 40,
    },
    googleButton: {
      height: 56,
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: cores.texto,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 40,
    },
    disabledButton: {
      opacity: 0.6,
      backgroundColor: '#eee',
    },
    googleButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: '#000',
    },
  });

  const isButtonDisabled = loading || isAuthLoading || !!user;

  // ===================================================================
  // Render
  // ===================================================================
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleGoBack}
          accessibilityRole='button'
          accessibilityLabel='Voltar para página anterior'
          accessibilityHint='Retorna para a tela anterior'
        >
          <View style={styles.backIcon}>
            <Ionicons 
              name="arrow-back" 
              size={getIconSize('medium')} 
              color={cores.icone} 
            />
          </View>
          <Text style={styles.headerTitle}>Voltar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image
            source={
              temaAplicado === "dark"
                ? require("../assets/images/logo-escuro.png")
                : require("../assets/images/logo-claro.png")
            }
            style={styles.logo}
          />
          <Text 
            ref={titleRef}
            style={styles.title}
            accessible={true}
            accessibilityRole="header"
            accessibilityLabel="Login"
            importantForAccessibility="yes"
          >
            AcessiVision
          </Text>
        </View>

        <Text style={styles.subtitle}>
          Entre no AcessiVision e desfrute de todas as funcionalidades!
        </Text>

        <TouchableOpacity 
          style={[styles.googleButton, isButtonDisabled && styles.disabledButton]}
          onPress={handleGoogleLogin}
          disabled={isButtonDisabled}
          accessibilityLabel='Entrar com Google'
          accessibilityHint={isButtonDisabled ? '' : 'Diga "Entrar com Google" ou toque duas vezes para fazer login'}
          accessibilityRole="button"
        >
          <Image source={require('../assets/images/icone-google.png')} />
          <Text style={styles.googleButtonText}>
            Entrar com Google
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}