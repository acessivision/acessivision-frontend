// SpeechManager.ts - Enhanced with echo prevention and duplicate event handling
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
  
  // ✅ Track recently spoken phrases to prevent echo
  private recentlySpoken: Set<string> = new Set();
  private lastSpokenText: string | null = null;
  
  // ✅ Track last processed result to prevent duplicates
  private lastProcessedResult: string | null = null;
  private lastProcessedTime: number = 0;
  
  // ✅ Track last error/end event to prevent duplicate handling
  private lastErrorTime: number = 0;
  private lastEndTime: number = 0;
  
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
  async speak(text: string, callback?: () => void, keepListening: boolean = false): Promise<void> {
    console.log('[SpeechManager] 🔊 Speaking:', text, 'keepListening:', keepListening);
    
    // ✅ Track this text to ignore it if recognized
    const normalizedText = text.toLowerCase().trim();
    this.lastSpokenText = normalizedText;
    this.recentlySpoken.add(normalizedText);
    
    // ✅ Only stop recognition if NOT keeping it active
    if (this.isRecognizing && !keepListening) {
      console.log('[SpeechManager] Stopping recognition to speak');
      await this.stopRecognition();
    }
    
    this.isSpeaking = true;
    
    // ✅ Track if callbacks already fired to prevent duplicates
    let callbackFired = false;
    let restartTimeout: ReturnType<typeof setTimeout> | null = null;
    
    const handleSpeechComplete = () => {
      if (callbackFired) return;
      callbackFired = true;
      
      console.log('[SpeechManager] Speech finished');
      this.isSpeaking = false;
      
      // Clear any existing timeout
      if (restartTimeout) clearTimeout(restartTimeout);
      
      // ✅ Wait longer before reactivating recognition to avoid echo
      restartTimeout = setTimeout(() => {
        // ✅ Remove from recently spoken after delay
        this.recentlySpoken.delete(normalizedText);
        this.lastSpokenText = null;
        
        // ✅ CORREÇÃO: Sempre tenta iniciar se enabled e não está reconhecendo
        if (this.isEnabled && !this.isRecognizing) {
          console.log('[SpeechManager] Restarting recognition after speech (keepListening was', keepListening, ')');
          this.startRecognition('global');
        } else if (keepListening && !this.isRecognizing) {
          // ✅ Se keepListening=true mas não está reconhecendo, força o início
          console.log('[SpeechManager] ⚠️ keepListening=true but not recognizing, forcing start');
          this.startRecognition('global');
        } else if (keepListening) {
          console.log('[SpeechManager] Keeping recognition active (keepListening=true)');
        }
      }, 800);
      
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
            console.log('[SpeechManager] Speech stopped');
            this.isSpeaking = false;
            setTimeout(() => {
              this.recentlySpoken.delete(normalizedText);
              this.lastSpokenText = null;
            }, 500);
            if (callback) callback();
            callbackFired = true;
          }
          resolve();
        },
        onError: () => {
          if (!callbackFired) {
            console.log('[SpeechManager] Speech error');
            this.isSpeaking = false;
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
    // ✅ Clear recently spoken when manually stopped
    this.recentlySpoken.clear();
    this.lastSpokenText = null;
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
    
    // ✅ CORREÇÃO: Permite reiniciar mesmo se já estiver "reconhecendo"
    // porque às vezes o flag está true mas o microfone não está realmente ativo
    if (this.isRecognizing) {
      console.log('[SpeechManager] ⚠️ Already recognizing flag is true, but will restart anyway');
      // Força parar primeiro
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (e) {
        // Ignora erros ao parar
      }
      this.isRecognizing = false;
    }
    
    this.currentMode = mode;
    if (mode === 'local' && callback) {
      this.localCallback = callback;
    }
    
    // Debounce para evitar múltiplas chamadas
    this.startTimeout = setTimeout(async () => {
      try {
        console.log(`[SpeechManager] 🎤 Starting recognition (${mode} mode)`);
        
        // ✅ Use interimResults: true for local mode to capture full phrases
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
        console.log('[SpeechManager] Stopping recognition (temporary pause)');
        ExpoSpeechRecognitionModule.stop();
        this.isRecognizing = false;
        // ✅ DON'T set isEnabled = false! We want to restart after speaking
        // Only clear the mode and callback
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
    console.log('[SpeechManager] Listener added. Total:', this.listeners.size);
  }
  
  removeListener(callback: SpeechCallback): void {
    this.listeners.delete(callback);
    console.log('[SpeechManager] Listener removed. Total:', this.listeners.size);
  }
  
  // Chamado pelos eventos do expo-speech-recognition
  handleResult(text: string, isFinal: boolean): void {
    if (!isFinal || !text.trim()) return;
    
    const normalizedText = text.toLowerCase().trim();
    const now = Date.now();
    
    // ✅ FIRST: Block duplicate results from speech recognition
    if (this.lastProcessedResult === normalizedText && (now - this.lastProcessedTime) < 1500) {
      return;
    }
    
    // Update tracking
    this.lastProcessedResult = normalizedText;
    this.lastProcessedTime = now;
    
    // ✅ SECOND: Ignore if this matches recently spoken text (echo prevention)
    if (this.recentlySpoken.has(normalizedText)) {
      console.log('[SpeechManager] 🔇 IGNORING ECHO:', text);
      return;
    }
    
    // ✅ THIRD: Check partial matches with last spoken text
    if (this.lastSpokenText) {
      const similarity = this.calculateSimilarity(normalizedText, this.lastSpokenText);
      if (similarity > 0.8) {
        console.log('[SpeechManager] 🔇 IGNORING SIMILAR ECHO:', text, `(${(similarity * 100).toFixed(0)}% match)`);
        return;
      }
    }
    
    console.log('[SpeechManager] ✅ Result:', text, 'Mode:', this.currentMode);
    
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
  
  // ✅ Calculate text similarity for better echo detection
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
    
    // ✅ Prevent duplicate end events within 500ms
    if (now - this.lastEndTime < 500) {
      return;
    }
    this.lastEndTime = now;
    
    console.log('[SpeechManager] Recognition ended');
    
    // ✅ Prevent duplicate processing
    if (!this.isRecognizing) {
      return;
    }
    
    const wasGlobal = this.currentMode === 'global';
    
    this.isRecognizing = false;
    this.currentMode = null;
    this.localCallback = null;
    
    // ✅ Restart if enabled and was global
    if (this.isEnabled && !this.isSpeaking && wasGlobal) {
      setTimeout(() => {
        console.log('[SpeechManager] Auto-restarting global recognition after end');
        this.startRecognition('global');
      }, 300);
    }
  }
  
  handleError(error: string): void {
    const now = Date.now();
    
    // ✅ Prevent duplicate error events within 500ms
    if (now - this.lastErrorTime < 500) {
      return;
    }
    this.lastErrorTime = now;
    
    console.log('[SpeechManager] Recognition error:', error);
    
    // ✅ Only process if we're actually recognizing
    if (!this.isRecognizing) {
      return;
    }
    
    this.isRecognizing = false;
    
    // Restart based on error type
    if (this.isEnabled && !this.isSpeaking) {
      const delay = error === 'no-speech' ? 1000 : 1000;
      setTimeout(() => {
        console.log('[SpeechManager] Restarting after error:', error);
        this.startRecognition('global');
      }, delay);
    }
  }
  
  // ============================================
  // CONTROLE DE ESTADO
  // ============================================
  enable(): void {
    console.log('[SpeechManager] ✅ Enabling manager');
    this.isEnabled = true;
    
    // ✅ CORREÇÃO: Sempre tenta iniciar, mesmo se o flag diz que já está ativo
    if (!this.isSpeaking) {
      console.log('[SpeechManager] 🎤 Forcing recognition start on enable()');
      this.startRecognition('global');
    }
  }
  
  disable(): void {
    console.log('[SpeechManager] ❌ Disabling manager');
    this.isEnabled = false;
    if (this.isRecognizing) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (e) {
        console.error('[SpeechManager] Error stopping on disable:', e);
      }
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