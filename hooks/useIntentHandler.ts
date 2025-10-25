import { useCallback, useRef, Dispatch, SetStateAction } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { IntentClassifierService } from '../assets/models/IntentClassifier';

type AppPath = '/tabs' | '/tabs/historico' | '/tabs/menu' | '/tabs/editarPerfil' | '/login' | '/cadastro';
export type VoiceState = 'waiting_wake' | 'listening_command' | 'waiting_confirmation';

interface UseIntentHandlerProps {
  speak: (text: string) => void;
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

  const checkAndNavigate = useCallback((targetPath: AppPath, alreadyMessage: string) => {
    const now = Date.now();
    if (lastNavigationRef.current?.route === targetPath && now - lastNavigationRef.current.timestamp < 5000) {
      console.log(`[Voice] Skipping duplicate navigation to ${targetPath}`);
      speak(alreadyMessage);
      isBusyRef.current = false;
      return false;
    }

    if (pathname === targetPath) {
      speak(alreadyMessage);
      isBusyRef.current = false;
      return false;
    }

    router.push(targetPath);
    lastNavigationRef.current = { route: targetPath, timestamp: now };
    console.log(`[Voice] Navigated to ${targetPath}`);
    return true;
  }, [pathname, router, speak]);

  const executeIntent = useCallback((intent: string, originalText: string, setPendingSpokenText?: (text: string) => void, clearPending?: () => void) => {
    const now = Date.now();
    if (lastExecutedIntentRef.current?.intent === intent && now - lastExecutedIntentRef.current.timestamp < 5000) {
      console.log(`[Intent] Skipping duplicate execution of ${intent}`);
      speak("Comando já executado recentemente.");
      isBusyRef.current = false;
      return;
    }
    lastExecutedIntentRef.current = { intent, timestamp: now };
    console.log(`[Intent] Executing: ${intent}`);
    
    switch (intent) {
      case 'tirar_foto':
        // ✅ CORRIGIDO: Se já está na câmera, apenas executa a ação
        if (pathname === '/tabs' || pathname === '/tabs/') {
          if (setPendingSpokenText) setPendingSpokenText(originalText);
          console.log('[Intent] Already on camera, executing photo action');
          
          // ✅ CRÍTICO: Volta para waiting_wake e reinicia escuta
          stopListening();
          setTimeout(() => {
            setVoiceState("waiting_wake");
            setRecognizedText("");
            startListening();
            isBusyRef.current = false;
          }, 2000);
        } else {
          // Se não está na câmera, navega até ela
          if (setPendingSpokenText) setPendingSpokenText(originalText);
          const navigatedFoto = checkAndNavigate('/tabs', "Indo para a câmera.");
          if (!navigatedFoto) return;
          // Para navegação: reinicia escuta após delay
          setTimeout(() => {
            setVoiceState("waiting_wake");
            setRecognizedText("");
            startListening();
            isBusyRef.current = false;
          }, 3000);
        }
        return;
        
      case 'abrir_camera':
        if (clearPending) clearPending();
        const navigatedCamera = checkAndNavigate('/tabs', "Você já está na câmera.");
        if (!navigatedCamera) return;
        break;
        
      case 'ir_para_historico':
        const navigatedHistorico = checkAndNavigate('/tabs/historico', "Você já está no histórico.");
        if (!navigatedHistorico) return;
        break;
        
      case 'abrir_menu':
        const navigatedConfig = checkAndNavigate('/tabs/menu', "Você já está no menu.");
        if (!navigatedConfig) return;
        break;
        
      case 'ir_para_editar_perfil':
        const navigatedPerfil = checkAndNavigate('/tabs/editarPerfil', "Você já está editando o perfil.");
        if (!navigatedPerfil) return;
        break;
        
      case 'ir_para_login':
        const navigatedLogin = checkAndNavigate('/login', "Você já está na tela de login.");
        if (!navigatedLogin) return;
        break;
        
      case 'fazer_logout':
        speak("Encerrando a sessão...");
        setTimeout(() => { isBusyRef.current = false; }, 1000);
        return;
        
      case 'mudar_tema_claro':
        if (temaAplicado === 'dark') {
          setTheme('light');
          speak("Tema claro!");
        } else {
          speak("O tema já está claro!");
        }
        setTimeout(() => { isBusyRef.current = false; }, 1000);
        return;
        
      case 'mudar_tema_escuro':
        if (temaAplicado === 'light') {
          setTheme('dark');
          speak("Tema escuro!");
        } else {
          speak("O tema já está escuro!");
        }
        setTimeout(() => { isBusyRef.current = false; }, 1000);
        return;
        
      case 'tutorial':
        speak("Mostrando o tutorial...");
        setTimeout(() => { isBusyRef.current = false; }, 1000);
        return;
        
      case 'explicar_tela':
        const texto = tutoriais[pathname] || 'Este é o aplicativo. Use os botões ou comandos de voz para navegar.';
        speak(texto);
        setTimeout(() => { isBusyRef.current = false; }, 1000);
        return;
        
      case 'excluir_conta':
        speak("Iniciando exclusão de conta...");
        setTimeout(() => { isBusyRef.current = false; }, 1000);
        return;
        
      case 'cadastro':
        router.push('/cadastro');
        break;
        
      default:
        speak("Comando não reconhecido.");
        setTimeout(() => { isBusyRef.current = false; }, 1000);
        return;
    }

    // Para casos que navegam: reinicia escuta
    setTimeout(() => {
      setVoiceState("waiting_wake");
      setRecognizedText("");
      startListening();
      isBusyRef.current = false;
    }, 3000);
  }, [temaAplicado, router, pathname, setTheme, speak, startListening, checkAndNavigate, setVoiceState, setRecognizedText]);

