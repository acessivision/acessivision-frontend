import React, { createContext, useState, useContext, useCallback, useEffect, useMemo } from 'react';
import { useTheme } from './ThemeContext';
import { useAudioSetup } from '../hooks/useAudioSetup';
import { useSpeech } from '../hooks/useSpeech'; // ✅ Usa o novo hook
import { useIntentHandler, VoiceState as IntentHandlerVoiceState } from '../hooks/useIntentHandler';
import SpeechManager from '../utils/speechManager';

type VoiceState = IntentHandlerVoiceState;

interface VoiceContextProps {
  isListening: boolean;
  recognizedText: string;
  voiceState: VoiceState;
  pendingSpokenText: string | null;
  clearPending: () => void;
  registerAudioPlayer: (player: any) => void;
  unregisterAudioPlayer: () => void;
  stopListening: () => void;
}

const VoiceCommandContext = createContext<VoiceContextProps | undefined>(undefined);

export const VoiceCommandProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { temaAplicado, setTheme } = useTheme();

  const [pendingSpokenText, setPendingSpokenText] = useState<string | null>(null);
  const [pendingIntent, setPendingIntent] = useState<string>('');
  const [pendingOriginalText, setPendingOriginalText] = useState<string>('');
  
  const [voiceState, setVoiceState] = useState<VoiceState>('waiting_wake');

  // Setup de áudio e TTS
  const { speak, stopCurrentAudio, registerAudioPlayer, unregisterAudioPlayer } = useAudioSetup();
  
  // ✅ Usa o novo hook de voz para comandos globais
  const {
    isListening,
    recognizedText,
    setRecognizedText,
    startListening,
    stopListening,
  } = useSpeech({
    enabled: true, // Sempre habilitado para comandos globais
    mode: 'global',
    onResult: (text: string) => {
      console.log('[VoiceContext] Global result received:', text);
      // A lógica de processamento é feita no useEffect abaixo
    }
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

  // ===================================================================
  // PROCESSAR COMANDOS GLOBAIS
  // ===================================================================
  // useEffect(() => {
  //   if (!recognizedText.trim()) return;

  //   console.log(`[VoiceContext] Processing: "${recognizedText}", State: ${voiceState}`);

  //   // Processa confirmação
  //   if (voiceState === "waiting_confirmation") {
  //     handleConfirmationResponse(recognizedText);
  //     return;
  //   }

  //   // Processa comandos gerais
  //   if (voiceState === 'waiting_wake' || voiceState === 'listening_command') {
  //     processCommand(
  //       recognizedText,
  //       voiceState,
  //       stopCurrentAudio,
  //       setPendingIntent,
  //       setPendingOriginalText,
  //       setPendingSpokenText,
  //       clearPending
  //     );
  //   }

  // }, [recognizedText, voiceState]);

  // ===================================================================
  // HANDLER DE CONFIRMAÇÃO
  // ===================================================================
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

  const clearPending = useCallback(() => setPendingSpokenText(null), []);

  // ===================================================================
  // REGISTRAR LISTENER NO SPEECHMANAGER
  // ===================================================================
  useEffect(() => {
    // This function is called by SpeechManager ONLY with FINAL results
    const listener = (finalText: string) => {
      console.log('[VoiceContext] Received FINAL result via Listener:', finalText);

      // --- MOVED PROCESSING LOGIC HERE ---
      if (!finalText.trim()) return; // Ignore empty final results

      // Update UI state with the final text (optional but good)
      setRecognizedText(finalText); 

      console.log(`[VoiceContext] Processing FINAL: "${finalText}", State: ${voiceState}`);

      // Process confirmation if needed
      if (voiceState === "waiting_confirmation") {
         // Stop listening BEFORE handling confirmation
         stopListening(); // Use stopListening from useSpeech hook
         handleConfirmationResponse(finalText); // Assumes stable via useCallback
         return; // Don't process as a general command
      }

      // Process general commands
      if (voiceState === 'waiting_wake' || voiceState === 'listening_command') {
        // No setTimeout needed here, 'isFinal' guarantees stability
        processCommand( // Assumes stable via useCallback
          finalText,
          voiceState,
          stopCurrentAudio, // Ensure stable from useAudioSetup
          setPendingIntent,
          setPendingOriginalText,
          setPendingSpokenText,
          clearPending
        );
      } else {
         console.log('[Voice] Ignoring final result - wrong state:', voiceState);
      }
      // --- END OF MOVED LOGIC ---
    };

    SpeechManager.addListener(listener);
    console.log('[VoiceContext] Global listener ADDED.');

    // Cleanup function
    return () => {
      SpeechManager.removeListener(listener);
      console.log('[VoiceContext] Global listener REMOVED.');
    };

  // ✅ DEPENDENCIES: Include everything used INSIDE the listener function
  }, [
      voiceState, // State value
      // Stable functions (ensure they are wrapped correctly where defined)
      handleConfirmationResponse,
      processCommand,
      stopListening, // From useSpeech (should be stable)
      stopCurrentAudio, // From useAudioSetup (ensure stable)
      // State setters (stable by default)
      setPendingIntent,
      setPendingOriginalText,
      setPendingSpokenText,
      clearPending,
      setRecognizedText, // Added because we update it inside
  ]);

  const value = useMemo(() => ({
    isListening,
    recognizedText,
    voiceState,
    pendingSpokenText,
    clearPending,
    registerAudioPlayer,
    unregisterAudioPlayer,
    stopListening,
  }), [
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