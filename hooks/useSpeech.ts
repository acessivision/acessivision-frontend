// useSpeech.ts - Respeita o estado global do SpeechManager
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
  
  // ✅ Controle de duplicatas no próprio hook
  const lastResultRef = useRef<string>('');
  const lastResultTimeRef = useRef<number>(0);
  
  useEffect(() => {
    localCallbackRef.current = onResult;
  }, [onResult]);
  
  // ============================================
  // SETUP DE PERMISSÕES
  // ============================================
  useEffect(() => {
    const initializePermissions = async () => {
      const granted = await SpeechManager.requestPermissions();
      if (granted) {
        setPermissionsGranted(true);
      }
    };
    initializePermissions();
  }, []);
  
  // ============================================
  // CONTROLE DE ATIVAÇÃO (LÓGICA CORRIGIDA)
  // ============================================
  useEffect(() => {
    if (!permissionsGranted) return;
    
    // Verificamos o estado GLOBAL real do manager
    const managerState = SpeechManager.getState();

    if (enabled) {
      // ✅ Só inicia se o Manager estiver HABILITADO globalmente (pelo Context)
      if (managerState.isEnabled) {
        console.log(`[useSpeech - ${mode}] ✅ Solicitando início (Manager está ON)`);
        
        // Pequeno delay para garantir que transições de tela não encavalem
        setTimeout(() => {
           const current = SpeechManager.getState();
           if (!current.isRecognizing && !current.isSpeaking && current.isEnabled) {
             SpeechManager.startRecognition(mode);
             setIsListening(true);
           }
        }, 300);
      } else {
        console.log(`[useSpeech - ${mode}] 🔇 Ignorando ativação (Manager está OFF globalmente)`);
      }
    } 
    else {
      // Se enabled = false (tela perdeu foco), paramos o reconhecimento
      // MAS NÃO desabilitamos o manager globalmente
      if (mode === 'local') {
         SpeechManager.stopRecognition();
      } else if (managerState.isRecognizing && managerState.currentMode === 'global') {
         // Se for global e perdeu foco, pausamos o reconhecimento, mas mantemos isEnabled
         SpeechManager.stopRecognition();
      }
    }

    return () => {
      // Cleanup: Ao desmontar, para o reconhecimento, mas nunca desabilita o Manager global
      if (mode === 'local') {
         SpeechManager.stopRecognition();
      }
    };
  }, [enabled, mode, permissionsGranted]);

  // ============================================
  // MONITORAMENTO DE ESTADO DO MANAGER
  // ============================================
  // Adiciona um listener para atualizar o isListening se o estado do Manager mudar externamente
  useEffect(() => {
     const interval = setInterval(() => {
        const state = SpeechManager.getState();
        if (state.isRecognizing !== isListening) {
           setIsListening(state.isRecognizing);
        }
        if (state.isSpeaking !== isSpeaking) {
           setIsSpeaking(state.isSpeaking);
        }
     }, 500);
     return () => clearInterval(interval);
  }, [isListening, isSpeaking]);
  
  // ... (RESTO DO ARQUIVO IGUAL: Eventos, Filtros, Funções Expostas) ...
  
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
    
    if (!transcript.trim()) return;
    
    const now = Date.now();
    const normalizedTranscript = transcript.toLowerCase().trim();
    
    if (!isFinal) {
      if (normalizedTranscript === lastResultRef.current) return;
      setRecognizedText(transcript);
      lastResultRef.current = normalizedTranscript;
      return;
    }
    
    if (normalizedTranscript === lastResultRef.current && (now - lastResultTimeRef.current) < 1000) {
      return;
    }
    
    lastResultRef.current = normalizedTranscript;
    lastResultTimeRef.current = now;
    
    console.log('[useSpeech] 📝 Result:', transcript, 'isFinal:', isFinal);
    setRecognizedText(transcript);
    SpeechManager.handleResult(transcript, true);
  });
  
  useSpeechRecognitionEvent('error', (error) => {
    setIsListening(false);
    SpeechManager.handleError(error.error);
  });
  
  const speak = useCallback(async (text: string, callback?: () => void) => {
    setIsListening(false);
    setIsSpeaking(true);
    await SpeechManager.speak(text, () => {
      setIsSpeaking(false);
      callback?.();
    }, true);
  }, []);
  
  const startListening = useCallback((localMode: boolean = false, localOverrideCallback?: (text: string) => void) => {
    // ✅ Proteção: Só inicia se o global estiver habilitado
    if (!SpeechManager.getState().isEnabled) {
       console.log('[useSpeech] ❌ Tentativa de iniciar recusada: Microfone desabilitado globalmente.');
       return;
    }

    const actualMode = localMode ? 'local' : mode;
    const callbackToUse = localMode ? (localOverrideCallback || localCallbackRef.current) : undefined;
    SpeechManager.startRecognition(actualMode, callbackToUse);
    setIsListening(true);
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