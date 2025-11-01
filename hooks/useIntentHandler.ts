import { useCallback, useRef, Dispatch, SetStateAction } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { IntentClassifierService } from '../assets/models/IntentClassifier';

type AppPath = '/tabs' | '/tabs/historico' | '/tabs/menu' | '/tabs/editarPerfil' | '/login';
export type VoiceState = 'waiting_wake' | 'listening_command' | 'waiting_confirmation';

interface UseIntentHandlerProps {
  speak: (text: string, onDone?: () => void) => void;
  temaAplicado: string;
  setTheme: (theme: 'light' | 'dark') => void;
  startListening: () => void;
  stopListening: () => void;
  setVoiceState: Dispatch<SetStateAction<VoiceState>>;
  setRecognizedText: (text: string) => void;
}

const tutoriais: Record<string, string> = {
  '/tabs/historico': 'Aqui você pode ver suas conversas salvas.',
  '/tabs/menu': 'Aqui você pode ver as páginas do aplicativo e ações',
  '/tabs/editarPerfil': 'Nesta tela você pode atualizar suas informações pessoais.',
  '/login': 'Diga entrar com google para usar seu gmail salvo no celular.',
  '/tabs': 'Para enviar uma foto, diga "Escute" e faça uma pergunta.',
};

export function useIntentHandler(props: UseIntentHandlerProps) {
  const { speak, temaAplicado, setTheme, startListening, stopListening, setVoiceState, setRecognizedText } = props;
  const router = useRouter();
  const pathname = usePathname();

  const isBusyRef = useRef(false);
  const lastProcessedCommandRef = useRef<string>('');
  const lastProcessedTimeRef = useRef(0);
  const lastNavigationRef = useRef<{ route: string; timestamp: number } | null>(null);
  const lastExecutedIntentRef = useRef<{ intent: string; timestamp: number } | null>(null);

  const restartListeningAfterSpeak = useCallback(() => {
    console.log("[Intent] Ação/Fala concluída, aguardando pequeno delay para reiniciar listener...");
    isBusyRef.current = false;
    setVoiceState("waiting_wake");
    setRecognizedText("");
    setTimeout(() => {
      console.log("[Intent] Reiniciando listener agora.");
      startListening();
    }, 300);
  }, [startListening, setVoiceState, setRecognizedText, isBusyRef]);
    
  const checkAndNavigate = useCallback((targetPath: AppPath, alreadyMessage: string) => {
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
    stopListening();
    let nomeTela = targetPath.split('/').pop() || 'tela inicial';
    if (nomeTela === 'historico') {
      nomeTela = 'histórico';
    } else if (nomeTela === 'menu') {
      nomeTela = 'mehnu'
    } else if (nomeTela === 'tabs') {
      nomeTela = 'câmera'
    }
    speak(`Indo para ${nomeTela || 'tela inicial'}...`, () => {
      console.log(`[Voice] Navigation speak finished. Navigating to ${targetPath}...`);
      router.push(targetPath);
      lastNavigationRef.current = { route: targetPath, timestamp: now };
      setTimeout(() => {
          console.log(`[Navigation] Attempting listener restart after navigating to ${targetPath}`);
          isBusyRef.current = false; 
          restartListeningAfterSpeak(); 
      }, 300);
    });
    return true;
  }, [pathname, router, speak, stopListening, restartListeningAfterSpeak, isBusyRef]);

  const executeIntent = useCallback((intent: string, originalText: string, setPendingSpokenText?: (text: string) => void, clearPending?: () => void) => {
    const now = Date.now();
    
    if (lastExecutedIntentRef.current?.intent === intent && now - lastExecutedIntentRef.current.timestamp < 5000) {
      console.log(`[Intent] Skipping duplicate execution of ${intent}`);
      stopListening();
      speak("Comando já executado recentemente.", restartListeningAfterSpeak);
      return;
    }
    lastExecutedIntentRef.current = { intent, timestamp: now };
    console.log(`[Intent] Executing: ${intent}`);

    switch (intent) {
        case 'tirar_foto':
            stopListening();
            
            // ✅ CORREÇÃO: Sempre reseta para waiting_wake antes de tirar foto
            console.log('[Intent] 🔄 Resetting voice state to waiting_wake');
            setVoiceState('waiting_wake');
            setRecognizedText('');
            isBusyRef.current = false;
            
            if (pathname === '/tabs' || pathname === '/tabs/') {
                if (setPendingSpokenText) setPendingSpokenText(originalText);
                console.log('[Intent] Already on camera, executing photo action');
            } else {
                if (setPendingSpokenText) setPendingSpokenText(originalText);
                const navigatedFoto = checkAndNavigate('/tabs', "Indo para a câmera.");
                if (!navigatedFoto) { 
                  // Já está na câmera, apenas reseta estado
                  setTimeout(() => {
                    startListening();
                  }, 300);
                }
            }
            return;

        case 'abrir_camera':
            if (clearPending) clearPending();
            const navigatedCamera = checkAndNavigate('/tabs', "Você já está na câmera.");
            if (!navigatedCamera) { restartListeningAfterSpeak(); }
            break;
        case 'ir_para_historico':
            const navigatedHistorico = checkAndNavigate('/tabs/historico', "Você já está no histórico.");
            if (!navigatedHistorico) { restartListeningAfterSpeak(); }
            break;
        case 'abrir_menu':
            const navigatedMenu = checkAndNavigate('/tabs/menu', "Você já está no menu.");
            if (!navigatedMenu) { restartListeningAfterSpeak(); }
            break;
        case 'ir_para_editar_perfil':
            const navigatedPerfil = checkAndNavigate('/tabs/editarPerfil', "Você já está editando o perfil.");
            if (!navigatedPerfil) { restartListeningAfterSpeak(); }
            break;
        case 'ir_para_login':
            const navigatedLogin = checkAndNavigate('/login', "Você já está na tela de login.");
            if (!navigatedLogin) { restartListeningAfterSpeak(); }
            break;

        case 'fazer_logout':
            stopListening();
            speak("Encerrando a sessão...", restartListeningAfterSpeak);
            return;
        case 'mudar_tema_claro':
            stopListening();
            if (temaAplicado === 'dark') { setTheme('light'); speak("Tema claro!", restartListeningAfterSpeak); }
            else { speak("O tema já está claro!", restartListeningAfterSpeak); }
            return;
        case 'mudar_tema_escuro':
            stopListening();
            if (temaAplicado === 'light') { setTheme('dark'); speak("Tema escuro!", restartListeningAfterSpeak); }
            else { speak("O tema já está escuro!", restartListeningAfterSpeak); }
            return;
        case 'tutorial':
            stopListening();
            speak("Mostrando o tutorial...", restartListeningAfterSpeak);
            return;
        case 'explicar_tela':
            const texto = tutoriais[pathname] || 'Este é o aplicativo...';
            stopListening();
            speak(texto, restartListeningAfterSpeak);
            return;
        case 'excluir_conta':
            stopListening();
            speak("Iniciando exclusão de conta...", restartListeningAfterSpeak);
            return;

        case 'cadastro':
            stopListening();
            router.push('/login');
            isBusyRef.current = false;
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
  }, [ temaAplicado, setTheme, startListening, stopListening, setVoiceState, setRecognizedText,
       router, pathname, speak, checkAndNavigate, restartListeningAfterSpeak, isBusyRef ]);

  const getIntentDisplayName = useCallback((intent: string): string => {
    const intentNames: { [key: string]: string } = {
      'tirar_foto': 'tirar uma foto',
      'abrir_camera': 'abrir a câmera',
      'ir_para_historico': 'ir para o histórico',
      'abrir_menu': 'abre o menu',
      'ir_para_editar_perfil': 'editar seu perfil',
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
  
  if (isBusyRef.current) {
    return console.log('[Voice] Busy, skipping command:', trimmedText);
  }

  lastProcessedCommandRef.current = trimmedText;
  lastProcessedTimeRef.current = now;
  isBusyRef.current = true;

  
try {
  if (voiceState === "waiting_wake") {
    const lowerText = trimmedText.toLowerCase();
    
    const wakePatterns = [
      /^escuta\b/,
      /\bescuta\b/,
      /^escute\b/,
      /\bescute\b/
    ];
    
    const isWakeWord = wakePatterns.some(pattern => pattern.test(lowerText));
    
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
    
    const isStopCommand = stopPatterns.some(pattern => pattern.test(lowerText));
    
    if (isWakeWord) {
      console.log('[Voice] ✅ Wake word detected:', trimmedText);
      stopCurrentAudio();
      stopListening();
      speak("Escutando", () => {
        setVoiceState("listening_command");
        setRecognizedText("");
        startListening();
        isBusyRef.current = false;
      });
    } else if (isStopCommand) {
      console.log('[Voice] 🛑 Stop command detected:', trimmedText);
      stopCurrentAudio();
      stopListening();
      isBusyRef.current = false;
    } else {
      console.log('[Voice] Ignoring non-command speech:', trimmedText);
      isBusyRef.current = false;
    }
  } else if (voiceState === "listening_command") {
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