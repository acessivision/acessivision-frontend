import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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

  const styles = StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      minHeight: 100,
      paddingTop: insets.top,
      backgroundColor: cores.barrasDeNavegacao,
      borderBottomWidth: 1,
      borderColor: cores.icone,
    },
    title: {
      fontSize: getFontSize('xxlarge'),
      fontWeight: '600',
      flex: 1,
      textAlign: 'center',
      color: cores.texto,
    },
    iconButton: {
      width: 40,
      alignItems: 'center',
    },
  });

  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={mudaTema} style={styles.iconButton}>
        <Ionicons name={temaAplicado === 'dark' ? 'moon-outline' : 'sunny-outline'} size={getIconSize('large')} color={cores.icone} />
      </TouchableOpacity>

      <Text style={styles.title}>{title}</Text>

      <TouchableOpacity onPress={abreConfiguracoes} style={styles.iconButton}>
        <Ionicons name="settings" size={getIconSize('large')} color={cores.icone} />
      </TouchableOpacity>
    </View>
  );
}