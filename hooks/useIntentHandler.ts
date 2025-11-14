// ===================================================================
// CORREÇÃO: useIntentHandler.ts - Navegação coordenada com TalkBack
// ===================================================================

import { useCallback, useRef, Dispatch, SetStateAction } from 'react';
import { useRouter, usePathname, Href } from 'expo-router';
import { AccessibilityInfo } from 'react-native';
import { IntentClassifierService } from '../assets/models/IntentClassifier';
import SpeechManager from '../utils/speechManager';

type AppPath = '/tabs' | '/tabs/historico' | '/tabs/menu' | '/login' | '/conversa';
export type VoiceState = 'waiting_wake' | 'listening_command' | 'waiting_confirmation';

interface UseIntentHandlerProps {
  speak: (text: string, onDone?: () => void) => void;
  temaAplicado: string;
  mudaTema?: () => void; 
  startListening: () => void;
  stopListening: () => void;
  setVoiceState: Dispatch<SetStateAction<VoiceState>>;
  setRecognizedText: (text: string) => void;
  onActivateMic?: () => void;
  onTakePhoto?: (question: string) => void;
  onOpenCamera?: () => void;
  setPendingContext?: (context: { mode?: string; conversaId?: string } | null) => void;
}

const tutoriais: Record<string, string> = {
  '/tabs/historico': 'Aqui você pode ver suas conversas salvas.',
  '/tabs/menu': 'Aqui você pode ver as páginas do aplicativo e ações',
  '/login': 'Diga entrar com google para usar seu gmail salvo no celular.',
  '/tabs': 'Para enviar uma foto, diga "Escute" e faça uma pergunta.',
  '/conversa': 'Nesta tela você pode conversar sobre fotos. Diga "ativar microfone" para fazer perguntas por voz.',
};

