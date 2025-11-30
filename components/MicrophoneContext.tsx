// MicrophoneContext.tsx - Contexto global para estado do microfone
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import SpeechManager from '../utils/speechManager';

interface MicrophoneContextType {
  isMicrophoneEnabled: boolean;
  enableMicrophone: () => void;
  disableMicrophone: () => void;
  toggleMicrophone: () => void;
}

const MicrophoneContext = createContext<MicrophoneContextType | undefined>(undefined);

export const MicrophoneProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true);

  // Inicialização robusta
  useEffect(() => {
    const state = SpeechManager.getState();
    setIsMicrophoneEnabled(state.isEnabled);
    
    // Se o estado inicial for true, garanta que o manager saiba disso
    if (state.isEnabled) {
       SpeechManager.enable(); 
    }
  }, []);

  const enableMicrophone = useCallback(() => {
    console.log('[Context] 🟢 Enabling Master Switch');
    setIsMicrophoneEnabled(true);
    SpeechManager.enable();
  }, []);

  const disableMicrophone = useCallback(() => {
    console.log('[Context] 🔴 Disabling Master Switch');
    setIsMicrophoneEnabled(false);
    SpeechManager.disable();
  }, []);

  const toggleMicrophone = useCallback(() => {
    if (isMicrophoneEnabled) {
      disableMicrophone();
    } else {
      enableMicrophone();
    }
  }, [isMicrophoneEnabled, enableMicrophone, disableMicrophone]);

  return (
    <MicrophoneContext.Provider
      value={{
        isMicrophoneEnabled,
        enableMicrophone,
        disableMicrophone,
        toggleMicrophone,
      }}
    >
      {children}
    </MicrophoneContext.Provider>
  );
};

export const useMicrophone = () => {
  const context = useContext(MicrophoneContext);
  if (!context) {
    throw new Error('useMicrophone deve ser usado dentro de MicrophoneProvider');
  }
  return context;
};