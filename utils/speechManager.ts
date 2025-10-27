// SpeechManager.ts - Gerenciador centralizado de voz
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import * as Speech from 'expo-speech';

type SpeechCallback = (text: string) => void;

class SpeechManager {
  private static instance: SpeechManager;
  
  private isRecognizing = false;
  private isSpeaking = false;
  private isEnabled = false;
  private permissionGranted = false;
  
  private listeners: Set<SpeechCallback> = new Set();
  private currentMode: 'global' | 'local' | null = null;
  private localCallback: SpeechCallback | null = null;
  
  // Debounce para evitar múltiplas chamadas
  private startTimeout: ReturnType<typeof setTimeout> | null = null;
  private stopTimeout: ReturnType<typeof setTimeout> | null = null;
  
  private constructor() {}
  
  static getInstance(): SpeechManager {
    if (!SpeechManager.instance) {
      SpeechManager.instance = new SpeechManager();
    }
    return SpeechManager.instance;
  }
  
  // ============================================
  // PERMISSÕES
  // ============================================
  async requestPermissions(): Promise<boolean> {
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      this.permissionGranted = granted;
      return granted;
    } catch (error) {
      console.error('[SpeechManager] Permission error:', error);
      return false;
    }
  }
  
  // ============================================
  // TTS (Text-to-Speech)
  // ============================================
  async speak(text: string, callback?: () => void): Promise<void> {
    console.log('[SpeechManager] Speaking:', text);
    
    // Para o reconhecimento enquanto fala
    if (this.isRecognizing) {
      await this.stopRecognition();
    }
    
    this.isSpeaking = true;
    
    return new Promise((resolve) => {
      Speech.speak(text, {
        language: 'pt-BR',
        onDone: () => {
          console.log('[SpeechManager] Speech finished');
          this.isSpeaking = false;
          
          // Aguarda um pouco antes de reativar o reconhecimento
          setTimeout(() => {
            if (this.isEnabled) {
              this.startRecognition();
            }
          }, 500);
          
          if (callback) callback();
          resolve();
        },
        onStopped: () => {
          this.isSpeaking = false;
          if (callback) callback();
          resolve();
        },
        onError: () => {
          this.isSpeaking = false;
          if (callback) callback();
          resolve();
        }
      });
    });
  }
  
  stopSpeaking(): void {
    Speech.stop();
    this.isSpeaking = false;
  }
  
  // ============================================
  // RECONHECIMENTO DE VOZ
  // ============================================
  async startRecognition(mode: 'global' | 'local' = 'global', callback?: SpeechCallback): Promise<void> {
    if (!this.permissionGranted) {
      console.warn('[SpeechManager] No permission for recognition');
      return;
    }
    
    if (this.isSpeaking) {
      console.log('[SpeechManager] Cannot start recognition while speaking');
      return;
    }
    
    // Limpa timeout pendente
    if (this.startTimeout) {
      clearTimeout(this.startTimeout);
      this.startTimeout = null;
    }
    
    // Se já está reconhecendo, não faz nada
    if (this.isRecognizing) {
      console.log('[SpeechManager] Already recognizing');
      return;
    }
    
    this.currentMode = mode;
    if (mode === 'local' && callback) {
      this.localCallback = callback;
    }
    
    // Debounce para evitar múltiplas chamadas
    this.startTimeout = setTimeout(async () => {
      try {
        console.log(`[SpeechManager] Starting recognition (${mode} mode)`);
        
        ExpoSpeechRecognitionModule.start({
          lang: 'pt-BR',
          interimResults: false,
          continuous: true,
          requiresOnDeviceRecognition: true,
          addsPunctuation: false,
          maxAlternatives: 1,
        });
        
        this.isRecognizing = true;
        this.isEnabled = true;
        
      } catch (error) {
        console.error('[SpeechManager] Start error:', error);
        this.isRecognizing = false;
      }
    }, 200);
  }
  
  async stopRecognition(): Promise<void> {
    // Limpa timeouts pendentes
    if (this.startTimeout) {
      clearTimeout(this.startTimeout);
      this.startTimeout = null;
    }
    
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }
    
    if (!this.isRecognizing) {
      return;
    }
    
    this.stopTimeout = setTimeout(() => {
      try {
        console.log('[SpeechManager] Stopping recognition');
        ExpoSpeechRecognitionModule.stop();
        this.isRecognizing = false;
        this.isEnabled = false;
        this.currentMode = null;
        this.localCallback = null;
      } catch (error) {
        console.error('[SpeechManager] Stop error:', error);
      }
    }, 100);
  }
  
  // ============================================
  // GERENCIAMENTO DE LISTENERS
  // ============================================
  addListener(callback: SpeechCallback): void {
    this.listeners.add(callback);
  }
  
  removeListener(callback: SpeechCallback): void {
    this.listeners.delete(callback);
  }
  
  // Chamado pelos eventos do expo-speech-recognition
  handleResult(text: string, isFinal: boolean): void {
    if (!isFinal || !text.trim()) return;
    
    console.log('[SpeechManager] Result:', text, 'Mode:', this.currentMode);
    
    // Se está em modo local, chama apenas o callback local
    if (this.currentMode === 'local' && this.localCallback) {
      this.localCallback(text);
      this.localCallback = null;
      return;
    }
    
    // Caso contrário, notifica todos os listeners globais
    this.listeners.forEach(listener => {
      try {
        listener(text);
      } catch (error) {
        console.error('[SpeechManager] Listener error:', error);
      }
    });
  }
  
  handleEnd(): void {
    console.log('[SpeechManager] Recognition ended');
    this.isRecognizing = false;
    this.currentMode = null;
    this.localCallback = null;
    
    // Se ainda está habilitado e não está falando, reinicia
    if (this.isEnabled && !this.isSpeaking && this.currentMode === 'global') {
      setTimeout(() => {
        this.startRecognition('global');
      }, 500);
    }
  }
  
  handleError(error: string): void {
    console.log('[SpeechManager] Recognition error:', error);
    this.isRecognizing = false;
    
    // Se não foi um erro crítico, tenta reiniciar
    if (error === 'no-speech' && this.isEnabled && !this.isSpeaking) {
      setTimeout(() => {
        this.startRecognition(this.currentMode || 'global');
      }, 1000);
    }
  }
  
  // ============================================
  // CONTROLE DE ESTADO
  // ============================================
  enable(): void {
    this.isEnabled = true;
    if (!this.isSpeaking && !this.isRecognizing) {
      this.startRecognition('global');
    }
  }
  
  disable(): void {
    this.isEnabled = false;
    this.stopRecognition();
  }
  
  getState() {
    return {
      isRecognizing: this.isRecognizing,
      isSpeaking: this.isSpeaking,
      isEnabled: this.isEnabled,
      currentMode: this.currentMode,
    };
  }
}

export default SpeechManager.getInstance();