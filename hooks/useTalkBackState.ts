import { useState, useEffect, useCallback, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';

interface TalkBackState {
  isActive: boolean;
  isSpeaking: boolean;
}

export const useTalkBackState = () => {
  const [state, setState] = useState<TalkBackState>({
    isActive: false,
    isSpeaking: false,
  });

  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Detecta se TalkBack está ativo
    const checkTalkBack = async () => {
      const isActive = await AccessibilityInfo.isScreenReaderEnabled();
      setState(prev => ({ ...prev, isActive }));
      console.log('[TalkBack] Estado:', isActive ? 'ATIVO' : 'INATIVO');
    };

    checkTalkBack();

    // Monitora mudanças
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      (isActive) => {
        setState(prev => ({ ...prev, isActive }));
        console.log('[TalkBack] Mudou para:', isActive ? 'ATIVO' : 'INATIVO');
      }
    );

    return () => {
      subscription.remove();
      if (speakingTimeoutRef.current) {
        clearTimeout(speakingTimeoutRef.current);
      }
    };
  }, []);

  // Função para marcar que TalkBack está falando
  const markAsSpeaking = useCallback((duration: number = 1000) => {
    setState(prev => ({ ...prev, isSpeaking: true }));

    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
    }

    speakingTimeoutRef.current = setTimeout(() => {
      console.log('[TalkBack] Marcando como NÃO falando');
      setState(prev => ({ ...prev, isSpeaking: false }));
    }, duration);
  }, []);

  return {
    ...state,
    markAsSpeaking,
  };
};