import React, { useMemo } from 'react';
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

export default function ConfigScreen() {
  const router = useRouter();
  const { theme, cores, getFontSize, getIconSize } = useTheme();

  const handleFazerLogin = () => {
    router.push('/login');
  };

  const handleEditProfile = () => {
    router.push('/tabs/editarPerfil');
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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: cores.fundo,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between', // MUDANÇA: adiciona espaço entre elementos
          paddingHorizontal: 16,
          paddingVertical: 16,
          backgroundColor: cores.fundo,
        },
        backButton: {
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
        // NOVO: estilo para o botão de login no header
        loginIconButton: {
          padding: 8,
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
          borderWidth: 1,
          borderColor: theme === 'dark' ? '#3a3a3a' : '#000',
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
      }),
    [theme, cores, getFontSize, getIconSize]
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conta</Text>
          <View style={styles.optionContainer}>
            <TouchableOpacity style={styles.option} onPress={handleFazerLogin}>
              <View style={styles.optionIcon}>
                <Ionicons
                  name="log-in-outline"
                  size={getIconSize('small')}
                  color={cores.icone}
                />
              </View>
              <Text style={styles.optionText}>Fazer Login</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.option} onPress={handleEditProfile}>
              <View style={styles.optionIcon}>
                <Ionicons
                  name="person-outline"
                  size={getIconSize('small')}
                  color={cores.icone}
                />
              </View>
              <Text style={styles.optionText}>Editar Perfil</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.option} onPress={handleDeleteAccount}>
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
      </ScrollView>
    </View>
  );
}