  const getIntentDisplayName = (intent: string): string => {
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
  };

  const processCommand = useCallback((spokenText: string, voiceState: string, stopCurrentAudio: () => void, setPendingIntent: (intent: string) => void, setPendingOriginalText: (text: string) => void, setPendingSpokenText?: (text: string) => void, clearPending?: () => void) => {
    const now = Date.now();
    
    if (!spokenText.trim()) return;
    
    // Proteção contra duplicatas
    if (spokenText === lastProcessedCommandRef.current && (now - lastProcessedTimeRef.current < 2000)) {
      console.log('[Voice] Blocked near-duplicate:', spokenText);
      return;
    }

    // Proteção busy
    if (isBusyRef.current) {
      console.log('[Voice] Busy, skipping command:', spokenText);
      return;
    }

    lastProcessedCommandRef.current = spokenText;
    lastProcessedTimeRef.current = now;
    isBusyRef.current = true;

    try {
      if (voiceState === "waiting_wake") {
      const lowerText = spokenText.toLowerCase();
      
      // ✅ CORREÇÃO: Só interrompe áudio em comandos específicos
      if (lowerText.includes("escuta")) {
        stopCurrentAudio(); // ✅ Interrompe aqui
        stopListening();
        setVoiceState("listening_command");
        speak("Escutando...");
        setRecognizedText("");
        setTimeout(() => {
          startListening();
          isBusyRef.current = false;
        }, 1500);
      } else if (
        lowerText.includes("pare") ||
        lowerText.includes("parar") ||
        lowerText.includes("cala a boca") ||
        lowerText.includes("para")
      ) {
        stopCurrentAudio();
        stopListening();
        setTimeout(() => {
          startListening();
          isBusyRef.current = false;
        }, 1500);
      } else {
        // ✅ NOVO: Fala aleatória - NÃO interrompe áudio
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
          speak("Desculpe, não entendi.");
          setTimeout(() => {
            setVoiceState("waiting_wake");
            setRecognizedText("");
            startListening();
            isBusyRef.current = false;
          }, 2500);
        } else {
          executeIntent(prediction.intent, spokenText, setPendingSpokenText, clearPending);
        }
      }
    } catch (error) {
      console.error('[Voice] Error processing input:', error);
      speak("Erro ao processar comando.");
      stopListening();
      setTimeout(() => {
        setVoiceState("waiting_wake");
        setRecognizedText("");
        startListening();
        isBusyRef.current = false;
      }, 2000);
    }
  }, [speak, stopListening, startListening, setVoiceState, setRecognizedText, executeIntent]);

  return {
    executeIntent,
    getIntentDisplayName,
    processCommand,
    isBusyRef,
  };
}