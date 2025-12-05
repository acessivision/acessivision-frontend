// MicrophoneContext.tsx - INICIA AUTOMATICAMENTE
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
  // ✅ CORRIGIDO: Começa LIGADO por padrão
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true);

  // ✅ Inicializa o SpeechManager já ATIVADO
  useEffect(() => {
    console.log('[MicrophoneContext] 🎬 Inicializando com microfone LIGADO');
    
    // Aguarda um pouco para garantir que as permissões foram solicitadas
    const initTimer = setTimeout(() => {
      SpeechManager.enable();
      console.log('[MicrophoneContext] ✅ Microfone ativado automaticamente');
    }, 500);

    return () => clearTimeout(initTimer);
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

  const enableMicrophone = useCallback(() => {
    console.log('[Context] ✅ Ativando microfone manualmente');
    setIsMicrophoneEnabled(true);
    SpeechManager.enable();
  }, []);

  const disableMicrophone = useCallback(() => {
    console.log('[Context] ❌ Desativando microfone manualmente');
    setIsMicrophoneEnabled(false);
    SpeechManager.disable();
  }, []);

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