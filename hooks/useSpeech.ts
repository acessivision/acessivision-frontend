// hooks/useSpeech.ts - VERSÃO CORRIGIDA (Não inicia automaticamente no modo local)
import { useState, useEffect, useCallback, useRef } from 'react';
import SpeechManager from '../utils/speechManager';
import { useMicrophone } from '../components/MicrophoneContext'; 

interface UseSpeechProps {
  enabled?: boolean;
  mode?: 'global' | 'local';
  onResult?: (text: string) => void;
}

export function useSpeech({ enabled = true, mode = 'global', onResult }: UseSpeechProps = {}) {
  // Estado local sincronizado com o Manager
  const [recognizedText, setRecognizedText] = useState('');
  const [isListening, setIsListening] = useState(SpeechManager.getState().isRecognizing);
  const [isSpeaking, setIsSpeaking] = useState(SpeechManager.getState().isSpeaking);
  
  // ✅ Obtém o estado real do interruptor mestre
  const { isMicrophoneEnabled } = useMicrophone(); 

  const localCallbackRef = useRef(onResult);
  
  // Atualiza a ref do callback para não quebrar o useEffect
  useEffect(() => {
    localCallbackRef.current = onResult;
  }, [onResult]);
  
  // ============================================
  // 1. GERENCIAMENTO DA ASSINATURA (Ouvir Texto)
  // ============================================
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

  // ============================================
  // 2. CONTROLE DO MOTOR (Ligar/Desligar)
  // ============================================
  useEffect(() => {
    // ✅ CRÍTICO: Modo LOCAL não inicia automaticamente
    // Ele só inicia quando startListening() é chamado explicitamente
    if (mode === 'local') {
      console.log('[useSpeech] ℹ️ Modo local - aguardando startListening() explícito');
      // Cleanup para modo local
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
    
    // ✅ Daqui pra baixo, mode só pode ser 'global'
    const shouldBeRunning = enabled && isMicrophoneEnabled;
    
    if (shouldBeRunning) {
      const state = SpeechManager.getState();
      if (!state.isRecognizing && !state.isSpeaking) {
         console.log(`[useSpeech] 🎤 Iniciando reconhecimento (global)`);
         SpeechManager.startRecognition('global');
      }
    }
    
    // Cleanup para modo global (não faz nada)
    return () => {
      // Modo global NÃO para ao desmontar - deixa para outros usarem
    };
  }, [enabled, mode, isMicrophoneEnabled]);

  // ============================================
  // 3. SINCRONIA VISUAL (Polling)
  // ============================================
  useEffect(() => {
     const interval = setInterval(() => {
        const state = SpeechManager.getState();
        if (state.isRecognizing !== isListening) setIsListening(state.isRecognizing);
        if (state.isSpeaking !== isSpeaking) setIsSpeaking(state.isSpeaking);
     }, 500);
     return () => clearInterval(interval);
  }, [isListening, isSpeaking]);

  // ============================================
  // 4. AÇÕES EXPOSTAS
  // ============================================
  
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