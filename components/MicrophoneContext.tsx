// MicrophoneContext.tsx - SOLUÇÃO SIMPLES E CLARA
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
  // ✅ SOLUÇÃO: Sempre começa DESLIGADO
  // O usuário decide quando quer ativar via toggle
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false);

  // ✅ Garante que o SpeechManager também comece desligado
  useEffect(() => {
    console.log('[MicrophoneContext] 🎬 Inicializando');
    SpeechManager.disable();
    SpeechManager.requestPermissions();
    
  }, []);

  const toggleMicrophone = useCallback(() => {
    setIsMicrophoneEnabled(prev => {
      const novoEstado = !prev;
      console.log(`[Context] 🔄 Toggle: ${prev} -> ${novoEstado}`);
      
      if (novoEstado) {
        SpeechManager.enable();
      } else {
        SpeechManager.disable();
      }
      return novoEstado;
    });
  }, []);

  const enableMicrophone = () => {}; 
  const disableMicrophone = () => {};

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
  if (!context) throw new Error('useMicrophone deve ser usado dentro de MicrophoneProvider');
  return context;
};