// SpeechManager.ts - MANTÉM microfone ativo enquanto fala
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

  private talkBackSpeakingCallback: ((isSpeaking: boolean) => void) | null = null;
  
  // ✅ NOVO: Registrar callback para notificar quando TalkBack fala
  setTalkBackSpeakingCallback(callback: (isSpeaking: boolean) => void) {
    this.talkBackSpeakingCallback = callback;
  }
  
  // ============================================
  // TTS (Text-to-Speech)
  // ============================================
  async speak(text: string, callback?: () => void, pauseRecognition: boolean = true): Promise<void> {
    console.log('[SpeechManager] 🔊 Speaking:', text, 'pauseRecognition:', pauseRecognition);
    
    const normalizedText = text.toLowerCase().trim();
    this.lastSpokenText = normalizedText;
    this.recentlySpoken.add(normalizedText);
    
    // ✅ ADICIONA VARIAÇÕES COMUNS para proteção extra contra eco
    const variations = [
      normalizedText,
      normalizedText.replace(/\s+/g, ''), // sem espaços
      ...normalizedText.split(' '), // palavras individuais
    ];
    
    variations.forEach(v => {
      if (v.length > 2) { // Apenas palavras com 3+ caracteres
        this.recentlySpoken.add(v);
      }
    });
    
    console.log('[SpeechManager] 🛡️ Proteção de eco ativa para:', Array.from(this.recentlySpoken));
    
    // ✅ CONDICIONAL: Só pausa o reconhecimento se pauseRecognition === true
    const wasRecognizing = this.isRecognizing;
    if (pauseRecognition && this.isRecognizing) {
      console.log('[SpeechManager] ⏸️ Pausando reconhecimento para falar');
      await this.stopRecognition();
    } else if (!pauseRecognition) {
      console.log('[SpeechManager] 🎤 Mantendo reconhecimento ATIVO durante fala');
    }
    
    this.isSpeaking = true;
    
    // ✅ Notifica que está falando
    if (this.talkBackSpeakingCallback) {
      this.talkBackSpeakingCallback(true);
    }
    
    let callbackFired = false;
    let cleanupTimeout: ReturnType<typeof setTimeout> | null = null;
    
    const handleSpeechComplete = () => {
      if (callbackFired) return;
      callbackFired = true;
      
      console.log('[SpeechManager] ✅ Speech finished');
      this.isSpeaking = false;
      
      // ✅ Notifica que parou de falar
      if (this.talkBackSpeakingCallback) {
        this.talkBackSpeakingCallback(false);
      }
      
      if (cleanupTimeout) clearTimeout(cleanupTimeout);
      
      // ✅ REATIVA IMEDIATAMENTE se pausou o reconhecimento
      if (pauseRecognition && wasRecognizing && this.isEnabled) {
        console.log('[SpeechManager] ▶️ Retomando reconhecimento IMEDIATAMENTE após fala');
        this.startRecognition('global');
      }
      
      if (normalizedText.length <= 15) { 
          console.log('[SpeechManager] ⏳ Agendando limpeza RÁPIDA de eco (500ms) para frase curta');
          
          cleanupTimeout = setTimeout(() => {
            variations.forEach(v => this.recentlySpoken.delete(v));
            this.lastSpokenText = null;
            console.log('[SpeechManager] 🧹 Cache de eco LIMPO (frase curta)');
          }, 500); // 500ms é o "sweet spot"

      } else {
          // ✅ Mantém a limpeza em background para frases mais longas
          const ecoCacheTime = normalizedText.length <= 10 ? 1500 : 800;
          console.log(`[SpeechManager] 🛡️ Cache de eco ativo por ${ecoCacheTime}ms (frase longa)`);
          
          cleanupTimeout = setTimeout(() => {
            variations.forEach(v => this.recentlySpoken.delete(v));
            this.lastSpokenText = null;
            console.log('[SpeechManager] 🧹 Cache de eco limpo');
          }, ecoCacheTime);
      }
      
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
            console.log('[SpeechManager] 🛑 Speech stopped');
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
            console.log('[SpeechManager] ❌ Speech error');
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

  // ✅ Método para parar TTS
  stopSpeaking(): void {
    Speech.stop();
    this.isSpeaking = false;
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
    
    // ✅ REMOVIDO: Não verifica mais se está falando
    // O reconhecimento pode ficar ativo mesmo durante fala
    
    // Limpa timeout pendente
    if (this.startTimeout) {
      clearTimeout(this.startTimeout);
      this.startTimeout = null;
    }
    
    // ✅ Se já está reconhecendo, não faz nada
    if (this.isRecognizing) {
      console.log('[SpeechManager] ✅ Already recognizing, skipping restart');
      return;
    }
    
    this.currentMode = mode;
    if (mode === 'local' && callback) {
      this.localCallback = callback;
    }
    
    // Debounce mínimo para evitar múltiplas chamadas simultâneas
    this.startTimeout = setTimeout(async () => {
      try {
        console.log(`[SpeechManager] 🎤 Starting recognition (${mode} mode)`);
        
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
    }, 10);
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
        this.currentMode = null;
        this.localCallback = null;
      } catch (error) {
        console.error('[SpeechManager] Stop error:', error);
      }
    }, 50);
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
    
    // ✅ 1. Prevenção de duplicatas do motor de voz (Mantenha curto, ex: 1500ms)
    if (this.lastProcessedResult === normalizedText && (now - this.lastProcessedTime) < 1500) {
      console.log('[SpeechManager] 🔇 IGNORANDO DUPLICATA:', text);
      return;
    }
    
    // Atualiza rastreamento
    this.lastProcessedResult = normalizedText;
    this.lastProcessedTime = now;
    
    // ====================================================================
    // 🚨 AQUI ESTÁ A MUDANÇA LÓGICA PEDIDA
    // ====================================================================

    // ✅ CASO ESPECIAL: O termo exato "escutando" (ignora se for SÓ ISSO)
    if (normalizedText === 'escutando' || normalizedText === 'escutando.') {
       console.log('[SpeechManager] 🔇 IGNORANDO PROMPT DO SISTEMA (Exato):', normalizedText);
       return;
    }

    // ✅ 2. Verifica se a frase INTEIRA já foi falada recentemente (Eco Exato)
    // Se o sistema disse "Desculpe não entendi" e o microfone ouve "Desculpe não entendi", ele bloqueia.
    if (this.recentlySpoken.has(normalizedText)) {
      console.log('[SpeechManager] 🔇 IGNORANDO ECO EXATO:', text);
      return;
    }
    
    // ❌ REMOVIDO: O bloco "THIRD" que verificava palavra por palavra.
    // Isso causava o bug: se você dissesse "Escutando música", ele achava "Escutando"
    // na lista negra e bloqueava tudo. Ao remover isso, resolvemos o problema.

    // ✅ 3. Verifica similaridade APENAS se a frase for curta (para evitar falsos positivos)
    if (this.lastSpokenText && normalizedText.length < 20) {
      const similarity = this.calculateSimilarity(normalizedText, this.lastSpokenText);
      // Se for 90% igual ao que o robô acabou de falar, ignoramos.
      if (similarity > 0.9) { 
        console.log('[SpeechManager] 🔇 IGNORANDO ECO MUITO SIMILAR:', text);
        return;
      }
    }
    
    console.log('[SpeechManager] ✅ Result (Aceito):', text, 'Mode:', this.currentMode);
    
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
      }, 200); // ✅ REDUZIDO: De 300ms para 200ms
    }
  }
  
  handleError(error: string): void {
    const now = Date.now();
    
    // ✅ Prevent duplicate error events within 200ms
    if (now - this.lastErrorTime < 200) {
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
      const delay = error === 'no-speech' ? 500 : 500; // ✅ REDUZIDO: De 1000ms para 500ms
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
    
    if (!this.isSpeaking && !this.isRecognizing) {
      console.log('[SpeechManager] 🎤 Starting recognition on enable()');
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