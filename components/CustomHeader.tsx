// ===================================================================
// CustomHeader.tsx - CORRIGIDO: Foco único no título
// ===================================================================

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  findNodeHandle,
  AccessibilityInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../components/ThemeContext';
import { usePathname } from 'expo-router';
import { LayoutChangeEvent } from 'react-native';
import { useAuth } from '../components/AuthContext';
import { useSpeech } from '../hooks/useSpeech';
import { useIsFocused } from '@react-navigation/native';
import { useTalkBackState } from '../hooks/useTalkBackState';
import SpeechManager from '../utils/speechManager';
import LogoutModal from '../components/LogoutModal';

interface CustomHeaderProps {
  title: string;
  mudaTema?: () => void;
  abreLogin?: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
}

type LogoutStepType = 'idle' | 'aguardandoConfirmacaoLogout';

export interface CustomHeaderHandle {
  focusTitle: () => void;
}

const CustomHeader = forwardRef<CustomHeaderHandle, CustomHeaderProps>(
  ({ title, mudaTema, abreLogin, onLayout }, ref) => {
    const insets = useSafeAreaInsets();
    const { cores, temaAplicado, getFontSize, getIconSize } = useTheme();
    const pathname = usePathname();
    const isFocused = useIsFocused();
    const { user, logout } = useAuth(); 
    const tituloRef = useRef(null);

    const { isActive: isTalkBackActive, isSpeaking: isTalkBackSpeaking, markAsSpeaking } = useTalkBackState();

    const [logoutModalVisible, setLogoutModalVisible] = useState(false);
    const [step, setStep] = useState<LogoutStepType>('idle');
    const logoutTimeoutRef = useRef<any>(null);
    const focusTimeoutRef = useRef<any>(null);
    
    // ✅ NOVO: Controla se já anunciou para este pathname
    const lastAnnouncedPathRef = useRef<string>('');
    const isAnnouncingRef = useRef(false);

    const { 
      speak, 
      startListening, 
      stopListening,
      stopSpeaking,
      isListening,
      recognizedText,
      setRecognizedText 
    } = useSpeech({
      enabled: logoutModalVisible,
      mode: 'local',
    });

    // ✅ Expõe método para focar no título externamente
    useImperativeHandle(ref, () => ({
      focusTitle: () => {
        if (tituloRef.current && !isAnnouncingRef.current) {
          const reactTag = findNodeHandle(tituloRef.current);
          if (reactTag) {
            console.log('[CustomHeader] 🎯 Foco externo solicitado no título');
            isAnnouncingRef.current = true;
            AccessibilityInfo.setAccessibilityFocus(reactTag);
            
            const textLength = title.length;
            const estimatedDuration = Math.max(2500, textLength * 60);
            markAsSpeaking(estimatedDuration);
            
            setTimeout(() => {
              isAnnouncingRef.current = false;
            }, estimatedDuration);
          }
        }
      }
    }));

    useEffect(() => {
      SpeechManager.setTalkBackSpeakingCallback((isSpeaking) => {
        if (isSpeaking) {
          const estimatedDuration = 3000;
          markAsSpeaking(estimatedDuration);
        }
      });
      
      return () => {
        SpeechManager.setTalkBackSpeakingCallback(() => {});
      };
    }, [markAsSpeaking]);

    // ✅ Cleanup ao desmontar
    useEffect(() => {
      return () => {
        if (logoutTimeoutRef.current) {
          clearTimeout(logoutTimeoutRef.current);
        }
        if (focusTimeoutRef.current) {
          clearTimeout(focusTimeoutRef.current);
        }
        isAnnouncingRef.current = false;
      };
    }, []);

    const toggleMicrofone = () => {
      if (isTalkBackSpeaking) {
        AccessibilityInfo.announceForAccessibility("Aguarde o anúncio terminar.");
        return;
      }

      if (isListening) {
        stopListening();
        speak("Microfone desativado.");
      } else {
        startListening();
        speak("Microfone ativado.");
      }
    };

    const tutoriais: Record<string, string> = {
      '/tabs/historico': 'Aqui você pode ver suas conversas salvas.',
      '/tabs/menu': 'Aqui você pode ajustar as preferências do aplicativo.',
      '/tabs/editarPerfil': 'Nesta tela você pode atualizar suas informações.',
      '/login': 'Diga entrar com google para usar seu gmail.',
      '/tabs': 'Para enviar uma foto, diga "Escuta" e faça uma pergunta.',
    };

    const handleAbrirTutorial = () => {
      const texto = tutoriais[pathname] || 'Este é o aplicativo.';
      
      const estimatedDuration = Math.max(3000, texto.length * 60);
      markAsSpeaking(estimatedDuration);
      
      if (isTalkBackActive) {
        AccessibilityInfo.announceForAccessibility(texto);
      } else {
        import('expo-speech').then(Speech => {
          Speech.speak(texto, { language: 'pt-BR' });
        });
      }
    };

    useEffect(() => {
      if (!recognizedText.trim() || step !== 'aguardandoConfirmacaoLogout') return;

      const fala = recognizedText.toLowerCase().trim();

      if (logoutTimeoutRef.current) {
        clearTimeout(logoutTimeoutRef.current);
      }

      logoutTimeoutRef.current = setTimeout(() => {
        const confirmWords = ['sim', 'confirmo', 'confirmar', 'isso', 'exato', 'certo', 'ok', 'yes', 'pode', 'quero', 'sair'];
        const denyWords = ['não', 'nao', 'cancelar', 'cancel', 'errado', 'no', 'negativo', 'nunca'];
        
        const isConfirm = confirmWords.some(word => fala.includes(word));
        const isDeny = denyWords.some(word => fala.includes(word));
        
        if (isConfirm) {
          stopListening();
          setRecognizedText('');
          speak("Confirmado. Saindo da conta.", () => {
            handleLogout();
          });
        } else if (isDeny) {
          stopListening();
          setRecognizedText('');
          speak("Cancelado.", () => {
            fecharModalLogout();
          });
        } else {
          setRecognizedText('');
          speak(`Não entendi. Você quer sair da conta? Diga sim ou não.`, () => {
            startListening(true);
          });
        }
      }, 1500);

    }, [recognizedText, step, logoutModalVisible]);

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
      modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      },
      modalContent: {
        backgroundColor: cores.fundo,
        borderRadius: 20,
        padding: 28,
        width: '100%',
        maxWidth: 500,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
        alignItems: 'center',
      },
      modalTitle: {
        fontSize: getFontSize('large'),
        fontWeight: 'bold',
        color: cores.texto,
        marginBottom: 16,
        textAlign: 'center',
      },
      modalMessage: {
        fontSize: getFontSize('medium'),
        color: cores.texto,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24,
      },
      modalActions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
      },
      cancelButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: cores.texto,
        alignItems: 'center',
        backgroundColor: cores.confirmar,
      },
      cancelButtonText: {
        color: '#000',
        fontSize: getFontSize('medium'),
        fontWeight: '600',
      },
      logoutButton: { 
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: cores.perigo,
        alignItems: 'center',
        justifyContent: 'center',
      },
      logoutButtonText: { 
        color: '#fff',
        fontSize: getFontSize('medium'),
        fontWeight: '600',
      },
      listeningIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        marginBottom: 16,
        width: '100%',
      },
      listeningText: {
        marginLeft: 8,
        color: cores.texto,
        fontSize: getFontSize('medium'),
        fontWeight: '500',
      },
      recognizedTextBox: {
        padding: 12,
        borderRadius: 8,
        width: '100%',
        backgroundColor: cores.barrasDeNavegacao,
        marginBottom: 20,
      },
      recognizedTextLabel: {
        fontSize: getFontSize('small'),
        fontWeight: '600',
        marginBottom: 4,
        color: cores.texto,
      },
      recognizedTextContent: {
        fontSize: getFontSize('medium'),
        fontStyle: 'italic',
        color: cores.texto,
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
            onPress={toggleMicrofone}
            style={styles.iconButton}
            accessibilityLabel={isListening ? "Desativar Microfone" : "Ativar Microfone"}
            accessibilityRole="button"
            disabled={isTalkBackSpeaking}
          >
            <Ionicons 
              name={isListening ? "mic" : "mic-off"}
              size={getIconSize('medium')} 
              color={isTalkBackSpeaking ? '#666' : (isListening ? cores.texto : cores.icone)}
              style={{ opacity: isTalkBackSpeaking ? 0.5 : 1 }}
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