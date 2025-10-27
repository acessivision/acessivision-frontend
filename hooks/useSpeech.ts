// useSpeech.ts - Hook simplificado usando SpeechManager
import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  useSpeechRecognitionEvent,
  ExpoSpeechRecognitionResultEvent 
} from 'expo-speech-recognition';
import SpeechManager from '../utils/speechManager';

interface UseSpeechProps {
  enabled?: boolean;
  mode?: 'global' | 'local';
  onResult?: (text: string) => void;
}

export function useSpeech({ enabled = true, mode = 'global', onResult }: UseSpeechProps = {}) {
  const [recognizedText, setRecognizedText] = useState('');
  const [isListening, setIsListening] = useState(SpeechManager.getState().isRecognizing);
  const [isSpeaking, setIsSpeaking] = useState(SpeechManager.getState().isSpeaking);

  const localCallbackRef = useRef(onResult);
  useEffect(() => {
    localCallbackRef.current = onResult;
  }, [onResult]);
  
  // ============================================
  // SETUP DE PERMISSÕES
  // ============================================
  useEffect(() => {
    SpeechManager.requestPermissions();
  }, []);
  
  // ============================================
  // CONTROLE DE ATIVAÇÃO
  // ============================================
  useEffect(() => {
    // Se este hook deve estar ativo E é global, HABILITA o manager
    if (enabled && mode === 'global') {
      console.log(`[useSpeech - ${mode}] Enabling Manager.`);
      SpeechManager.enable();
    }
    // Se este hook NÃO deve estar ativo E é global, DESABILITA o manager
    else if (!enabled && mode === 'global') {
       console.log(`[useSpeech - ${mode}] Disabling Manager.`);
       SpeechManager.disable();
    }
    // Se for local, não controla o enable/disable globalmente
    // A ativação local é feita pelo startListening específico

    // Cleanup: Se este hook global for desmontado, desabilita o manager
    return () => {
      if (mode === 'global') {
         console.log('[useSpeech - global] Unmounting, disabling Manager.');
         SpeechManager.disable();
      }
    };
  }, [enabled, mode]);
  
  // ============================================
  // EVENTOS DO RECONHECIMENTO
  // ============================================
  useSpeechRecognitionEvent('start', () => {
    // console.log('[useSpeech] Event: start'); // Menos verboso
    setIsListening(true);
    // Não precisa chamar nada do manager aqui, ele já sabe
  });
  
  useSpeechRecognitionEvent('end', () => {
    // console.log('[useSpeech] Event: end'); // Menos verboso
    setIsListening(false);
    SpeechManager.handleEnd(); // Informa o manager
  });
  
  useSpeechRecognitionEvent('result', (event: ExpoSpeechRecognitionResultEvent) => {
    const transcript = event.results?.[0]?.transcript || '';
    const isFinal = event.isFinal || false;
    setRecognizedText(transcript); // Atualiza estado local para UI

    // Só repassa o FINAL para o manager
    if (isFinal && transcript.trim()) {
      SpeechManager.handleResult(transcript, true); // Informa o manager
    }
  });
  
  useSpeechRecognitionEvent('error', (error) => {
    // console.log('[useSpeech] Event: error', error.error); // Menos verboso
    setIsListening(false);
    SpeechManager.handleError(error.error); // Informa o manager
  });
  
  // ============================================
  // FUNÇÕES EXPOSTAS
  // ============================================
  const speak = useCallback(async (text: string, callback?: () => void) => {
    // Atualiza estado local ANTES de chamar o manager
    setIsSpeaking(true);
    await SpeechManager.speak(text, () => {
      setIsSpeaking(false); // Atualiza estado local DEPOIS
      callback?.();
    });
  }, []);
  
  const startListening = useCallback((localMode: boolean = false, localOverrideCallback?: (text: string) => void) => {
    // Decide o modo e o callback a serem passados
    const actualMode = localMode ? 'local' : mode;
    const callbackToUse = localMode ? (localOverrideCallback || localCallbackRef.current) : undefined;
    
    console.log(`[useSpeech] Requesting Manager.startRecognition(mode=${actualMode})`);
    SpeechManager.startRecognition(actualMode, callbackToUse);
  }, [mode]);
  
  const stopListening = useCallback(() => {
    console.log('[useSpeech] Requesting Manager.stopRecognition()');
    SpeechManager.stopRecognition();
  }, []);
  
  const stopSpeaking = useCallback(() => {
    SpeechManager.stopSpeaking();
    setIsSpeaking(false); // Atualiza estado local
  }, []);
  
  return {
    recognizedText,
    isListening,
    isSpeaking,
    speak,
    startListening,
    stopListening,
    stopSpeaking,
    setRecognizedText,
  };
}