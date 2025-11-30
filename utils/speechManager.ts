// SpeechManager.ts - Corrigido para não gerar erros ao parar
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
  
  // Controle de eco
  private recentlySpoken: Set<string> = new Set();
  private lastSpokenText: string | null = null;
  
  // Controle de duplicatas
  private lastProcessedResult: string | null = null;
  private lastProcessedTime: number = 0;
  private processingResults = new Map<string, number>();
  
  private lastErrorTime: number = 0;
  private lastEndTime: number = 0;
  
  // ✅ NOVO: Flag para saber se foi parado intencionalmente
  private intentionalStop = false;
  
  // Debounce
  private startTimeout: ReturnType<typeof setTimeout> | null = null;
  private stopTimeout: ReturnType<typeof setTimeout> | null = null;
  
  private talkBackSpeakingCallback: ((isSpeaking: boolean) => void) | null = null;
  
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

  setTalkBackSpeakingCallback(callback: (isSpeaking: boolean) => void) {
    this.talkBackSpeakingCallback = callback;
  }
  
  // ============================================
  // TTS
  // ============================================
  async speak(text: string, callback?: () => void, pauseRecognition: boolean = true): Promise<void> {
    console.log('[SpeechManager] 🔊 Speaking:', text);
    
    const normalizedText = text.toLowerCase().trim();
    this.lastSpokenText = normalizedText;
    this.recentlySpoken.add(normalizedText);
    
    const variations = [
      normalizedText,
      normalizedText.replace(/\s+/g, ''),
    ];
    
    variations.forEach(v => {
      if (v.length > 2) {
        this.recentlySpoken.add(v);
      }
    });
    
    const wasRecognizing = this.isRecognizing;
    if (pauseRecognition && this.isRecognizing) {
      console.log('[SpeechManager] ⏸️ Pausando reconhecimento');
      await this.stopRecognition();
    }
    
    this.isSpeaking = true;
    if (this.talkBackSpeakingCallback) {
      this.talkBackSpeakingCallback(true);
    }
    
    let callbackFired = false;
    let cleanupTimeout: ReturnType<typeof setTimeout> | null = null;
    
    const handleSpeechComplete = () => {
      if (callbackFired) return;
      callbackFired = true;
      
      this.isSpeaking = false;
      if (this.talkBackSpeakingCallback) {
        this.talkBackSpeakingCallback(false);
      }
      
      if (cleanupTimeout) clearTimeout(cleanupTimeout);
      
      if (pauseRecognition && wasRecognizing && this.isEnabled) {
        console.log('[SpeechManager] ▶️ Retomando reconhecimento');
        this.startRecognition('global');
      }
      
      const cacheTime = normalizedText.length <= 10 ? 800 : 1200;
      
      cleanupTimeout = setTimeout(() => {
        variations.forEach(v => this.recentlySpoken.delete(v));
        this.lastSpokenText = null;
        console.log('[SpeechManager] 🧹 Cache de eco limpo');
      }, cacheTime);
      
      if (callback) callback();
    };
    
    return new Promise((resolve) => {
      Speech.speak(text, {
        language: 'pt-BR',
        onDone: () => {
          handleSpeechComplete();
          resolve();
        },
        onStopped: () => {
          if (!callbackFired) {
            this.isSpeaking = false;
            if (this.talkBackSpeakingCallback) {
              this.talkBackSpeakingCallback(false);
            }
            setTimeout(() => {
              this.recentlySpoken.delete(normalizedText);
              this.lastSpokenText = null;
            }, 200);
            if (callback) callback();
            callbackFired = true;
          }
          resolve();
        },
        onError: () => {
          if (!callbackFired) {
            this.isSpeaking = false;
            if (this.talkBackSpeakingCallback) {
              this.talkBackSpeakingCallback(false);
            }
            this.recentlySpoken.delete(normalizedText);
            this.lastSpokenText = null;
            if (callback) callback();
            callbackFired = true;
          }
          resolve();
        }
      });
    });
  }

  stopSpeaking(): void {
    Speech.stop();
    this.isSpeaking = false;
    this.recentlySpoken.clear();
    this.lastSpokenText = null;
  }
  
  // ============================================
  // RECONHECIMENTO
  // ============================================
  async startRecognition(mode: 'global' | 'local' = 'global', callback?: SpeechCallback): Promise<void> {
    if (!this.permissionGranted) return;
    
    if (this.startTimeout) {
      clearTimeout(this.startTimeout);
      this.startTimeout = null;
    }
    
    if (this.isRecognizing) {
      console.log('[SpeechManager] ⚠️ Já está reconhecendo, forçando parada antes de reiniciar');
      
      // ✅ CRÍTICO: Para completamente antes de reiniciar
      try {
        ExpoSpeechRecognitionModule.stop();
        this.isRecognizing = false;
        await new Promise(resolve => setTimeout(resolve, 300)); // Aguarda parada completa
      } catch (e) {
        console.warn('[SpeechManager] Erro ao forçar parada:', e);
      }
    }
    
    // ✅ Reset da flag de parada intencional
    this.intentionalStop = false;
    
    this.currentMode = mode;
    if (mode === 'local' && callback) {
      this.localCallback = callback;
    }
    
    this.startTimeout = setTimeout(async () => {
      try {
        console.log(`[SpeechManager] 🎤 Starting recognition (${mode})`);
        
        ExpoSpeechRecognitionModule.start({
          lang: 'pt-BR',
          interimResults: mode === 'local',
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
    }, 100);
  }
  
  // ✅ Stop que NÃO desabilita o manager (para modo local)
  async stopRecognition(): Promise<void> {
    if (this.startTimeout) {
      clearTimeout(this.startTimeout);
      this.startTimeout = null;
    }
    
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }
    
    if (!this.isRecognizing) return;
    
    // ✅ Marca como parada intencional
    this.intentionalStop = true;
    
    this.stopTimeout = setTimeout(() => {
      try {
        console.log('[SpeechManager] 🛑 Stopping recognition (intentional)');
        ExpoSpeechRecognitionModule.stop();
        this.isRecognizing = false;
        this.currentMode = null;
        this.localCallback = null;
      } catch (error) {
        console.error('[SpeechManager] Stop error:', error);
      }
    }, 100); // ✅ Delay para garantir que o Android processe
    
    // ✅ Aguarda um pouco para garantir que parou completamente
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // ============================================
  // LISTENERS
  // ============================================
  addListener(callback: SpeechCallback): void {
    this.listeners.add(callback);
  }
  
  removeListener(callback: SpeechCallback): void {
    this.listeners.delete(callback);
  }
  
  // ============================================
  // PROCESSAMENTO DE RESULTADOS
  // ============================================
  handleResult(text: string, isFinal: boolean): void {
    if (!isFinal || !text.trim()) return;
    
    const normalizedText = text.toLowerCase().trim();
    const now = Date.now();
    
    // Filtros de duplicata
    if (this.lastProcessedResult === normalizedText && 
        (now - this.lastProcessedTime) < 1000) {
      console.log('[SpeechManager] 🔇 IGNORANDO DUPLICATA:', text);
      return;
    }
    
    const lastProcessed = this.processingResults.get(normalizedText);
    if (lastProcessed && (now - lastProcessed) < 2000) {
      console.log('[SpeechManager] 🔇 IGNORANDO DUPLICATA (Mapa):', text);
      return;
    }
    
    this.lastProcessedResult = normalizedText;
    this.lastProcessedTime = now;
    this.processingResults.set(normalizedText, now);
    
    if (this.processingResults.size > 20) {
      const oldestAllowed = now - 5000;
      for (const [key, timestamp] of this.processingResults.entries()) {
        if (timestamp < oldestAllowed) {
          this.processingResults.delete(key);
        }
      }
    }
    
    if (normalizedText === 'escutando' || normalizedText === 'escutando.') {
      console.log('[SpeechManager] 🔇 IGNORANDO PROMPT DO SISTEMA (Exato):', normalizedText);
      return;
    }

    if (this.recentlySpoken.has(normalizedText)) {
      console.log('[SpeechManager] 🔇 IGNORANDO ECO EXATO:', text);
      return;
    }
    
    if (this.lastSpokenText && normalizedText.length < 20) {
      const similarity = this.calculateSimilarity(normalizedText, this.lastSpokenText);
      if (similarity > 0.9) {
        console.log('[SpeechManager] 🔇 IGNORANDO ECO SIMILAR:', text);
        return;
      }
    }
    
    console.log('[SpeechManager] ✅ Result (Aceito):', text);
    
    if (this.currentMode === 'local' && this.localCallback) {
      this.localCallback(text);
      this.localCallback = null;
      return;
    }
    
    this.listeners.forEach(listener => {
      try {
        listener(text);
      } catch (error) {
        console.error('[SpeechManager] Listener error:', error);
      }
    });
  }
  
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    if (longer.includes(shorter)) return 0.9;
    
    const longerChars = new Set(longer.split(''));
    const shorterChars = shorter.split('');
    const matches = shorterChars.filter(char => longerChars.has(char)).length;
    
    return matches / longer.length;
  }
  
  handleEnd(): void {
    const now = Date.now();
    
    if (now - this.lastEndTime < 500) return;
    this.lastEndTime = now;
    
    if (!this.isRecognizing) return;
    
    const wasGlobal = this.currentMode === 'global';
    
    this.isRecognizing = false;
    this.currentMode = null;
    this.localCallback = null;
    
    // ✅ Só reinicia se NÃO foi parada intencional e está em modo global
    if (this.isEnabled && !this.isSpeaking && wasGlobal && !this.intentionalStop) {
      setTimeout(() => {
        this.startRecognition('global');
      }, 150);
    } else if (this.intentionalStop) {
      console.log('[SpeechManager] ℹ️ Parada intencional, não reiniciando');
      this.intentionalStop = false; // Reset da flag
    }
  }
  
  handleError(error: string): void {
    const now = Date.now();
    
    if (now - this.lastErrorTime < 200) return;
    this.lastErrorTime = now;
    
    // ✅ Se foi parada intencional, ignora o erro e não reinicia
    if (this.intentionalStop) {
      console.log('[SpeechManager] ℹ️ Erro após parada intencional, ignorando');
      this.intentionalStop = false;
      this.isRecognizing = false;
      return;
    }
    
    if (!this.isRecognizing) return;
    
    this.isRecognizing = false;
    
    // ✅ Só reinicia se estiver habilitado e for modo global
    if (this.isEnabled && !this.isSpeaking && this.currentMode === 'global') {
      setTimeout(() => {
        this.startRecognition('global');
      }, 400);
    }
  }
  
  // ============================================
  // CONTROLE DE ESTADO
  // ============================================
  enable(): void {
    console.log('[SpeechManager] ✅ Enabling');
    this.isEnabled = true;
    
    if (!this.isSpeaking && !this.isRecognizing) {
      this.startRecognition('global');
    }
  }
  
  disable(): void {
    console.log('[SpeechManager] ❌ Disabling');
    this.isEnabled = false;
    this.intentionalStop = true; // ✅ Marca como parada intencional
    
    if (this.isRecognizing) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (e) {}
      this.isRecognizing = false;
    }
    this.currentMode = null;
    this.localCallback = null;
  }
  
  getState() {
    return {
      isRecognizing: this.isRecognizing,
      isSpeaking: this.isSpeaking,
      isEnabled: this.isEnabled,
      currentMode: this.currentMode,
      listenerCount: this.listeners.size,
    };
  }
}

export default SpeechManager.getInstance();