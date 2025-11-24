import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from "@react-navigation/native";
import { useTheme } from "../../components/ThemeContext";
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useVoiceCommands } from '../../components/VoiceCommandContext';
import { useSpeech } from '../../hooks/useSpeech';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import SpeechManager from '../../utils/speechManager';

interface Photo {
  uri: string;
  base64?: string;
}

const SERVER_URL = 'https://www.acessivision.com.br/upload';

const CameraScreen: React.FC = () => {
  const router = useRouter();
  const { cores, temaAplicado, getFontSize, getIconSize } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const isFocused = useIsFocused();
  const [isCameraReady, setIsCameraReady] = useState(false);
  
  const params = useLocalSearchParams();
  
  const conversaIdFromUrl = typeof params.conversaId === 'string' ? params.conversaId : undefined;
  const modeFromUrl = typeof params.mode === 'string' ? params.mode : undefined;
  const autoTakePhoto = params.autoTakePhoto === 'true';
  const question = typeof params.question === 'string' ? params.question : undefined;
  
  const {
    pendingSpokenText,
    pendingContext,
    clearPending,
  } = useVoiceCommands();

  const mode = modeFromUrl || pendingContext?.mode;
  const conversaId = conversaIdFromUrl || pendingContext?.conversaId;
  
  const [capturedPhoto, setCapturedPhoto] = useState<Photo | null>(null);
  const [isSending, setIsSending] = useState(false);
  
  // ✅ Estados para o modal de pergunta
  const [questionModalVisible, setQuestionModalVisible] = useState(false);
  const [questionInput, setQuestionInput] = useState('');
  const [questionStep, setQuestionStep] = useState<'aguardandoPalavraPergunta' | 'aguardandoPergunta' | 'idle'>('idle');
  const questionProcessadoRef = useRef(false);
  const questionModalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const hasProcessedAutoPhotoRef = useRef(false);
  const feedbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSpeakingRef = useRef(false);

  // ✅ Hook de voz atualizado para incluir o modal
  const { 
    speak, 
    startListening,
    stopListening,
    isListening,
    recognizedText,
    setRecognizedText
  } = useSpeech({
    enabled: isFocused && questionModalVisible,
    mode: 'local',
  });

  useEffect(() => {
    console.log('[Camera] 📋 Parâmetros recebidos:');
    console.log('[Camera]   - URL conversaId:', conversaIdFromUrl);
    console.log('[Camera]   - URL mode:', modeFromUrl);
    console.log('[Camera]   - Context conversaId:', pendingContext?.conversaId);
    console.log('[Camera]   - Context mode:', pendingContext?.mode);
    console.log('[Camera]   - FINAL conversaId:', conversaId);
    console.log('[Camera]   - FINAL mode:', mode);
    console.log('[Camera]   - autoTakePhoto:', autoTakePhoto);
    console.log('[Camera]   - question:', question);
  }, [conversaIdFromUrl, modeFromUrl, pendingContext, conversaId, mode, autoTakePhoto, question]);

  // ===================================================================
  // AUTO TIRAR FOTO (quando vem com autoTakePhoto=true)
  // ===================================================================
  useEffect(() => {
    if (!isFocused) {
      console.log('[Camera] ⏭️ Tela não está focada, ignorando auto-foto');
      return;
    }
    
    if (autoTakePhoto && question && !isSending && !hasProcessedAutoPhotoRef.current) {
      console.log('[Camera] 🎯 Recebeu comando para auto-tirar foto com pergunta:', question);
      
      if (isCameraReady) {
        console.log('[Camera] ✅ Câmera pronta, agendando foto em 500ms');
        hasProcessedAutoPhotoRef.current = true;
        
        const timeoutId = setTimeout(() => {
          if (!isFocused) {
            console.log('[Camera] ⚠️ Timeout executou mas tela não está mais focada, abortando');
            return;
          }
          takePictureForVoiceCommand(question);
        }, 500);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [isFocused, autoTakePhoto, question, isSending, isCameraReady]);

  useEffect(() => {
    if (!isFocused) {
      console.log('[Camera] ⏭️ Tela não está focada, ignorando câmera pronta (auto)');
      return;
    }
    
    if (isCameraReady && autoTakePhoto && question && !hasProcessedAutoPhotoRef.current && !isSending) {
      console.log('[Camera] 🎬 Câmera ficou pronta, agendando auto-foto em 500ms');
      hasProcessedAutoPhotoRef.current = true;
      
      const timeoutId = setTimeout(() => {
        if (!isFocused) {
          console.log('[Camera] ⚠️ Timeout executou mas tela não está mais focada, abortando');
          return;
        }
        takePictureForVoiceCommand(question);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isFocused, isCameraReady, autoTakePhoto, question, isSending]);

  useEffect(() => {
    if (!isFocused) {
      hasProcessedAutoPhotoRef.current = false;
      setIsCameraReady(false);
    }
  }, [isFocused]);

  // ===================================================================
  // PROCESSAR RECONHECIMENTO DE VOZ NO MODAL
  // ===================================================================
  useEffect(() => {
    if (!recognizedText.trim() || !questionModalVisible) return;

    const textoAtual = recognizedText.trim();
    const textoLower = textoAtual.toLowerCase();
    
    console.log(`[Camera Modal] Step: ${questionStep}, Texto: "${textoAtual}"`);

    // Detectar palavra "pergunta"
    if (questionStep === 'aguardandoPalavraPergunta' && textoLower.includes('pergunta')) {
      console.log("✅ Palavra 'pergunta' detectada!");
      setQuestionStep('aguardandoPergunta');
      setRecognizedText('');
      questionProcessadoRef.current = false;
      
      if (questionModalTimeoutRef.current) {
        clearTimeout(questionModalTimeoutRef.current);
        questionModalTimeoutRef.current = null;
      }
      
      speak("Escutando a pergunta. Fale e aguarde um momento.", () => {
        startListening(true);
      });
      return;
    }

    // Capturar a pergunta
    if (questionStep === 'aguardandoPergunta' && textoAtual && !questionProcessadoRef.current) {
      console.log(`📝 Acumulando pergunta: "${textoAtual}"`);
      
      if (questionModalTimeoutRef.current) {
        clearTimeout(questionModalTimeoutRef.current);
      }
      
      questionModalTimeoutRef.current = setTimeout(() => {
        if (!questionProcessadoRef.current && textoAtual) {
          console.log(`✅ Pergunta final capturada: "${textoAtual}"`);
          questionProcessadoRef.current = true;
          stopListening();
          speak(`Processando pergunta: ${textoAtual}`, () => {
            processarPergunta(textoAtual);
          });
        }
      }, 2000);
      return;
    }
  }, [recognizedText, questionStep, questionModalVisible]);

  // ===================================================================
  // CLEANUP DOS TIMEOUTS
  // ===================================================================
  useEffect(() => {
    return () => {
      if (feedbackIntervalRef.current) {
        clearInterval(feedbackIntervalRef.current);
        feedbackIntervalRef.current = null;
      }
      if (questionModalTimeoutRef.current) {
        clearTimeout(questionModalTimeoutRef.current);
        questionModalTimeoutRef.current = null;
      }
    };
  }, []);

  // ===================================================================
  // FUNÇÕES DO MODAL
  // ===================================================================
  const abrirQuestionModal = () => {
    console.log('[Camera Modal] 🚪 Abrindo modal de pergunta');
    
    setQuestionInput('');
    setQuestionStep('aguardandoPalavraPergunta');
    setQuestionModalVisible(true);
    setRecognizedText('');
    questionProcessadoRef.current = false;
    
    setTimeout(() => {
      isSpeakingRef.current = true;
      
      speak("Por favor, digite a pergunta ou diga 'pergunta' para informá-la por voz.", () => {
        setTimeout(() => {
          isSpeakingRef.current = false;
          startListening(true);
        }, 500);
      });
    }, 500);
  };

  const fecharQuestionModal = () => {
    console.log('[Camera Modal] 🚪 Fechando modal de pergunta');
    stopListening();
    
    setQuestionModalVisible(false);
    setQuestionInput('');
    setQuestionStep('idle');
    setRecognizedText('');
    questionProcessadoRef.current = false;
    setCapturedPhoto(null);
    isSpeakingRef.current = false;
    
    if (questionModalTimeoutRef.current) {
      clearTimeout(questionModalTimeoutRef.current);
      questionModalTimeoutRef.current = null;
    }
  };

  const processarPergunta = (pergunta: string) => {
    const perguntaFinal = pergunta.trim();
    
    // ✅ Previne processamento se contém frases do TTS
    const perguntaLower = perguntaFinal.toLowerCase();
    const ttsBlacklist = [
      'escutando a pergunta',
      'fale e aguarde',
      'digite a pergunta',
      'pergunta para informá-la',
      'por favor',
    ];
    
    const containsTTSPhrase = ttsBlacklist.some(phrase => 
      perguntaLower.includes(phrase)
    );
    
    if (containsTTSPhrase) {
      console.log('[Camera] ⚠️ Pergunta contém frase do TTS, ignorando');
      return;
    }
    
    if (!perguntaFinal) {
      Alert.alert('Atenção', 'Por favor, digite a pergunta ou diga "pergunta" para informá-la por voz.');
      return;
    }

    if (!capturedPhoto) {
      Alert.alert('Erro', 'Nenhuma foto capturada.');
      fecharQuestionModal();
      return;
    }

    console.log(`[Camera Modal] 📤 Processando pergunta: "${perguntaFinal}"`);
    
    setQuestionModalVisible(false);
    handleUploadAndProcess(capturedPhoto, perguntaFinal);
  };

  const processarPerguntaManual = () => {
    processarPergunta(questionInput);
  };

  // ===================================================================
  // FEEDBACK EM LOOP
  // ===================================================================
  const startProcessingFeedback = () => {
    console.log("[Feedback] 🔊 Iniciando feedback em loop");
    speak("Processando");
    
    feedbackIntervalRef.current = setInterval(() => {
      console.log("[Feedback] 🔊 Repetindo feedback");
      speak("Processando");
    }, 3000);
  };

  const stopProcessingFeedback = () => {
    if (feedbackIntervalRef.current) {
      console.log("[Feedback] 🛑 Parando feedback em loop");
      clearInterval(feedbackIntervalRef.current);
      feedbackIntervalRef.current = null;
      stopListening();
    }
  };

  // ===================================================================
  // UPLOAD E PROCESSAMENTO
  // ===================================================================
  const isNavigatingRef = useRef(false);

  const handleUploadAndProcess = async (photo: Photo, prompt: string) => {
    if (isSending) {
      console.log("[Upload] Ignorado, upload já em progresso.");
      return;
    }

    if (isNavigatingRef.current) {
      console.log("[Upload] ⚠️ Navegação já em progresso, ignorando");
      return;
    }

    console.log(`[Upload] 🚀 Iniciando upload com BASE64`);
    setIsSending(true);
    stopListening();

    try {
      startProcessingFeedback();

      if (!photo.base64) {
        throw new Error('Foto não contém base64.');
      }

      const response = await fetch(SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          image: photo.base64,
          prompt: prompt,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro do servidor: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      stopProcessingFeedback();
      
      const description = result.description;

      if (!description) {
        throw new Error("A resposta do servidor não continha uma descrição.");
      }

      if (mode === 'chat' && conversaId) {
        await speak("Resposta recebida. Salvando na conversa.");

        const filename = photo.uri.split('/').pop() || `photo-${Date.now()}.jpg`;
        const storagePath = `conversas/${conversaId}/${filename}`;
        
        const reference = storage().ref(storagePath);
        await reference.putFile(photo.uri);
        const downloadURL = await reference.getDownloadURL();

        await firestore()
          .collection('conversas')
          .doc(conversaId)
          .collection('mensagens')
          .add({
            sender: 'user',
            text: prompt,
            imageUri: downloadURL,
            timestamp: firestore.FieldValue.serverTimestamp(),
          });

        await firestore()
          .collection('conversas')
          .doc(conversaId)
          .collection('mensagens')
          .add({
            sender: 'api',
            text: description,
            imageUri: null,
            timestamp: firestore.FieldValue.serverTimestamp(),
          });

        await firestore()
          .collection('conversas')
          .doc(conversaId)
          .update({
            dataAlteracao: firestore.FieldValue.serverTimestamp(),
          });
    
        clearPending();
        hasProcessedAutoPhotoRef.current = false;
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const conversaDoc = await firestore()
          .collection('conversas')
          .doc(conversaId)
          .get();
        
        const tituloConversa = conversaDoc.exists ? conversaDoc.data()?.titulo : 'Conversa';
        
        router.replace({
          pathname: '/conversa',
          params: {
            conversaId: conversaId,
            titulo: tituloConversa,
            speakLastMessage: 'true',
            timestamp: Date.now().toString()
          }
        });

      } else {
        await speak(description);
      }

    } catch (error) {
      stopProcessingFeedback();
      
      let errorMessage = 'Ocorreu um erro desconhecido.';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (error.message.includes('Network request failed')) {
          errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
        }
      }
      
      await speak(`Erro: ${errorMessage}`);
      Alert.alert("Erro no Upload", errorMessage);
    } finally {
      setCapturedPhoto(null);
      setIsSending(false);
      hasProcessedAutoPhotoRef.current = false;
      SpeechManager.enable();
    }
  };

  // ===================================================================
  // TIRAR FOTO (COMANDO DE VOZ GLOBAL)
  // ===================================================================
  const takePictureForVoiceCommand = async (spokenText: string): Promise<void> => {
    if (isSending) {
      console.log('[Camera] ⚠️ Já está enviando, ignorando comando duplicado');
      return;
    }
    
    if (!cameraRef.current) {
      Alert.alert("Erro", "Câmera não está pronta.");
      hasProcessedAutoPhotoRef.current = false;
      return;
    }

    if (!isCameraReady) {
      const maxWait = 3000;
      const startTime = Date.now();
      
      while (!isCameraReady && (Date.now() - startTime) < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!isCameraReady) {
        Alert.alert("Erro", "A câmera demorou muito para inicializar.");
        hasProcessedAutoPhotoRef.current = false;
        return;
      }
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({ 
        quality: 0.5,
        base64: true
      });

      if (!photo) {
        Alert.alert("Erro", "Não foi possível capturar a foto.");
        hasProcessedAutoPhotoRef.current = false;
        return;
      }

      await handleUploadAndProcess(photo, spokenText);

    } catch (error) {
      Alert.alert("Erro", error instanceof Error ? error.message : "Erro ao capturar foto");
      hasProcessedAutoPhotoRef.current = false;
    }
  };

  // ===================================================================
  // TIRAR FOTO (BOTÃO) - AGORA ABRE O MODAL
  // ===================================================================
  const takePictureForButton = async (): Promise<void> => {
    if (!cameraRef.current) {
      Alert.alert("Erro", "Câmera não está pronta.");
      return;
    }

    try {
      console.log("[Camera] 📸 Taking picture for button...");
      
      const photo = await cameraRef.current.takePictureAsync({ 
        quality: 0.5,
        base64: true
      });
      
      if (!photo) {
        Alert.alert("Erro", "Não foi possível capturar a foto.");
        return;
      }

      setCapturedPhoto(photo);
      abrirQuestionModal();

    } catch (error) {
      console.error("[Camera] ❌ Error taking picture:", error);
      Alert.alert("Erro", error instanceof Error ? error.message : "Erro ao capturar foto");
      setCapturedPhoto(null);
    }
  };

  // ===================================================================
  // COMANDO DE VOZ PENDENTE
  // ===================================================================
  useEffect(() => {
    if (isFocused && pendingSpokenText) {
      takePictureForVoiceCommand(pendingSpokenText);
      
      if (mode !== 'chat') {
        clearPending();
      }
    }
  }, [isFocused, pendingSpokenText, mode]);

  // ===================================================================
  // ESTILOS
  // ===================================================================
  const styles = StyleSheet.create({
    container: { 
      flex: 1,
      justifyContent: "center" 
    },
    message: {
      textAlign: "center",
      paddingBottom: 10,
      fontSize: 16,
      paddingHorizontal: 20,
    },
    buttonContainer: {
      position: "absolute",
      bottom: 40,
      alignSelf: "center",
    },
    button: { 
      alignItems: "center" 
    },
    iconeCamera: { 
      width: 100, 
      height: 100 
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
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: getFontSize('large'),
      fontWeight: 'bold',
      color: cores.texto,
    },
    closeButton: {
      padding: 4,
    },
    inputContainer: {
      marginBottom: 20,
    },
    label: {
      fontSize: getFontSize('medium'),
      marginBottom: 8,
      fontWeight: '500',
      color: cores.texto,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: cores.texto,
    },
    input: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: getFontSize('medium'),
      color: '#000',
    },
    micButton: {
      padding: 12,
      marginRight: 4,
    },
    modalListeningIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      backgroundColor: cores.fundo,
      borderRadius: 8,
      marginBottom: 16,
    },
    modalListeningText: {
      marginLeft: 8,
      fontSize: getFontSize('medium'),
      fontWeight: '500',
      color: cores.texto,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: cores.texto,
      alignItems: 'center',
    },
    cancelButtonText: {
      color: cores.texto,
      fontSize: getFontSize('medium'),
      fontWeight: '600',
    },
    sendButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: cores.texto,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonText: {
      color: cores.fundo,
      fontSize: getFontSize('medium'),
      fontWeight: '600',
    },
  });

  // ===================================================================
  // RENDER
  // ===================================================================
  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: cores.barrasDeNavegacao }]}>
        <Text style={[styles.message, { color: cores.texto }]}>
          Precisamos da sua permissão para usar a câmera
        </Text>
        <Button onPress={requestPermission} title="Conceder Permissão da Câmera" />
      </View>
    );
  }

  const aguardandoPalavraPergunta = questionStep === 'aguardandoPalavraPergunta';

  return (
    <View style={[styles.container, { backgroundColor: cores.barrasDeNavegacao }]}>
      <StatusBar
        backgroundColor={cores.barrasDeNavegacao}
        barStyle={temaAplicado === "dark" ? "light-content" : "dark-content"}
      />
      {isFocused && (
        <>
          <CameraView 
            style={StyleSheet.absoluteFill} 
            ref={cameraRef} 
            onCameraReady={() => {
              console.log('[Camera] ✅ Camera is ready!');
              setIsCameraReady(true);
            }}
            flash='auto'
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.button}
              onPress={takePictureForButton}
              accessibilityLabel="Tirar foto"
              accessibilityRole="button"
              disabled={isSending || questionModalVisible}
            >
              <Image
                source={
                  temaAplicado === "dark"
                    ? require("../../assets/images/icone-camera-escuro.png")
                    : require("../../assets/images/icone-camera-claro.png")
                }
                style={[
                  styles.iconeCamera,
                  (isSending || questionModalVisible) && { opacity: 0.5 }
                ]}
              />
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* MODAL DE PERGUNTA */}
      <Modal 
        visible={questionModalVisible} 
        transparent={true} 
        animationType="fade" 
        onRequestClose={fecharQuestionModal}
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]} 
            activeOpacity={1} 
            onPress={fecharQuestionModal} 
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>O que deseja saber?</Text>
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={fecharQuestionModal}
              >
                <Ionicons name="close" size={getIconSize('medium')} color={cores.texto} />
              </TouchableOpacity>
            </View>
            
            {isListening && (
              <View style={styles.modalListeningIndicator}>
                <ActivityIndicator size="small" color={cores.texto} />
                <Text style={styles.modalListeningText}>
                  {aguardandoPalavraPergunta 
                    ? 'Aguardando "Pergunta"...' 
                    : 'Ouvindo pergunta...'}
                </Text>
              </View>
            )}
            
            {questionStep === 'aguardandoPergunta' && recognizedText && (
              <View style={[styles.modalListeningIndicator, { backgroundColor: cores.barrasDeNavegacao }]}>
                <Text style={styles.modalListeningText}>"{recognizedText}"</Text>
              </View>
            )}
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Sua Pergunta</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={questionInput}
                  onChangeText={(text) => {
                    setQuestionInput(text);
                    if (questionStep !== 'idle') {
                      setQuestionStep('idle');
                      stopListening();
                      questionProcessadoRef.current = false;
                    }
                  }}
                  placeholder="Digite ou fale a pergunta"
                  placeholderTextColor='#999'
                  multiline
                  autoFocus={false}
                />
                <TouchableOpacity 
                  style={styles.micButton}
                  onPress={() => {
                    setQuestionStep('aguardandoPalavraPergunta');
                    setRecognizedText('');
                    questionProcessadoRef.current = false;
                    speak("Diga 'pergunta' para começar", () => {
                      startListening(true);
                    });
                  }}
                  disabled={isListening}
                >
                  <Ionicons 
                    name={isListening ? "mic" : "mic-outline"} 
                    size={getIconSize('medium')} 
                    color={cores.fundo} 
                  />
                </TouchableOpacity>
              </View>
            </View>
            
            {questionStep === 'idle' && (
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={fecharQuestionModal}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.sendButton} 
                  onPress={processarPerguntaManual}
                >
                  <Text style={styles.sendButtonText}>Enviar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default CameraScreen;