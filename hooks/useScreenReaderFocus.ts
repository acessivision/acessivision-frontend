import { useEffect, useRef } from 'react';
import { 
  AccessibilityInfo, 
  findNodeHandle, 
  Platform, 
  InteractionManager,
  AppState 
} from 'react-native';
import { usePathname } from 'expo-router';

/**
 * Hook para forçar o foco do leitor de tela em um elemento específico
 * sempre que a rota mudar ou o app voltar de background.
 * @param ref Referência do componente (ex: Título) que deve receber o foco.
 */
export const useScreenReaderFocus = (ref: React.RefObject<any>) => {
  const pathname = usePathname();
  const appState = useRef(AppState.currentState);

  const setFocus = () => {
    // Aguarda as interações/animações de navegação terminarem
    InteractionManager.runAfterInteractions(() => {
      // Pequeno timeout para garantir que o layout nativo foi montado
      const timeoutId = setTimeout(() => {
        if (ref.current) {
          const reactTag = findNodeHandle(ref.current);
          if (reactTag) {
            // Foca no elemento
            AccessibilityInfo.setAccessibilityFocus(reactTag);
            
            // Opcional: Anuncia o título também, útil para garantir leitura
            // AccessibilityInfo.announceForAccessibility('Título da tela focado');
          }
        }
      }, 500); // 500ms é um tempo seguro para o TalkBack reconhecer a nova tela

      return () => clearTimeout(timeoutId);
    });
  };

  // 1. Dispara quando a rota muda (Navegação)
  useEffect(() => {
    setFocus();
  }, [pathname]);

  // 2. Dispara quando o app volta de background (opcional, mas bom para "foco perdido")
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        setFocus();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);
};