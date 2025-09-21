import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useTheme } from './ThemeContext';
import { IntentClassifierService } from '../assets/models/IntentClassifier';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';

type ActionCallback = (spokenText: string) => void;
const registeredActions = new Map<string, ActionCallback>();

interface VoiceContextProps {
  statusMessage: string;
  isListening: boolean;
  recognizedText: string;
  voiceState: 'waiting_wake' | 'listening_command';
  registerAction: (name: string, callback: ActionCallback) => void;
  unregisterAction: (name: string) => void;
  pendingSpokenText: string | null;
  clearPending: () => void;
}

const VoiceCommandContext = createContext<VoiceContextProps | undefined>(undefined);

export const VoiceCommandProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { temaAplicado, setTheme } = useTheme();

  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [voiceState, setVoiceState] = useState<'waiting_wake' | 'listening_command'>('waiting_wake');
  const [statusMessage, setStatusMessage] = useState('👂 Diga "oi" para começar...');
  const [speechPermissionGranted, setSpeechPermissionGranted] = useState(false);
  const [pendingSpokenText, setPendingSpokenText] = useState<string | null>(null);

  const isStartingRef = useRef(false);
  const isListeningRef = useRef(false);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processVoiceInput = useCallback((spokenText: string) => {
    // Sua função processVoiceInput original, adaptada para o contexto
    if (voiceState === "waiting_wake") {
      if (spokenText.includes("oi")) {
        setVoiceState("listening_command");
        setStatusMessage("🎯 Escutando... Pode falar!");
        setRecognizedText("");
      }
    } else if (voiceState === "listening_command") {
      const intent = IntentClassifierService.predict(spokenText);
      console.log(`[Intent] Predicted as: ${intent}`);
      setRecognizedText(spokenText);

      switch (intent) {
        case 'tirar_foto':
        case 'pergunta_sobre_imagem_ou_tela':
        case 'abrir_camera':
          const takePictureAction = registeredActions.get('takePictureAndUpload');
          if (takePictureAction) {
            setStatusMessage("📸 Analisando a imagem...");
            takePictureAction(spokenText);
          } else {
            setStatusMessage("Redirecionando para a câmera...");
            setPendingSpokenText(spokenText);
            router.push('/tabs');
          }
          break;
        case 'ir_para_historico':
          setStatusMessage("Indo para o Histórico...");
          router.push('/tabs/historico');
          break;
        case 'ir_para_configuracoes':
          setStatusMessage("Abrindo as Configurações...");
          router.push('/tabs/configuracoes');
          break;
        case 'mudar_tema_claro':
          if (temaAplicado === 'dark') setTheme('light');
          break;
        case 'mudar_tema_escuro':
          if (temaAplicado === 'light') setTheme('dark');
          break;
        case 'pedir_ajuda':
          setStatusMessage("Tutorial ainda não foi feito...");
          break;
        case 'editar_perfil':
          setStatusMessage("Abrindo a página para Editar Perfil...");
          router.push('/tabs/editarPerfil');
          break;
        default:
          setStatusMessage("Não entendi o comando.");
          break;
      }

      setTimeout(() => {
        setVoiceState("waiting_wake");
        setStatusMessage('👂 Diga "oi" para começar...');
        setRecognizedText("");
      }, 3500);
    }
  }, [voiceState, temaAplicado, router, setTheme]);

  const startListening = useCallback(() => {
    if (isStartingRef.current || isListeningRef.current || !speechPermissionGranted) {
      return;
    }
    isStartingRef.current = true;
    try {
      // Tenta parar qualquer sessão anterior para evitar conflitos
      ExpoSpeechRecognitionModule.stop();
      ExpoSpeechRecognitionModule.start({
        lang: 'pt-BR',
        interimResults: true,
        continuous: true, // Adicionado para manter a escuta contínua, evitando paradas por silêncio
      });
    } catch (error) {
      console.error("Erro ao iniciar a escuta:", error);
    } finally {
      isStartingRef.current = false;
    }
  }, [speechPermissionGranted]);

  const stopListening = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (error) {
      // Ignora erros de "nenhuma escuta para parar"
    }
  }, []);

  const requestSpeechPermissions = useCallback(async () => {
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    setSpeechPermissionGranted(granted);
    if (!granted) {
      Alert.alert("Permissão necessária", "A permissão do microfone é necessária para os comandos de voz.");
    }
  }, []);

  useEffect(() => {
    requestSpeechPermissions();
  }, [requestSpeechPermissions]);

  useEffect(() => {
    if (isFocused && speechPermissionGranted) {
      startListening();
    } else {
      stopListening();
    }
    return () => {
      stopListening();
    };
  }, [isFocused, speechPermissionGranted, startListening, stopListening]);

  useSpeechRecognitionEvent("start", () => {
    setIsListening(true);
    isListeningRef.current = true;
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    isListeningRef.current = false;
    if (isFocused && speechPermissionGranted) {
      restartTimeoutRef.current = setTimeout(startListening, 250); // Reinício suave em caso de fim inesperado
    }
  });

  useSpeechRecognitionEvent("result", (event: ExpoSpeechRecognitionResultEvent) => {
    if (event.results && event.results.length > 0) {
      const transcript = event.results[0]?.transcript || "";
      setRecognizedText(transcript);
      if (event.isFinal) {
        processVoiceInput(transcript.trim().toLowerCase());
      }
    }
  });

  useSpeechRecognitionEvent("error", (error) => {
    isListeningRef.current = false;
    setIsListening(false);
    if (error.error !== "no-speech") {
      console.error("Speech Recognition Error:", error);
    }
    // Para "no-speech", tratamos como um "end" normal e reiniciamos
    if (isFocused && speechPermissionGranted) {
      restartTimeoutRef.current = setTimeout(startListening, 250);
    }
  });

  const registerAction = (name: string, callback: ActionCallback) => {
    registeredActions.set(name, callback);
  };

  const unregisterAction = (name: string) => {
    registeredActions.delete(name);
  };

  const clearPending = () => setPendingSpokenText(null);

  const value = {
    statusMessage,
    isListening,
    recognizedText,
    voiceState,
    registerAction,
    unregisterAction,
    pendingSpokenText,
    clearPending,
  };

  return (
    <VoiceCommandContext.Provider value={value}>
      {children}
    </VoiceCommandContext.Provider>
  );
};

export const useVoiceCommands = () => {
  const context = useContext(VoiceCommandContext);
  if (context === undefined) {
    throw new Error('useVoiceCommands must be used within a VoiceCommandProvider');
  }
  return context;
};