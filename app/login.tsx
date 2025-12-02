// app/login.tsx - COMANDO DE VOZ INTELIGENTE E FLEXÍVEL

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
import { useMicrophone } from '../components/MicrophoneContext';
import { useTutorial } from '../components/TutorialContext'; // ✅ NOVO

export default function LoginScreen() {
  const titleRef = useRef(null);
  const router = useRouter();
  const { temaAplicado, cores, getIconSize, getFontSize } = useTheme();
  const [loading, setLoading] = useState(false);
  const { loginWithGoogle, user, isLoading: isAuthLoading } = useAuth();
  
  const { isMicrophoneEnabled } = useMicrophone();
  const { isTutorialAtivo } = useTutorial(); // ✅ NOVO

  const isFocused = useIsFocused();
  
  const { 
    speak, 
    recognizedText, 
    setRecognizedText, 
    stopListening 
  } = useSpeech({
    enabled: isFocused && isMicrophoneEnabled && !isTutorialAtivo, // ✅ Adicionar tutorial
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
  // ✅ DETECÇÃO DE COMANDO DE VOZ - INTELIGENTE E FLEXÍVEL
  // ===================================================================
  useEffect(() => {
    if (!recognizedText.trim() || !isFocused || loading || isAuthLoading || user || isTutorialAtivo) return;

    const textoAtual = recognizedText.trim();
    const textoLower = textoAtual.toLowerCase();

    console.log(`[Login] 🗣️ Texto reconhecido: "${textoAtual}"`);

    // ✅ BLACKLIST: Ignora frases do leitor de tela
    const screenReaderBlacklist = [
      'voltar para página anterior',
      'voltar para a página anterior',
      'retorna para a tela anterior',
      'entrar com google botão',
      'entrar com google botao',
      'botão',
      'botao',
      'toque duas vezes',
      'diga',
    ];
    
    const isScreenReaderNoise = screenReaderBlacklist.some(phrase => 
      textoLower.includes(phrase)
    );
    
    if (isScreenReaderNoise) {
      console.log('[Login] ⚠️ Ignorando ruído do leitor de tela:', textoAtual);
      setRecognizedText('');
      return;
    }

    // ✅ DETECÇÃO INTELIGENTE DE INTENÇÃO DE LOGIN
    const querLogar = detectarIntencaoDeLogin(textoLower);

    if (querLogar) {
      console.log('[Login] 🎯 Comando de login detectado!');
      
      setRecognizedText('');
      stopListening();
      
      speak("Clique em uma das contas que aparecerão na tela para fazer o login", () => {
        handleGoogleLogin();
      });
    }

  }, [recognizedText, isFocused, loading, isAuthLoading, user, isTutorialAtivo]);

  // ===================================================================
  // ✅ FUNÇÃO INTELIGENTE DE DETECÇÃO DE INTENÇÃO
  // ===================================================================
  const detectarIntencaoDeLogin = (texto: string): boolean => {
    // Remove pontuações e espaços extras
    const textoLimpo = texto
      .replace(/[.,!?;:]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Palavras-chave relacionadas a login
    const palavrasLogin = [
      'entrar', 'entra', 'entro', 'entre',
      'login', 'logar', 'loga', 'logo',
      'fazer login', 'faz login',
      'acessar', 'acessa', 'acesso',
      'conectar', 'conecta', 'conecte',
      'autenticar', 'autentica',
      'iniciar sessão',
      'log in', 'sign in',
    ];

    // Palavras relacionadas ao Google
    const palavrasGoogle = [
      'google',
      'gugou', // pronúncia comum
      'gogle',  // erro de dicção
      'conta google',
      'conta do google',
      'gmail',
      'email',
    ];

    // Palavras relacionadas a "usar" ou "com"
    const palavrasConexao = [
      'com', 'no', 'na', 'pelo', 'pela', 'usando', 'usa', 'use', 'via', 'através',
    ];

    // ✅ PADRÃO 1: Menção direta ao Google (mais simples)
    // Ex: "Google", "Gmail", "Gugou"
    const mencionaGoogle = palavrasGoogle.some(palavra => textoLimpo.includes(palavra));
    
    if (mencionaGoogle && textoLimpo.split(' ').length <= 3) {
      // Se menciona Google e tem poucas palavras, provavelmente quer logar
      console.log('[Login] ✅ Padrão 1: Menção direta ao Google');
      return true;
    }

    // ✅ PADRÃO 2: Verbo de login + Google
    // Ex: "Entrar com Google", "Login Google", "Fazer login no Gmail"
    const temVerboLogin = palavrasLogin.some(palavra => textoLimpo.includes(palavra));
    
    if (temVerboLogin && mencionaGoogle) {
      console.log('[Login] ✅ Padrão 2: Verbo de login + Google');
      return true;
    }

    // ✅ PADRÃO 3: Verbo de login + palavra de conexão + Google
    // Ex: "Entrar com o Google", "Login usando Gmail"
    const temConexao = palavrasConexao.some(palavra => textoLimpo.includes(palavra));
    
    if (temVerboLogin && temConexao && mencionaGoogle) {
      console.log('[Login] ✅ Padrão 3: Verbo + conexão + Google');
      return true;
    }

    // ✅ PADRÃO 4: Frases comuns específicas
    const frasesComuns = [
      'quero entrar',
      'quero logar',
      'quero fazer login',
      'quero acessar',
      'vou entrar',
      'vou logar',
      'fazer o login',
      'me loga',
      'me conecta',
      'loga eu',
      'entra pra mim',
      'faz o login',
    ];

    const contemFraseComum = frasesComuns.some(frase => textoLimpo.includes(frase));
    
    if (contemFraseComum && (mencionaGoogle || textoLimpo.split(' ').length <= 4)) {
      console.log('[Login] ✅ Padrão 4: Frase comum de intenção');
      return true;
    }

    // ✅ PADRÃO 5: Apenas verbo de login (na tela de login, contexto é claro)
    // Ex: "Entrar", "Login", "Fazer login"
    if (temVerboLogin && textoLimpo.split(' ').length <= 3 && !mencionaGoogle) {
      console.log('[Login] ✅ Padrão 5: Apenas verbo de login (contexto claro)');
      return true;
    }

    return false;
  };

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
  // Estilos (mantidos iguais)
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleGoBack}
          accessibilityRole='button'
          accessibilityLabel='Voltar'
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
          accessibilityHint={isButtonDisabled ? '' : 'Toque duas vezes para fazer login'}
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