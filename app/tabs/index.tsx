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
} from "react-native";
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
  const { cores, temaAplicado } = useTheme();
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
  
  const [capturedPhoto, setCapturedPhoto] = useState<Photo | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [waitingForQuestion, setWaitingForQuestion] = useState(false);
  
  const hasProcessedAutoPhotoRef = useRef(false);
  const feedbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // ✅ NOVO: Refs para debounce da pergunta
  const lastRecognizedTextRef = useRef<string>('');
  const questionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { 
    speak, 
    startListening,
    stopListening,
    isListening,
    recognizedText,
    setRecognizedText
  } = useSpeech({
    enabled: isFocused && waitingForQuestion,
    mode: 'local',
  });

  // ===================================================================
  // AUTO TIRAR FOTO (quando vem com autoTakePhoto=true)
  // ===================================================================
  useEffect(() => {
    if (isFocused && autoTakePhoto && question && !isSending && !hasProcessedAutoPhotoRef.current && isCameraReady) {
      console.log('[Camera] 🎯 Auto-tirando foto com pergunta:', question);
      
      hasProcessedAutoPhotoRef.current = true;
      
      // router.replace({
      //   pathname: '/tabs',
      //   params: {
      //     mode: mode,
      //     conversaId: conversaId,
      //     timestamp: Date.now().toString()
      //   }
      // });
      
      setTimeout(() => {
        takePictureForVoiceCommand(question);
      }, 1000);
    }
  }, [isFocused, autoTakePhoto, question, isSending, isCameraReady]);

  useEffect(() => {
    if (!isFocused) {
      hasProcessedAutoPhotoRef.current = false;
      setIsCameraReady(false);
    }
  }, [isFocused]);

  // ===================================================================
  // LIMPAR INTERVALOS E TIMEOUTS AO DESMONTAR
  // ===================================================================
  useEffect(() => {
    return () => {
      if (feedbackIntervalRef.current) {
        clearInterval(feedbackIntervalRef.current);
        feedbackIntervalRef.current = null;
      }
      if (questionTimeoutRef.current) {
        clearTimeout(questionTimeoutRef.current);
        questionTimeoutRef.current = null;
      }
    };
  }, []);

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
  // ✅ PROCESSAR PERGUNTA RECONHECIDA COM DEBOUNCE (CORRIGIDO)
  // ===================================================================
  useEffect(() => {
    if (!recognizedText.trim() || !waitingForQuestion || !capturedPhoto) return;

    const textoAtual = recognizedText.trim();
    lastRecognizedTextRef.current = textoAtual;

    console.log("[Camera] Texto sendo reconhecido:", textoAtual);

    // ✅ Limpa timeout anterior
    if (questionTimeoutRef.current) {
      clearTimeout(questionTimeoutRef.current);
    }

    // ✅ Aguarda 2 segundos de silêncio antes de processar
    questionTimeoutRef.current = setTimeout(() => {
      const textoFinal = lastRecognizedTextRef.current;
      
      if (!textoFinal) {
        console.warn('[Camera] Resultado da fala estava vazio.');
        setRecognizedText('');
        lastRecognizedTextRef.current = '';
        return;
      }

      console.log("[Camera] ✅ Pergunta final capturada:", textoFinal);
      
      // ✅ Para de escutar e processa
      setWaitingForQuestion(false);
      handleUploadAndProcess(capturedPhoto, textoFinal);
      setRecognizedText('');
      lastRecognizedTextRef.current = '';

    }, 2000); // 2 segundos de silêncio

  }, [recognizedText, waitingForQuestion, capturedPhoto]);

  // ===================================================================
  // UPLOAD E PROCESSAMENTO
  // ===================================================================
  const isNavigatingRef = useRef(false);

  const handleUploadAndProcess = async (photo: Photo, prompt: string) => {
  if (isSending) {
    console.log("[Upload] Ignorado, upload já em progresso.");
    return;
  }

  // ✅ GUARD: Previne navegação duplicada
  if (isNavigatingRef.current) {
    console.log("[Upload] ⚠️ Navegação já em progresso, ignorando");
    return;
  }

    console.log(`[Upload] 🚀 Iniciando upload com BASE64`);
    console.log('[Upload] Modo:', mode, 'Conversa:', conversaId);
    console.log('[Upload] Foto URI:', photo.uri);
    console.log('[Upload] Prompt:', prompt);

    setIsSending(true);
    stopListening();

    try {
      startProcessingFeedback();

      console.log('[Upload] 📸 Usando base64 da câmera...');
      
      if (!photo.base64) {
        throw new Error('Foto não contém base64. A câmera deve estar configurada com base64: true');
      }

      const base64 = photo.base64;
      console.log(`[Upload] ✅ Base64 pronto (${base64.length} caracteres)`);

      console.log('[Upload] 📤 Enviando requisição JSON para:', SERVER_URL);
      const response = await fetch(SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          image: base64,
          prompt: prompt,
        }),
      });

      console.log('[Upload] 📥 Resposta recebida');
      console.log('[Upload] Status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Upload] ❌ Erro do servidor:', errorText);
        throw new Error(`Erro do servidor: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('[Upload] 🎉 Resultado:', result);
      
      stopProcessingFeedback();
      
      const description = result.description;

      if (!description) {
        throw new Error("A resposta do servidor não continha uma descrição.");
      }

      console.log('[Upload] ✅ Descrição recebida:', description);

      console.log(`[Upload] 🔍 Verificando modo - mode: "${mode}", conversaId: "${conversaId}"`);
      
      if (mode === 'chat' && conversaId) {
        console.log(`[Firestore] 💾 Salvando na conversa ${conversaId}`);

        await speak("Resposta recebida. Salvando na conversa.");

        const filename = photo.uri.split('/').pop() || `photo-${Date.now()}.jpg`;
        const storagePath = `conversas/${conversaId}/${filename}`;
        
        console.log(`[Storage] ☁️ Fazendo upload para: ${storagePath}`);
        const reference = storage().ref(storagePath);
        await reference.putFile(photo.uri);
        const downloadURL = await reference.getDownloadURL();
        console.log(`[Storage] ✅ Foto salva em: ${downloadURL}`);

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
        
        console.log('[Firestore] ✅ Mensagem do usuário salva');

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
        
        console.log('[Firestore] ✅ Resposta da API salva');

        await firestore()
          .collection('conversas')
          .doc(conversaId)
          .update({
            dataAlteracao: firestore.FieldValue.serverTimestamp(),
          });
    
        console.log("[Firestore] ✅ Salvamento concluído. Voltando para o chat...");
        
        console.log('[Navigation] 🧹 Limpando pending antes de voltar');
        clearPending();
        
        hasProcessedAutoPhotoRef.current = false;
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const conversaDoc = await firestore()
          .collection('conversas')
          .doc(conversaId)
          .get();
        
        const tituloConversa = conversaDoc.exists ? conversaDoc.data()?.titulo : 'Conversa';
        
        console.log(`[Navigation] 🔙 Navegando de volta para conversa: ${conversaId} (${tituloConversa})`);
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
        console.log(`[Speech] 🔊 Falando a descrição: "${description}"`);
        await speak(description);
      }

    } catch (error) {
      stopProcessingFeedback();
      
      console.error("[Upload] ❌ Error completo:", error);
      
      let errorMessage = 'Ocorreu um erro desconhecido.';
      if (error instanceof Error) {
        console.error("[Upload] Error message:", error.message);
        errorMessage = error.message;
        
        if (error.message.includes('Network request failed')) {
          errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
        }
      }
      
      await speak(`Erro: ${errorMessage}`);
      Alert.alert("Erro no Upload", errorMessage);
    } finally {
      setCapturedPhoto(null);
      setWaitingForQuestion(false);
      setIsSending(false);
      hasProcessedAutoPhotoRef.current = false;

      console.log("[Upload] 🔄 Re-habilitando listener global.");
      SpeechManager.enable();
    }
  };

  useEffect(() => {
    if (!isFocused) {
      hasProcessedAutoPhotoRef.current = false;
      setIsCameraReady(false);
      isNavigatingRef.current = false; // ✅ Reset quando sai da tela
    }
  }, [isFocused]);

  // ===================================================================
  // TIRAR FOTO (COMANDO DE VOZ GLOBAL)
  // ===================================================================
  const takePictureForVoiceCommand = async (spokenText: string): Promise<void> => {
    if (isSending) {
      console.log('[Camera] ⚠️ Já está enviando, ignorando comando duplicado');
      return;
    }
    
    if (!cameraRef.current) {
      console.error('[Camera] ❌ Câmera não está pronta');
      Alert.alert("Erro", "Câmera não está pronta.");
      hasProcessedAutoPhotoRef.current = false;
      return;
    }

    if (!isCameraReady) {
      console.log('[Camera] ⏳ Aguardando câmera ficar pronta...');
      const maxWait = 3000;
      const startTime = Date.now();
      
      while (!isCameraReady && (Date.now() - startTime) < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!isCameraReady) {
        console.error('[Camera] ❌ Timeout aguardando câmera');
        Alert.alert("Erro", "A câmera demorou muito para inicializar.");
        hasProcessedAutoPhotoRef.current = false;
        return;
      }
    }

    try {
      console.log("[Camera] 📸 Taking picture for voice command...");
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
      console.error("[Camera] ❌ Error in takePictureForVoiceCommand:", error);
      Alert.alert("Erro", error instanceof Error ? error.message : "Erro ao capturar foto");
      hasProcessedAutoPhotoRef.current = false;
    }
  };

  // ===================================================================
  // TIRAR FOTO (BOTÃO)
  // ===================================================================
  const takePictureForButton = async (): Promise<void> => {
    if (!cameraRef.current) {
      Alert.alert("Erro", "Câmera não está pronta.");
      return;
    }

    try {
      console.log("[Camera] 📸 Taking picture for button...");
      console.log('[Camera] 📋 Contexto: mode =', mode, ', conversaId =', conversaId);
      
      const photo = await cameraRef.current.takePictureAsync({ 
        quality: 0.5,
        base64: true
      });
      
      if (!photo) {
        Alert.alert("Erro", "Não foi possível capturar a foto.");
        return;
      }

      // ✅ Limpa estados antes de começar
      setRecognizedText('');
      lastRecognizedTextRef.current = '';
      if (questionTimeoutRef.current) {
        clearTimeout(questionTimeoutRef.current);
      }

      setCapturedPhoto(photo);
      setWaitingForQuestion(true);

      if (mode === 'chat' && conversaId) {
        await speak("Foto capturada. O que você deseja saber?");
      } else {
        await speak("O que você deseja saber sobre a foto?");
      }
      
      startListening(true);

    } catch (error) {
      console.error("[Camera] ❌ Error taking picture:", error);
      Alert.alert("Erro", error instanceof Error ? error.message : "Erro ao capturar foto");
      setCapturedPhoto(null);
      setWaitingForQuestion(false);
    }
  };

  // ===================================================================
  // COMANDO DE VOZ PENDENTE
  // ===================================================================
  useEffect(() => {
    if (isFocused && pendingSpokenText) {
      console.log(`[Camera] 🎤 Executando ação de voz pendente: "${pendingSpokenText}"`);
      console.log(`[Camera] 📋 Contexto atual - mode: "${mode}", conversaId: "${conversaId}"`);
      
      takePictureForVoiceCommand(pendingSpokenText);
      
      if (mode !== 'chat') {
        clearPending();
      }
    }
  }, [isFocused, pendingSpokenText, mode]);

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

          {/* ✅ INDICADOR DE ESCUTA */}
          {waitingForQuestion && isListening && (
            <View style={styles.listeningOverlay}>
              <View style={[styles.listeningContainer, { backgroundColor: cores.fundo }]}>
                <ActivityIndicator size="large" color={cores.texto} />
                <Text style={[styles.listeningText, { color: cores.texto }]}>
                  Escutando sua pergunta...
                </Text>
                {recognizedText && (
                  <Text style={[styles.recognizedText, { color: cores.texto }]}>
                    "{recognizedText}"
                  </Text>
                )}
              </View>
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.button}
              onPress={takePictureForButton}
              accessibilityLabel="Tirar foto"
              accessibilityRole="button"
              disabled={isSending || waitingForQuestion}
            >
              <Image
                source={
                  temaAplicado === "dark"
                    ? require("../../assets/images/icone-camera-escuro.png")
                    : require("../../assets/images/icone-camera-claro.png")
                }
                style={[
                  styles.iconeCamera,
                  (isSending || waitingForQuestion) && { opacity: 0.5 }
                ]}
              />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};

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
  listeningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listeningContainer: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 280,
  },
  listeningText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  recognizedText: {
    marginTop: 12,
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

export default CameraScreen;