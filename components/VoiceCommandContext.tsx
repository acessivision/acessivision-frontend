import React, { createContext, useState, useContext, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTheme } from './ThemeContext';
import { useAudioSetup } from '../hooks/useAudioSetup';
import { useSpeech } from '../hooks/useSpeech';
import { useIntentHandler, VoiceState as IntentHandlerVoiceState } from '../hooks/useIntentHandler';
import SpeechManager from '../utils/speechManager';

type VoiceState = IntentHandlerVoiceState;

interface VoiceContextProps {
  isListening: boolean;
  recognizedText: string;
  voiceState: VoiceState;
  pendingSpokenText: string | null;
  pendingContext: NavigationContext | null;
  clearPending: () => void;
  setPendingContext: (context: NavigationContext | null) => void;
  registerAudioPlayer: (player: any) => void;
  unregisterAudioPlayer: () => void;
  stopListening: () => void;
  registerConversationCallbacks: (callbacks: ConversationCallbacks) => void;
  unregisterConversationCallbacks: () => void;
}

interface ConversationCallbacks {
  onActivateMic?: () => void;
  onTakePhoto?: (question: string) => void;
  onOpenCamera?: () => void;
}

interface NavigationContext {
  mode?: string;
  conversaId?: string;
}

const VoiceCommandContext = createContext<VoiceContextProps | undefined>(undefined);

export const VoiceCommandProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ✅ MODIFICAÇÃO AQUI: Trocado 'setTheme' por 'mudaTema'
  const { temaAplicado, mudaTema } = useTheme();

  const [pendingSpokenText, setPendingSpokenText] = useState<string | null>(null);
  const [pendingContext, setPendingContext] = useState<NavigationContext | null>(null);
  const [pendingIntent, setPendingIntent] = useState<string>('');
  const [pendingOriginalText, setPendingOriginalText] = useState<string>('');
  
  const [voiceState, setVoiceState] = useState<VoiceState>('waiting_wake');

  const conversationCallbacksRef = useRef<ConversationCallbacks>({});

  const listenerRegisteredRef = useRef(false);

  const { speak, stopCurrentAudio, registerAudioPlayer, unregisterAudioPlayer } = useAudioSetup();
  
  const {
    isListening,
    recognizedText,
    setRecognizedText,
    startListening,
    stopListening,
  } = useSpeech({
    enabled: true,
    mode: 'global',
    onResult: (text: string) => {
      console.log('[VoiceContext] Global result received:', text);
    }
  });

  const registerConversationCallbacks = useCallback((callbacks: ConversationCallbacks) => {
    console.log('[VoiceContext] Registering conversation callbacks');
    conversationCallbacksRef.current = callbacks;
  }, []);

  const unregisterConversationCallbacks = useCallback(() => {
    console.log('[VoiceContext] Unregistering conversation callbacks');
    conversationCallbacksRef.current = {};
  }, []);

  const { executeIntent, getIntentDisplayName, processCommand, isBusyRef } = useIntentHandler({
    speak,
    temaAplicado,
    // ✅ MODIFICAÇÃO AQUI: Passando 'mudaTema'
    mudaTema: mudaTema, 
    startListening,
    stopListening,
    setVoiceState,
    setRecognizedText,
    onActivateMic: () => conversationCallbacksRef.current.onActivateMic?.(),
    onTakePhoto: (q: string) => conversationCallbacksRef.current.onTakePhoto?.(q),
    onOpenCamera: () => conversationCallbacksRef.current.onOpenCamera?.(),
    setPendingContext,
  });

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

  const clearPending = useCallback(() => {
    setPendingSpokenText(null);
    setPendingContext(null);
  }, []);

  const voiceStateRef = useRef(voiceState);
  const handleConfirmationResponseRef = useRef(handleConfirmationResponse);
  const processCommandRef = useRef(processCommand);
  const stopListeningRef = useRef(stopListening);
  const stopCurrentAudioRef = useRef(stopCurrentAudio);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    handleConfirmationResponseRef.current = handleConfirmationResponse;
  }, [handleConfirmationResponse]);

  useEffect(() => {
    processCommandRef.current = processCommand;
  }, [processCommand]);

  useEffect(() => {
    stopListeningRef.current = stopListening;
  }, [stopListening]);

  useEffect(() => {
    stopCurrentAudioRef.current = stopCurrentAudio;
  }, [stopCurrentAudio]);

  useEffect(() => {
    if (listenerRegisteredRef.current) {
      console.log('[VoiceContext] Listener already registered, skipping');
      return;
    }

    const listener = (finalText: string) => {
      console.log('[VoiceContext] Received FINAL result via Listener:', finalText);

      const trimmedText = finalText.trim();
      
      if (!trimmedText) {
        console.log('[VoiceContext] Ignoring empty/whitespace-only result');
        return;
      }

      setRecognizedText(trimmedText); 

      const currentState = voiceStateRef.current;
      console.log(`[VoiceContext] Processing FINAL: "${trimmedText}", State: ${currentState}`);

      if (currentState === "waiting_confirmation") {
        stopListeningRef.current();
        handleConfirmationResponseRef.current(trimmedText);
        return;
      }

      if (currentState === 'waiting_wake' || currentState === 'listening_command') {
        processCommandRef.current(
          trimmedText,
          currentState,
          stopCurrentAudioRef.current,
          setPendingIntent,
          setPendingOriginalText,
          setPendingSpokenText,
          clearPending
        );
      } else {
        console.log('[Voice] Ignoring final result - wrong state:', currentState);
      }
    };

    SpeechManager.addListener(listener);
    listenerRegisteredRef.current = true;
    console.log('[VoiceContext] Global listener REGISTERED (once)');

    return () => {
      SpeechManager.removeListener(listener);
      listenerRegisteredRef.current = false;
      console.log('[VoiceContext] Global listener UNREGISTERED');
    };
  }, []);

  const value = useMemo(() => ({
    isListening,
    recognizedText,
    voiceState,
    pendingSpokenText,
    pendingContext,
    clearPending,
    setPendingContext,
    registerAudioPlayer,
    unregisterAudioPlayer,
    stopListening,
    registerConversationCallbacks,
    unregisterConversationCallbacks,
  }), [
    isListening,
    recognizedText,
    voiceState,
    pendingSpokenText,
    pendingContext,
    registerAudioPlayer,
    unregisterAudioPlayer,
    clearPending,
    stopListening,
    registerConversationCallbacks,
    unregisterConversationCallbacks,
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