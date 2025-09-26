import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../components/ThemeContext';
import * as WebBrowser from 'expo-web-browser';

export default function LoginScreen() {
  const { theme, temaAplicado } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      // URL de autenticação do Google OAuth
      const googleAuthUrl = 'https://accounts.google.com/oauth/authorize?' +
        'client_id=SEU_CLIENT_ID_AQUI&' +
        'redirect_uri=SEU_REDIRECT_URI&' +
        'response_type=code&' +
        'scope=openid%20email%20profile&' +
        'state=random_state_string';
      
      // Abre o navegador para autenticação
      const result = await WebBrowser.openAuthSessionAsync(
        googleAuthUrl,
        'SEU_REDIRECT_URI' // Deve ser o mesmo da URL acima
      );

      if (result.type === 'success') {
        // Aqui você pode processar o resultado da autenticação
        console.log('Autenticação bem-sucedida:', result.url);
        // Extrair o código de autorização da URL de retorno
        // e enviar para seu backend para trocar pelo token
      } else {
        console.log('Autenticação cancelada ou falhou');
      }
    } catch (error) {
      console.error('Erro na autenticação:', error);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: temaAplicado === 'dark' ? '#000' : '#fff',
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
          {/* Eye Icon */}
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

          {/* Title */}
          <Text style={styles.title}>Entre com sua Conta</Text>
          <Text style={styles.subtitle}>Preencha seu email e senha para entrar</Text>

          {/* Email Field */}
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

          {/* Password Field */}
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

          {/* Forgot Password */}
          <TouchableOpacity style={styles.forgotContainer}>
            <Text style={styles.forgotText}>Esqueceu Senha?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity style={styles.loginButton}>
            <Text style={styles.loginButtonText}>Entrar</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Ou</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Button */}
          <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
            <Image source={require('../assets/images/icone-google.png')} />
            <Text style={styles.googleButtonText}> Entrar com Google</Text>
          </TouchableOpacity>

          {/* Create Account */}
          <View style={styles.createAccountContainer}>
            <Text style={styles.createAccountText}>Não tem uma conta? </Text>
            <TouchableOpacity>
              <Text style={styles.createAccountLink}>Criar Conta</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
    </SafeAreaView>
  );
}