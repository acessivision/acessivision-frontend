// app/login.tsx - CORREÇÃO COMPLETA

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

export default function LoginScreen() {
  const titleRef = useRef(null);
  const router = useRouter();
  const { temaAplicado, cores, getIconSize, getFontSize } = useTheme();
  const [loading, setLoading] = useState(false);
  const { loginWithGoogle, user, isLoading: isAuthLoading } = useAuth();

  const isFocused = useIsFocused();
  const { speak } = useSpeech({
    enabled: isFocused,
    mode: 'local',
  });
  
  const spokenRef = useRef(false);
  const hasSetInitialFocusRef = useRef(false);

  // ===================================================================
// ✅ CORREÇÃO: useEffect para foco inicial do TalkBack
// ===================================================================
useEffect(() => {
  if (!isFocused) {
    hasSetInitialFocusRef.current = false;
    return;
  }

  if (hasSetInitialFocusRef.current) return;

  const setInitialFocus = async () => {
    try {
      console.log('[Login] 🎯 Iniciando configuração de foco...');
      
      // ✅ Aguarda as interações terminarem
      await new Promise(resolve => {
        InteractionManager.runAfterInteractions(() => {
          resolve(undefined);
        });
      });

      // ✅ Aguarda a UI estabilizar (aumentado)
      await new Promise(resolve => setTimeout(resolve, 1200)); // ← Aumentado de 800 para 1200

      // ✅ Verifica se TalkBack está ativo
      const isScreenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      console.log('[Login] 📱 TalkBack ativo:', isScreenReaderEnabled);
      
      if (isScreenReaderEnabled && titleRef.current) {
        const reactTag = findNodeHandle(titleRef.current);
        console.log('[Login] 🏷️ ReactTag obtido:', reactTag);
        
        if (reactTag) {
          console.log('[Login] ✅ Definindo foco no título "AcessiVision"');
          
          // ✅ Apenas define o foco - NÃO anuncia manualmente
          // O TalkBack vai anunciar automaticamente o elemento focado
          AccessibilityInfo.setAccessibilityFocus(reactTag);
          
          hasSetInitialFocusRef.current = true;
          console.log('[Login] 🎉 Foco configurado com sucesso!');
        } else {
          console.warn('[Login] ⚠️ ReactTag é null, não foi possível definir foco');
        }
      } else {
        console.log('[Login] ℹ️ TalkBack não está ativo ou ref não está disponível');
      }
    } catch (error) {
      console.error('[Login] ❌ Erro ao definir foco:', error);
    }
  };

  setInitialFocus();
}, [isFocused]);

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
          {/* ✅ Título com ref e propriedades de acessibilidade */}
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
          accessibilityHint={isButtonDisabled ? '' : 'Faz login usando sua conta Google'}
          accessibilityRole="button"
        >
          <Image source={require('../assets/images/icone-google.png')} />
          <Text style={styles.googleButtonText}>
            'Entrar com Google'
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}