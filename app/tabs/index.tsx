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
import { Platform } from 'react-native';
import SpeechManager from '../../utils/speechManager';

interface Photo {
  uri: string;
  base64?: string;
}

const SERVER_URL = 'https://acessivision.com.br/upload';

const CameraScreen: React.FC = () => {
  const router = useRouter();
  const { cores, temaAplicado } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const isFocused = useIsFocused();
  const { conversaId, mode } = useLocalSearchParams<{ conversaId?: string, mode?: string }>();
  
  const [capturedPhoto, setCapturedPhoto] = useState<Photo | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [waitingForQuestion, setWaitingForQuestion] = useState(false);

  const {
    pendingSpokenText,
    clearPending,
  } = useVoiceCommands();

  // ✅ Usa o novo hook de voz
  const { 
    speak, 
    startListening,
    stopListening,
    isListening,
    recognizedText,
    setRecognizedText
  } = useSpeech({
    enabled: isFocused && waitingForQuestion, // Só escuta quando esperando pergunta
    mode: 'local',
  });

  // ===================================================================
  // PROCESSAR PERGUNTA RECONHECIDA
  // ===================================================================
  useEffect(() => {
    if (!recognizedText.trim() || !waitingForQuestion || !capturedPhoto) return;

    console.log("[Camera] Pergunta reconhecida:", recognizedText);

    // Valida se não é vazio
    if (!recognizedText.trim()) {
      console.warn('[Camera] Resultado da fala estava vazio.');
      setRecognizedText('');
      return;
    }

    // Desativa o estado de espera e processa
    setWaitingForQuestion(false);
    handleUploadAndProcess(capturedPhoto, recognizedText);
    setRecognizedText('');

  }, [recognizedText, waitingForQuestion, capturedPhoto]);

  // ===================================================================
  // UPLOAD E PROCESSAMENTO
  // ===================================================================
  const handleUploadAndProcess = async (photo: Photo, prompt: string) => {
    if (isSending) {
      console.log("[Upload] Ignorado, upload já em progresso.");
      return;
    }

    console.log(`[Upload] Iniciando. Modo: ${mode}, ID Conversa: ${conversaId}`);

    setIsSending(true);
    stopListening(); // Garante que o reconhecimento está parado

    try {
      // 1. CHAMA O BACKEND (Moondream)
      const formData = createFormData(photo, prompt);
      const response = await fetch(SERVER_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro do servidor: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const description = result.description;

      if (!description) {
        throw new Error("A resposta do servidor não continha uma descrição.");
      }

      // =======================================================
      // LÓGICA CONDICIONAL (MODO CHAT)
      // =======================================================
      if (mode === 'chat' && conversaId) {
        console.log(`[Firestore] Salvando na conversa ${conversaId}`);

        // 2. FAZ UPLOAD DA FOTO PARA O FIREBASE STORAGE
        const filename = photo.uri.split('/').pop() || `photo-${Date.now()}.jpg`;
        const storagePath = `conversas/${conversaId}/${filename}`;
        
        console.log(`[Storage] Fazendo upload para: ${storagePath}`);
        const storageRef = storage().ref(storagePath);
        await storageRef.putFile(photo.uri);
        const downloadURL = await storageRef.getDownloadURL();
        console.log(`[Storage] Foto salva em: ${downloadURL}`);

        // 3. SALVA A MENSAGEM DO USUÁRIO (MENSAGEM 1)
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

        // 4. SALVA A RESPOSTA DO BOT (MENSAGEM 2)
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
    
        // 5. VOLTA PARA A TELA DE CHAT
        console.log("Salvamento concluído. Voltando para o chat...");
        router.back();

      } else {
        // Comportamento original: Apenas fala a resposta
        console.log(`[Speech] Falando a descrição: "${description}"`);
        await speak(description);
      }

    } catch (error) {
      console.error("[Upload] Error:", error);
      let errorMessage = 'Ocorreu um erro desconhecido.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      Alert.alert("Erro no Upload", errorMessage);
    } finally {
    setCapturedPhoto(null);
    setWaitingForQuestion(false); // Disables local useSpeech
    setIsSending(false);

    // ==========================================
    // EXPLICITLY RE-ENABLE GLOBAL LISTENER
    // ==========================================
    console.log("[Upload] Finally block: Attempting to ensure global listener is enabled.");
    // Import SpeechManager if not already imported at top
    // import SpeechManager from '../../utils/speechManager'; 
    SpeechManager.enable(); // Tell the manager it SHOULD be enabled globally
    // The enable() function itself should handle checking if it needs to actually start
    // ==========================================
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
      console.log("[Camera] Taking picture for voice command...");
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });

      if (!photo) {
        Alert.alert("Erro", "Não foi possível capturar a foto.");
        return;
      }

      await handleUploadAndProcess(photo, spokenText);

    } catch (error) {
      console.error("[Camera] Error in takePictureForVoiceCommand:", error);
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
      console.log("[Camera] Taking picture for button...");
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
      
      if (!photo) {
        Alert.alert("Erro", "Não foi possível capturar a foto.");
        return;
      }

      setRecognizedText('');
      setCapturedPhoto(photo);
      setWaitingForQuestion(true);

      // Fala a pergunta e depois inicia o reconhecimento
      await speak("O que você deseja saber sobre a foto?");
      startListening(true); // Modo local

    } catch (error) {
      console.error("[Camera] Error taking picture:", error);
      Alert.alert("Erro", error instanceof Error ? error.message : "Erro ao capturar foto");
      setCapturedPhoto(null);
      setWaitingForQuestion(false);
    }
  };

  // ===================================================================
  // COMANDO DE VOZ PENDENTE (do contexto global)
  // ===================================================================
  useEffect(() => {
    if (isFocused && pendingSpokenText) {
      console.log(`[Camera] Executando ação de voz pendente: "${pendingSpokenText}"`);
      takePictureForVoiceCommand(pendingSpokenText);
      clearPending();
    }
  }, [isFocused, pendingSpokenText]);

  // ===================================================================
  // CRIAR FORM DATA
  // ===================================================================
  const createFormData = (photo: Photo, prompt: string): FormData => {
    const formData = new FormData();

    formData.append("file", {
      uri: photo.uri,
      type: "image/jpeg",
      name: "photo.jpg",
    } as any);

    formData.append("prompt", prompt);

    return formData;
  };

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

          {/* Camera Button */}
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