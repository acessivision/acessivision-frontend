import { CameraView, useCameraPermissions } from "expo-camera";
import { File, Paths } from "expo-file-system/next";
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
  Platform
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useTheme } from "../../components/ThemeContext";
import { useAudioPlayer, AudioModule, type AudioSource, createAudioPlayer } from "expo-audio";
import { useRouter } from 'expo-router';
import { useVoiceCommands } from '../../components/VoiceCommandContext'; 

interface Photo {
  uri: string;
  base64?: string;
}

console.log('IP do .env:', process.env.EXPO_PUBLIC_IP);
const SERVER_URL = `http://${process.env.EXPO_PUBLIC_IP}:3000/upload`;
console.log('URL final:', SERVER_URL);

const CameraScreen: React.FC = () => {
  const router = useRouter();
  const { cores, temaAplicado, setTheme } = useTheme();
  const [audioSource, setAudioSource] = useState<AudioSource | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const cameraRef = useRef<CameraView>(null);
  const isFocused = useIsFocused();
  const [player, setPlayer] = useState<ReturnType<typeof createAudioPlayer> | null>(null);

  const { 
    registerAction,
    unregisterAction,
    pendingSpokenText,
    clearPending,
    registerAudioPlayer,
    unregisterAudioPlayer,
  } = useVoiceCommands();

  const takePictureAndUpload = async (spokenText: string): Promise<void> => {
    if (!cameraRef.current) {
      Alert.alert("Erro", "Câmera não está pronta.");
      return;
    }

    try {
      console.log("[Camera] Taking picture...");
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
      if (!photo) {
        Alert.alert("Erro", "Não foi possível capturar a foto.");
        return;
      }

      console.log(`[Upload] Uploading photo with prompt: "${spokenText}"`);
      // Passe o texto para a função que cria o FormData
      const formData = createFormData(photo, spokenText); 
      const response = await fetch(SERVER_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro do servidor: ${response.status} - ${errorText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      await processAudioResponse(arrayBuffer);
      console.log("[Upload] Upload completed successfully");
    } catch (error) {
      console.error("[Upload] Error:", error);
      Alert.alert("Erro", error instanceof Error ? error.message : "Erro desconhecido");
    }
  };

  // ---------------- Registro da ação de voz ----------------
  useEffect(() => {
    if (isFocused) {
      registerAction('takePictureAndUpload', takePictureAndUpload);
      return () => unregisterAction('takePictureAndUpload');
    }
  }, [isFocused]);

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
  }, [isFocused, pendingSpokenText]);

  // ---------------- Audio setup ----------------
  useEffect(() => {
    const configureAudioMode = async () => {
      try {
        await AudioModule.setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
          interruptionMode: "doNotMix",
          shouldPlayInBackground: false,
        });
        console.log("[Audio] Audio mode configured");
      } catch (error) {
        console.error("Erro ao configurar o modo de áudio: ", error);
      }
    };
    configureAudioMode();
  }, []);

  useEffect(() => {
    if (audioSource) {
      const newPlayer = createAudioPlayer(audioSource);
      if (Platform.OS === "android") {
        newPlayer.shouldCorrectPitch = true;
        newPlayer.setPlaybackRate(1.3);
      } else {
        newPlayer.setPlaybackRate(1.3, "high");
      }
      setPlayer(newPlayer);
      
      // Registra o player no contexto de voz para permitir interrupção
      registerAudioPlayer(newPlayer);
      
      newPlayer.play();
      console.log("[Audio] Playing audio response");
      
      return () => {
        // Remove o registro do player e libera recursos
        unregisterAudioPlayer();
        newPlayer.release();
      };
    }
  }, [audioSource, registerAudioPlayer, unregisterAudioPlayer]);

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

  const processAudioResponse = async (arrayBuffer: ArrayBuffer) => {
    try {
      const tempFile = new File(
        Paths.cache,
        `temp-audio-${Date.now()}.mp3`
      );
      tempFile.create();
      const uint8Array = new Uint8Array(arrayBuffer);
      await tempFile.write(uint8Array);
      setAudioSource({ uri: tempFile.uri });
      console.log("[Audio] Processed audio response");
    } catch (error) {
      console.error("Erro ao processar áudio:", error);
    }
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
              onPress={() => takePictureAndUpload('ativado pelo botão')}
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