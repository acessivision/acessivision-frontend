import { useEffect, useRef } from 'react';
import { 
  AccessibilityInfo, 
  findNodeHandle, 
  InteractionManager 
} from 'react-native';

interface UsePageFocusOptions {
  /**
   * Se o foco deve ser ativado
   * @default true
   */
  enabled?: boolean;
  
  /**
   * Delay em ms antes de definir o foco
   * @default 800
   */
  delay?: number;
  
  /**
   * Texto para anunciar após definir o foco
   * Se não fornecido, usará o accessibilityLabel do elemento
   */
  announceText?: string;
  
  /**
   * Se deve anunciar após definir o foco
   * @default true
   */
  shouldAnnounce?: boolean;
}

/**
 * Hook para definir foco de acessibilidade em um elemento quando a página abre
 * 
 * @example
 * const titleRef = useRef(null);
 * usePageFocus(titleRef, {
 *   enabled: isFocused,
 *   announceText: "Página: Login"
 * });
 * 
 * <Text ref={titleRef} accessibilityLabel="Login">Título</Text>
 */
export const usePageFocus = (
  ref: React.RefObject<any>,
  options: UsePageFocusOptions = {}
) => {
  const {
    enabled = true,
    delay = 800,
    announceText,
    shouldAnnounce = true
  } = options;

  const hasSetFocusRef = useRef(false);

  useEffect(() => {
    // Reset quando disabled
    if (!enabled) {
      hasSetFocusRef.current = false;
      return;
    }

    // Já configurou o foco
    if (hasSetFocusRef.current) return;

    const setFocus = async () => {
      try {
        console.log('[PageFocus] 🎯 Iniciando configuração de foco...');
        
        // 1. Aguarda as interações da UI terminarem
        await new Promise<void>(resolve => {
          InteractionManager.runAfterInteractions(() => {
            resolve();
          });
        });

        // 2. Aguarda o delay configurado
        await new Promise(resolve => setTimeout(resolve, delay));

        // 3. Verifica se o leitor de tela está ativo
        const isScreenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
        console.log('[PageFocus] 📱 Leitor de tela ativo:', isScreenReaderEnabled);
        
        if (!isScreenReaderEnabled) {
          console.log('[PageFocus] ℹ️ Leitor de tela não está ativo, pulando foco');
          return;
        }

        // 4. Verifica se a ref está disponível
        if (!ref.current) {
          console.warn('[PageFocus] ⚠️ Ref não está disponível');
          return;
        }

        // 5. Obtém o reactTag
        const reactTag = findNodeHandle(ref.current);
        console.log('[PageFocus] 🏷️ ReactTag obtido:', reactTag);
        
        if (!reactTag) {
          console.warn('[PageFocus] ⚠️ ReactTag é null, não foi possível definir foco');
          return;
        }

        // 6. Define o foco
        console.log('[PageFocus] ✅ Definindo foco no elemento');
        AccessibilityInfo.setAccessibilityFocus(reactTag);
        
        // 7. Anuncia o texto (se configurado)
        if (shouldAnnounce) {
          setTimeout(() => {
            const textToAnnounce = announceText || 
              ref.current?.props?.accessibilityLabel || 
              ref.current?.props?.children;
            
            if (textToAnnounce) {
              console.log('[PageFocus] 🔊 Anunciando:', textToAnnounce);
              AccessibilityInfo.announceForAccessibility(String(textToAnnounce));
            }
          }, 150);
        }
        
        hasSetFocusRef.current = true;
        console.log('[PageFocus] 🎉 Foco configurado com sucesso!');
        
      } catch (error) {
        console.error('[PageFocus] ❌ Erro ao definir foco:', error);
      }
    };

    setFocus();
  }, [enabled, delay, announceText, shouldAnnounce]);

  // Retorna função para resetar manualmente (opcional)
  const resetFocus = () => {
    hasSetFocusRef.current = false;
  };

  return { resetFocus };
};