export function useIntentHandler(props: UseIntentHandlerProps) {
  const { 
    speak, 
    temaAplicado, 
    mudaTema,
    startListening, 
    stopListening, 
    setVoiceState, 
    setRecognizedText,
    onActivateMic,
    onTakePhoto,
    onOpenCamera,
    setPendingContext,
  } = props;
  
  const router = useRouter();
  const pathname = usePathname();

  const isBusyRef = useRef(false);
  const lastProcessedCommandRef = useRef<string>('');
  const lastProcessedTimeRef = useRef(0);
  const lastNavigationRef = useRef<{ route: string; timestamp: number } | null>(null);
  const lastExecutedIntentRef = useRef<{ intent: string; timestamp: number } | null>(null);

  // ✅ NOVO: Verifica se TalkBack está ativo
  const checkTalkBackActive = useCallback(async () => {
    try {
      return await AccessibilityInfo.isScreenReaderEnabled();
    } catch {
      return false;
    }
  }, []);

  // ✅ MODIFICADO: Reinicia listener com delay adaptativo
  const restartListeningAfterSpeak = useCallback(async () => {
    console.log("[Intent] Ação/Fala concluída, verificando TalkBack...");
    isBusyRef.current = false;
    setVoiceState("waiting_wake");
    setRecognizedText("");
    
    const isTalkBackActive = await checkTalkBackActive();
    const delay = isTalkBackActive ? 1500 : 800; // ✅ Reduzido: 1.5s com TalkBack
    
    console.log(`[Intent] TalkBack: ${isTalkBackActive ? 'ATIVO' : 'INATIVO'}, delay: ${delay}ms`);
    
    setTimeout(() => {
      console.log("[Intent] Reiniciando listener agora.");
      startListening();
    }, delay);
  }, [startListening, setVoiceState, setRecognizedText, isBusyRef, checkTalkBackActive]);
    
  // ✅ MODIFICADO: Navegação coordenada com TalkBack
  const checkAndNavigate = useCallback(async (targetPath: AppPath, alreadyMessage: string) => {
    const now = Date.now();
    
    if (lastNavigationRef.current?.route === targetPath && now - lastNavigationRef.current.timestamp < 5000) {
      console.log(`[Voice] Skipping duplicate navigation to ${targetPath}`);
      stopListening();
      speak(alreadyMessage, restartListeningAfterSpeak);
      return false;
    }
    
    if (pathname === targetPath || pathname === `${targetPath}/`) {
      stopListening();
      speak(alreadyMessage, restartListeningAfterSpeak);
      return false;
    }
    
    console.log(`[Voice] 🚀 Iniciando navegação para ${targetPath}`);
    
    // ✅ 1. Para TUDO antes de navegar
    console.log('[Voice] 🔇 Desabilitando reconhecimento COMPLETAMENTE');
    SpeechManager.disable();
    stopListening();
    
    // ✅ 2. Verifica se TalkBack está ativo
    const isTalkBackActive = await checkTalkBackActive();
    console.log(`[Voice] TalkBack status: ${isTalkBackActive ? 'ATIVO' : 'INATIVO'}`);
    
    // ✅ 3. Navega
    router.push(targetPath as Href);
    lastNavigationRef.current = { route: targetPath, timestamp: now };
    
    // ✅ 4. Aguarda navegação + renderização
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // ✅ 5. Aguarda TalkBack anunciar (se ativo)
    if (isTalkBackActive) {
      console.log('[Voice] ⏳ Aguardando TalkBack anunciar título...');
      await new Promise(resolve => setTimeout(resolve, 3000)); // ✅ 3 segundos (reduzido de 5s)
    } else {
      console.log('[Voice] ⏭️ TalkBack inativo, delay reduzido');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // ✅ 6. Reativa reconhecimento
    console.log('[Voice] ✅ Reativando reconhecimento');
    isBusyRef.current = false;
    setVoiceState("waiting_wake");
    setRecognizedText("");
    SpeechManager.enable();
    
    return true;
  }, [pathname, router, speak, stopListening, restartListeningAfterSpeak, isBusyRef, setVoiceState, setRecognizedText, checkTalkBackActive]);

  const executeIntent = useCallback(async (intent: string, originalText: string, setPendingSpokenText?: (text: string) => void, clearPending?: () => void) => {
    const now = Date.now();
    
    if (lastExecutedIntentRef.current?.intent === intent && now - lastExecutedIntentRef.current.timestamp < 5000) {
      console.log(`[Intent] Skipping duplicate execution of ${intent}`);
      stopListening();
      speak("Comando já executado recentemente.", restartListeningAfterSpeak);
      return;
    }
    lastExecutedIntentRef.current = { intent, timestamp: now };
    console.log(`[Intent] Executing: ${intent}`);

    let currentConversaId: string | undefined;
    if (pathname.startsWith('/conversa')) {
      const match = pathname.match(/conversaId=([^&]+)/);
      if (match) {
        currentConversaId = match[1];
      }
    }

    // ATIVAR MICROFONE
    if (intent === 'ativar_microfone') {
      stopListening();
      
      if (pathname.startsWith('/conversa')) {
        console.log('[Intent] 🎤 Ativando microfone na conversa');
        if (onActivateMic) {
          speak("Microfone ativado.", () => {
            onActivateMic();
            restartListeningAfterSpeak();
          });
        } else {
          speak("Microfone ativado.", restartListeningAfterSpeak);
        }
      } else {
        speak("O microfone só pode ser ativado na tela de conversa.", restartListeningAfterSpeak);
      }
      return;
    }

    // TIRAR FOTO
    if (intent === 'tirar_foto') {
      stopListening();
      
      setVoiceState('waiting_wake');
      setRecognizedText('');
      isBusyRef.current = false;
      
      if (pathname.startsWith('/conversa') && onTakePhoto) {
        console.log('[Intent] 📸 Tirando foto na conversa com pergunta');
        onTakePhoto(originalText);
      } 
      else if (pathname === '/tabs' || pathname === '/tabs/') {
        if (setPendingSpokenText) setPendingSpokenText(originalText);
        console.log('[Intent] Already on camera, executing photo action');
      } 
      else {
        if (setPendingSpokenText) setPendingSpokenText(originalText);
        const navigated = await checkAndNavigate('/tabs', "Indo para a câmera.");
        if (!navigated) { 
          setTimeout(() => {
            startListening();
          }, 1500);
        }
      }
      return;
    }

    // ABRIR CÂMERA
    if (intent === 'abrir_camera') {
      if (pathname.startsWith('/conversa') && onOpenCamera) {
        console.log('[Intent] 📷 Abrindo câmera na conversa (sem tirar foto)');
        stopListening();
        onOpenCamera();
        return;
      }
      
      if (clearPending) clearPending();
      await checkAndNavigate('/tabs', "Você já está na câmera.");
      return;
    }

    // OUTROS INTENTS COM NAVEGAÇÃO
    switch (intent) {
      case 'ir_para_historico':
        await checkAndNavigate('/tabs/historico', "Você já está no histórico.");
        break;
        
      case 'abrir_menu':
        await checkAndNavigate('/tabs/menu', "Você já está no menu.");
        break;
        
      case 'ir_para_login':
        await checkAndNavigate('/login', "Você já está na tela de login.");
        break;

      case 'fazer_logout':
        stopListening();
        speak("Encerrando a sessão...", restartListeningAfterSpeak);
        return;

      case 'mudar_tema_claro':
        stopListening();
        console.log(`[Theme] Current theme: ${temaAplicado}, requested: claro`);
        
        if (temaAplicado === 'dark') { 
          console.log('[Theme] Changing from dark to light');
          if (mudaTema) mudaTema();
          speak("Tema claro ativado!", restartListeningAfterSpeak); 
        }
        else { 
          console.log('[Theme] Already in light theme');
          speak("O tema já está claro!", restartListeningAfterSpeak); 
        }
        return;

      case 'mudar_tema_escuro':
        stopListening();
        console.log(`[Theme] Current theme: ${temaAplicado}, requested: escuro`);
        
        if (temaAplicado === 'light') { 
          console.log('[Theme] Changing from light to dark');
          if (mudaTema) mudaTema();
          speak("Tema escuro ativado!", restartListeningAfterSpeak); 
        }
        else { 
          console.log('[Theme] Already in dark theme');
          speak("O tema já está escuro!", restartListeningAfterSpeak); 
        }
        return;

      case 'tutorial':
        stopListening();
        speak("Mostrando o tutorial...", restartListeningAfterSpeak);
        return;
        
      case 'explicar_tela':
        const texto = tutoriais[pathname] || tutoriais['/conversa'] || 'Este é o aplicativo...';
        stopListening();
        speak(texto, restartListeningAfterSpeak);
        return;
        
      case 'excluir_conta':
        stopListening();
        speak("Iniciando exclusão de conta...", restartListeningAfterSpeak);
        return;

      case 'cadastro':
        stopListening();
        await checkAndNavigate('/login', "Você já está na tela de login.");
        break;
        
      case 'cancelar_assinatura':
        stopListening();
        speak('Cancelamento de assinatura ainda não implementado', restartListeningAfterSpeak);
        return;

      default:
        stopListening();
        speak("Comando não reconhecido.", restartListeningAfterSpeak);
        return;
    }
  }, [ 
    temaAplicado, 
    mudaTema, 
    startListening, 
    stopListening, 
    setVoiceState, 
    setRecognizedText,
    router, 
    pathname, 
    speak, 
    checkAndNavigate, 
    restartListeningAfterSpeak, 
    isBusyRef,
    onActivateMic, 
    onTakePhoto, 
    onOpenCamera 
  ]);

  const getIntentDisplayName = useCallback((intent: string): string => {
    const intentNames: { [key: string]: string } = {
      'tirar_foto': 'tirar uma foto',
      'abrir_camera': 'abrir a câmera',
      'ativar_microfone': 'ativar o microfone',
      'ir_para_historico': 'ir para o histórico',
      'abrir_menu': 'abre o menu',
      'ir_para_login': 'ir para a tela de login',
      'fazer_logout': 'sair da sua conta',
      'mudar_tema_claro': 'mudar para o tema claro',
      'mudar_tema_escuro': 'mudar para o tema escuro',
      'tutorial': 'pedir ajuda ou ver o tutorial',
      'explicar_tela': 'pedir uma explicação da tela atual',
      'cadastro': 'criar uma nova conta',
    };
    return intentNames[intent] || intent;
  }, []);

  const processCommand = useCallback((
    spokenText: string, 
    voiceState: string,
    stopCurrentAudio: () => void, 
    setPendingIntent: (intent: string) => void, 
    setPendingOriginalText: (text: string) => void, 
    setPendingSpokenText?: (text: string) => void, 
    clearPending?: () => void
  ) => {
    const now = Date.now();
    const trimmedText = spokenText.trim();
    
    if (!trimmedText) return;
    
    if (trimmedText === lastProcessedCommandRef.current && (now - lastProcessedTimeRef.current < 2000)) {
      return console.log('[Voice] Blocked near-duplicate:', trimmedText);
    }

    const lowerText = trimmedText.toLowerCase();
    
    const wakePatterns = [
      /^escuta\b/,
      /\bescuta\b/,
      /^escute\b/,
      /\bescute\b/
    ];
    
    const stopPatterns = [
      /^pare\b/,
      /^parar\b/,
      /^cala a boca\b/,
      /\bpare de\b/,
      /\bpara de\b/,
      /\bpara aí\b/,
      /\bpara já\b/,
      /\bcala a boca\b/,
      /^silêncio\b/,
      /^quieto\b/
    ];
    
    const isWakeWord = wakePatterns.some(pattern => pattern.test(lowerText));
    const isStopCommand = stopPatterns.some(pattern => pattern.test(lowerText));
    
    if (isWakeWord) {
      console.log('[Voice] ✅ Wake word detected:', trimmedText);
      lastProcessedCommandRef.current = trimmedText;
      lastProcessedTimeRef.current = now;
      
      if (voiceState === "listening_command") {
        console.log('[Voice] ⚠️ Wake word in listening_command - resetting to waiting_wake');
        stopCurrentAudio();
        stopListening();
        isBusyRef.current = false;
        
        setTimeout(() => {
          setVoiceState("waiting_wake");
          setRecognizedText("");
          startListening();
        }, 1000);
        return;
      }
      
      if (voiceState === "waiting_wake") {
        stopCurrentAudio();
        stopListening();
        speak("Escutando", () => {
          setVoiceState("listening_command");
          setRecognizedText("");
          startListening();
          isBusyRef.current = false;
        });
        return;
      }
    }
    
    if (isStopCommand) {
      console.log('[Voice] 🛑 Stop command detected:', trimmedText);
      lastProcessedCommandRef.current = trimmedText;
      lastProcessedTimeRef.current = now;
      stopCurrentAudio();
      stopListening();
      isBusyRef.current = false;
      
      setTimeout(() => {
        setVoiceState("waiting_wake");
        setRecognizedText("");
        startListening();
      }, 500);
      return;
    }
    
    if (isBusyRef.current) {
      return console.log('[Voice] Busy, skipping command:', trimmedText);
    }

    lastProcessedCommandRef.current = trimmedText;
    lastProcessedTimeRef.current = now;
    isBusyRef.current = true;

    try {
      if (voiceState === "waiting_wake") {
        console.log('[Voice] Ignoring non-command speech:', trimmedText);
        isBusyRef.current = false;
      } 
      else if (voiceState === "listening_command") {
        const prediction = IntentClassifierService.predictWithConfidence(trimmedText);
        const confidencePercent = (prediction.confidence * 100).toFixed(0);
        console.log(`[Intent] "${trimmedText}" -> ${prediction.intent} (${confidencePercent}%)`);
        setRecognizedText(trimmedText);
        
        stopListening(); 

        if (prediction.notUnderstood) {
          speak("Desculpe, não entendi.", restartListeningAfterSpeak); 
        } else {
          executeIntent(prediction.intent, trimmedText, setPendingSpokenText, clearPending);
        }
      }
    } catch (error) {
      console.error('[Voice] Error processing input:', error);
      stopListening();
      speak("Erro ao processar comando.", restartListeningAfterSpeak);
    }

  }, [speak, stopListening, startListening, setVoiceState, setRecognizedText, executeIntent, restartListeningAfterSpeak]);

  return {
    executeIntent,
    getIntentDisplayName,
    processCommand,
    isBusyRef,
  };
}