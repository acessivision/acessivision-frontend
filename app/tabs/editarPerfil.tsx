import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../components/ThemeContext';

export default function EditProfileScreen() {
  const router = useRouter();
  const { cores, temaAplicado } = useTheme();
  const [nome, setNome] = useState('João da Silva');
  const [email, setEmail] = useState('joaosilva@gmail.com');
  const [senha, setSenha] = useState('*******');
  const [showPassword, setShowPassword] = useState(false);

  const handleGoBack = () => {
    router.back();
  };

  const handleUpdateData = () => {
    // Functionality will be implemented later
    console.log('Atualizar Dados pressed');
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
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
      paddingTop: 60, // Account for status bar
      backgroundColor: cores.fundo,
    },
    backButton: {
      marginRight: 16,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: cores.texto,
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 24,
    },
    inputContainer: {
      marginBottom: 24,
    },
    label: {
      fontSize: 16,
      fontWeight: '500',
      color: cores.texto,
      marginBottom: 8,
    },
    inputWrapper: {
      position: 'relative',
    },
    input: {
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: temaAplicado === 'dark' ? '#fff' : '#000',
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 16,
      fontSize: 16,
      color: '#000',
    },
    passwordInput: {
      paddingRight: 50, // Make room for the eye icon
    },
    eyeIcon: {
      position: 'absolute',
      right: 16,
      top: '50%',
      marginTop: -12, // Half of icon size to center it
    },
    updateButton: {
      backgroundColor: temaAplicado === 'dark' ? '#ffffff' : '#000000',
      borderRadius: 8,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 32,
    },
    updateButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: temaAplicado === 'dark' ? '#000000' : '#ffffff',
    },
    bottomTabsSpace: {
      height: 100, // Space for bottom navigation
    },
  });

  return (
    <View style={styles.container}>
      <StatusBar
        backgroundColor={cores.fundo}
        barStyle={temaAplicado === 'dark' ? 'light-content' : 'dark-content'}
      />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleGoBack}
        >
          <Ionicons 
            name="arrow-back" 
            size={24} 
            color={cores.icone} 
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voltar</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Nome</Text>
          <TextInput
            style={styles.input}
            value={nome}
            onChangeText={setNome}
            placeholder="Digite seu nome"
            placeholderTextColor={temaAplicado === 'dark' ? '#888' : '#999'}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Digite seu email"
            placeholderTextColor={temaAplicado === 'dark' ? '#888' : '#999'}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Senha</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={senha}
              onChangeText={setSenha}
              placeholder="Digite sua senha"
              placeholderTextColor={temaAplicado === 'dark' ? '#888' : '#999'}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity 
              style={styles.eyeIcon}
              onPress={togglePasswordVisibility}
            >
              <Ionicons 
                name={showPassword ? 'eye-off' : 'eye'} 
                size={24} 
                color={cores.icone} 
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.updateButton}
          onPress={handleUpdateData}
        >
          <Text style={styles.updateButtonText}>Atualizar Dados</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomTabsSpace} />
    </View>
  );
}