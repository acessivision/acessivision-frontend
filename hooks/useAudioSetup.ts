import { useEffect, useCallback, useRef } from 'react';
import { AudioModule } from 'expo-audio';
import * as Speech from 'expo-speech';

export function useAudioSetup() {
  const currentAudioPlayerRef = useRef<any>(null);
  const isSpeakingRef = useRef(false);
  const lastSpokenTextRef = useRef<string | null>(null);
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

  const stopCurrentAudio = useCallback(() => {
    Speech.stop();
    isSpeakingRef.current = false; // Reset flag when stopping
    lastSpokenTextRef.current = null; // Reset last spoken text
    console.log('[TTS] Stop requested.');
  }, []);

  const speak = useCallback((text: string, onDone?: () => void) => { // Accept optional onDone callback
    // 1. Stop any previous speech immediately
    stopCurrentAudio();

    // (Optional) Check for immediate duplicates - though less critical now
    if (text === lastSpokenTextRef.current) {
       console.log('[Voice] Skipping immediate duplicate TTS:', text);
       onDone?.(); // Call callback even if skipped, to unblock
       return;
    }
    lastSpokenTextRef.current = text; // Set last spoken text *before* speaking

    console.log('[TTS] Speaking:', text);
    isSpeakingRef.current = true; // Set flag *before* calling speak

    // 2. Call Speech.speak directly (removed setTimeout)
    Speech.speak(text, {
      language: 'pt-BR',
      pitch: 1.0,
      rate: 1.0,
      onDone: () => {
        if (isSpeakingRef.current) { // Check if still supposed to be speaking
            isSpeakingRef.current = false;
            lastSpokenTextRef.current = null; // Clear last text on completion
            console.log('[Voice] TTS finished');
            onDone?.(); // 3. Call the provided callback on success
        }
      },
      onError: (error) => {
        if (isSpeakingRef.current) { // Check flag
            isSpeakingRef.current = false;
            lastSpokenTextRef.current = null; // Clear last text on error
            console.error('[Voice] TTS error:', error);
            onDone?.(); // 4. Call the provided callback on error to unblock
        }
      },
      onStopped: () => { // Handle interruption
        if (isSpeakingRef.current) {
            isSpeakingRef.current = false;
            lastSpokenTextRef.current = null; // Clear last text if stopped early
            console.log('[Voice] TTS stopped (interrupted?)');
            onDone?.(); // 5. Call the provided callback if stopped to unblock
        }
      }
    });
  }, [stopCurrentAudio]);

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