import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../components/ThemeContext';
import { useRouter } from 'expo-router';
import authService from '../services/authService';

export default function SignUpScreen() {
  const router = useRouter();
  const { temaAplicado, cores, getIconSize, getFontSize } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGoBack = () => {
    router.back();
  };

  const handleCreateAccount = async () => {
    if (!email.trim()) {
      Alert.alert('Erro', 'Por favor, informe seu email');
      return;
    }

    if (!password) {
      Alert.alert('Erro', 'Por favor, informe sua senha');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Erro', 'A senha deve ter no mínimo 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      await authService.register(email, password);
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro ao criar a conta');
      console.error('Erro ao criar conta:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    router.push('/login');
  };

  const styles = StyleSheet.create({
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
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 40,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 24,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: temaAplicado === 'dark' ? '#fff' : '#000',
      marginBottom: 40,
      letterSpacing: -0.5,
    },
    inputContainer: {
      marginBottom: 24,
    },
    label: {
      fontSize: 16,
      fontWeight: '500',
      color: temaAplicado === 'dark' ? '#fff' : '#000',
      marginBottom: 8,
    },
    input: {
      height: 56,
      borderWidth: 1.5,
      borderColor: temaAplicado === 'dark' ? '#fff' : '#000',
      borderRadius: 12,
      paddingHorizontal: 16,
      fontSize: 16,
      color: temaAplicado === 'dark' ? '#000' : '#000',
      backgroundColor: '#fff',
    },
    passwordContainer: {
      position: 'relative',
    },
    passwordInput: {
      height: 56,
      borderWidth: 1.5,
      borderColor: temaAplicado === 'dark' ? '#fff' : '#000',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingRight: 50,
      fontSize: 16,
      color: temaAplicado === 'dark' ? '#000' : '#000',
      backgroundColor: '#fff',
    },
    eyeButton: {
      position: 'absolute',
      right: 14,
      top: '50%',
      transform: [{ translateY: -12 }],
      padding: 4,
    },
    createButton: {
      height: 56,
      backgroundColor: temaAplicado === 'dark' ? '#fff' : '#000',
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
      marginTop: 8,
    },
    createButtonDisabled: {
      opacity: 0.6,
    },
    createButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: temaAplicado === 'dark' ? '#000' : '#fff',
    },
    loginContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    loginText: {
      fontSize: 15,
      color: temaAplicado === 'dark' ? '#fff' : '#000',
    },
    loginLink: {
      fontSize: 15,
      color: temaAplicado === 'dark' ? '#fff' : '#000',
      textDecorationLine: 'underline',
      fontWeight: '600',
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

        <Text style={styles.title}>Criar Conta</Text>

        {/* Email Field */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="joaosilva@gmail.com"
            placeholderTextColor="#999"
            editable={!loading}
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
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor="#999"
              editable={!loading}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
              disabled={loading}
            >
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={22}
                color={temaAplicado === 'dark' ? '#666' : '#666'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Create Account Button */}
        <TouchableOpacity 
          style={[styles.createButton, loading && styles.createButtonDisabled]}
          onPress={handleCreateAccount}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={temaAplicado === 'dark' ? '#000' : '#fff'} />
          ) : (
            <Text style={styles.createButtonText}>Criar Conta</Text>
          )}
        </TouchableOpacity>

        {/* Login Link */}
        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Já tem uma conta? </Text>
          <TouchableOpacity onPress={handleLogin} disabled={loading}>
            <Text style={styles.loginLink}>Entrar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}