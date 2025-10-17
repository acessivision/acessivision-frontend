import { useEffect, useCallback, useRef } from 'react';
import { AudioModule } from 'expo-audio';
import * as Speech from 'expo-speech';

export function useAudioSetup() {
  const currentAudioPlayerRef = useRef<any>(null);
  const isSpeakingRef = useRef(false);
  const lastSpokenTextRef = useRef<string>('');
  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Configurar áudio no mount
  useEffect(() => {
    const configureAudio = async () => {
      try {
        await AudioModule.setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
          interruptionMode: "doNotMix",
          shouldPlayInBackground: false,
        });
        console.log("[Voice] Audio mode configured");
      } catch (err) {
        console.error("[Voice] Error configuring audio:", err);
      }
    };
    configureAudio();
  }, []);

  const speak = useCallback((text: string) => {
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }

    if (text === lastSpokenTextRef.current && isSpeakingRef.current) {
      console.log('[Voice] Skipping duplicate TTS:', text);
      return;
    }
    
    lastSpokenTextRef.current = text;
    
    speakTimeoutRef.current = setTimeout(() => {
      Speech.stop();
      isSpeakingRef.current = true;

      Speech.speak(text, {
        language: 'pt-BR',
        pitch: 1.0,
        rate: 1.0,
        onDone: () => {
          isSpeakingRef.current = false;
          console.log('[Voice] TTS finished');
        },
        onError: (error) => {
          isSpeakingRef.current = false;
          console.error('[Voice] TTS error:', error);
        },
      });
    }, 100);
  }, []);

  const stopCurrentAudio = useCallback(() => {
    if (currentAudioPlayerRef.current) {
      try {
        currentAudioPlayerRef.current.pause();
        console.log('[Voice] Audio interrupted');
      } catch (error) {
        console.error('[Voice] Error stopping audio:', error);
      }
    }
  }, []);

  const registerAudioPlayer = useCallback((player: any) => {
    currentAudioPlayerRef.current = player;
    console.log('[Voice] Audio player registered');
  }, []);

  const unregisterAudioPlayer = useCallback(() => {
    currentAudioPlayerRef.current = null;
    console.log('[Voice] Audio player unregistered');
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      Speech.stop();
      if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
    };
  }, []);

  return {
    speak,
    stopCurrentAudio,
    registerAudioPlayer,
    unregisterAudioPlayer,
  };
}