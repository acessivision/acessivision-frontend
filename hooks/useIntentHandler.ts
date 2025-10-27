import { useCallback, useRef, Dispatch, SetStateAction } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { IntentClassifierService } from '../assets/models/IntentClassifier';

type AppPath = '/tabs' | '/tabs/historico' | '/tabs/menu' | '/tabs/editarPerfil' | '/login' | '/cadastro';
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
      startListening(); // Assumes startListening from props is stable
    }, 300);
  // Add ALL dependencies used inside
  }, [startListening, setVoiceState, setRecognizedText, isBusyRef]); // isBusyRef doesn't strictly need to be here but is fine
    
  const checkAndNavigate = useCallback((targetPath: AppPath, alreadyMessage: string) => {
    const now = Date.now();
    if (lastNavigationRef.current?.route === targetPath && now - lastNavigationRef.current.timestamp < 5000) {
      console.log(`[Voice] Skipping duplicate navigation to ${targetPath}`);
      stopListening();
      speak(alreadyMessage, restartListeningAfterSpeak); // Use the stable restart function
      return false;
    }
    if (pathname === targetPath || pathname === `${targetPath}/`) {
      stopListening();
      speak(alreadyMessage, restartListeningAfterSpeak); // Use the stable restart function
      return false;
    }
    stopListening();
    let nomeTela = targetPath.split('/').pop() || 'tela inicial';
    if (nomeTela === 'historico') {
      nomeTela = 'histórico';
    } else if (nomeTela === 'menu') {
      nomeTela = 'mehnu'
    }
    speak(`Indo para ${nomeTela || 'tela inicial'}...`, () => {
      console.log(`[Voice] Navigation speak finished. Navigating to ${targetPath}...`);
      router.push(targetPath);
      lastNavigationRef.current = { route: targetPath, timestamp: now };
      // Let focus change restart listener. Reset busy flag after delay.
      setTimeout(() => {
          console.log(`[Navigation] Attempting listener restart after navigating to ${targetPath}`);
          // Reset busy flag here
          isBusyRef.current = false; 
          // Call the standard restart function which resets state and starts listening
          // Ensure this function calls startListening() for the GLOBAL listener
          restartListeningAfterSpeak(); 
      }, 300);
    });
    return true;
  // Add ALL dependencies used inside
  }, [pathname, router, speak, stopListening, restartListeningAfterSpeak, isBusyRef]); // Added isBusyRef

  const executeIntent = useCallback((intent: string, originalText: string, setPendingSpokenText?: (text: string) => void, clearPending?: () => void) => {
    const now = Date.now();
    // Duplicate check (OK)
    if (lastExecutedIntentRef.current?.intent === intent && now - lastExecutedIntentRef.current.timestamp < 5000) {
      console.log(`[Intent] Skipping duplicate execution of ${intent}`);
      stopListening();
      speak("Comando já executado recentemente.", restartListeningAfterSpeak);
      return;
    }
    lastExecutedIntentRef.current = { intent, timestamp: now };
    console.log(`[Intent] Executing: ${intent}`);

    // Logic using stopListening, speak, checkAndNavigate, restartListeningAfterSpeak
    switch (intent) {
        case 'tirar_foto':
            stopListening();
            if (pathname === '/tabs' || pathname === '/tabs/') {
                if (setPendingSpokenText) setPendingSpokenText(originalText);
                console.log('[Intent] Already on camera, executing photo action');
                isBusyRef.current = false; // CameraScreen will handle its state
            } else {
                if (setPendingSpokenText) setPendingSpokenText(originalText);
                const navigatedFoto = checkAndNavigate('/tabs', "Indo para a câmera.");
                if (!navigatedFoto) { restartListeningAfterSpeak(); } // Restart if already there
            }
            return; // Exit function

        // --- Apply pattern: checkAndNavigate -> if (!navigated) restart; -> break ---
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

        // --- Apply pattern: stopListening -> speak(..., restart) -> return ---
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
            stopListening(); speak("Mostrando o tutorial...", restartListeningAfterSpeak); return;
        case 'explicar_tela':
            const texto = tutoriais[pathname] || 'Este é o aplicativo...';
            stopListening(); speak(texto, restartListeningAfterSpeak); return;
        case 'excluir_conta':
            stopListening(); speak("Iniciando exclusão de conta...", restartListeningAfterSpeak); return;

        // --- Handle navigation differently ---
        case 'cadastro':
            stopListening();
            router.push('/cadastro');
            // Rely on focus change to restart, but reset busy flag
            isBusyRef.current = false;
            break;

        default:
            stopListening();
            speak("Comando não reconhecido.", restartListeningAfterSpeak);
            return;
    }
    // If we reached here (likely via break after navigation), reset busy flag
    // isBusyRef.current = false; // Maybe reset in checkAndNavigate is enough
  // Add ALL dependencies used inside
  }, [ temaAplicado, setTheme, startListening, stopListening, setVoiceState, setRecognizedText, // Props
       router, pathname, // Hooks
       speak, checkAndNavigate, restartListeningAfterSpeak, // Stable functions from this hook/props
       isBusyRef, lastExecutedIntentRef, // Refs (don't strictly need to be deps, but okay)
       // State setters passed down (setPendingSpokenText, clearPending) - ensure they are stable if passed
       // setPendingSpokenText, clearPending // Assuming these come from stable sources (like useState setters)
     ]);

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
    if (!spokenText.trim()) return;
    if (spokenText === lastProcessedCommandRef.current && (now - lastProcessedTimeRef.current < 2000)) return console.log('[Voice] Blocked near-duplicate:', spokenText);
    if (isBusyRef.current) return console.log('[Voice] Busy, skipping command:', spokenText);

    lastProcessedCommandRef.current = spokenText;
    lastProcessedTimeRef.current = now;
    isBusyRef.current = true;

    try {
      if (voiceState === "waiting_wake") {
        const lowerText = spokenText.toLowerCase();
        if (lowerText.includes("escuta")) {
          stopCurrentAudio();
          stopListening();
          speak("Escutando", () => {
              setVoiceState("listening_command");
              setRecognizedText("");
              startListening();
              isBusyRef.current = false;
            });
        } else if (
          lowerText.includes("pare") || lowerText.includes("parar") || 
          lowerText.includes("cala a boca") || lowerText.includes("para")
        ) {
          stopCurrentAudio();
          stopListening();
          isBusyRef.current = false;
        } else {
          console.log('[Voice] Ignoring non-command speech:', spokenText);
          isBusyRef.current = false;
        }
      } else if (voiceState === "listening_command") {
          const prediction = IntentClassifierService.predictWithConfidence(spokenText);
          const confidencePercent = (prediction.confidence * 100).toFixed(0);
          console.log(`[Intent] "${spokenText}" -> ${prediction.intent} (${confidencePercent}%)`);
          setRecognizedText(spokenText);
          
          stopListening(); 

          if (prediction.notUnderstood) {
            speak("Desculpe, não entendi.", restartListeningAfterSpeak); 
          } else {
            executeIntent(prediction.intent, spokenText, setPendingSpokenText, clearPending);
          }
        }
    } catch (error) {
      console.error('[Voice] Error processing input:', error);
      stopListening();
      speak("Erro ao processar comando.", restartListeningAfterSpeak);
    }

  }, [speak, stopListening, startListening, setVoiceState, setRecognizedText, executeIntent, restartListeningAfterSpeak /*, stopCurrentAudio, etc */ ]);

  return {
    executeIntent,
    getIntentDisplayName,
    processCommand,
    isBusyRef,
  };
}