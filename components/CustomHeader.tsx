// ===================================================================
// CustomHeader.tsx - CORRIGIDO: Integração com MicrophoneContext
// ===================================================================

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet,
  LayoutChangeEvent // Adicionado que estava faltando no seu import
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../components/ThemeContext';
import { usePathname } from 'expo-router';
import { useAuth } from '../components/AuthContext';
import { useSpeech } from '../hooks/useSpeech';
import LogoutModal from '../components/LogoutModal';
import { tutoriaisDasTelas } from '../utils/tutoriais';
import { useTutorial } from '../components/TutorialContext'; // Ajuste o caminho se necessário
// ✅ IMPORTANTE: Importar o contexto do microfone
import { useMicrophone } from '../components/MicrophoneContext';

interface CustomHeaderProps {
  title: string;
  mudaTema?: () => void;
  abreLogin?: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
}

export interface CustomHeaderHandle {
  focusTitle: () => void;
}

const CustomHeader = forwardRef<CustomHeaderHandle, CustomHeaderProps>(
  ({ title, mudaTema, abreLogin, onLayout }, ref) => {
    const insets = useSafeAreaInsets();
    const { cores, temaAplicado, getFontSize, getIconSize } = useTheme();
    const pathname = usePathname();
    const { user, logout } = useAuth(); 
    const tituloRef = useRef(null);

    const [logoutModalVisible, setLogoutModalVisible] = useState(false);
    
    // ✅ NOVO: Usar o estado global do microfone
    const { isMicrophoneEnabled, toggleMicrophone: toggleGlobalMic } = useMicrophone();
    
    const { reproduzirTutorial } = useTutorial();

    // Hook para escuta local (apenas para o modal de logout, se necessário)
    // Nota: O header em si não precisa "ouvir" comandos o tempo todo, 
    // quem ouve comandos globais é a tela ativa.
    const { 
      speak,
      stopListening,
      stopSpeaking 
    } = useSpeech({
      enabled: false, // O Header não ouve ativamente, só fala feedback
      mode: 'local',
    });

    const handleToggleMicrofone = () => {
      // ✅ Alterna o estado GLOBAL do microfone
      toggleGlobalMic();
      
      // Feedback falado
      if (isMicrophoneEnabled) {
        // Estava ligado, vai desligar
        speak("Microfone desativado.");
      } else {
        // Estava desligado, vai ligar
        speak("Microfone ativado.");
      }
    };

    const handleAbrirTutorial = () => {
      const texto = tutoriaisDasTelas[pathname] || "Tutorial não disponível para esta tela.";
      reproduzirTutorial(texto);
    };

    const abrirModalLogout = () => {
      setLogoutModalVisible(true);
    };

    const fecharModalLogout = () => {
      setLogoutModalVisible(false);
    };

    const handleLoginIconPress = () => {
      if (user) {
        abrirModalLogout();
      } else {
        if (abreLogin) {
          abreLogin();
        }
      }
    };
    
    const handleLogout = async () => {
      await logout();
      fecharModalLogout(); // Fecha modal após logout
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
      titleContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
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
      <View style={styles.header} accessible={false} onLayout={onLayout}>
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
            <Ionicons
              name={temaAplicado === 'dark' ? 'moon-outline' : 'sunny-outline'}
              size={getIconSize('large')}
              color={cores.icone}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleToggleMicrofone}
            style={styles.iconButton}
            // ✅ Usa o estado global para definir o ícone e label
            accessibilityLabel={isMicrophoneEnabled ? "Desativar Microfone" : "Ativar Microfone"}
            accessibilityRole="button"
          >
            <Ionicons 
              name={isMicrophoneEnabled ? "mic" : "mic-off"}
              size={getIconSize('medium')} 
              color={isMicrophoneEnabled ? cores.texto : cores.icone} // Destaque visual quando ativo
            />
          </TouchableOpacity>
        </View>
        
        <View style={styles.titleContainer}>
          <View style={styles.iconButton} />
          <Text
            ref={tituloRef}
            style={styles.title}
            accessibilityRole='header'
          >
            {title}
          </Text>
          <TouchableOpacity
            onPress={handleAbrirTutorial}
            style={styles.iconButton}
            accessibilityLabel="Tutorial"
            accessibilityHint="Abre o tutorial de ajuda para esta tela"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons 
              name="help-circle-outline" 
              color={cores.icone} 
              size={getIconSize('large')} 
            />
          </TouchableOpacity>
        </View>

        
        <View 
          style={[styles.sideContainer, { justifyContent: 'flex-end' }]} 
          accessible={false}
        >
          <TouchableOpacity
            onPress={handleLoginIconPress}
            style={styles.iconButton}
            accessibilityLabel={user ? 'Sair' : 'Login'}
            accessibilityRole="button"
          >
            <Ionicons 
              name={user ? "exit-outline" : "log-in-outline"}
              size={getIconSize('large')} 
              color={cores.icone} 
            />
          </TouchableOpacity>
        </View>
        
        <LogoutModal
          visible={logoutModalVisible}
          onClose={fecharModalLogout}
          onConfirm={handleLogout}
        />
      </View>
    );
  }
);

CustomHeader.displayName = 'CustomHeader';

export default CustomHeader;