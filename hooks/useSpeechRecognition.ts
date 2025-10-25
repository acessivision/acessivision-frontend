import { useState, useRef, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';

interface UseSpeechRecognitionProps {
  isFocused: boolean;
  onFinalResult: (text: string) => void;
  autoStart?: boolean;
}

export function useSpeechRecognition({ isFocused, onFinalResult, autoStart = true }: UseSpeechRecognitionProps) {
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [permissionGranted, setPermissionGranted] = useState(false);

  const isStartingRef = useRef(false);
  const isListeningRef = useRef(false);
  const isStoppingRef = useRef(false);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorCountRef = useRef(0);
  const lastErrorTimeRef = useRef(0);
  const recentFinalTranscriptsRef = useRef<{ text: string; timestamp: number }[]>([]);

  const stopListening = useCallback(() => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    
    try {
      if (isListeningRef.current) {
        ExpoSpeechRecognitionModule.stop();
        console.log('[Voice] Recognition stopped');
      }
    } catch (error) {
      // Silenciar erros de stop
    } finally {
      setTimeout(() => {
        isStoppingRef.current = false;
      }, 100);
    }
  }, []);

  const startListening = useCallback(async () => {
    console.log('[Voice] startListening called - Starting:', isStartingRef.current, 'Listening:', isListeningRef.current, 'Permission:', permissionGranted, 'Focused:', isFocused);
    
    if (isStartingRef.current || isListeningRef.current || !permissionGranted || !isFocused) {
      console.log('[Voice] Abortando startListening - condições não atendidas');
      isStartingRef.current = false;
      return;
    }

    isStartingRef.current = true;
    
    try {
      if (isListeningRef.current) {
        await new Promise<void>((resolve) => {
          ExpoSpeechRecognitionModule.stop();
          setTimeout(resolve, 100);
        });
      }

      await new Promise(resolve => setTimeout(resolve, 150));

      console.log('[Voice] Calling ExpoSpeechRecognitionModule.start...');
      ExpoSpeechRecognitionModule.start({
        lang: 'pt-BR',
        interimResults: true,
        continuous: true,
        requiresOnDeviceRecognition: true,
        addsPunctuation: false,
        maxAlternatives: 1,
      });

      console.log('[Voice] Recognition started successfully');
      errorCountRef.current = 0;
      recentFinalTranscriptsRef.current = [];
      
    } catch (error) {
      console.error('[Voice] Error starting recognition:', error);
      errorCountRef.current++;
      
      const delay = Math.min(errorCountRef.current * 500, 3000);
      if (isFocused && permissionGranted && errorCountRef.current < 5) {
        restartTimeoutRef.current = setTimeout(() => startListening(), delay);
      }
    } finally {
      isStartingRef.current = false;
    }
  }, [permissionGranted, isFocused]);

  // Request permissions
  const requestPermissions = useCallback(async () => {
    console.log('[Voice] Requesting permissions...');
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      setPermissionGranted(granted);
      
      if (!granted) {
        Alert.alert("Permissão necessária", "A permissão do microfone é necessária para os comandos de voz.");
        console.log('[Voice] Permission DENIED');
      } else {
        console.log('[Voice] Speech permissions GRANTED');
      }
    } catch (error) {
      console.error('[Voice] Error requesting permissions:', error);
      setPermissionGranted(false);
    }
  }, []);

  // Request permissions on mount (com delay para audio config)
  useEffect(() => {
    const timer = setTimeout(requestPermissions, 500);
    return () => clearTimeout(timer);
  }, []);

  // Auto-start/stop based on focus and permissions
  useEffect(() => {
    console.log('[DEBUG useSpeechRecognition] isFocused:', isFocused, 'permissionGranted:', permissionGranted);
    
    if (isFocused && permissionGranted) {
      const timer = setTimeout(() => {
        console.log('[DEBUG] Tentando iniciar listening...');
        startListening();
      }, 1000);
      return () => clearTimeout(timer);
    } else if (!isFocused && (isListeningRef.current || isStartingRef.current) ) {
      console.log('[Voice Hook] Tela perdeu foco, chamando stopListening...');
      stopListening();
    }
  }, [autoStart, isFocused, permissionGranted, startListening, stopListening]);

  // Event: start
  useSpeechRecognitionEvent("start", () => {
    console.log('[Voice] Recognition started (event)');
    setIsListening(true);
    isListeningRef.current = true;
    errorCountRef.current = 0;
  });

  // Event: end
  useSpeechRecognitionEvent("end", () => {
    console.log('[Voice] Recognition ended (event)');
    setIsListening(false);
    isListeningRef.current = false;
    isStartingRef.current = false;

    if (autoStart && isFocused && permissionGranted && !isStoppingRef.current) {
      const delay = errorCountRef.current > 0 ? Math.min(errorCountRef.current * 300, 2000) : 250;
      restartTimeoutRef.current = setTimeout(() => startListening(), delay);
    }
  });

  // Event: result (com filtro de duplicatas)
  useSpeechRecognitionEvent("result", (event: ExpoSpeechRecognitionResultEvent) => {
    try {
      if (event.results && event.results.length > 0) {
        const transcript = event.results[0]?.transcript || "";
        setRecognizedText(transcript);
        
        if (event.isFinal && transcript.trim()) {
          const cleanTranscript = transcript.trim().toLowerCase().replace(/[.,!?]/g, '');
          const now = Date.now();

          // Limpar transcrições antigas
          recentFinalTranscriptsRef.current = recentFinalTranscriptsRef.current.filter(
            item => now - item.timestamp < 5000
          );

          // Verificar duplicata
          const isDuplicate = recentFinalTranscriptsRef.current.some(
            item => item.text === cleanTranscript
          );

          if (isDuplicate) {
            console.log('[Voice] Ignoring duplicate final result:', cleanTranscript);
            return;
          }

          // Registrar como processado
          recentFinalTranscriptsRef.current.push({
            text: cleanTranscript,
            timestamp: now
          });

          console.log('[Voice] Final result (accepted):', cleanTranscript);
          onFinalResult(transcript);
        }
      }
    } catch (error) {
      console.error('[Voice] Error processing result:', error);
    }
  });

  // Event: error
  useSpeechRecognitionEvent("error", (error) => {
    const currentTime = Date.now();
    const timeSinceLastError = currentTime - lastErrorTimeRef.current;
    lastErrorTimeRef.current = currentTime;

    if (timeSinceLastError > 1000 || error.error !== "no-speech") {
      console.log(`[Voice] Recognition error: ${error.error}`);
    }

    setIsListening(false);
    isListeningRef.current = false;
    errorCountRef.current++;

    let restartDelay = 250;
    switch (error.error) {
      case "no-speech": restartDelay = 200; break;
      case "client": restartDelay = Math.min(errorCountRef.current * 500, 2000); break;
      case "network": restartDelay = 1500; break;
      default: restartDelay = Math.min(errorCountRef.current * 300, 1500);
    }

    if (autoStart && isFocused && permissionGranted) {
      if (errorCountRef.current < 8) {
        restartTimeoutRef.current = setTimeout(() => startListening(), restartDelay);
      } else {
        console.log('[Voice] Too many errors, full reset');
        stopListening();
        errorCountRef.current = 0;
        setTimeout(() => startListening(), 3000);
      }
    }
  });

  // Cleanup
  useEffect(() => {
    return () => {
      stopListening();
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    };
  }, []);

  return {
    isListening,
    recognizedText,
    setRecognizedText,
    startListening,
    stopListening,
    permissionGranted,
  };
}