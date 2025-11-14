import { useEffect, useRef } from 'react';
import { 
  AccessibilityInfo, 
  findNodeHandle, 
  Platform,
  InteractionManager 
} from 'react-native';

interface UseAccessibilityFocusOptions {
  enabled?: boolean;
  delay?: number;
  announce?: boolean;
  announceText?: string;
}

export const useAccessibilityFocus = (
  ref: React.RefObject<any>,
  options: UseAccessibilityFocusOptions = {}
) => {
  const {
    enabled = true,
    delay = 500,
    announce = true,
    announceText
  } = options;

  const hasSetFocusRef = useRef(false);

  useEffect(() => {
    if (!enabled || hasSetFocusRef.current) return;

    const setFocus = async () => {
      try {
        // Aguarda a UI estabilizar
        await InteractionManager.runAfterInteractions(async () => {
          // Verifica se TalkBack/VoiceOver está ativo
          const isScreenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
          
          if (!isScreenReaderEnabled) {
            console.log('[A11y] Screen reader não está ativo');
            return;
          }

          // Aguarda o delay configurado
          await new Promise(resolve => setTimeout(resolve, delay));

          if (ref.current) {
            const reactTag = findNodeHandle(ref.current);
            
            if (reactTag) {
              console.log('[A11y] ✅ Definindo foco no elemento');
              
              // Define o foco
              AccessibilityInfo.setAccessibilityFocus(reactTag);
              
              // Se deve anunciar, faz o anúncio após definir o foco
              if (announce) {
                setTimeout(() => {
                  const textToAnnounce = announceText || 
                    ref.current?.props?.accessibilityLabel || 
                    ref.current?.props?.children;
                  
                  if (textToAnnounce) {
                    console.log('[A11y] 🔊 Anunciando:', textToAnnounce);
                    AccessibilityInfo.announceForAccessibility(
                      String(textToAnnounce)
                    );
                  }
                }, 100);
              }
              
              hasSetFocusRef.current = true;
            } else {
              console.warn('[A11y] ⚠️ Não foi possível obter reactTag');
            }
          } else {
            console.warn('[A11y] ⚠️ Ref não está disponível');
          }
        });
      } catch (error) {
        console.error('[A11y] ❌ Erro ao definir foco:', error);
      }
    };

    setFocus();

    return () => {
      hasSetFocusRef.current = false;
    };
  }, [enabled, delay, announce, announceText]);
};