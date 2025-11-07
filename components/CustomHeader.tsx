import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal,
  Alert, // Mantido para o caso de precisar, mas não usado no handleLogout
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../components/ThemeContext';
import { usePathname } from 'expo-router';
import { LayoutChangeEvent } from 'react-native';
import { useAuth } from '../components/AuthContext';
import { useSpeech } from '../hooks/useSpeech'; // Importa o hook de voz

interface CustomHeaderProps {
  title: string;
  mudaTema?: () => void;
  abreLogin?: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
}

// Define os passos do fluxo de voz
type LogoutStepType = 'idle' | 'aguardandoConfirmacaoLogout';

export default function CustomHeader({ title, mudaTema, abreLogin, onLayout }: CustomHeaderProps) {
  const insets = useSafeAreaInsets();
  const { cores, temaAplicado, getFontSize, getIconSize } = useTheme();
  const pathname = usePathname();
  const { user, logout } = useAuth(); 

  // --- Estados do Modal e Voz ---
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [step, setStep] = useState<LogoutStepType>('idle');
  const logoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inicializa o useSpeech
  // Ele só será ativado (enabled) quando o modal de logout estiver visível
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

  // 🔥 Mapeia tutoriais por rota
  const tutoriais: Record<string, string> = {
    '/tabs/historico': 'Aqui você pode ver suas conversas salvas.',
    '/tabs/menu': 'Aqui você pode ajustar as preferências do aplicativo, como tema e voz.',
    '/tabs/editarPerfil': 'Nesta tela você pode atualizar suas informações pessoais.',
    '/login': 'Diga entrar com google para usar seu gmail salvo no celular ou diga email para preencher o campo de email e depois senha para preencher o campo de senha. Quando estiverem preenchidos diga entrar.',
    '/tabs': 'Para enviar uma foto, diga "Escuta" e faça uma pergunta. Ou clique no botão Tirar Foto e faça uma pergunta',
  };

  const handleAbrirTutorial = () => {
    const texto = tutoriais[pathname] || 'Este é o aplicativo. Use os botões ou comandos de voz para navegar.';
    import('expo-speech').then(Speech => {
      Speech.speak(texto, { language: 'pt-BR' });
    });
  };

  // ===================================================================
  // PROCESSAR RECONHECIMENTO DE VOZ (LOGOUT)
  // ===================================================================
  useEffect(() => {
    if (!recognizedText.trim() || step !== 'aguardandoConfirmacaoLogout') return;

    const fala = recognizedText.toLowerCase().trim();
    console.log(`[Header] Step: ${step}, Fala: "${fala}"`);

    // Limpa timeout anterior
    if (logoutTimeoutRef.current) {
      clearTimeout(logoutTimeoutRef.current);
    }

    // Aguarda 1.5 segundos de silêncio
    logoutTimeoutRef.current = setTimeout(() => {
      const confirmWords = ['sim', 'confirmo', 'confirmar', 'isso', 'exato', 'certo', 'ok', 'yes', 'pode', 'quero', 'sair'];
      const denyWords = ['não', 'nao', 'cancelar', 'cancel', 'errado', 'no', 'negativo', 'nunca'];
      
      const isConfirm = confirmWords.some(word => fala.includes(word));
      const isDeny = denyWords.some(word => fala.includes(word));
      
      if (isConfirm) {
        console.log('✅ Confirmação de Logout recebida');
        stopListening();
        setRecognizedText('');
        speak("Confirmado. Saindo da conta.", () => {
          handleLogout(); // Chama a função de logout
        });
      } else if (isDeny) {
        console.log('❌ Logout cancelado pelo usuário');
        stopListening();
        setRecognizedText('');
        speak("Cancelado.", () => {
          fecharModalLogout();
        });
      } else {
        console.log('⚠️ Resposta não reconhecida, perguntando novamente');
        setRecognizedText('');
        speak(`Não entendi. Você quer sair da conta? Diga sim ou não.`, () => {
          startListening(true);
        });
      }
    }, 1500); // 1.5s de silêncio

  }, [recognizedText, step, logoutModalVisible]);

  // Cleanup do timeout
  useEffect(() => {
    return () => {
      if (logoutTimeoutRef.current) {
        clearTimeout(logoutTimeoutRef.current);
      }
    };
  }, []);

  // ===================================================================
  // FUNÇÕES DE CONTROLE DO MODAL E LOGOUT
  // ===================================================================

  const abrirModalLogout = () => {
    setStep('aguardandoConfirmacaoLogout');
    setRecognizedText('');
    setLogoutModalVisible(true);
    
    // Atraso para o modal abrir antes de falar
    setTimeout(() => {
      speak("Você tem certeza que deseja sair da sua conta? Diga sim ou não.", () => {
        startListening(true);
      });
    }, 300);
  };

  const fecharModalLogout = () => {
    stopSpeaking();
    stopListening();
    
    if (logoutTimeoutRef.current) {
      clearTimeout(logoutTimeoutRef.current);
      logoutTimeoutRef.current = null;
    }
    
    setLogoutModalVisible(false);
    setStep('idle');
    setRecognizedText('');
  };

  const handleLoginIconPress = () => {
    if (user) {
      abrirModalLogout(); // Chama a função de abrir o modal com voz
    } else {
      if (abreLogin) {
        abreLogin();
      }
    }
  };
  
  // ✅ ========================================================
  // ✅ handleLogout MODIFICADO para usar speak()
  // ✅ ========================================================
  const handleLogout = async () => {
    try {
      await logout();
      await speak('Sucesso. Você saiu da sua conta.'); // ✅ Modificado
    } catch (error) {
      await speak('Erro. Não foi possível sair da conta.'); // ✅ Modificado
    } finally {
      fecharModalLogout(); // Fecha e limpa tudo, independente de sucesso ou falha
    }
  };
  // ✅ ========================================================

  // Função para o botão "Sair" (confirmação manual)
  const handleLogoutManual = () => {
    console.log('[Header] Confirmação manual via botão');
    stopSpeaking();
    stopListening();
    
    if (logoutTimeoutRef.current) {
      clearTimeout(logoutTimeoutRef.current);
      logoutTimeoutRef.current = null;
    }
    
    speak("Confirmado. Saindo da conta.", () => {
      handleLogout();
    });
  };

  // ===================================================================
  // ESTILOS
  // ===================================================================
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
    
    // --- Estilos do Modal de Logout ---
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
      alignItems: 'center', // Centralizar conteúdo
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
      width: '100%', // Fazer botões ocuparem espaço
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: cores.texto,
      alignItems: 'center',
      backgroundColor: cores.confirmar, // Cor de cancelar
    },
    cancelButtonText: {
      color: '#000', // Texto preto para fundo claro
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

    // --- Estilos de Voz ---
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

  // ===================================================================
  // RENDER
  // ===================================================================
  return (
    <View style={styles.header} accessible={false} onLayout={onLayout}>
      {/* --- Botão de Tema --- */}
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

      {/* --- Título e Botão de Tutorial --- */}
      <View style={styles.titleContainer}>
        <View style={styles.iconButton} />
        <Text
          style={styles.title}
          accessible={true}
          accessibilityRole="header"
          accessibilityLabel={`Página: ${title}`}
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
          <MaterialCommunityIcons name="help-circle-outline" color={cores.icone} size={getIconSize('large')} />
        </TouchableOpacity>
      </View>
      
      {/* --- Botão de Login/Conta --- */}
      <View style={[styles.sideContainer, { justifyContent: 'flex-end' }]} accessible={false}>
        <TouchableOpacity
          onPress={handleLoginIconPress} // Função atualizada
          style={styles.iconButton}
          accessibilityLabel={user ? 'Opções da Conta' : 'Login'}
          accessibilityHint={user ? 'Toque para sair da sua conta' : 'Toque para fazer login'}
          accessibilityRole="button"
        >
          <Ionicons 
            name={"person"}
            size={getIconSize('large')} 
            color={cores.icone} 
          />
        </TouchableOpacity>
      </View>
      
      {/* --- MODAL DE LOGOUT COM VOZ --- */}
      <Modal
        visible={logoutModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={fecharModalLogout} // Função atualizada
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]}
            activeOpacity={1} 
            onPress={fecharModalLogout} // Função atualizada
          />
          <View style={styles.modalContent}>
            <Ionicons 
              name="log-out-outline" 
              size={48} 
              color={cores.perigo} 
              style={{ marginBottom: 16 }}
            />
            <Text style={styles.modalTitle}>Sair da Conta</Text>
            <Text style={styles.modalMessage}>
              Você tem certeza que deseja sair?
            </Text>

            {/* --- Indicador de Voz --- */}
            {isListening && (
              <View style={styles.listeningIndicator}>
                <ActivityIndicator size="small" color={cores.texto} />
                <Text style={styles.listeningText}>
                  Escutando...
                </Text>
              </View>
            )}

            {/* --- Texto Reconhecido --- */}
            {recognizedText && (
              <View style={styles.recognizedTextBox}>
                <Text style={styles.recognizedTextLabel}>
                  Você disse:
                </Text>
                <Text style={styles.recognizedTextContent}>
                  "{recognizedText}"
                </Text>
              </View>
            )}
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={fecharModalLogout} // Função atualizada
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.logoutButton}
                onPress={handleLogoutManual} // Função de confirmação manual
              >
                <Text style={styles.logoutButtonText}>Sair</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}