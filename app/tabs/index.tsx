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
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  ExpoSpeechRecognitionResultEvent,
} from "expo-speech-recognition";
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';


interface Photo {
  uri: string;
  base64?: string;
}

console.log('IP do .env:', process.env.EXPO_PUBLIC_IP);
const SERVER_URL = `http://${process.env.EXPO_PUBLIC_IP}:3000/upload`;
console.log('URL final:', SERVER_URL);

const CameraScreen: React.FC = () => {
  const router = useRouter();
  const { cores, temaAplicado } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const isFocused = useIsFocused();
  const { conversaId, mode } = useLocalSearchParams<{ conversaId?: string, mode?: string }>();
  const [capturedPhoto, setCapturedPhoto] = useState<Photo | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isListeningForQuestion, setIsListeningForQuestion] = useState(false);
  const [recognizedQuestion, setRecognizedQuestion] = useState("");

  const {
    registerAction,
    unregisterAction,
    pendingSpokenText,
    clearPending,
  } = useVoiceCommands();

  // Função para falar
  const falar = (texto: string, callback?: () => void) => {
    Speech.stop();
    Speech.speak(texto, {
      language: "pt-BR",
      onDone: () => {
        if (callback) callback();
      },
      onStopped: () => {
        if (callback) callback();
      },
    });
  };

  const handleUploadAndProcess = async (photo: Photo, prompt: string) => {
    if (isSending) {
      console.log("[Upload] Ignorado, upload já em progresso.");
      return;
    }

    console.log(`[Upload] Iniciando. Modo: ${mode}, ID Conversa: ${conversaId}`);

    setIsSending(true);

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
      const description = result.description; // A resposta do Bot

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
            imageUri: downloadURL, // Salva a URL da foto
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
            imageUri: null, // O bot não envia imagem
            timestamp: firestore.FieldValue.serverTimestamp(),
          });
    
        // 5. VOLTA PARA A TELA DE CHAT
        console.log("Salvamento concluído. Voltando para o chat...");
        router.back();

      } else {
        // Comportamento original: Apenas fala a resposta
        console.log(`[Speech] A falar a descrição: "${description}"`);
        Speech.speak(description, { language: 'pt-BR' });
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
      setRecognizedQuestion("");
      setIsListeningForQuestion(false);
      setIsSending(false);
    }
  };

  useSpeechRecognitionEvent("result", (event: ExpoSpeechRecognitionResultEvent) => { // Use o tipo importado
    // SÓ processa se estiver no estado de ouvir a pergunta DA FOTO
    if (isListeningForQuestion && capturedPhoto) {
      const transcription = event.results?.[0]?.transcript || "";
      if (transcription) { // Evita processar resultados vazios
          console.log("[Speech - Local] Recognized question:", transcription);
          setRecognizedQuestion(transcription); // Atualiza o estado local
      }
    } else {
      // Ignora resultados se não estiver esperando a pergunta da foto
      // (o listener global do contexto vai pegar)
    }
  });

  useSpeechRecognitionEvent("end", () => {
    // ADICIONE ESTA VERIFICAÇÃO
    if (isSending) {
      console.log("[Speech] 'end' event ignorado, upload em progresso.");
      return; 
    }

    if (isListeningForQuestion && capturedPhoto && recognizedQuestion) {
      console.log("[Speech] Recognition ended, chamando handler");
      handleUploadAndProcess(capturedPhoto, recognizedQuestion); 
    }
  });

  const takePictureAndUpload = async (spokenText: string): Promise<void> => {
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

      // Chama a nova função unificada
      await handleUploadAndProcess(photo, spokenText);

    } catch (error) {
      console.error("[Camera] Error in takePictureAndUpload:", error);
      Alert.alert("Erro", error instanceof Error ? error.message : "Erro ao capturar foto");
    }
  };

