import React from 'react';
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
  const { theme, cores } = useTheme();
  const [fontSize, setFontSize] = React.useState(16);

  const handleGoBack = () => {
    router.back();
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

  const styles = StyleSheet.create({
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
      fontSize: 20,
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
      fontSize: 16,
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
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    optionText: {
      flex: 1,
      fontSize: 16,
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
      fontSize: 14,
      color: cores.texto,
      fontWeight: 'bold',
    },
    slider: {
      flex: 1,
      marginHorizontal: 16,
      height: 40,
    },
  });

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
                size={24} 
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
                onPress={handleEditProfile}
              >
                <View style={styles.optionIcon}>
                  <Ionicons 
                    name="person-outline" 
                    size={20} 
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
                    size={20} 
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
                    size={20} 
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
                    size={20} 
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
                    size={20} 
                    color={cores.icone} 
                  />
                </View>
                <Text style={styles.optionText}>Liberar Espaço</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tamanho da Fonte Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tamanho da Fonte</Text>
            <View style={styles.sliderContainer}>
              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabel}>a</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={12}
                  maximumValue={24}
                  value={fontSize}
                  onValueChange={setFontSize}
                  minimumTrackTintColor={cores.icone}
                  maximumTrackTintColor={theme === 'dark' ? '#555' : '#ccc'}
                />
                <Text style={[styles.sliderLabel, { fontSize: 18, fontWeight: 'bold' }]}>
                  A
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
    </View>
  );
}