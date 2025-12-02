import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';
import { useSpeech } from '../hooks/useSpeech';

interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteAccountModal({ visible, onClose, onConfirm }: DeleteAccountModalProps) {
  const { cores, getFontSize } = useTheme();
  const [step, setStep] = useState<'idle' | 'aguardandoConfirmacao'>('idle');
  const deleteTimeoutRef = useRef<any>(null);

  const { 
    speak, 
    startListening, 
    stopListening,
    stopSpeaking,
    isListening,
    recognizedText,
    setRecognizedText 
  } = useSpeech({
    enabled: visible,
    mode: 'local',
  });

  // Reset quando abre/fecha
  useEffect(() => {
    if (visible) {
      setStep('aguardandoConfirmacao');
      setRecognizedText('');
      
      setTimeout(() => {
        speak("Você tem certeza que deseja excluir sua conta permanentemente? Esta ação não pode ser desfeita. Diga sim ou não.", () => {
          startListening(true);
        });
      }, 300);
    } else {
      setStep('idle');
      setRecognizedText('');
    }
  }, [visible]);

  // Processa resposta de voz
  useEffect(() => {
    if (!recognizedText.trim() || step !== 'aguardandoConfirmacao') return;

    const fala = recognizedText.toLowerCase().trim();

    // Ignora leituras de botões pelo TalkBack
    const ignoredPhrases = ['cancelar botão', 'excluir botão', 'sair botão'];
    if (ignoredPhrases.includes(fala)) {
      console.log('[DeleteModal] Ignorando leitura de botão:', fala);
      setRecognizedText('');
      return;
    }

    if (deleteTimeoutRef.current) {
      clearTimeout(deleteTimeoutRef.current);
    }

    deleteTimeoutRef.current = setTimeout(() => {
      const confirmWords = ['sim', 'confirmo', 'confirmar', 'isso', 'exato', 'certo', 'ok', 'yes', 'pode', 'quero', 'excluir'];
      const denyWords = ['não', 'nao', 'cancelar', 'cancel', 'errado', 'no', 'negativo', 'nunca'];
      
      const isConfirm = confirmWords.some(word => fala.includes(word));
      const isDeny = denyWords.some(word => fala.includes(word));
      
      if (isConfirm) {
        stopListening();
        setRecognizedText('');
        speak("Confirmado. Excluindo sua conta.", async () => {
          await handleConfirm();
        });
      } else if (isDeny) {
        stopListening();
        setRecognizedText('');
        speak("Cancelado. Sua conta não foi excluída.", () => {
          handleClose();
        });
      } else {
        setRecognizedText('');
        speak(`Não entendi. Você deseja excluir sua conta permanentemente? Diga sim ou não.`, () => {
          startListening(true);
        });
      }
    }, 1500);

  }, [recognizedText, step, visible]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    stopSpeaking();
    stopListening();
    
    if (deleteTimeoutRef.current) {
      clearTimeout(deleteTimeoutRef.current);
      deleteTimeoutRef.current = null;
    }
    
    setStep('idle');
    setRecognizedText('');
    onClose();
  };

  const handleConfirm = async () => {
    try {
      await onConfirm();
      await speak('Sua conta foi excluída com sucesso.');
    } catch (error: any) {
      const errorMessage = error?.message || 'Não foi possível excluir sua conta.';
      await speak(`Erro. ${errorMessage}`);
    } finally {
      handleClose();
    }
  };

  const handleConfirmManual = () => {
    stopSpeaking();
    stopListening();
    
    if (deleteTimeoutRef.current) {
      clearTimeout(deleteTimeoutRef.current);
      deleteTimeoutRef.current = null;
    }
    
    speak("Confirmado. Excluindo sua conta.", async () => {
      await handleConfirm();
    });
  };

  const styles = StyleSheet.create({
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
    deleteButton: { 
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: cores.perigo,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteButtonText: { 
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
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]}
          activeOpacity={1} 
          onPress={handleClose}
        />
        <View style={styles.modalContent}>
          <Ionicons 
            name="warning" 
            size={48} 
            color={cores.perigo} 
            style={{ marginBottom: 16 }}
          />
          <Text style={styles.modalTitle}>Excluir Conta</Text>
          <Text style={styles.modalMessage}>
            Tem certeza que deseja excluir sua conta permanentemente?{'\n\n'}
            Esta ação não pode ser desfeita e todos os seus dados serão removidos.
          </Text>

          {isListening && (
            <View style={styles.listeningIndicator}>
              <ActivityIndicator size="small" color={cores.texto} />
              <Text style={styles.listeningText}>
                Escutando...
              </Text>
            </View>
          )}

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
              onPress={handleClose}
              accessibilityRole='button'
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={handleConfirmManual}
              accessibilityRole='button'
            >
              <Text style={styles.deleteButtonText}>Excluir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}