const startListeningForQuestion = async () => {
    try {
      setIsListeningForQuestion(true);
      setRecognizedQuestion("");
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        Alert.alert("Permissão negada", "Precisamos de permissão para usar o microfone.");
        setIsListeningForQuestion(false);
        setCapturedPhoto(null);
        return;
      }
      await ExpoSpeechRecognitionModule.start({ lang: "pt-BR", /* ...outras opções */ });
      console.log("[Speech] Started listening for question");
    } catch (error) {
      console.error("[Speech] Error starting recognition:", error);
      Alert.alert("Erro", "Não foi possível iniciar o reconhecimento de voz");
      setIsListeningForQuestion(false);
      setCapturedPhoto(null);
    }
  };

  // Função do botão MODIFICADA (não precisa mais do upload)
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

      // 2. Guarda a foto (o estado local 'capturedPhoto' ainda é útil aqui)
      setCapturedPhoto(photo); 

      // 3. Fala a pergunta
      falar("O que você deseja saber sobre a foto?", () => {
        startListeningForQuestion();
        // 4. NO CALLBACK do 'falar':
        console.log("[Camera Button] Fala concluída. Mudando estado e reiniciando listener global...");
      });

    } catch (error) {
      console.error("[Camera] Error taking picture:", error);
      Alert.alert("Erro", error instanceof Error ? error.message : "Erro ao capturar foto");
      // Limpa a foto capturada em caso de erro e reinicia o listener
      setCapturedPhoto(null); 
    }
  };

  // ---------------- Registro da ação de voz ----------------
  useEffect(() => {
    if (isFocused) {
      registerAction('takePictureAndUpload', takePictureAndUpload);
      return () => unregisterAction('takePictureAndUpload');
    }
  }, [isFocused, handleUploadAndProcess]);

  // Hook para executar a ação de voz pendente
  useEffect(() => {
    // Se a tela estiver em foco e houver um comando de voz pendente para tirar foto
    if (isFocused && pendingSpokenText) {
      console.log(`[Camera] Executando ação de voz pendente: "${pendingSpokenText}"`);
      // Chama a função para tirar a foto com o texto que veio do comando de voz
      takePictureAndUpload(pendingSpokenText);
      // Limpa o comando pendente para garantir que não seja executado novamente
      clearPending();
    }
  }, [isFocused, pendingSpokenText, handleUploadAndProcess]);

  // ---------------- Camera & upload ----------------
  const createFormData = (photo: Photo, prompt: string): FormData => {
    const formData = new FormData();

    // 1. Adiciona a imagem
    formData.append("file", {
      uri: photo.uri,
      type: "image/jpeg",
      name: "photo.jpg",
    } as any);

    // 2. Adiciona o texto da pergunta do usuário
    formData.append("prompt", prompt);

    return formData;
  };

  // ---------------- UI ----------------
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
            >
              <Image
                source={
                  temaAplicado === "dark"
                    ? require("../../assets/images/icone-camera-escuro.png")
                    : require("../../assets/images/icone-camera-claro.png")
                }
                style={styles.iconeCamera}
              />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center" },
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
  button: { alignItems: "center" },
  iconeCamera: { width: 100, height: 100 },
  voiceStatusContainer: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
  },
  voiceStatusBox: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  listeningIndicator: {
    marginLeft: 10,
  },
  listeningDot: {
    fontSize: 16,
  },
  recognizedTextContainer: {
    position: "absolute",
    top: 120,
    left: 20,
    right: 20,
  },
  recognizedTextBox: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  recognizedTextLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 5,
    fontWeight: "500",
  },
  recognizedText: {
    fontSize: 16,
    color: "#000",
    fontWeight: "600",
  },
  debugContainer: {
    position: "absolute",
    bottom: 160,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  debugButton: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    flex: 0.48,
  },
  debugButtonText: {
    color: "#000",
    fontSize: 12,
    textAlign: "center",
    fontWeight: "600",
  },
});

export default CameraScreen;