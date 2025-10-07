import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, findNodeHandle, AccessibilityInfo } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../components/ThemeContext';
import { usePathname, useRouter } from 'expo-router';

interface CustomHeaderProps {
  title: string;
  mudaTema?: () => void;
  abreConfiguracoes?: () => void;
}

export default function CustomHeader({ title, mudaTema, abreConfiguracoes }: CustomHeaderProps) {
  const insets = useSafeAreaInsets();
  const { cores, temaAplicado, getFontSize, getIconSize } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  // 🔥 Mapeia tutoriais por rota
  const tutoriais: Record<string, string> = {
    '/tabs/historico': 'Aqui você pode ver suas conversas salvas.',
    '/tabs/configuracoes': 'Aqui você pode ajustar as preferências do aplicativo, como tema e voz.',
    '/tabs/editarPerfil': 'Nesta tela você pode atualizar suas informações pessoais.',
    '/login': 'Diga entrar com google para usar seu gmail salvo no celular ou diga email para preencher o campo de email e depois senha para preencher o campo de senha. Quando estiverem preenchidos diga entrar.',
    '/tabs': 'Para enviar uma foto, diga "Escute" e faça uma pergunta. Ou clique no botão Tirar Foto e faça uma pergunta',
  };

  const handleAbrirTutorial = () => {
    const texto = tutoriais[pathname] || 'Este é o aplicativo. Use os botões ou comandos de voz para navegar.';
    // Aqui você pode abrir um modal, ou falar o texto via TTS
    // Exemplo com expo-speech:
    import('expo-speech').then(Speech => {
      Speech.speak(texto, { language: 'pt-BR' });
    });
  };

  const styles = StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      minHeight: 100,
      paddingTop: insets.top,
      backgroundColor: cores.barrasDeNavegacao,
      borderBottomWidth: 1,
      borderColor: cores.icone,
    },
    sideContainer: {
      width: 80,
      flexDirection: 'row',
    },
    title: {
      textAlign: 'center',
      fontSize: getFontSize('xxlarge'),
      fontWeight: '600',
      color: cores.texto,
      marginHorizontal: 8,
    },
    iconButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  return (
    <View style={styles.header} accessible={false}>
      <View style={[styles.sideContainer, { justifyContent: 'flex-start' }]} accessible={false}>
        <TouchableOpacity
          onPress={mudaTema}
          style={styles.iconButton}
          accessibilityLabel="Mudar Tema"
          accessibilityHint={`Tema atual: ${temaAplicado === 'dark' ? 'escuro' : 'claro'}`}
          accessibilityRole="button"
        >
          <Ionicons
            name={temaAplicado === 'dark' ? 'moon-outline' : 'sunny-outline'}
            size={getIconSize('large')}
            color={cores.icone}
          />
        </TouchableOpacity>
      </View>

      <Text
        style={styles.title}
        accessible={true}
        accessibilityRole="header"
        accessibilityLabel={`Página: ${title}`}
      >
        {title}
      </Text>

      <View style={[styles.sideContainer, { justifyContent: 'flex-end' }]} accessible={false}>
        <TouchableOpacity
          onPress={handleAbrirTutorial}
          style={styles.iconButton}
          accessibilityLabel="Tutorial"
          accessibilityHint="Abre o tutorial de ajuda para esta tela"
          accessibilityRole="button"
        >
          <Ionicons name="help-circle-outline" size={getIconSize('large')} color={cores.icone} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={abreConfiguracoes}
          style={styles.iconButton}
          accessibilityLabel="Configurações"
          accessibilityHint="Abre as configurações do aplicativo"
          accessibilityRole="button"
        >
          <Ionicons name="settings-outline" size={getIconSize('large')} color={cores.icone} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
