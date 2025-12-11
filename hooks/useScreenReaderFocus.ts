import { useEffect, useRef } from 'react';
import { 
  AccessibilityInfo, 
  findNodeHandle, 
  Platform, 
  InteractionManager,
  AppState 
} from 'react-native';
import { usePathname } from 'expo-router';

export const useScreenReaderFocus = (ref: React.RefObject<any>) => {
  const pathname = usePathname();
  const appState = useRef(AppState.currentState);

  const setFocus = () => {
    InteractionManager.runAfterInteractions(() => {
      const timeoutId = setTimeout(() => {
        if (ref.current) {
          const reactTag = findNodeHandle(ref.current);
          if (reactTag) {
            AccessibilityInfo.setAccessibilityFocus(reactTag);
          }
        }
      }, 500);

      return () => clearTimeout(timeoutId);
    });
  };

  useEffect(() => {
    setFocus();
  }, [pathname]);

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