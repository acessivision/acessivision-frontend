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
import { Link, useRouter } from 'expo-router';
import { useAuth } from '../components/AuthContext';

export default function LoginScreen() {
  const titleRef = useRef(null);
  const router = useRouter();
  const { temaAplicado, cores, getIconSize, getFontSize } = useTheme();
  const [loading, setLoading] = useState(false);
  const { loginWithGoogle } = useAuth();

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
        Alert.alert('Sucesso', 'Login realizado com sucesso!');
        router.replace('/tabs');
      } else {
        Alert.alert('Erro', result.message || 'Falha ao autenticar com o Google.');
      }
    } catch (error) {
      console.error("Erro no login com Google:", error);
      Alert.alert('Erro', 'Ocorreu um erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

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
    keyboardView: {
      flex: 1,
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
  });

  return (
    <SafeAreaView style={styles.container}>
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
              <Text style={styles.title}>AcessiVision</Text>
          </View>

          <Text style={styles.subtitle}>Entre no AcessiVision e desfrute de todas as funcionalidades!</Text>

          <TouchableOpacity 
            style={styles.googleButton} 
            onPress={handleGoogleLogin}
            disabled={loading}
          >
            <Image source={require('../assets/images/icone-google.png')} />
            <Text style={styles.googleButtonText}> Entrar com Google</Text>
          </TouchableOpacity>
        </View>
    </SafeAreaView>
  );
}