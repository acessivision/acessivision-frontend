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
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  const localCallbackRef = useRef(onResult);
  const autoStartAttemptedRef = useRef(false); // ✅ Previne múltiplas tentativas
  
  useEffect(() => {
    localCallbackRef.current = onResult;
  }, [onResult]);
  
  // ============================================
  // SETUP DE PERMISSÕES - PRIMEIRA PRIORIDADE
  // ============================================
  useEffect(() => {
    const initializePermissions = async () => {
      console.log('[useSpeech] 🔐 Requesting permissions...');
      const granted = await SpeechManager.requestPermissions();
      
      if (granted) {
        console.log('[useSpeech] ✅ Permissions granted');
        setPermissionsGranted(true);
      } else {
        console.log('[useSpeech] ❌ Permissions denied');
      }
    };
    
    initializePermissions();
  }, []);
  
  // ============================================
  // CONTROLE DE ATIVAÇÃO - DEPOIS DAS PERMISSÕES
  // ============================================
  useEffect(() => {
    // ✅ Só ativa depois que as permissões foram concedidas
    if (!permissionsGranted) {
      console.log('[useSpeech] ⏳ Waiting for permissions...');
      return;
    }
    
    // Se este hook deve estar ativo E é global, HABILITA o manager
    if (enabled && mode === 'global') {
      console.log(`[useSpeech - ${mode}] ✅ Enabling Manager and starting recognition.`);
      SpeechManager.enable();
      
      // ✅ Só tenta auto-start uma vez
      if (!autoStartAttemptedRef.current) {
        autoStartAttemptedRef.current = true;
        
        setTimeout(() => {
          const state = SpeechManager.getState();
          if (!state.isRecognizing && !state.isSpeaking) {
            console.log('[useSpeech] 🎤 Auto-starting recognition');
            SpeechManager.startRecognition('global');
            setIsListening(true);
          } else {
            console.log('[useSpeech] ⏭️ Skipping auto-start (already active)');
          }
        }, 500); // ✅ Aumentado para 500ms para dar mais tempo
      }
    }
    // Se este hook NÃO deve estar ativo E é global, DESABILITA o manager
    else if (!enabled && mode === 'global') {
       console.log(`[useSpeech - ${mode}] ❌ Disabling Manager.`);
       SpeechManager.disable();
       autoStartAttemptedRef.current = false; // ✅ Reset quando desabilitado
    }

    // Cleanup: Se este hook global for desmontado, desabilita o manager
    return () => {
      if (mode === 'global') {
         console.log('[useSpeech - global] 🔄 Unmounting, disabling Manager.');
         SpeechManager.disable();
         autoStartAttemptedRef.current = false; // ✅ Reset no cleanup
      }
    };
  }, [enabled, mode, permissionsGranted]);
  
  // ============================================
  // EVENTOS DO RECONHECIMENTO
  // ============================================
  useSpeechRecognitionEvent('start', () => {
    setIsListening(true);
  });
  
  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    SpeechManager.handleEnd();
  });
  
  useSpeechRecognitionEvent('result', (event: ExpoSpeechRecognitionResultEvent) => {
    const transcript = event.results?.[0]?.transcript || '';
    const isFinal = event.isFinal || false;
    setRecognizedText(transcript);

    if (isFinal && transcript.trim()) {
      SpeechManager.handleResult(transcript, true);
    }
  });
  
  useSpeechRecognitionEvent('error', (error) => {
    setIsListening(false);
    SpeechManager.handleError(error.error);
  });
  
  // ============================================
  // FUNÇÕES EXPOSTAS
  // ============================================
  const speak = useCallback(async (text: string, callback?: () => void) => {
    setIsSpeaking(true);
    await SpeechManager.speak(text, () => {
      setIsSpeaking(false);
      callback?.();
    });
  }, []);
  
  const startListening = useCallback((localMode: boolean = false, localOverrideCallback?: (text: string) => void) => {
    const actualMode = localMode ? 'local' : mode;
    const callbackToUse = localMode ? (localOverrideCallback || localCallbackRef.current) : undefined;
    
    console.log(`[useSpeech] Requesting Manager.startRecognition(mode=${actualMode})`);
    SpeechManager.startRecognition(actualMode, callbackToUse);
    setIsListening(true);
  }, [mode]);
  
  const stopListening = useCallback(() => {
    console.log('[useSpeech] Requesting Manager.stopRecognition()');
    SpeechManager.stopRecognition();
    setIsListening(false);
  }, []);
  
  const stopSpeaking = useCallback(() => {
    SpeechManager.stopSpeaking();
    setIsSpeaking(false);
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