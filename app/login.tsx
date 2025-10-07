import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  ActivityIndicator,
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  findNodeHandle,
  AccessibilityInfo
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../components/ThemeContext';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import authService from '../services/authService'

export default function LoginScreen() {
  const titleRef = useRef(null);
  const router = useRouter();
  const { theme, temaAplicado, cores, getIconSize, getFontSize } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const setInitialFocus = async () => {
      try {
        const isScreenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
        if (isScreenReaderEnabled && titleRef.current) {
          const reactTag = findNodeHandle(titleRef.current);
          if (reactTag) {
            AccessibilityInfo.setAccessibilityFocus(reactTag);
          }
        }
      } catch (error) {
        console.error('Error setting initial focus:', error);
      }
    };
    setInitialFocus();
  }, []);

  const handleLogin = async () => { // MODIFICAR
  if (!email.trim()) {
    Alert.alert('Erro', 'Por favor, informe seu email');
    return;
  }

  if (!password) {
    Alert.alert('Erro', 'Por favor, informe sua senha');
    return;
  }

  setLoading(true);

  try {
    const result = await authService.login(email, password);

    if (result.success) {
      router.replace('/tabs');
    } else {
      Alert.alert('Erro', result.message);
    }
  } catch (error) {
    Alert.alert('Erro', 'Ocorreu um erro ao fazer login');
    console.error('Erro no login:', error);
  } finally {
    setLoading(false);
  }
};

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/tabs');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const googleAuthUrl = 'https://accounts.google.com/oauth/authorize?' +
        'client_id=SEU_CLIENT_ID_AQUI&' +
        'redirect_uri=SEU_REDIRECT_URI&' +
        'response_type=code&' +
        'scope=openid%20email%20profile&' +
        'state=random_state_string';
      
      const result = await WebBrowser.openAuthSessionAsync(
        googleAuthUrl,
        'SEU_REDIRECT_URI'
      );

      if (result.type === 'success') {
        console.log('Autenticação bem-sucedida:', result.url);
      } else {
        console.log('Autenticação cancelada ou falhou');
      }
    } catch (error) {
      console.error('Erro na autenticação:', error);
    }
  };

  const styles = StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 16,
      paddingBottom: 40,
      paddingTop: 0,
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
    keyboardView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 60,
      paddingBottom: 40,
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: 40,
    },
    logo: {
      width: 130,
      height: 90,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      textAlign: 'center',
      color: temaAplicado === 'dark' ? '#fff' : '#000',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      textAlign: 'center',
      color: temaAplicado === 'dark' ? '#ccc' : '#666',
      marginBottom: 40,
    },
    inputContainer: {
      marginBottom: 20,
    },
    label: {
      fontSize: 16,
      fontWeight: '500',
      color: temaAplicado === 'dark' ? '#fff' : '#000',
      marginBottom: 8,
    },
    input: {
      height: 56,
      borderWidth: 2,
      borderColor: temaAplicado === 'dark' ? '#FFF' : '#000',
      borderRadius: 8,
      paddingHorizontal: 16,
      fontSize: 16,
      color: temaAplicado === 'dark' ? '#fff' : '#000',
      backgroundColor: temaAplicado === 'dark' ? '#111' : '#fff',
    },
    passwordContainer: {
      position: 'relative',
    },
    passwordInput: {
      height: 56,
      borderWidth: 2,
      borderColor: temaAplicado === 'dark' ? '#FFF' : '#000',
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingRight: 50,
      fontSize: 16,
      color: temaAplicado === 'dark' ? '#fff' : '#000',
      backgroundColor: temaAplicado === 'dark' ? '#111' : '#fff',
    },
    eyeButton: {
      position: 'absolute',
      right: 16,
      top: 16,
      padding: 4,
    },
    forgotContainer: {
      alignItems: 'center',
      marginBottom: 30,
    },
    forgotText: {
      fontSize: 16,
      color: temaAplicado === 'dark' ? '#fff' : '#000',
      textDecorationLine: 'underline',
    },
    loginButton: {
      height: 56,
      backgroundColor: temaAplicado === 'dark' ? '#fff' : '#000',
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 30,
    },
    loginButtonText: {
      fontSize: 18,
      fontWeight: '600',
      color: temaAplicado === 'dark' ? '#000' : '#fff',
    },
    loginButtonDisabled: {
      backgroundColor: temaAplicado === 'dark' ? '#888' : '#ccc',
      opacity: 0.7,
    },
    dividerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 30,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: temaAplicado === 'dark' ? '#333' : '#e0e0e0',
    },
    dividerText: {
      marginHorizontal: 16,
      fontSize: 16,
      color: temaAplicado === 'dark' ? '#ccc' : '#666',
    },
    googleButton: {
      height: 56,
      backgroundColor: temaAplicado === 'dark' ? '#fff' : '#fff',
      borderWidth: temaAplicado === 'dark' ? 0 : 1,
      borderColor: '#000',
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 40,
    },
    googleIcon: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#4285f4',
      marginRight: 12,
    },
    googleButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: '#000',
    },
    createAccountContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    createAccountText: {
      fontSize: 16,
      color: temaAplicado === 'dark' ? '#ccc' : '#666',
    },
    createAccountLink: {
      fontSize: 16,
      color: temaAplicado === 'dark' ? '#fff' : '#000',
      textDecorationLine: 'underline',
      fontWeight: '500',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={handleGoBack}
              accessibilityRole='button'
              accessibilityLabel='Voltar'
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

          <View style={styles.logoContainer}>
            <Image
                source={
                    temaAplicado === "dark"
                    ? require("../assets/images/logo-escuro.png")
                    : require("../assets/images/logo-claro.png")
                }
                style={styles.logo}
                />
          </View>

          <Text style={styles.title} ref={titleRef} accessibilityRole="header">Entre com sua Conta</Text>
          <Text style={styles.subtitle}>Preencha seu email e senha para entrar</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder='Email'
              placeholderTextColor={theme === 'dark' ? '#888' : '#666'}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="Senha"
                placeholderTextColor={theme === 'dark' ? '#888' : '#666'}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={24}
                  color={temaAplicado === 'dark' ? '#888' : '#666'}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            accessibilityRole='button'
          >
            {loading ? (
              <ActivityIndicator color={temaAplicado === 'dark' ? '#000' : '#fff'} />
            ) : (
              <Text style={styles.loginButtonText}>Entrar</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
            <Image source={require('../assets/images/icone-google.png')} />
            <Text style={styles.googleButtonText}> Entrar com Google</Text>
          </TouchableOpacity>

          <View style={styles.createAccountContainer}>
            <Text style={styles.createAccountText}>Não tem uma conta? </Text>
            <TouchableOpacity onPress={() => router.push('/tabs/cadastro')}>
              <Text style={styles.createAccountLink}>Criar Conta</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
    </SafeAreaView>
  );
}