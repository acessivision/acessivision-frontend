import { ExpoSpeechRecognitionModule, ExpoSpeechRecognitionNativeEventMap } from 'expo-speech-recognition';
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
  
  private recentlySpoken: Set<string> = new Set();
  private lastSpokenText: string | null = null;
  
  private lastInterimText: string = '';
  private interimTimeout: ReturnType<typeof setTimeout> | null = null;
  
  private lastProcessedResult: string | null = null;
  private lastProcessedTime: number = 0;
  private processingResults = new Map<string, number>();
  
  private lastErrorTime: number = 0;
  private lastEndTime: number = 0;
  private lastStartTime: number = 0;
  
  private intentionalStop = false;
  private isInitializing = false;
  private consecutiveErrors = 0;
  
  private startTimeout: ReturnType<typeof setTimeout> | null = null;
  private stopTimeout: ReturnType<typeof setTimeout> | null = null;
  private restartTimeout: ReturnType<typeof setTimeout> | null = null;
  
  private talkBackSpeakingCallback: ((isSpeaking: boolean) => void) | null = null;
  
  private subscriptions: Array<{ remove: () => void }> = [];
  
  private constructor() {
    this.setupNativeListeners();
  }
  
  static getInstance(): SpeechManager {
    if (!SpeechManager.instance) {
      SpeechManager.instance = new SpeechManager();
    }
    return SpeechManager.instance;
  }
  
  private setupNativeListeners(): void {
    console.log('[SpeechManager] 🎧 Configurando event listeners nativos');
    
    try {
      const resultSub = ExpoSpeechRecognitionModule.addListener(
        'result',
        (event: ExpoSpeechRecognitionNativeEventMap['result']) => {
          if (event.results && event.results.length > 0) {
            const transcript = event.results[0].transcript;
            
            if (this.currentMode === 'local' && !event.isFinal) {
              this.handleInterimResult(transcript);
            }
            
            if (event.isFinal) {
              console.log('[SpeechManager] ✅ FINAL result:', transcript);
              this.handleResult(transcript, true);
            }
          }
        }
      );
      
      const endSub = ExpoSpeechRecognitionModule.addListener(
        'end',
        () => {
          console.log('[SpeechManager] 🏁 Recognition ended (native event)');
          this.handleEnd();
        }
      );
      
      const errorSub = ExpoSpeechRecognitionModule.addListener('error', (event) => {
          this.handleError(event.error);
      });
      
      const startSub = ExpoSpeechRecognitionModule.addListener('start', () => {
          this.isInitializing = false;
          this.consecutiveErrors = 0;
      });
      
      this.subscriptions = [resultSub, endSub, errorSub, startSub];
      console.log('[SpeechManager] ✅ Event listeners configurados com sucesso');
      
    } catch (error) {
      console.error('[SpeechManager] ❌ Erro ao configurar listeners:', error);
    }
  }
  
  private handleInterimResult(text: string): void {
    if (!text.trim()) return;
    
    const normalizedText = text.toLowerCase().trim();
    
    const systemPrompts = ['escutando', 'processando', 'aguarde'];
    let cleanedText = normalizedText;
    systemPrompts.forEach(prompt => {
      const regex = new RegExp(`\\b${prompt}\\b`, 'gi');
      cleanedText = cleanedText.replace(regex, '').trim();
    });
    cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
    
    if (!cleanedText) return;
    
    if (this.recentlySpoken.has(cleanedText)) return;
    
    if (this.currentMode === 'local' && this.localCallback) {
      if (this.interimTimeout) {
        clearTimeout(this.interimTimeout);
      }
      
      if (cleanedText !== this.lastInterimText) {
        console.log('[SpeechManager] ⚡ Interim result:', cleanedText);
        this.lastInterimText = cleanedText;
        this.localCallback(cleanedText);
      }
    }
  }
  
  async requestPermissions(): Promise<boolean> {
    try {
      console.log('[SpeechManager] 🔑 Solicitando permissões...');
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      this.permissionGranted = granted;
      console.log('[SpeechManager] Permissões:', granted ? '✅ Concedidas' : '❌ Negadas');
      return granted;
    } catch (error) {
      console.error('[SpeechManager] Erro ao solicitar permissões:', error);
      return false;
    }
  }

  setTalkBackSpeakingCallback(callback: (isSpeaking: boolean) => void) {
    this.talkBackSpeakingCallback = callback;
  }
  
  async speak(text: string, callback?: () => void, pauseRecognition: boolean = false): Promise<void> {
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
    
    const wasEnabled = this.isEnabled;
    const shouldPause = pauseRecognition && this.isRecognizing;
    
    if (shouldPause) {
      console.log('[SpeechManager] ⏸️ Pausando reconhecimento para falar');
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
      
      if (shouldPause && wasEnabled && this.isEnabled) {
        console.log('[SpeechManager] ▶️ Retomando reconhecimento após fala');
        setTimeout(() => {
          this.startRecognition('global');
        }, 300);
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
  
  async startRecognition(mode: 'global' | 'local' = 'global', callback?: SpeechCallback): Promise<void> {
    if (!this.permissionGranted) {
      console.log('[SpeechManager] ⚠️ Permissão faltando ao iniciar. Solicitando agora...');
      const granted = await this.requestPermissions();
      if (!granted) {
        console.warn('[SpeechManager] 🚫 Permissão negada pelo usuário.');
        return;
      }
    }
    
    if (this.isInitializing) return;
    const now = Date.now();
    if (now - this.lastStartTime < 500) return;
    
    if (this.isRecognizing) {
      this.currentMode = mode;
      if (mode === 'local' && callback) this.localCallback = callback;
      if (mode === 'global') this.localCallback = null;
      return; 
    }
    
    this.intentionalStop = false;
    this.currentMode = mode;
    this.isInitializing = true;
    this.lastStartTime = now;
    this.lastInterimText = '';
    
    if (mode === 'local' && callback) this.localCallback = callback;
    
    this.startTimeout = setTimeout(async () => {
      try {
        try { ExpoSpeechRecognitionModule.stop(); } catch (e) {}
        
        ExpoSpeechRecognitionModule.start({
          lang: 'pt-BR',
          interimResults: mode === 'local',
          continuous: mode === 'global',
          requiresOnDeviceRecognition: true, 
          addsPunctuation: false,
          maxAlternatives: 1,
          ...(mode === 'local' && {
            contextualStrings: [],
          }),
        });
        
        this.isRecognizing = true;
        this.isEnabled = true;
        console.log(`[SpeechManager] 🎤 Engine Iniciada (${mode})`);
        
      } catch (error) {
        console.error('[SpeechManager] ❌ Start falhou:', error);
        this.isRecognizing = false;
        this.isInitializing = false;
      }
    }, 50);
  }
  
  async stopRecognition(): Promise<void> {
    if (this.stopTimeout) clearTimeout(this.stopTimeout);
    if (this.interimTimeout) clearTimeout(this.interimTimeout);
    
    if (!this.isRecognizing && !this.isInitializing) return;
    
    this.intentionalStop = true;
    this.isInitializing = false;
    this.lastInterimText = '';
    
    this.stopTimeout = setTimeout(() => {
      try {
        ExpoSpeechRecognitionModule.stop();
        this.isRecognizing = false;
        this.currentMode = null;
        this.localCallback = null;
        console.log('[SpeechManager] 🛑 Engine Parada');
      } catch (error) {}
    }, 50);
  }
  
  addListener(callback: SpeechCallback): void {
    this.listeners.add(callback);
    console.log('[SpeechManager] 👂 Listener adicionado. Total:', this.listeners.size);
  }
  
  removeListener(callback: SpeechCallback): void {
    this.listeners.delete(callback);
    console.log('[SpeechManager] 🗑️ Listener removido. Total:', this.listeners.size);
  }
  
  handleResult(text: string, isFinal: boolean): void {
    if (!isFinal || !text.trim()) return;
    
    const normalizedText = text.toLowerCase().trim();
    const now = Date.now();
    
    const systemPrompts = ['escutando', 'processando', 'aguarde'];
    
    let cleanedText = normalizedText;
    systemPrompts.forEach(prompt => {
      const regex = new RegExp(`\\b${prompt}\\b`, 'gi');
      cleanedText = cleanedText.replace(regex, '').trim();
    });
    
    cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
    
    if (!cleanedText) {
      console.log('[SpeechManager] 🔇 IGNORANDO PROMPT DO SISTEMA:', normalizedText);
      return;
    }
    
    const textToProcess = cleanedText;
    
    if (textToProcess !== normalizedText) {
      console.log('[SpeechManager] 🧹 Palavras do sistema removidas:', {
        original: normalizedText,
        limpo: textToProcess
      });
    }
    
    if (this.lastProcessedResult === textToProcess && 
        (now - this.lastProcessedTime) < 1000) {
      console.log('[SpeechManager] 🔇 IGNORANDO DUPLICATA:', textToProcess);
      return;
    }
    
    const lastProcessed = this.processingResults.get(textToProcess);
    if (lastProcessed && (now - lastProcessed) < 2000) {
      console.log('[SpeechManager] 🔇 IGNORANDO DUPLICATA (Mapa):', textToProcess);
      return;
    }
    
    this.lastProcessedResult = textToProcess;
    this.lastProcessedTime = now;
    this.processingResults.set(textToProcess, now);
    
    if (this.processingResults.size > 20) {
      const oldestAllowed = now - 5000;
      for (const [key, timestamp] of this.processingResults.entries()) {
        if (timestamp < oldestAllowed) {
          this.processingResults.delete(key);
        }
      }
    }

    if (this.recentlySpoken.has(textToProcess)) {
      console.log('[SpeechManager] 🔇 IGNORANDO ECO EXATO:', textToProcess);
      return;
    }
    
    if (this.lastSpokenText && textToProcess.length < 20) {
      const similarity = this.calculateSimilarity(textToProcess, this.lastSpokenText);
      if (similarity > 0.9) {
        console.log('[SpeechManager] 🔇 IGNORANDO ECO SIMILAR:', textToProcess);
        return;
      }
    }
    
    console.log('[SpeechManager] ✅ Resultado aceito:', textToProcess);
    
    if (this.currentMode === 'local' && this.localCallback) {
      console.log('[SpeechManager] 📞 Chamando callback local (final)');
      this.localCallback(textToProcess);
      return;
    }
    
    console.log('[SpeechManager] 📢 Notificando', this.listeners.size, 'listeners');
    this.listeners.forEach(listener => {
      try {
        listener(textToProcess);
      } catch (error) {
        console.error('[SpeechManager] Erro em listener:', error);
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
    
    if (now - this.lastEndTime < 500) {
      console.log('[SpeechManager] ⚠️ Evento end duplicado, ignorando');
      return;
    }
    this.lastEndTime = now;
    
    if (!this.isRecognizing) {
      console.log('[SpeechManager] ℹ️ End event mas não estava reconhecendo');
      return;
    }
    
    const wasGlobal = this.currentMode === 'global';
    
    this.isRecognizing = false;
    this.isInitializing = false;
    this.currentMode = null;
    this.localCallback = null;
    this.lastInterimText = '';
    
    if (this.isEnabled && !this.isSpeaking && wasGlobal && !this.intentionalStop) {
      console.log('[SpeechManager] 🔄 Agendando reinício automático');
      
      if (this.restartTimeout) {
        clearTimeout(this.restartTimeout);
      }
      
      this.restartTimeout = setTimeout(() => {
        if (this.isEnabled && !this.isSpeaking && !this.isRecognizing) {
          console.log('[SpeechManager] 🔄 Executando reinício automático');
          this.startRecognition('global');
        }
      }, 300);
    } else if (this.intentionalStop) {
      console.log('[SpeechManager] ℹ️ Parada intencional, não reiniciando');
      this.intentionalStop = false;
    }
  }
  
  handleError(error: string): void {
    const now = Date.now();
    if (now - this.lastErrorTime < 300) return;
    this.lastErrorTime = now;
    
    if (error === 'no-speech' || error === 'speech_timeout' || error === 'client') {
        console.log(`[SpeechManager] ⚠️ Erro não-fatal (${error}). Reiniciando silenciosamente...`);
        
        this.isRecognizing = false;
        this.isInitializing = false;
        this.lastInterimText = '';
        
        if (this.isEnabled && !this.isSpeaking && !this.intentionalStop) {
            setTimeout(() => this.startRecognition(this.currentMode || 'global'), 200);
        }
        return;
    }
    
    console.error('[SpeechManager] ❌ Erro Real:', error);
    this.consecutiveErrors++;
    this.isRecognizing = false;
    
    if (this.isEnabled && !this.isSpeaking) {
       const waitTime = Math.min(1000 * this.consecutiveErrors, 5000);
       setTimeout(() => this.startRecognition('global'), waitTime);
    }
  }
  
  enable(): void {
    console.log('[SpeechManager] ✅ Habilitando');
    this.isEnabled = true;
    this.consecutiveErrors = 0;
    
    setTimeout(() => {
      if (this.isEnabled && !this.isSpeaking && !this.isRecognizing && !this.isInitializing) {
        console.log('[SpeechManager] 🎤 Auto-iniciando reconhecimento');
        this.startRecognition('global');
      }
    }, 300);
  }
  
  disable(): void {
    console.log('[SpeechManager] ❌ Desabilitando');
    this.isEnabled = false;
    this.intentionalStop = true;
    this.consecutiveErrors = 0;
    this.lastInterimText = '';
    
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    
    if (this.interimTimeout) {
      clearTimeout(this.interimTimeout);
      this.interimTimeout = null;
    }
    
    if (this.isRecognizing || this.isInitializing) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (e) {
        console.error('[SpeechManager] Erro ao parar:', e);
      }
      this.isRecognizing = false;
      this.isInitializing = false;
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
      permissionGranted: this.permissionGranted,
      isInitializing: this.isInitializing,
      consecutiveErrors: this.consecutiveErrors,
    };
  }
  
  cleanup(): void {
    console.log('[SpeechManager] 🧹 Limpando recursos');
    
    if (this.startTimeout) clearTimeout(this.startTimeout);
    if (this.stopTimeout) clearTimeout(this.stopTimeout);
    if (this.restartTimeout) clearTimeout(this.restartTimeout);
    if (this.interimTimeout) clearTimeout(this.interimTimeout);
    
    this.subscriptions.forEach(sub => sub.remove());
    this.subscriptions = [];
    this.disable();
  }
}

export default SpeechManager.getInstance();