import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../components/ThemeContext';
import Slider from '@react-native-community/slider';

export default function ConfigScreen() {
  const router = useRouter();
  const { theme, cores, fontScale, setFontScale, getFontSize, getIconSize } = useTheme();
  const [isSliding, setIsSliding] = useState(false);

  const handleGoBack = () => {
    router.back();
  };

  const handleFazerLogin = () => {
    router.push('../../login');
  };

  const handleEditProfile = () => {
    router.push('./editarPerfil');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Excluir Conta',
      'Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive' },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair da sua conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive' },
      ]
    );
  };

  const handleAbout = () => {
    Alert.alert('Sobre', 'Informações sobre o aplicativo');
  };

  const handleFreeSpace = () => {
    Alert.alert('Liberar Espaço', 'Limpando cache e arquivos temporários...');
  };

  // Memoize the styles to prevent recalculation on every render
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: cores.fundo,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: cores.fundo,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    backIcon: {
      marginRight: 16,
    },
    headerTitle: {
      fontSize: getFontSize('large'),
      fontWeight: 'bold',
      color: cores.texto,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: getFontSize('medium'),
      fontWeight: 'bold',
      color: cores.texto,
      marginBottom: 8,
    },
    optionContainer: {
      backgroundColor: theme === 'dark' ? '#2a2a2a' : '#f5f5f5',
      borderRadius: 12,
      overflow: 'hidden',
      outlineColor: '#000',
      outlineWidth: 1,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
    },
    lastOption: {
      borderBottomWidth: 0,
    },
    optionIcon: {
      marginRight: 12,
      width: getIconSize('medium'),
      height: getIconSize('medium'),
      justifyContent: 'center',
      alignItems: 'center',
    },
    optionText: {
      flex: 1,
      fontSize: getFontSize('medium'),
      color: cores.texto,
    },
    deleteText: {
      color: theme === 'dark' ? '#ffeb3b' : '#d32f2f',
    },
    sliderContainer: {
      backgroundColor: theme === 'dark' ? '#2a2a2a' : '#f5f5f5',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 20,
      outlineColor: '#000',
      outlineWidth: 1,
    },
    sliderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sliderLabel: {
      fontSize: getFontSize('small'),
      color: cores.texto,
      fontWeight: 'bold',
    },
    sliderLabelLarge: {
      fontSize: getFontSize('medium'),
      color: cores.texto,
      fontWeight: 'bold',
    },
    slider: {
      flex: 1,
      marginHorizontal: 16,
      height: 40,
    },
    previewText: {
      fontSize: getFontSize('medium'),
      color: cores.texto,
      textAlign: 'center',
      marginTop: 12,
    },
  }), [theme, cores, getFontSize, getIconSize]); // Only recalculate when these change

  // Handle slider changes with proper tap/drag distinction
  const handleSliderChange = (value: number) => {
    if (isSliding) {
      setFontScale(value);
    }
  };

  const handleSlidingStart = () => {
    setIsSliding(true);
  };

  const handleSlidingComplete = (value: number) => {
    setIsSliding(false);
    setFontScale(value); // Always update on completion (handles taps)
  };

  return (
    <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleGoBack}
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

        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Conta</Text>
            <View style={styles.optionContainer}>
              <TouchableOpacity 
                style={styles.option} 
                onPress={handleFazerLogin}
              >
                <View style={styles.optionIcon}>
                  <Ionicons 
                    name="log-in-outline" 
                    size={getIconSize('small')} 
                    color={cores.icone} 
                  />
                </View>
                <Text style={styles.optionText}>Fazer Login</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.option} 
                onPress={handleEditProfile}
              >
                <View style={styles.optionIcon}>
                  <Ionicons 
                    name="person-outline" 
                    size={getIconSize('small')} 
                    color={cores.icone} 
                  />
                </View>
                <Text style={styles.optionText}>Editar Perfil</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.option} 
                onPress={handleDeleteAccount}
              >
                <View style={styles.optionIcon}>
                  <Ionicons 
                    name="warning-outline" 
                    size={getIconSize('small')} 
                    color={theme === 'dark' ? '#ffeb3b' : '#d32f2f'} 
                  />
                </View>
                <Text style={[styles.optionText, styles.deleteText]}>
                  Excluir Conta
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.option, styles.lastOption]} 
                onPress={handleLogout}
              >
                <View style={styles.optionIcon}>
                  <Ionicons 
                    name="exit-outline" 
                    size={getIconSize('small')} 
                    color={cores.icone} 
                  />
                </View>
                <Text style={styles.optionText}>Sair</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sobre</Text>
            <View style={styles.optionContainer}>
              <TouchableOpacity 
                style={[styles.option, styles.lastOption]} 
                onPress={handleAbout}
              >
                <View style={styles.optionIcon}>
                  <Ionicons 
                    name="information-circle-outline" 
                    size={getIconSize('small')} 
                    color={cores.icone} 
                  />
                </View>
                <Text style={styles.optionText}>Sobre</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Armazenamento Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Armazenamento</Text>
            <View style={styles.optionContainer}>
              <TouchableOpacity 
                style={[styles.option, styles.lastOption]} 
                onPress={handleFreeSpace}
              >
                <View style={styles.optionIcon}>
                  <Ionicons 
                    name="trash-outline" 
                    size={getIconSize('small')} 
                    color={cores.icone} 
                  />
                </View>
                <Text style={styles.optionText}>Liberar Espaço</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
    </View>
  );
}