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
  const autoStartAttemptedRef = useRef(false);
  
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
    if (!permissionsGranted) {
      console.log('[useSpeech] ⏳ Waiting for permissions...');
      return;
    }
    
    if (enabled && mode === 'global') {
      console.log(`[useSpeech - ${mode}] ✅ Enabling Manager and starting recognition.`);
      SpeechManager.enable();
      
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
        }, 500);
      }
    }
    else if (!enabled && mode === 'global') {
       console.log(`[useSpeech - ${mode}] ❌ Disabling Manager.`);
       SpeechManager.disable();
       autoStartAttemptedRef.current = false;
    }

    return () => {
      if (mode === 'global') {
         console.log('[useSpeech - global] 🔄 Unmounting, disabling Manager.');
         SpeechManager.disable();
         autoStartAttemptedRef.current = false;
      }
    };
  }, [enabled, mode, permissionsGranted]);
  
  // ============================================
  // EVENTOS DO RECONHECIMENTO
  // ============================================
  useSpeechRecognitionEvent('start', () => {
    console.log('[useSpeech] 🎤 Recognition STARTED');
    setIsListening(true);
  });
  
  useSpeechRecognitionEvent('end', () => {
    console.log('[useSpeech] 🛑 Recognition ENDED');
    setIsListening(false);
    SpeechManager.handleEnd();
  });
  
  useSpeechRecognitionEvent('result', (event: ExpoSpeechRecognitionResultEvent) => {
    const transcript = event.results?.[0]?.transcript || '';
    const isFinal = event.isFinal || false;
    
    console.log('[useSpeech] 📝 Result:', transcript, 'isFinal:', isFinal);
    setRecognizedText(transcript);

    if (isFinal && transcript.trim()) {
      SpeechManager.handleResult(transcript, true);
    }
  });
  
  useSpeechRecognitionEvent('error', (error) => {
    console.log('[useSpeech] ❌ Recognition ERROR:', error);
    setIsListening(false);
    SpeechManager.handleError(error.error);
  });
  
  // ============================================
  // FUNÇÕES EXPOSTAS
  // ============================================
  const speak = useCallback(async (text: string, callback?: () => void) => {
    console.log('[useSpeech] 🔊 Speaking:', text);
    console.log('[useSpeech] 🎤 Pausing recognition before speaking');
    
    // ✅ CRÍTICO: Para o reconhecimento ANTES de falar
    setIsListening(false);
    setIsSpeaking(true);
    
    await SpeechManager.speak(text, () => {
      console.log('[useSpeech] ✅ Speech finished');
      setIsSpeaking(false);
      callback?.();
    }, true); // ✅ Força pausar reconhecimento
  }, []);
  
  const startListening = useCallback((localMode: boolean = false, localOverrideCallback?: (text: string) => void) => {
    const actualMode = localMode ? 'local' : mode;
    const callbackToUse = localMode ? (localOverrideCallback || localCallbackRef.current) : undefined;
    
    console.log(`[useSpeech] 🎤 Requesting Manager.startRecognition(mode=${actualMode})`);
    SpeechManager.startRecognition(actualMode, callbackToUse);
    setIsListening(true);
  }, [mode]);
  
  const stopListening = useCallback(() => {
    console.log('[useSpeech] 🛑 Manual stop: Disabling Manager completely');
    SpeechManager.disable();
    setIsListening(false);
  }, []);
  
  const stopSpeaking = useCallback(() => {
    console.log('[useSpeech] 🔇 Stopping speech');
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