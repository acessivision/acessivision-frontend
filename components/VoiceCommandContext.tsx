import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useRouter, usePathname } from 'expo-router';
import { useTheme } from './ThemeContext';
import { IntentClassifierService } from '../assets/models/IntentClassifier';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import { useAudioPlayer, AudioModule, type AudioSource } from "expo-audio";
import { Asset } from "expo-asset";
import * as Speech from 'expo-speech';

type ActionCallback = (spokenText: string) => void;
const registeredActions = new Map<string, ActionCallback>();

interface VoiceContextProps {
  statusMessage: string;
  isListening: boolean;
  recognizedText: string;
  voiceState: 'waiting_wake' | 'listening_command' | 'waiting_confirmation';
  registerAction: (name: string, callback: ActionCallback) => void;
  unregisterAction: (name: string) => void;
  pendingSpokenText: string | null;
  clearPending: () => void;
  registerAudioPlayer: (player: any) => void;
  unregisterAudioPlayer: () => void;
}

const VoiceCommandContext = createContext<VoiceContextProps | undefined>(undefined);

export const VoiceCommandProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const isFocused = useIsFocused();
  const { temaAplicado, setTheme } = useTheme();

  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [voiceState, setVoiceState] = useState<'waiting_wake' | 'listening_command' | 'waiting_confirmation'>('waiting_wake');
  const [statusMessage, setStatusMessage] = useState('👂 Diga "Escuta" para começar...');
  const [speechPermissionGranted, setSpeechPermissionGranted] = useState(false);
  const [pendingSpokenText, setPendingSpokenText] = useState<string | null>(null);

  // Estados para confirmação
  const [pendingIntent, setPendingIntent] = useState<string>('');
  const [pendingOriginalText, setPendingOriginalText] = useState<string>('');

  // Refs para controle de estado
  const isStartingRef = useRef(false);
  const isListeningRef = useRef(false);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorCountRef = useRef(0);
  const lastErrorTimeRef = useRef(0);
  const isStoppingRef = useRef(false);
  const lastProcessedTranscript = useRef<string>('');

  // Ref para controlar o player de áudio atual
  const currentAudioPlayerRef = useRef<any>(null);
  const isSpeakingRef = useRef(false);
  const lastSpokenTextRef = useRef<string>('');
  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Função para falar texto usando TTS (usando ref para evitar recriação)
  const speakRef = useRef((text: string) => {
    // Cancela qualquer fala pendente
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }

    // Evita falar o mesmo texto duas vezes seguidas
    if (text === lastSpokenTextRef.current && isSpeakingRef.current) {
      console.log('[Voice] Skipping duplicate TTS (already speaking):', text);
      return;
    }
    
    lastSpokenTextRef.current = text;
    
    // Pequeno delay para evitar chamadas duplicadas
    speakTimeoutRef.current = setTimeout(() => {
      // Para qualquer fala em andamento
      Speech.stop();
      isSpeakingRef.current = true;

      Speech.speak(text, {
        language: 'pt-BR',
        pitch: 1.0,
        rate: 1.0,
        onDone: () => {
          isSpeakingRef.current = false;
          console.log('[Voice] TTS finished');
        },
        onError: (error) => {
          isSpeakingRef.current = false;
          console.error('[Voice] TTS error:', error);
        },
      });
    }, 100);
  });

  const speak = useCallback((text: string) => {
    speakRef.current(text);
  }, []);

  // Função para registrar o player de áudio atual
  const registerAudioPlayer = useCallback((player: any) => {
    currentAudioPlayerRef.current = player;
    console.log('[Voice] Audio player registered for interruption control');
  }, []);

  // Função para desregistrar o player de áudio
  const unregisterAudioPlayer = useCallback(() => {
    currentAudioPlayerRef.current = null;
    console.log('[Voice] Audio player unregistered');
  }, []);

  // Função para interromper o áudio em reprodução
  const stopCurrentAudio = useCallback(() => {
    if (currentAudioPlayerRef.current) {
      try {
        currentAudioPlayerRef.current.pause();
        console.log('[Voice] Audio interrupted by wake word');
      } catch (error) {
        console.error('[Voice] Error stopping audio:', error);
      }
    }
  }, []);

  // Função melhorada para parar escuta
  const stopListening = useCallback(() => {
    if (isStoppingRef.current) return;
    
    isStoppingRef.current = true;
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    
    try {
      if (isListeningRef.current) {
        ExpoSpeechRecognitionModule.stop();
        console.log('[Voice] Recognition stopped');
      }
    } catch (error) {
      // Silenciar erros de stop
    } finally {
      setTimeout(() => {
        isStoppingRef.current = false;
      }, 100);
    }
  }, []);

  // Função melhorada para iniciar escuta
  const startListening = useCallback(async () => {
    if (isStartingRef.current || isListeningRef.current || !speechPermissionGranted || !isFocused) {
      isStartingRef.current = false;
      return;
    }

    isStartingRef.current = true;
    
    try {
      if (isListeningRef.current) {
        await new Promise<void>((resolve) => {
          ExpoSpeechRecognitionModule.stop();
          setTimeout(resolve, 100);
        });
      }

      await new Promise(resolve => setTimeout(resolve, 150));

      ExpoSpeechRecognitionModule.start({
        lang: 'pt-BR',
        interimResults: true,
        continuous: true,
      });

      console.log('[Voice] Recognition started successfully');
      errorCountRef.current = 0;
      lastProcessedTranscript.current = '';
      
    } catch (error) {
      console.error('[Voice] Error starting recognition:', error);
      errorCountRef.current++;
      
      const delay = Math.min(errorCountRef.current * 500, 3000);
      if (isFocused && speechPermissionGranted && errorCountRef.current < 5) {
        restartTimeoutRef.current = setTimeout(startListening, delay);
      }
    } finally {
      isStartingRef.current = false;
    }
  }, [speechPermissionGranted, isFocused]);

  // Função para executar as intenções
  const executeIntent = useCallback((intent: string, originalText: string) => {
    console.log(`[Intent] Executing: ${intent}`);
    switch (intent) {
      case 'tirar_foto':
        setStatusMessage("📸 Preparando para tirar foto...");
        setPendingSpokenText(originalText);
        if (pathname !== '/tabs') {
          router.replace('/tabs');
        }
        break;
      case 'abrir_camera':
        clearPending();
        setStatusMessage("Abrindo a câmera...");
        if (pathname !== '/tabs') {
          router.replace('/tabs');
        }
        break;
      case 'ir_para_historico':
        setStatusMessage("Indo para o Histórico...");
        router.replace('/tabs/historico');
        break;
      case 'ir_para_configuracoes':
        setStatusMessage("Abrindo as Configurações...");
        router.replace('/tabs/configuracoes');
        break;
      case 'ir_para_editar_perfil':
        setStatusMessage("Abrindo a página para Editar Perfil...");
        router.replace('/tabs/editarPerfil');
        break;
      case 'ir_para_login':
        setStatusMessage("Indo para a tela de login...");
        router.replace('/login');
        break;
      case 'fazer_logout':
        setStatusMessage("Encerrando a sessão...");
        break;
      case 'mudar_tema_claro':
        if (temaAplicado === 'dark') {
          setTheme('light');
          setStatusMessage("Tema alterado para claro!");
        } else {
          setStatusMessage("O tema já está claro!");
        }
        break;
      case 'mudar_tema_escuro':
        if (temaAplicado === 'light') {
          setTheme('dark');
          setStatusMessage("Tema alterado para escuro!");
        } else {
          setStatusMessage("O tema já está escuro!");
        }
        break;
      case 'tutorial':
        setStatusMessage("Mostrando o tutorial...");
        break;
      case 'explicar_tela':
        setStatusMessage("Explicando os elementos da tela...");
        break;
      case 'cadastro':
        setStatusMessage("Indo para a tela de cadastro...");
        break;
      case 'recuperar_senha':
        setStatusMessage("Indo para a recuperação de senha...");
        break;
      case 'excluir_conta':
        setStatusMessage("Iniciando exclusão de conta...");
        break;
      default:
        setStatusMessage("Comando não reconhecido.");
        break;
    }
  }, [temaAplicado, router, pathname, setTheme]);

  // Função para obter nome amigável da intenção
  const getIntentDisplayName = (intent: string): string => {
    const intentNames: { [key: string]: string } = {
      'tirar_foto': 'tirar uma foto',
      'abrir_camera': 'abrir a câmera',
      'ir_para_historico': 'ir para o histórico',
      'ir_para_configuracoes': 'ir para as configurações',
      'ir_para_editar_perfil': 'editar seu perfil',
      'ir_para_login': 'ir para a tela de login',
      'fazer_logout': 'sair da sua conta',
      'mudar_tema_claro': 'mudar para o tema claro',
      'mudar_tema_escuro': 'mudar para o tema escuro',
      'tutorial': 'pedir ajuda ou ver o tutorial',
      'explicar_tela': 'pedir uma explicação da tela atual',
      'cadastro': 'criar uma nova conta',
      'recuperar_senha': 'recuperar sua senha',
      'excluir_conta': 'excluir sua conta'
    };
    return intentNames[intent] || intent;
  };

  // Função para lidar com respostas de confirmação
  const handleConfirmationResponse = useCallback((spokenText: string) => {
    const normalizedText = spokenText.toLowerCase().trim();
    
    const confirmWords = ['sim', 'confirmo', 'confirmar', 'isso', 'exato', 'certo', 'ok', 'yes'];
    const denyWords = ['não', 'nao', 'cancelar', 'cancel', 'errado', 'no'];
    
    const isConfirm = confirmWords.some(word => normalizedText.includes(word));
    const isDeny = denyWords.some(word => normalizedText.includes(word));
    
    if (isConfirm && pendingIntent) {
      const confirmMessage = "Confirmado! Executando...";
      setStatusMessage("✅ " + confirmMessage);
      speak(confirmMessage);
      executeIntent(pendingIntent, pendingOriginalText);
      setPendingIntent('');
      setPendingOriginalText('');
      
      stopListening();
      setTimeout(() => {
        setVoiceState("waiting_wake");
        setStatusMessage('👂 Diga "Escuta" para começar...');
        setRecognizedText("");
        startListening();
      }, 2500);
      
    } else if (isDeny) {
      const cancelMessage = "Cancelado";
      setStatusMessage("❌ " + cancelMessage);
      speak(cancelMessage);
      setPendingIntent('');
      setPendingOriginalText('');
      
      stopListening();
      setTimeout(() => {
        setVoiceState("waiting_wake");
        setStatusMessage('👂 Diga "Escuta" para começar...');
        setRecognizedText("");
        startListening();
      }, 2500);
      
    } else {
      const displayName = getIntentDisplayName(pendingIntent);
      const confirmQuestion = `Você confirma que quer ${displayName}? Diga sim ou não`;
      setStatusMessage(`🤔 ${confirmQuestion}`);
      speak(confirmQuestion);
    }
  }, [pendingIntent, pendingOriginalText, executeIntent, stopListening, startListening, speak]);

  const activationSound = Asset.fromModule(require("../assets/sons/som_ativacao.mp3")).uri;
  const player = useAudioPlayer({ uri: activationSound });

  useEffect(() => {
    const configureAudio = async () => {
      try {
        await AudioModule.setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
          interruptionMode: "doNotMix",
          shouldPlayInBackground: false,
        });
        console.log("[Voice] Audio mode ready");
      } catch (err) {
        console.error("[Voice] Erro ao configurar áudio:", err);
      }
    };
    configureAudio();
  }, []);

  const playActivationSound = () => {
    try {
      if (player) {
        player.seekTo(0);
        player.setPlaybackRate(1.0);
        player.play();
        console.log("[Voice] Som de ativação reproduzido");
      }
    } catch (err) {
      console.error("[Voice] Erro ao tocar som:", err);
    }
  };

  const processVoiceInput = useCallback((spokenText: string) => {
    if (!spokenText.trim() || spokenText === lastProcessedTranscript.current) {
      return;
    }
    lastProcessedTranscript.current = spokenText;

    try {
      if (voiceState === "waiting_wake") {
        if (spokenText.toLowerCase().includes("escuta")) {
          stopCurrentAudio();
          stopListening();
          playActivationSound();
          setVoiceState("listening_command");
          setStatusMessage("🎯 Escutando... Pode falar!");
          setRecognizedText("");
          setTimeout(startListening, 500);
        } else if (
          spokenText.toLowerCase().includes("pare") ||
          spokenText.toLowerCase().includes("parar") ||
          spokenText.toLowerCase().includes("cala a boca") ||
          spokenText.toLowerCase().includes("chega") ||
          spokenText.toLowerCase().includes("já deu") ||
          spokenText.toLowerCase().includes("para")) {
          stopCurrentAudio();
          stopListening();
        }
        
      } else if (voiceState === "listening_command") {
        const prediction = IntentClassifierService.predictWithConfidence(spokenText);
        const confidencePercent = (prediction.confidence * 100).toFixed(0);
        
        console.log(`[Intent] "${spokenText}" -> ${prediction.intent} (${confidencePercent}%)`);
        setRecognizedText(spokenText);

        stopListening();

        if (prediction.needsConfirmation) {
          const displayName = getIntentDisplayName(prediction.intent);
          const confirmQuestion = `Você quer ${displayName}? Diga sim ou não`;
          setStatusMessage(`❓ ${confirmQuestion}`);
          setPendingIntent(prediction.intent);
          setPendingOriginalText(spokenText);
          setVoiceState("waiting_confirmation");
          
          // Delay antes de falar para garantir que só aconteça uma vez
          setTimeout(() => {
            speak(confirmQuestion);
            startListening();
          }, 300);
          
        } else {
          setStatusMessage(`✅ Entendi! (${confidencePercent}%)`);
          executeIntent(prediction.intent, spokenText);
          
          setTimeout(() => {
            setVoiceState("waiting_wake");
            setStatusMessage('👂 Diga "Escuta" para começar...');
            setRecognizedText("");
            startListening();
          }, 3500);
        }
        
      } else if (voiceState === "waiting_confirmation") {
        stopListening();
        handleConfirmationResponse(spokenText);
        if (!pendingIntent) {
          setTimeout(startListening, 500);
        }
      }
    } catch (error) {
      console.error('[Voice] Error processing input:', error);
      setStatusMessage("Erro ao processar comando. Tente novamente.");
      stopListening();
      setTimeout(() => {
        setVoiceState("waiting_wake");
        setStatusMessage('👂 Diga "Escuta" para começar...');
        setRecognizedText("");
        startListening();
      }, 2000);
    }
  }, [voiceState, executeIntent, handleConfirmationResponse, stopListening, startListening, stopCurrentAudio, speak]);

  const requestSpeechPermissions = useCallback(async () => {
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      setSpeechPermissionGranted(granted);
      
      if (!granted) {
        Alert.alert("Permissão necessária", "A permissão do microfone é necessária para os comandos de voz.");
      } else {
        console.log('[Voice] Speech permissions granted');
      }
    } catch (error) {
      console.error('[Voice] Error requesting permissions:', error);
      setSpeechPermissionGranted(false);
    }
  }, []);

  useEffect(() => {
    requestSpeechPermissions();
  }, [requestSpeechPermissions]);

  useEffect(() => {
    if (isFocused && speechPermissionGranted) {
      const timer = setTimeout(startListening, 200);
      return () => clearTimeout(timer);
    } else {
      stopListening();
    }
  }, [isFocused, speechPermissionGranted, startListening, stopListening]);

  useEffect(() => {
    return () => {
      stopListening();
      Speech.stop();
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (speakTimeoutRef.current) {
        clearTimeout(speakTimeoutRef.current);
      }
    };
  }, [stopListening]);

  useSpeechRecognitionEvent("start", () => {
    console.log('[Voice] Recognition started');
    setIsListening(true);
    isListeningRef.current = true;
    errorCountRef.current = 0;
  });

  useSpeechRecognitionEvent("end", () => {
    console.log('[Voice] Recognition ended');
    setIsListening(false);
    isListeningRef.current = false;
    isStartingRef.current = false;

    if (isFocused && speechPermissionGranted && !isStoppingRef.current) {
      const delay = errorCountRef.current > 0 ? Math.min(errorCountRef.current * 300, 2000) : 250;
      restartTimeoutRef.current = setTimeout(startListening, delay);
    }
  });

  useSpeechRecognitionEvent("result", (event: ExpoSpeechRecognitionResultEvent) => {
    try {
      if (event.results && event.results.length > 0) {
        const transcript = event.results[0]?.transcript || "";
        setRecognizedText(transcript);
        
        if (event.isFinal && transcript.trim()) {
          console.log('[Voice] Final result:', transcript);
          processVoiceInput(transcript.trim().toLowerCase());
        }
      }
    } catch (error) {
      console.error('[Voice] Error processing result:', error);
    }
  });

  useSpeechRecognitionEvent("error", (error) => {
    const currentTime = Date.now();
    const timeSinceLastError = currentTime - lastErrorTimeRef.current;
    lastErrorTimeRef.current = currentTime;

    if (timeSinceLastError > 1000 || error.error !== "no-speech") {
      console.log(`[Voice] Recognition error: ${error.error} - ${error.message || 'No message'}`);
    }

    setIsListening(false);
    isListeningRef.current = false;
    errorCountRef.current++;

    let restartDelay = 250;
    
    switch (error.error) {
      case "no-speech":
        restartDelay = 200;
        break;
      case "client":
        restartDelay = Math.min(errorCountRef.current * 500, 2000);
        break;
      case "network":
        restartDelay = 1500;
        break;
      default:
        restartDelay = Math.min(errorCountRef.current * 300, 1500);
    }

    if (isFocused && speechPermissionGranted) {
      if (errorCountRef.current < 8) {
        restartTimeoutRef.current = setTimeout(startListening, restartDelay);
      } else {
        console.log('[Voice] Too many errors, full reset');
        stopListening();
        errorCountRef.current = 0;
        setTimeout(startListening, 3000);
      }
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
    registerAudioPlayer,
    unregisterAudioPlayer,
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