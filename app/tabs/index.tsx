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
import { useMicrophone } from '../../components/MicrophoneContext';
import { useTutorial } from '../../components/TutorialContext';

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
  
  const { isMicrophoneEnabled } = useMicrophone();

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
  const conversaTitulo = typeof params.conversaTitulo === 'string' ? params.conversaTitulo : undefined;
  
  const [capturedPhoto, setCapturedPhoto] = useState<Photo | null>(null);
  const [isSending, setIsSending] = useState(false);
  
  const [questionModalVisible, setQuestionModalVisible] = useState(false);
  const [questionInput, setQuestionInput] = useState('');
  const [questionStep, setQuestionStep] = useState<'aguardandoPalavraPergunta' | 'aguardandoPergunta' | 'idle'>('idle');
  const questionProcessadoRef = useRef(false);
  const questionModalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const hasProcessedAutoPhotoRef = useRef(false);
  
  const { isTutorialAtivo } = useTutorial();
  
  const isSpeakingRef = useRef(false);

  const globalSpeech = useSpeech({
    enabled: isFocused && !questionModalVisible && !isSending && !isTutorialAtivo,
    mode: 'global',
  });

  const { 
    speak, 
    startListening,
    stopListening,
    isListening,
    recognizedText,
    setRecognizedText,
    isSpeaking 
  } = useSpeech({
    enabled: isFocused && questionModalVisible && !isTutorialAtivo,
    mode: 'local',
  });

  useEffect(() => {
    if (!globalSpeech.recognizedText.trim() || questionModalVisible || isSending || isTutorialAtivo) return;
    
    const texto = globalSpeech.recognizedText.toLowerCase().trim();
    
    const ignorarFrases = [
      'tirar foto botão',
      'botão tirar foto',
      'botão',
      'image button',
      'button',
    ];
    
    const deveIgnorar = ignorarFrases.some(frase => texto === frase || texto.endsWith(' botão'));
    
    if (deveIgnorar) {
      console.log('[Camera] 🚫 Ignorando frase do leitor de tela:', texto);
      globalSpeech.setRecognizedText('');
      return;
    }
    
    if (texto.includes('tirar foto') || texto.includes('capturar') || texto.includes('fotografar')) {
      globalSpeech.setRecognizedText('');
      takePictureForVoiceCommand(texto);
    }
  }, [globalSpeech.recognizedText, questionModalVisible, isSending, isTutorialAtivo]);

  /*
  reativa o microfone global caso ele tenha sido desligado
  */
  useEffect(() => {
    if (!isFocused || questionModalVisible || isSending || isTutorialAtivo) return;

    if (isMicrophoneEnabled && !isListening && !isSpeaking && !globalSpeech.isSpeaking) {
      const timeout = setTimeout(() => {
        const currentState = SpeechManager.getState();
        if (!currentState.isRecognizing && !currentState.isSpeaking) {
          console.log('[Camera] 🔄 Forçando ativação do microfone');
          SpeechManager.startRecognition('global');
        }
      }, 500); 
      return () => clearTimeout(timeout);
    }
  }, [isFocused, isMicrophoneEnabled, isListening, isSpeaking, globalSpeech.isSpeaking, questionModalVisible, isSending, isTutorialAtivo]);

  useEffect(() => {
    console.log('[Camera] 📋 Parâmetros recebidos:', { conversaId, mode, autoTakePhoto });
  }, [conversaIdFromUrl, modeFromUrl, pendingContext]);

  /*
  captura automática quando o comando de voz vem de outra tela
  */
  useEffect(() => {
    if (!isFocused) {
      hasProcessedAutoPhotoRef.current = false;
      setIsCameraReady(false);
      return;
    }
    
    if (autoTakePhoto && question && !isSending && !hasProcessedAutoPhotoRef.current && isCameraReady) {
      console.log('[Camera] 📸 Auto-foto detectada - Processando UMA VEZ');
      hasProcessedAutoPhotoRef.current = true;
      
      const timeoutId = setTimeout(() => {
        if (!isFocused) return;
        takePictureForVoiceCommand(question);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isFocused, autoTakePhoto, question, isSending, isCameraReady]);

  /**
  Processa reconhecimento de voz dentro do modal, ativado quando o usuário tira a foto pelo botão, o que faz o modal abrir
  */
  useEffect(() => {
    if (!recognizedText.trim() || !questionModalVisible) return;
    const textoAtual = recognizedText.trim();
    const textoLower = textoAtual.toLowerCase();
    
    if (questionStep === 'aguardandoPalavraPergunta' && textoLower.includes('pergunta')) {
      setQuestionStep('aguardandoPergunta');
      setRecognizedText('');
      questionProcessadoRef.current = false;
      if (questionModalTimeoutRef.current) clearTimeout(questionModalTimeoutRef.current);
      speak("Escutando a pergunta.", () => startListening(true));
      return;
    }

    if (questionStep === 'aguardandoPergunta' && textoAtual && !questionProcessadoRef.current) {
      if (questionModalTimeoutRef.current) clearTimeout(questionModalTimeoutRef.current);
      questionModalTimeoutRef.current = setTimeout(() => {
        if (!questionProcessadoRef.current && textoAtual) {
          questionProcessadoRef.current = true;
          stopListening();
          speak('Processando:', () => processarPergunta(textoAtual));
        }
      }, 2000);
    }
  }, [recognizedText, questionStep, questionModalVisible]);

  useEffect(() => {
    return () => {
      if (questionModalTimeoutRef.current) clearTimeout(questionModalTimeoutRef.current);
    };
  }, []);

  const abrirQuestionModal = () => {
    setQuestionInput('');
    setQuestionStep('aguardandoPalavraPergunta');
    setQuestionModalVisible(true);
    setRecognizedText('');
    questionProcessadoRef.current = false;
    setTimeout(() => {
      isSpeakingRef.current = true;
      speak("Digite a pergunta ou fale: pergunta para enviar o que deseja saber sobre a foto.", () => {
        setTimeout(() => { isSpeakingRef.current = false; startListening(true); }, 500);
      });
    }, 500);
  };

  const fecharQuestionModal = () => {
    stopListening();
    setQuestionModalVisible(false);
    setQuestionInput('');
    setQuestionStep('idle');
    setRecognizedText('');
    questionProcessadoRef.current = false;
    setCapturedPhoto(null);
    isSpeakingRef.current = false;
    if (questionModalTimeoutRef.current) clearTimeout(questionModalTimeoutRef.current);
  };

  const processarPergunta = (pergunta: string) => {
    const perguntaFinal = pergunta.trim();
    const ttsBlacklist = ['escutando', 'digite', 'pergunta para', 'processando'];
    if (ttsBlacklist.some(p => perguntaFinal.toLowerCase().includes(p))) return;
    
    if (!perguntaFinal) {
      Alert.alert('Atenção', 'Por favor, digite a pergunta.');
      return;
    }
    if (!capturedPhoto) {
      Alert.alert('Erro', 'Nenhuma foto capturada.');
      fecharQuestionModal();
      return;
    }
    setQuestionModalVisible(false);
    handleUploadAndProcess(capturedPhoto, perguntaFinal);
  };

  const processarPerguntaManual = () => processarPergunta(questionInput);

const handleUploadAndProcess = async (photo: Photo, prompt: string) => {
  if (isSending) {
    console.log('[Camera] ⚠️ Upload já em andamento - Ignorando');
    return;
  }
  
  console.log('[Camera] 🚀 Iniciando upload e processamento');
  setIsSending(true);
  stopListening();

  try {
    console.log('[Camera] 🔊 Falando: Processando');
    speak("Processando").catch(err => console.log('[Camera] ❌ TTS erro:', err));

    if (!photo.base64) throw new Error('Foto não contém base64.');

    const feedbackInterval = setInterval(() => {
      speak("Ainda processando").catch(err => console.log('[Camera] ❌ TTS erro:', err));
    }, 8000);
    
    const timeoutId = setTimeout(() => {
      clearInterval(feedbackInterval);
      throw new Error('TIMEOUT');
    }, 60000);
    
    console.log('[Camera] 📤 Enviando para servidor...');
    
    try {
      const response = await fetch(SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ image: photo.base64, prompt: prompt }),
      });
      
      clearInterval(feedbackInterval);
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error('Erro do servidor');

      const result = await response.json();
      
      const description = result.description;
      if (!description) throw new Error("A resposta do servidor não continha uma descrição.");

        console.log('[Camera] ✅ Resposta recebida do servidor');

      if (mode === 'chat' && conversaId) {
        console.log('[Camera] 🔊 Falando: Resposta recebida. Salvando.');
        speak("Resposta recebida. Salvando.").catch(err => console.log('[Camera] ❌ TTS erro:', err));
        
        console.log('[Camera] 💾 Salvando no Firebase Storage...');
        
        const filename = `photo-${Date.now()}.jpg`;
        const storageRef = storage().ref(`conversas/${conversaId}/${filename}`);
        
        await storageRef.putFile(photo.uri);
        const url = await storageRef.getDownloadURL();

        console.log('[Camera] 📝 Salvando mensagens no Firestore...');

        const conversaRef = firestore()
          .collection('conversas')
          .doc(conversaId);
        
        const mensagensRef = conversaRef.collection('mensagens');

        await mensagensRef.add({
          sender: 'user',
          text: prompt,
          imageUri: url,
          timestamp: firestore.FieldValue.serverTimestamp()
        });

        await mensagensRef.add({
          sender: 'api',
          text: description,
          imageUri: null,
          timestamp: firestore.FieldValue.serverTimestamp()
        });

        await conversaRef.update({
          dataAlteracao: firestore.FieldValue.serverTimestamp()
        });
    
        console.log('[Camera] ✅ Tudo salvo com sucesso!');
        
        clearPending();
        hasProcessedAutoPhotoRef.current = false;
        
        router.setParams({
          autoTakePhoto: undefined,
          question: undefined,
          timestamp: undefined
        });
        
        setTimeout(() => {
          router.replace({
            pathname: '/conversa',
            params: { 
              conversaId, 
              titulo: conversaTitulo || 'Conversa', 
              speakLastMessage: 'true', 
              timestamp: Date.now().toString() 
            }
          });
        }, 100);
      } else {
        await speak(description);
      }
    } catch (fetchError) {
      clearInterval(feedbackInterval);
      clearTimeout(timeoutId);
      throw fetchError;
    }

  } catch (error) {
    console.error('[Camera] ❌ Erro no upload:', error);
    
    if (error instanceof Error && error.message === 'TIMEOUT') {
      speak("Tempo esgotado. A operação demorou muito. Tente novamente.").catch(err => console.log('[Camera] TTS erro:', err));
      Alert.alert("Tempo Esgotado", "A operação demorou mais de 1 minuto. Por favor, tente novamente.");
    } else {
      speak("Erro ao processar.").catch(err => console.log('[Camera] TTS erro:', err));
      Alert.alert("Erro no Upload", error instanceof Error ? error.message : "Erro desconhecido");
    }
    
  } finally {
    console.log('[Camera] 🏁 Finalizando upload');
    setCapturedPhoto(null);
    setIsSending(false); 
    hasProcessedAutoPhotoRef.current = false;
  }
};

  const takePictureForVoiceCommand = async (spokenText: string) => {
    if (isSending || !cameraRef.current || !isCameraReady) {
      console.log('[Camera] ⚠️ Não pode tirar foto:', { isSending, hasCamera: !!cameraRef.current, isCameraReady });
      return;
    }
    
    console.log('[Camera] 📸 Tirando foto por comando de voz');
    
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5, base64: true });
      if (photo) {
        console.log('[Camera] ✅ Foto capturada, iniciando upload');
        await handleUploadAndProcess(photo, spokenText);
      }
    } catch (e) { 
      console.error('[Camera] ❌ Erro ao capturar:', e);
      Alert.alert("Erro", "Erro ao capturar."); 
    }
  };

  const takePictureForButton = async () => {
    if (!cameraRef.current) { Alert.alert("Erro", "Câmera não pronta."); return; }
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5, base64: true });
      if (photo) {
        setCapturedPhoto(photo);
        abrirQuestionModal();
      }
    } catch (e) { Alert.alert("Erro", "Erro ao capturar."); setCapturedPhoto(null); }
  };

  useEffect(() => {
    if (isFocused && pendingSpokenText && !hasProcessedAutoPhotoRef.current) {
      takePictureForVoiceCommand(pendingSpokenText);
      if (mode !== 'chat') clearPending();
    }
  }, [isFocused, pendingSpokenText, mode]);

  const styles = StyleSheet.create({
    container: { 
      flex: 1, 
      justifyContent: "center" 
    },
    message: { 
      textAlign: "center", 
      paddingBottom: 10, 
      fontSize: 16, 
      paddingHorizontal: 20 
    },
    buttonContainer: { 
      position: "absolute", 
      bottom: 40, 
      alignSelf: "center" 
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
      padding: 20 
    },
    modalContent: { 
      backgroundColor: cores.fundo, 
      borderRadius: 20, 
      padding: 28, 
      width: '100%', 
      maxWidth: 500, 
      elevation: 8 
    },
    modalHeader: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: 20 
    },
    modalTitle: { 
      fontSize: getFontSize('large'), 
      fontWeight: 'bold', 
      color: cores.texto 
    },
    closeButton: { 
      padding: 4 
    },
    inputContainer: { 
      marginBottom: 20 
    },
    label: { 
      fontSize: getFontSize('medium'), 
      marginBottom: 8, 
      fontWeight: '500', 
      color: cores.texto 
    },
    inputWrapper: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      backgroundColor: '#fff', 
      borderRadius: 8, 
      borderWidth: 1, 
      borderColor: cores.texto 
    },
    input: { 
      flex: 1, 
      paddingHorizontal: 16, 
      paddingVertical: 12, 
      fontSize: getFontSize('medium'), 
      color: '#000' 
    },
    micButton: { 
      padding: 12, 
      marginRight: 4 
    },
    modalListeningIndicator: { 
      flexDirection: 'row',
      alignItems: 'center', 
      justifyContent: 'center', 
      paddingVertical: 12, 
      backgroundColor: cores.fundo, 
      borderRadius: 8, 
      marginBottom: 16 
    },
    modalListeningText: { 
      marginLeft: 8, 
      fontSize: getFontSize('medium'), 
      fontWeight: '500', 
      color: cores.texto 
    },
    modalActions: { 
      flexDirection: 'row', 
      gap: 12 
    },
    cancelButton: { 
      flex: 1, 
      paddingVertical: 12, 
      borderRadius: 8,
      borderWidth: 1,
      borderColor: cores.texto, 
      alignItems: 'center' 
    },
    cancelButtonText: { 
      color: cores.texto, 
      fontSize: getFontSize('medium'), 
      fontWeight: '600' 
    },
    sendButton: { 
      flex: 1, 
      paddingVertical: 12, 
      borderRadius: 8, 
      backgroundColor: cores.texto, 
      alignItems: 'center', 
      justifyContent: 'center' 
    },
    sendButtonText: { 
      color: cores.fundo, 
      fontSize: getFontSize('medium'), 
      fontWeight: '600' 
    },
  });

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: cores.barrasDeNavegacao }]}>
        <Text style={[styles.message, { color: cores.texto }]}>Precisamos da permissão da câmera</Text>
        <Button onPress={requestPermission} title="Conceder Permissão" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: cores.barrasDeNavegacao }]}>
      <StatusBar backgroundColor={cores.barrasDeNavegacao} barStyle={temaAplicado === "dark" ? "light-content" : "dark-content"} />
      {isFocused && (
        <>
          <CameraView 
            style={StyleSheet.absoluteFill} 
            ref={cameraRef} 
            mode="picture"
            onCameraReady={() => setIsCameraReady(true)}
            flash='auto'
          />
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={takePictureForButton} disabled={isSending || questionModalVisible} accessibilityRole="button" accessibilityLabel="Tirar Foto">
              <Image source={temaAplicado === "dark" ? require("../../assets/images/icone-camera-escuro.png") : require("../../assets/images/icone-camera-claro.png")} style={[styles.iconeCamera, (isSending || questionModalVisible) && { opacity: 0.5 }]} />
            </TouchableOpacity>
          </View>
        </>
      )}

      <Modal visible={questionModalVisible} transparent={true} animationType="fade" onRequestClose={fecharQuestionModal} statusBarTranslucent={true}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]} activeOpacity={1} onPress={fecharQuestionModal} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>O que deseja saber?</Text>
              <TouchableOpacity style={styles.closeButton} onPress={fecharQuestionModal}>
                <Ionicons name="close" size={getIconSize('medium')} color={cores.texto} />
              </TouchableOpacity>
            </View>
            {isListening && (
              <View style={styles.modalListeningIndicator}>
                <ActivityIndicator size="small" color={cores.texto} />
                <Text style={styles.modalListeningText}>{questionStep === 'aguardandoPalavraPergunta' ? 'Aguardando "Pergunta"...' : 'Ouvindo pergunta...'}</Text>
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
                  onChangeText={(text) => { setQuestionInput(text); if (questionStep !== 'idle') { setQuestionStep('idle'); stopListening(); questionProcessadoRef.current = false; } }}
                  placeholder="Digite ou fale a pergunta"
                  placeholderTextColor='#999'
                  multiline
                />
                <TouchableOpacity style={styles.micButton} onPress={() => { setQuestionStep('aguardandoPalavraPergunta'); setRecognizedText(''); questionProcessadoRef.current = false; speak("Diga 'pergunta'", () => startListening(true)); }} disabled={isListening}>
                  <Ionicons name={isListening ? "mic" : "mic-outline"} size={getIconSize('medium')} color={cores.fundo} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={fecharQuestionModal}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.sendButton} onPress={processarPerguntaManual}><Text style={styles.sendButtonText}>Enviar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default CameraScreen;