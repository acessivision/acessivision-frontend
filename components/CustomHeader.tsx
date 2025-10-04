import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, findNodeHandle, AccessibilityInfo } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../components/ThemeContext';

interface CustomHeaderProps {
  title: string;
  mudaTema?: () => void;
  abreConfiguracoes?: () => void;
}

export default function CustomHeader({ title, mudaTema, abreConfiguracoes }: CustomHeaderProps) {
  const insets = useSafeAreaInsets();
  const { cores, temaAplicado, getFontSize, getIconSize } = useTheme();
  const titleRef = useRef<Text>(null);

  // Define o foco no título quando o componente montar
  useEffect(() => {
    const timer = setTimeout(() => {
      if (titleRef.current) {
        const reactTag = findNodeHandle(titleRef.current);
        if (reactTag) {
          AccessibilityInfo.setAccessibilityFocus(reactTag);
        }
      }
    }, 100); // Pequeno delay para garantir que o componente está montado

    return () => clearTimeout(timer);
  }, [title]); // Re-executa quando o título mudar

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
    <View 
      style={styles.header}
      accessible={false}
    >
      <View 
        style={[styles.sideContainer, { justifyContent: 'flex-start' }]}
        accessible={false}
      >
        <TouchableOpacity
          onPress={mudaTema}
          style={styles.iconButton}
          accessibilityLabel="Mudar Tema"
          accessibilityHint={`Tema atual: ${temaAplicado === 'dark' ? 'escuro' : 'claro'}`}
          accessibilityRole="button"
        >
          <Ionicons name={temaAplicado === 'dark' ? 'moon-outline' : 'sunny-outline'} size={getIconSize('large')} color={cores.icone} />
        </TouchableOpacity>
      </View>

      <Text 
        ref={titleRef}
        style={styles.title} 
        accessible={true}
        accessibilityRole="header"
        accessibilityLabel={`Página: ${title}`}
      >
        {title}
      </Text>

      <View 
        style={[styles.sideContainer, { justifyContent: 'flex-end' }]}
        accessible={false}
      >
        <TouchableOpacity
          onPress={() => {}}
          style={styles.iconButton}
          accessibilityLabel="Tutorial"
          accessibilityHint="Abre o tutorial de ajuda"
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