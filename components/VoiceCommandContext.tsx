import React, { createContext, useState, useContext, useRef, useCallback, useEffect, useMemo, Dispatch, SetStateAction} from 'react';
import { useTheme } from './ThemeContext';
import { useAudioSetup } from '../hooks/useAudioSetup';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useIntentHandler, VoiceState as IntentHandlerVoiceState } from '../hooks/useIntentHandler';

type ActionCallback = (spokenText: string) => void;
const registeredActions = new Map<string, ActionCallback>();

type VoiceState = IntentHandlerVoiceState;

interface VoiceContextProps {
  isListening: boolean;
  recognizedText: string;
  voiceState: VoiceState;
  registerAction: (name: string, callback: ActionCallback) => void;
  unregisterAction: (name: string) => void;
  pendingSpokenText: string | null;
  clearPending: () => void;
  registerAudioPlayer: (player: any) => void;
  unregisterAudioPlayer: () => void;
  stopListening: () => void;
}

const VoiceCommandContext = createContext<VoiceContextProps | undefined>(undefined);

export const VoiceCommandProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { temaAplicado, setTheme } = useTheme();
  const [isFocused, setIsFocused] = useState(true); // ✅ Sempre focado por padrão

  const [pendingSpokenText, setPendingSpokenText] = useState<string | null>(null);
  const [pendingIntent, setPendingIntent] = useState<string>('');
  const [pendingOriginalText, setPendingOriginalText] = useState<string>('');
  
  const processTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Setup de áudio e TTS
  const { speak, stopCurrentAudio, registerAudioPlayer, unregisterAudioPlayer } = useAudioSetup();
  
  const [voiceState, setVoiceState] = useState<'waiting_wake' | 'listening_command' | 'waiting_confirmation'>('waiting_wake');

  // Reconhecimento de fala
  const {
    isListening,
    recognizedText,
    setRecognizedText,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    isFocused,
    onFinalResult: (text: string) => {
      if (processTimeoutRef.current) clearTimeout(processTimeoutRef.current);

      // Lógica original: Apenas processa comandos gerais
      if (voiceState === 'waiting_wake' || voiceState === 'listening_command') {
        processTimeoutRef.current = setTimeout(() => {
          // Pass the necessary functions to processCommand
          processCommand(text, voiceState, stopCurrentAudio, setPendingIntent, setPendingOriginalText, setPendingSpokenText, clearPending);
        }, 300);
      } else {
        console.log('[Voice] Ignoring result - wrong state:', voiceState);
      }
    },
  });

  // Handler de intents
  const { executeIntent, getIntentDisplayName, processCommand, isBusyRef } = useIntentHandler({
    speak,
    temaAplicado,
    setTheme,
    startListening,
    stopListening,
    setVoiceState,
    setRecognizedText,
  });

  // Handler de confirmação
  const handleConfirmationResponse = useCallback((spokenText: string) => {
    const normalizedText = spokenText.toLowerCase().trim();
    
    const confirmWords = ['sim', 'confirmo', 'confirmar', 'isso', 'exato', 'certo', 'ok'];
    const denyWords = ['não', 'nao', 'cancelar', 'cancel', 'errado', 'no'];
    
    const isConfirm = confirmWords.some(word => normalizedText.includes(word));
    const isDeny = denyWords.some(word => normalizedText.includes(word));
    
    if (isConfirm && pendingIntent) {
      speak("Confirmado! Executando...");
      executeIntent(pendingIntent, pendingOriginalText, setPendingSpokenText, clearPending);
      setPendingIntent('');
      setPendingOriginalText('');
      
      stopListening();
      setTimeout(() => {
        setVoiceState("waiting_wake");
        setRecognizedText("");
        startListening();
      }, 2500);
      
    } else if (isDeny) {
      speak("Cancelado");
      setPendingIntent('');
      setPendingOriginalText('');
      
      stopListening();
      setTimeout(() => {
        setVoiceState("waiting_wake");
        setRecognizedText("");
        startListening();
        isBusyRef.current = false;
      }, 2500);
      
    } else {
      const displayName = getIntentDisplayName(pendingIntent);
      speak(`Não entendi. Você quer ${displayName}? Diga sim ou não`);
    }
  }, [pendingIntent, pendingOriginalText, executeIntent, stopListening, startListening, speak, getIntentDisplayName, isBusyRef, setRecognizedText]);

  // ✅ CORREÇÃO: Processar confirmação dentro de um useEffect
  useEffect(() => {
    if (voiceState === "waiting_confirmation" && recognizedText) {
      const timeoutId = setTimeout(() => {
        handleConfirmationResponse(recognizedText);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [voiceState, recognizedText, handleConfirmationResponse]);

  const registerAction = (name: string, callback: ActionCallback) => {
    registeredActions.set(name, callback);
  };

  const unregisterAction = (name: string) => {
    registeredActions.delete(name);
  };

  const clearPending = useCallback(() => setPendingSpokenText(null), []);

  const value = useMemo(() => ({
    isListening,
    recognizedText,
    voiceState,
    registerAction,
    unregisterAction,
    pendingSpokenText,
    clearPending,
    registerAudioPlayer,
    unregisterAudioPlayer,
    stopListening,
  }), [
    // ADICIONE ÀS DEPENDÊNCIAS TAMBÉM:
    isListening,
    recognizedText,
    voiceState,
    pendingSpokenText,
    registerAudioPlayer,
    unregisterAudioPlayer,
    clearPending,
    stopListening,
  ]);

  return (
    <VoiceCommandContext.Provider value={value}>
      {children}
    </VoiceCommandContext.Provider>
  );
};

export const useVoiceCommands = () => {
  const context = useContext(VoiceCommandContext);
  if (context === undefined) {
    console.error('[useVoiceCommands] Context is undefined! Provider may not be mounted yet.');
    throw new Error('useVoiceCommands must be used within a VoiceCommandProvider');
  }
  return context;
};