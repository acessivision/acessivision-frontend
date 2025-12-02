import React, { createContext, useState, useContext, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTheme } from './ThemeContext';
import { useAudioSetup } from '../hooks/useAudioSetup';
import { useSpeech } from '../hooks/useSpeech';
import { useIntentHandler, VoiceState as IntentHandlerVoiceState } from '../hooks/useIntentHandler';
import SpeechManager from '../utils/speechManager';
import { useMicrophone } from './MicrophoneContext';

type VoiceState = IntentHandlerVoiceState;

interface VoiceContextProps {
  isListening: boolean;
  recognizedText: string;
  voiceState: VoiceState;
  pendingSpokenText: string | null;
  pendingContext: NavigationContext | null;
  pendingIntent: string | null; // ✅ ADICIONADO
  clearPending: () => void;
  clearPendingIntent: () => void; // ✅ ADICIONADO
  setPendingContext: (context: NavigationContext | null) => void;
  registerAudioPlayer: (player: any) => void;
  unregisterAudioPlayer: () => void;
  stopListening: () => void;
  registerConversationCallbacks: (callbacks: ConversationCallbacks) => void;
  unregisterConversationCallbacks: () => void;
  registerHeaderFocus: (focusFn: () => void) => void;
}

interface ConversationCallbacks {
  onActivateMic?: () => void;
  onTakePhoto?: (question: string) => void;
  onOpenCamera?: () => void;
  onSendAudio?: () => void;
}

interface NavigationContext {
  mode?: string;
  conversaId?: string;
}

const VoiceCommandContext = createContext<VoiceContextProps | undefined>(undefined);

export const VoiceCommandProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { temaAplicado, mudaTema } = useTheme();
  const headerFocusCallbackRef = useRef<(() => void) | null>(null);
  const [pendingSpokenText, setPendingSpokenText] = useState<string | null>(null);
  const [pendingContext, setPendingContextState] = useState<NavigationContext | null>(null);
  const [pendingIntentInternal, setPendingIntentInternal] = useState<string>('');
  const [pendingOriginalText, setPendingOriginalText] = useState<string>('');
  
  const [voiceState, setVoiceState] = useState<VoiceState>('waiting_wake');

  const conversationCallbacksRef = useRef<ConversationCallbacks>({});

  const listenerRegisteredRef = useRef(false);

  const { isMicrophoneEnabled } = useMicrophone();
  
  const { speak, stopCurrentAudio, registerAudioPlayer, unregisterAudioPlayer } = useAudioSetup();
  
  const {
    isListening,
    recognizedText,
    setRecognizedText,
    startListening,
    stopListening,
  } = useSpeech({
    enabled: isMicrophoneEnabled,
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

  const registerHeaderFocus = useCallback((focusFn: () => void) => {
    console.log('[VoiceContext] Registrando função de foco do Header');
    headerFocusCallbackRef.current = focusFn;
  }, []);

  // ✅ NOVO: Wrapper para setPendingContext que também define o pendingIntent
  const setPendingContext = useCallback((context: NavigationContext | null) => {
    console.log('[VoiceContext] Setting pending context:', context);
    setPendingContextState(context);
    
    // Se o mode for um intent válido, define também o pendingIntent
    if (context?.mode) {
      console.log('[VoiceContext] Setting pending intent from context.mode:', context.mode);
      setPendingIntentInternal(context.mode);
    }
  }, []);

  // ✅ NOVO: Função para limpar apenas o pendingIntent
  const clearPendingIntent = useCallback(() => {
    console.log('[VoiceContext] Clearing pending intent');
    setPendingIntentInternal('');
    // Também limpa o mode do context se existir
    if (pendingContext?.mode) {
      setPendingContextState(prev => prev ? { ...prev, mode: undefined } : null);
    }
  }, [pendingContext]);

  const { executeIntent, getIntentDisplayName, processCommand, isBusyRef } = useIntentHandler({
    speak,
    temaAplicado,
    mudaTema: mudaTema, 
    startListening,
    stopListening,
    setVoiceState,
    setRecognizedText,
    onActivateMic: () => conversationCallbacksRef.current.onActivateMic?.(),
    onTakePhoto: (q: string) => conversationCallbacksRef.current.onTakePhoto?.(q),
    onOpenCamera: () => conversationCallbacksRef.current.onOpenCamera?.(),
    onSendAudio: () => conversationCallbacksRef.current.onSendAudio?.(),
    setPendingContext,
  });

  const handleConfirmationResponse = useCallback((spokenText: string) => {
    const normalizedText = spokenText.toLowerCase().trim();
    
    const confirmWords = ['sim', 'confirmo', 'confirmar', 'isso', 'exato', 'certo', 'ok'];
    const denyWords = ['não', 'nao', 'cancelar', 'cancel', 'errado', 'no'];
    
    const isConfirm = confirmWords.some(word => normalizedText.includes(word));
    const isDeny = denyWords.some(word => normalizedText.includes(word));
    
    if (isConfirm && pendingIntentInternal) {
      speak("Confirmado! Executando...");
      executeIntent(pendingIntentInternal, pendingOriginalText, setPendingSpokenText, clearPending);
      setPendingIntentInternal('');
      setPendingOriginalText('');
      
      stopListening();
      setTimeout(() => {
        setVoiceState("waiting_wake");
        setRecognizedText("");
        startListening();
      }, 2500);
      
    } else if (isDeny) {
      speak("Cancelado");
      setPendingIntentInternal('');
      setPendingOriginalText('');
      
      stopListening();
      setTimeout(() => {
        setVoiceState("waiting_wake");
        setRecognizedText("");
        startListening();
        isBusyRef.current = false;
      }, 2500);
      
    } else {
      const displayName = getIntentDisplayName(pendingIntentInternal);
      speak(`Não entendi. Você quer ${displayName}? Diga sim ou não`);
    }
  }, [pendingIntentInternal, pendingOriginalText, executeIntent, stopListening, startListening, speak, getIntentDisplayName, isBusyRef, setRecognizedText]);

  const clearPending = useCallback(() => {
    setPendingSpokenText(null);
    setPendingContextState(null);
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

      const textoLower = trimmedText.toLowerCase();
      if ((textoLower.includes('enviar') && textoLower.includes('áudio')) || 
          (textoLower.includes('enviar') && textoLower.includes('audio'))) {
        console.log('[VoiceContext] 🎙️ Comando "enviar áudio" detectado - chamando callback onSendAudio');
        
        if (conversationCallbacksRef.current?.onSendAudio) {
          conversationCallbacksRef.current.onSendAudio();
          setRecognizedText('');
          return;
        } else {
          console.log('[VoiceContext] ⚠️ onSendAudio callback não registrado');
        }
      }

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
          setPendingIntentInternal,
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
    pendingIntent: pendingIntentInternal, // ✅ EXPOSTO
    clearPending,
    clearPendingIntent, // ✅ EXPOSTO
    setPendingContext,
    registerAudioPlayer,
    unregisterAudioPlayer,
    stopListening,
    registerConversationCallbacks,
    unregisterConversationCallbacks,
    registerHeaderFocus,
  }), [
    isListening,
    recognizedText,
    voiceState,
    pendingSpokenText,
    pendingContext,
    pendingIntentInternal,
    registerAudioPlayer,
    unregisterAudioPlayer,
    clearPending,
    clearPendingIntent,
    stopListening,
    registerConversationCallbacks,
    unregisterConversationCallbacks,
    registerHeaderFocus,
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