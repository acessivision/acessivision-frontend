import { useEffect, useCallback, useRef } from 'react';
import { AudioModule } from 'expo-audio';
import * as Speech from 'expo-speech';
import SpeechManager from '../utils/speechManager';

export function useAudioSetup() {
  const currentAudioPlayerRef = useRef<any>(null);
  const isSpeakingRef = useRef(false);
  const lastSpokenTextRef = useRef<string | null>(null);
  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
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

  const registerAudioPlayer = useCallback((player: any) => {
    currentAudioPlayerRef.current = player;
    console.log('[Voice] Audio player registered');
  }, []);

  const unregisterAudioPlayer = useCallback(() => {
    currentAudioPlayerRef.current = null;
    console.log('[Voice] Audio player unregistered');
  }, []);

  const speak = useCallback((text: string, onDone?: () => void) => {
    console.log('[useAudioSetup] 🔊 Speaking:', text);
    
    if (currentAudioPlayerRef.current) {
      try {
        currentAudioPlayerRef.current.pause();
        console.log('[useAudioSetup] ⏸️ Paused audio player');
      } catch (e) {
        console.log('[useAudioSetup] No audio to pause');
      }
    }

    const shouldPauseRecognition = !text.toLowerCase().includes('escutando');
    
    console.log('[useAudioSetup] pauseRecognition:', shouldPauseRecognition);

    SpeechManager.speak(text, onDone, shouldPauseRecognition);
  }, []);

  const stopCurrentAudio = useCallback(() => {
    console.log('[useAudioSetup] 🛑 Stopping current audio');
    
    if (currentAudioPlayerRef.current) {
      try {
        currentAudioPlayerRef.current.pause();
      } catch (e) {
        console.log('[useAudioSetup] No audio to stop');
      }
    }

    SpeechManager.stopSpeaking();
  }, []);

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