import { CameraView, useCameraPermissions } from "expo-camera";
import { File, Paths } from "expo-file-system/next";
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
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

interface Photo {
  uri: string;
  base64?: string;
}

const SERVER_URL = `http://${process.env.EXPO_PUBLIC_IP}:3000/upload`;

const CameraScreen: React.FC = () => {
  const { cores, temaAplicado } = useTheme();
  const [audioSource, setAudioSource] = useState<AudioSource | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  // Voice recognition states
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [voiceState, setVoiceState] = useState<
    "waiting_wake" | "listening_command"
  >("waiting_wake");
  const [statusMessage, setStatusMessage] = useState(
    '👂 Diga "oi" para começar...'
  );
  const [speechPermissionGranted, setSpeechPermissionGranted] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const isFocused = useIsFocused();
  const player = useAudioPlayer(audioSource);

  // Guards to prevent infinite loops
  const isStartingRef = useRef(false);
  const isListeningRef = useRef(false);
  const currentSessionRef = useRef<string | null>(null);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------- Speech recognition handlers ----------------
  useSpeechRecognitionEvent("start", () => {
    console.log("[Speech] Recognition started");
    setIsListening(true);
    isListeningRef.current = true;
    isStartingRef.current = false;
  });

  useSpeechRecognitionEvent("end", () => {
    console.log("[Speech] Recognition ended");
    setIsListening(false);
    isListeningRef.current = false;
    isStartingRef.current = false;
    
    // Auto-restart if screen is focused and we should be listening
    if (isFocused && speechPermissionGranted && !restartTimeoutRef.current) {
      restartTimeoutRef.current = setTimeout(() => {
        restartTimeoutRef.current = null;
        if (isFocused && speechPermissionGranted) {
          console.log("[Speech] Auto-restarting recognition");
          startListening();
        }
      }, 1000);
    }
  });

  useSpeechRecognitionEvent("result", (event) => {
    const results = event.results;
    if (results && results.length > 0) {
      const transcript = results[0]?.transcript || "";
      const isFinal = event.isFinal || false;

      console.log(`[Speech] Heard: "${transcript}" (final: ${isFinal})`);
      setRecognizedText(transcript);

      if (isFinal) {
        processVoiceInput(transcript.toLowerCase());
      }
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    const errorMessage = (event as any)?.message || "";
    console.log("Speech recognition error:", event.error, errorMessage);
    isListeningRef.current = false;
    isStartingRef.current = false;
    setIsListening(false);

    const errString = `${event?.error ?? ""} ${errorMessage}`.toLowerCase();

    // Handle different error types
    if (errString.includes("not-allowed")) {
      console.log("Permission denied, not restarting");
      setSpeechPermissionGranted(false);
      return;
    }

    if (errString.includes("aborted")) {
      console.log("Recognition aborted, will restart if needed");
      // Don't immediately restart on abort, let the "end" event handle it
      return;
    }

    // For other errors, restart after a delay
    if (isFocused && speechPermissionGranted && !restartTimeoutRef.current) {
      restartTimeoutRef.current = setTimeout(() => {
        restartTimeoutRef.current = null;
        if (isFocused && speechPermissionGranted) {
          console.log("[Speech] Restarting after error");
          startListening();
        }
      }, 2000);
    }
  });

  // ---------------- Permissions ----------------
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const result = await ExpoSpeechRecognitionModule.getPermissionsAsync();
        setSpeechPermissionGranted(result.granted);
        console.log("[Permissions] Speech permission:", result.granted);
      } catch (error) {
        console.error("Error checking permissions:", error);
        setSpeechPermissionGranted(false);
      }
    };

    checkPermissions();
  }, []);

  useEffect(() => {
    if (isFocused && speechPermissionGranted) {
      console.log("[Focus] Screen focused, starting listening");
      // Clear any pending restart
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      startListening();
    } else if (!isFocused) {
      console.log("[Focus] Screen unfocused, stopping listening");
      stopListening();
    }

    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      stopListening();
    };
  }, [isFocused, speechPermissionGranted]);

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
    if (player && audioSource) {
      try {
        player.seekTo(0);
        player.setPlaybackRate(1.5, "medium");
        player.play();
        console.log("[Audio] Playing audio response");
      } catch (error) {
        console.error("Erro ao reproduzir áudio:", error);
      }
    }
  }, [audioSource, player]);

  // ---------------- Voice logic ----------------
  const processVoiceInput = (spokenText: string) => {
    console.log("[VoiceInput] Processing:", spokenText, "State:", voiceState);

    if (voiceState === "waiting_wake") {
      if (
        spokenText.includes("oi") ||
        spokenText.includes("hey") ||
        spokenText.includes("olá")
      ) {
        console.log("[Wake Word] Detected!");
        setVoiceState("listening_command");
        setStatusMessage("🎯 Escutando... Pode falar!");
        setRecognizedText("");
      } else {
        console.log("[Wake Word] Not detected, staying idle.");
      }
    } else if (voiceState === "listening_command") {
      console.log("[Command] Heard:", spokenText);

      if (spokenText.includes("foto") || spokenText.includes("tirar")) {
        console.log("[Command] Triggering takePictureAndUpload()");
        setStatusMessage("📸 Tirando foto...");
        takePictureAndUpload();
      }

      // Reset to waiting state after processing command
      setTimeout(() => {
        console.log("[Reset] Going back to waiting_wake...");
        setVoiceState("waiting_wake");
        setStatusMessage('👂 Diga "oi" para começar...');
        setRecognizedText("");
      }, 3000);
    }
  };

  const startListening = async () => {
    if (isStartingRef.current || isListeningRef.current) {
      console.log("[StartListening] Already starting or listening, skipping");
      return;
    }

    if (!speechPermissionGranted) {
      console.log("[StartListening] No speech permission, skipping");
      return;
    }

    isStartingRef.current = true;
    const sessionId = Date.now().toString();
    currentSessionRef.current = sessionId;

    try {
      // Stop any existing session
      try {
        await ExpoSpeechRecognitionModule.stop();
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      } catch (e) {
        console.log("[StartListening] No active session to stop");
      }

      // Check if this session is still valid (prevents race conditions)
      if (currentSessionRef.current !== sessionId) {
        console.log("[StartListening] Session invalidated, aborting");
        return;
      }

      console.log("[StartListening] Starting new recognition session:", sessionId);
      await ExpoSpeechRecognitionModule.start({
        lang: "pt-BR",
        interimResults: true,
        maxAlternatives: 1,
        continuous: true,
        requiresOnDeviceRecognition: false,
      });

      console.log("✅ Started speech recognition session:", sessionId);
      console.log("[Debug] Make sure you're speaking clearly and the microphone has permission");
    } catch (error: any) {
      console.error("❌ Error starting speech recognition:", error);
      isStartingRef.current = false;
      currentSessionRef.current = null;

      // If we get a permission error, update state
      if (error?.message?.includes("not-allowed")) {
        setSpeechPermissionGranted(false);
      }
    }
  };

  const stopListening = async () => {
    try {
      console.log("[StopListening] Stopping recognition");
      isStartingRef.current = false;
      currentSessionRef.current = null;
      
      // Clear any pending restart
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }

      if (isListeningRef.current) {
        await ExpoSpeechRecognitionModule.stop();
      } else {
        try {
          await ExpoSpeechRecognitionModule.abort();
        } catch (e) {
          console.log("[StopListening] Nothing to abort");
        }
      }
    } catch (error) {
      console.error("Error stopping speech recognition:", error);
    } finally {
      isListeningRef.current = false;
      setIsListening(false);
    }
  };

  const requestSpeechPermissions = async () => {
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      setSpeechPermissionGranted(result.granted);
      
      if (result.granted) {
        console.log("[Permissions] Speech permission granted");
      } else {
        Alert.alert(
          "Permissão negada",
          "Não foi possível obter permissão para reconhecimento de voz."
        );
      }
    } catch (error) {
      console.error("Error requesting permissions:", error);
      Alert.alert("Erro", "Erro ao solicitar permissões.");
    }
  };

  // Reset state when unfocused
  useEffect(() => {
    if (!isFocused) {
      setVoiceState("waiting_wake");
      setStatusMessage('👂 Diga "oi" para começar...');
      setRecognizedText("");
    }
  }, [isFocused]);

  // ---------------- Camera & upload ----------------
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

  const takePictureAndUpload = async (): Promise<void> => {
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

      console.log("[Upload] Uploading photo...");
      const formData = createFormData(photo);
      const response = await fetch(SERVER_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Erro do servidor: ${response.status} - ${errorText}`
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      await processAudioResponse(arrayBuffer);
      console.log("[Upload] Upload completed successfully");
    } catch (error) {
      console.error("[Upload] Error:", error);
      Alert.alert(
        "Erro",
        error instanceof Error ? error.message : "Erro desconhecido"
      );
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

  if (!speechPermissionGranted) {
    return (
      <View
        style={[styles.container, { backgroundColor: cores.barrasDeNavegacao }]}
      >
        <Text style={[styles.message, { color: cores.texto }]}>
          Precisamos da sua permissão para usar o microfone para reconhecimento
          de voz
        </Text>
        <Button
          onPress={requestSpeechPermissions}
          title="Conceder Permissão do Microfone"
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

          {/* Voice Status */}
          <View style={styles.voiceStatusContainer}>
            <View
              style={[
                styles.voiceStatusBox,
                {
                  backgroundColor: isListening
                    ? "rgba(76, 175, 80, 0.9)"
                    : "rgba(0, 0, 0, 0.7)",
                },
              ]}
            >
              <Text style={styles.statusText}>{statusMessage}</Text>
              {isListening && (
                <View style={styles.listeningIndicator}>
                  <Text style={styles.listeningDot}>🎤</Text>
                </View>
              )}
            </View>
          </View>

          {/* Recognized Text */}
          {recognizedText && voiceState === "listening_command" && (
            <View style={styles.recognizedTextContainer}>
              <View style={styles.recognizedTextBox}>
                <Text style={styles.recognizedTextLabel}>Você disse:</Text>
                <Text style={styles.recognizedText}>"{recognizedText}"</Text>
              </View>
            </View>
          )}

          {/* Camera Button */}
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