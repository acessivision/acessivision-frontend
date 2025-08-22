import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useTheme } from "../../components/ThemeContext";
import { useAudioPlayer, AudioModule, type AudioSource } from "expo-audio";

interface Photo {
  uri: string;
  base64?: string;
}

const SERVER_URL = `http://${process.env.EXPO_PUBLIC_IP}:3000/upload`;

const CameraScreen: React.FC = () => {
  const { cores, temaAplicado } = useTheme();
  const [audioSource, setAudioSource] = useState<AudioSource | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const isFocused = useIsFocused();

  const player = useAudioPlayer(audioSource);

  useEffect(() => {
    const configureAudioMode = async () => {
      try {
        await AudioModule.setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
          interruptionMode: "doNotMix",
          shouldPlayInBackground: false,
        });
      } catch (error) {
        console.error("Erro ao configurar o modo de áudio: ", error);
      }
    };
    configureAudioMode();
  }, []);

  useEffect(() => {
    if (player && audioSource) {
      try {
        player.seekTo(0);
        player.play();
      } catch (error) {
        console.error("Erro ao reproduzir áudio:", error);
      }
    }
  }, [audioSource, player]);

  const createFormData = (photo: Photo): FormData => {
    const formData = new FormData();
    formData.append("file", {
      uri: photo.uri,
      type: "image/jpeg",
      name: "photo.jpg",
    } as any);
    return formData;
  };

  const processAudioResponse = async (arrayBuffer: ArrayBuffer) => {
    try {
      const uint8Array = new Uint8Array(arrayBuffer);

      // converte Uint8Array para base64 usando btoa
      let binary = "";
      const chunkSize = 0x8000; // evita travar com arquivos grandes
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      const base64Audio = btoa(binary);

      const tempFile = `${FileSystem.cacheDirectory}temp-audio-${Date.now()}.mp3`;
      await FileSystem.writeAsStringAsync(tempFile, base64Audio, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setAudioSource({ uri: tempFile });
    } catch (error) {
      console.error("Erro ao processar áudio:", error);
    }
  };

  const takePictureAndUpload = async (): Promise<void> => {
    if (!cameraRef.current) {
      Alert.alert("Erro", "Câmera não está pronta.");
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
      if (!photo) {
        Alert.alert("Erro", "Não foi possível capturar a foto.");
        return;
      }

      const formData = createFormData(photo);
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
    } catch (error) {
      Alert.alert(
        "Erro",
        error instanceof Error ? error.message : "Erro desconhecido"
      );
    }
  };

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View
        style={[styles.container, { backgroundColor: cores.barrasDeNavegacao }]}
      >
        <Text style={[styles.message, { color: cores.texto }]}>
          Precisamos da sua permissão para usar a câmera
        </Text>
        <Button onPress={requestPermission} title="Conceder Permissão" />
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

          {/* Botão sobreposto */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.button}
              onPress={takePictureAndUpload}
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
  message: { textAlign: "center", paddingBottom: 10 },
  buttonContainer: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
  },
  button: { alignItems: "center" },
  iconeCamera: { width: 100, height: 100 },
});

export default CameraScreen;
