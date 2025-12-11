import { useState, useEffect, useCallback, useRef } from 'react';
import SpeechManager from '../utils/speechManager';
import { useMicrophone } from '../components/MicrophoneContext'; 

interface UseSpeechProps {
  enabled?: boolean;
  mode?: 'global' | 'local';
  onResult?: (text: string) => void;
}

export function useSpeech({ enabled = true, mode = 'global', onResult }: UseSpeechProps = {}) {
  const [recognizedText, setRecognizedText] = useState('');
  const [isListening, setIsListening] = useState(SpeechManager.getState().isRecognizing);
  const [isSpeaking, setIsSpeaking] = useState(SpeechManager.getState().isSpeaking);
  
  const { isMicrophoneEnabled } = useMicrophone(); 

  const localCallbackRef = useRef(onResult);
  
  useEffect(() => {
    localCallbackRef.current = onResult;
  }, [onResult]);
  
  const handleManagerResult = useCallback((text: string) => {
    setRecognizedText(text);
    setIsListening(true);
    if (localCallbackRef.current) {
        localCallbackRef.current(text);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      SpeechManager.addListener(handleManagerResult);
    }
    return () => {
      SpeechManager.removeListener(handleManagerResult);
    };
  }, [enabled, handleManagerResult]);

  useEffect(() => {
    if (mode === 'local') {
      console.log('[useSpeech] ℹ️ Modo local - aguardando startListening() explícito');
      return () => {
        if (enabled) {
          const state = SpeechManager.getState();
          if (state.isRecognizing && state.currentMode === 'local') {
            console.log('[useSpeech] 🧹 Cleanup: parando reconhecimento local');
            SpeechManager.stopRecognition();
          }
        }
      };
    }
    
    const shouldBeRunning = enabled && isMicrophoneEnabled;
    
    if (shouldBeRunning) {
      const state = SpeechManager.getState();
      if (!state.isRecognizing && !state.isSpeaking) {
         console.log(`[useSpeech] 🎤 Iniciando reconhecimento (global)`);
         SpeechManager.startRecognition('global');
      }
    }
    
    return () => {
    };
  }, [enabled, mode, isMicrophoneEnabled]);

  useEffect(() => {
     const interval = setInterval(() => {
        const state = SpeechManager.getState();
        if (state.isRecognizing !== isListening) setIsListening(state.isRecognizing);
        if (state.isSpeaking !== isSpeaking) setIsSpeaking(state.isSpeaking);
     }, 500);
     return () => clearInterval(interval);
  }, [isListening, isSpeaking]);

  const speak = useCallback(async (text: string, callback?: () => void) => {
    setIsListening(false); 
    setIsSpeaking(true);
    await SpeechManager.speak(text, () => {
      setIsSpeaking(false);
      callback?.();
    }, true); 
  }, []);
  
  const startListening = useCallback((localMode: boolean = false) => {
    if (!SpeechManager.getState().isEnabled && !localMode) {
        console.log('[useSpeech] Bloqueado pelo Master Switch');
        return;
    }
    console.log(`[useSpeech] 🎤 startListening chamado explicitamente (mode: ${localMode ? 'local' : mode})`);
    SpeechManager.startRecognition(localMode ? 'local' : mode);
  }, [mode]);
  
  const stopListening = useCallback(() => {
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