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

const SERVER_URL = 'https://acessivision.com.br/upload';const CameraScreen: React.FC = () => {
  const router = useRouter();
  const { cores, temaAplicado } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const isFocused = useIsFocused();
  const { conversaId, mode } = useLocalSearchParams<{ conversaId?: string, mode?: string }>();
  
  const [capturedPhoto, setCapturedPhoto] = useState<Photo | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [waitingForQuestion, setWaitingForQuestion] = useState(false);

  // 🔊 Referência para o intervalo de feedback
 const feedbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    pendingSpokenText,
    clearPending,
  } = useVoiceCommands();

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
  // LIMPAR INTERVALO DE FEEDBACK AO DESMONTAR
  // ===================================================================
  useEffect(() => {
    return () => {
      if (feedbackIntervalRef.current) {
        clearInterval(feedbackIntervalRef.current);
        feedbackIntervalRef.current = null;
      }
    };
  }, []);

  // ===================================================================
  // INICIAR FEEDBACK EM LOOP
  // ===================================================================
  const startProcessingFeedback = () => {
    console.log("[Feedback] 🔊 Iniciando feedback em loop");
    
    // Fala imediatamente
    speak("Processando");
    
    // Configura intervalo para repetir a cada 3 segundos
    feedbackIntervalRef.current = setInterval(() => {
      console.log("[Feedback] 🔊 Repetindo feedback");
      speak("Processando");
    }, 5000);
  };

  // ===================================================================
  // PARAR FEEDBACK EM LOOP
  // ===================================================================
  const stopProcessingFeedback = () => {
    if (feedbackIntervalRef.current) {
      console.log("[Feedback] 🛑 Parando feedback em loop");
      clearInterval(feedbackIntervalRef.current);
      feedbackIntervalRef.current = null;
      
      // Para qualquer fala em andamento
      stopListening();
    }
  };

  // ===================================================================
  // PROCESSAR PERGUNTA RECONHECIDA
  // ===================================================================
  useEffect(() => {
    if (!recognizedText.trim() || !waitingForQuestion || !capturedPhoto) return;

    console.log("[Camera] Pergunta reconhecida:", recognizedText);

    if (!recognizedText.trim()) {
      console.warn('[Camera] Resultado da fala estava vazio.');
      setRecognizedText('');
      return;
    }

    setWaitingForQuestion(false);
    handleUploadAndProcess(capturedPhoto, recognizedText);
    setRecognizedText('');

  }, [recognizedText, waitingForQuestion, capturedPhoto]);

  // ===================================================================
  // UPLOAD E PROCESSAMENTO - USANDO BASE64
  // ===================================================================
  const handleUploadAndProcess = async (photo: Photo, prompt: string) => {
    if (isSending) {
      console.log("[Upload] Ignorado, upload já em progresso.");
      return;
    }

    console.log(`[Upload] 🚀 Iniciando upload com BASE64`);
    console.log('[Upload] Modo:', mode, 'Conversa:', conversaId);
    console.log('[Upload] Foto URI:', photo.uri);
    console.log('[Upload] Prompt:', prompt);

    setIsSending(true);
    stopListening();

    try {
      // 🔊 INICIAR FEEDBACK EM LOOP
      startProcessingFeedback();

      // ✅ USAR BASE64 DIRETO DA CÂMERA
      console.log('[Upload] 📸 Usando base64 da câmera...');
      
      if (!photo.base64) {
        throw new Error('Foto não contém base64. A câmera deve estar configurada com base64: true');
      }

      const base64 = photo.base64;
      console.log(`[Upload] ✅ Base64 pronto (${base64.length} caracteres)`);

      // ✅ ENVIAR COMO JSON
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
      
      // 🔊 PARAR FEEDBACK ASSIM QUE RECEBER A RESPOSTA
      stopProcessingFeedback();
      
      const description = result.description;

      if (!description) {
        throw new Error("A resposta do servidor não continha uma descrição.");
      }

      console.log('[Upload] ✅ Descrição recebida:', description);

      // =======================================================
      // LÓGICA CONDICIONAL (MODO CHAT)
      // =======================================================
      if (mode === 'chat' && conversaId) {
        console.log(`[Firestore] 💾 Salvando na conversa ${conversaId}`);

        // 🔊 FEEDBACK: Informar que vai salvar
        await speak("Resposta recebida. Salvando na conversa.");

        const filename = photo.uri.split('/').pop() || `photo-${Date.now()}.jpg`;
        const storagePath = `conversas/${conversaId}/${filename}`;
        
        console.log(`[Storage] ☁️ Fazendo upload para: ${storagePath}`);
        const storageRef = storage().ref(storagePath);
        await storageRef.putFile(photo.uri);
        const downloadURL = await storageRef.getDownloadURL();
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

        await firestore()
          .collection('conversas')
          .doc(conversaId)
          .collection('mensagens')
          .add({
            sender: 'bot',
            text: description,
            imageUri: null,
            timestamp: firestore.FieldValue.serverTimestamp(),
          });
    
        console.log("[Firestore] ✅ Salvamento concluído. Voltando para o chat...");
        router.back();

      } else {
        console.log(`[Speech] 🔊 Falando a descrição: "${description}"`);
        await speak(description);
      }

    } catch (error) {
      // 🔊 PARAR FEEDBACK EM CASO DE ERRO
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
      
      // 🔊 FEEDBACK DE ERRO
      await speak(`Erro: ${errorMessage}`);
      Alert.alert("Erro no Upload", errorMessage);
    } finally {
      setCapturedPhoto(null);
      setWaitingForQuestion(false);
      setIsSending(false);

      console.log("[Upload] 🔄 Re-habilitando listener global.");
      SpeechManager.enable();
    }
  };

  // ===================================================================
  // TIRAR FOTO (COMANDO DE VOZ GLOBAL)
  // ===================================================================
  const takePictureForVoiceCommand = async (spokenText: string): Promise<void> => {
    if (!cameraRef.current) {
      Alert.alert("Erro", "Câmera não está pronta.");
      return;
    }

    try {
      console.log("[Camera] 📸 Taking picture for voice command...");
      const photo = await cameraRef.current.takePictureAsync({ 
        quality: 0.5,
        base64: true // ✅ Captura base64 direto da câmera
      });

      if (!photo) {
        Alert.alert("Erro", "Não foi possível capturar a foto.");
        return;
      }

      await handleUploadAndProcess(photo, spokenText);

    } catch (error) {
      console.error("[Camera] ❌ Error in takePictureForVoiceCommand:", error);
      Alert.alert("Erro", error instanceof Error ? error.message : "Erro ao capturar foto");
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
      const photo = await cameraRef.current.takePictureAsync({ 
        quality: 0.5,
        base64: true // ✅ Captura base64 direto da câmera
      });
      
      if (!photo) {
        Alert.alert("Erro", "Não foi possível capturar a foto.");
        return;
      }

      setRecognizedText('');
      setCapturedPhoto(photo);
      setWaitingForQuestion(true);

      await speak("O que você deseja saber sobre a foto?");
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
      takePictureForVoiceCommand(pendingSpokenText);
      clearPending();
    }
  }, [isFocused, pendingSpokenText]);

  // ===================================================================
  // RENDER
  // ===================================================================
  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View
        style={[styles.container, { backgroundColor: cores.barrasDeNavegacao }]}
      >
        <Text style={[styles.message, { color: cores.texto }]}>
          Precisamos da sua permissão para usar a câmera
        </Text>
        <Button
          onPress={requestPermission}
          title="Conceder Permissão da Câmera"
        />
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: cores.barrasDeNavegacao }]}
    >
      <StatusBar
        backgroundColor={cores.barrasDeNavegacao}
        barStyle={temaAplicado === "dark" ? "light-content" : "dark-content"}
      />
      {isFocused && (
        <>
          <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} />

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.button}
              onPress={takePictureForButton}
              accessibilityLabel="Tirar foto"
              role="button"
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
});

export default CameraScreen;