import { useCallback, useRef, Dispatch, SetStateAction } from 'react';
import { useRouter, usePathname, Href } from 'expo-router';
import { AccessibilityInfo } from 'react-native';
import { IntentClassifierService } from '../assets/models/IntentClassifier';
import { useAuth } from '../components/AuthContext';
import { tutoriaisDasTelas, tutorialGeral } from '../utils/tutoriais';
import { useTutorial } from '../components/TutorialContext';
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
  onSendAudio?: () => void;
  setPendingContext?: (context: { mode?: string; conversaId?: string } | null) => void;
}

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
    onSendAudio,
    setPendingContext,
  } = props;
  
  const router = useRouter();
  const pathname = usePathname();
  const { reproduzirTutorial } = useTutorial();
  const isBusyRef = useRef(false);
  const lastProcessedCommandRef = useRef<string>('');
  const lastProcessedTimeRef = useRef(0);
  const lastNavigationRef = useRef<{ route: string; timestamp: number } | null>(null);
  const lastExecutedIntentRef = useRef<{ intent: string; timestamp: number } | null>(null);
  const { user, logout } = useAuth();
  

  const checkTalkBackActive = useCallback(async () => {
    try {
      return await AccessibilityInfo.isScreenReaderEnabled();
    } catch {
      return false;
    }
  }, []);

  const restartListeningAfterSpeak = useCallback(async () => {
    console.log("[Intent] Ação/Fala concluída, retornando ao estado waiting_wake...");
    isBusyRef.current = false;
    setVoiceState("waiting_wake");
    setRecognizedText("");
    
    console.log("[Intent] Listener continua ativo em background.");
  }, [setVoiceState, setRecognizedText, isBusyRef]);
    
  const checkAndNavigate = useCallback(async (targetPath: AppPath, alreadyMessage: string) => {
    const now = Date.now();
    
    if (lastNavigationRef.current?.route === targetPath && now - lastNavigationRef.current.timestamp < 5000) {
      console.log(`[Voice] Skipping duplicate navigation to ${targetPath}`);
      speak(alreadyMessage, restartListeningAfterSpeak);
      return false;
    }
    
    if (pathname === targetPath || pathname === `${targetPath}/`) {
      speak(alreadyMessage, restartListeningAfterSpeak);
      return false;
    }
    
    console.log(`[Voice] 🚀 Iniciando navegação para ${targetPath}`);
    
    const isTalkBackActive = await checkTalkBackActive();
    console.log(`[Voice] TalkBack status: ${isTalkBackActive ? 'ATIVO' : 'INATIVO'}`);
    
    router.push(targetPath as Href);
    lastNavigationRef.current = { route: targetPath, timestamp: now };
    
    if (isTalkBackActive) {
      console.log('[Voice] ⏳ Aguardando navegação e anúncio do TalkBack...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      await new Promise(resolve => setTimeout(resolve, 600));
    }
    
    console.log('[Voice] ✅ Navegação concluída, retornando ao estado waiting_wake');
    isBusyRef.current = false;
    setVoiceState("waiting_wake");
    setRecognizedText("");
    
    return true;
  }, [pathname, router, speak, restartListeningAfterSpeak, isBusyRef, setVoiceState, setRecognizedText, checkTalkBackActive]);

  const executeIntent = useCallback(async (intent: string, originalText: string, setPendingSpokenText?: (text: string) => void, clearPending?: () => void) => {
    const now = Date.now();
    
    if (lastExecutedIntentRef.current?.intent === intent && now - lastExecutedIntentRef.current.timestamp < 5000) {
      console.log(`[Intent] Skipping duplicate execution of ${intent}`);
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

    if (intent === 'enviar_audio') {
      if (pathname.startsWith('/conversa')) {
        console.log('[Intent] 🎙️ Ativando microfone para enviar áudio na conversa');
        if (onSendAudio) {
          speak("Ativando microfone para gravar mensagem.", () => {
            onSendAudio();
            restartListeningAfterSpeak();
          });
        } else {
          speak("Microfone ativado.", restartListeningAfterSpeak);
        }
      } else {
        speak("O envio de áudio só pode ser feito na tela de conversa.", restartListeningAfterSpeak);
      }
      return;
    }

    if (intent === 'ativar_microfone') {
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

    if (intent === 'tirar_foto') {
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
      }
      return;
    }

    if (intent === 'abrir_camera') {
      if (pathname.startsWith('/conversa') && onOpenCamera) {
        console.log('[Intent] 📷 Abrindo câmera na conversa (sem tirar foto)');
        onOpenCamera();
        return;
      }
      
      if (clearPending) clearPending();
      await checkAndNavigate('/tabs', "Você já está na câmera.");
      return;
    }

    switch (intent) {
      case 'ir_para_historico':
        await checkAndNavigate('/tabs/historico', "Você já está no histórico.");
        break;
        
      case 'abrir_menu':
        await checkAndNavigate('/tabs/menu', "Você já está no menu.");
        break;
        
      case 'ir_para_login':
        user ? speak(`Você já está logado como: ${user.email || 'usuário'}.`, restartListeningAfterSpeak) : await checkAndNavigate('/login', "Você já está na tela de login.");
        break;

      case 'fazer_logout':
        speak("Encerrando a sessão...", async () => {
          await logout();
          router.replace('/login');
          restartListeningAfterSpeak();
        });
        return;

      case 'mudar_tema_claro':
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
        console.log('[Intent] 📚 Iniciando tutorial geral');
        
        SpeechManager.disable();
        console.log('[Intent] 🔇 Microfone DESABILITADO para tutorial');
        
        isBusyRef.current = false;
        setVoiceState("waiting_wake");
        setRecognizedText("");
        
        reproduzirTutorial(tutorialGeral);
        return;
        
      case 'explicar_tela':
        const lowerText = originalText.toLowerCase();
        
        let targetPath: AppPath | null = null;
        let textoTutorial = '';

        if (lowerText.includes('histórico') || lowerText.includes('historico')) {
          targetPath = '/tabs/historico';
        } 
        else if (lowerText.includes('menu') || lowerText.includes('configurações')) {
          targetPath = '/tabs/menu';
        } 
        else if (lowerText.includes('câmera') || lowerText.includes('camera') || lowerText.includes('inicio') || lowerText.includes('início')) {
          targetPath = '/tabs';
        }

        if (targetPath && pathname !== targetPath) {
          console.log(`[Tutorial] Navegando para ${targetPath} antes de explicar.`);
          
          SpeechManager.disable();
          console.log('[Intent] 🔇 Microfone DESABILITADO antes de navegar para tutorial');
          
          isBusyRef.current = false;
          setVoiceState("waiting_wake");
          setRecognizedText("");
          
          const navigated = await checkAndNavigate(
            targetPath, 
            `Você já está ${targetPath === '/tabs/historico' ? 'no histórico' : targetPath === '/tabs/menu' ? 'no menu' : 'na câmera'}.`
          );
          
          if (!navigated) {
            textoTutorial = tutoriaisDasTelas[pathname] || tutorialGeral;
            reproduzirTutorial(textoTutorial);
            return;
          }
          
          await new Promise(resolve => setTimeout(resolve, 800));
          
          textoTutorial = tutoriaisDasTelas[targetPath] || tutorialGeral;
        } 
        else {
          console.log('[Tutorial] Explicando tela atual.');
          
          SpeechManager.disable();
          console.log('[Intent] 🔇 Microfone DESABILITADO para tutorial de tela');
          
          isBusyRef.current = false;
          setVoiceState("waiting_wake");
          setRecognizedText("");
          
          textoTutorial = tutoriaisDasTelas[pathname] || tutoriaisDasTelas['/conversa'] || tutorialGeral;
        }
        
        reproduzirTutorial(textoTutorial);
        return;
        
      case 'excluir_conta':
        if (!user) {
          speak("Você precisa estar logado para excluir sua conta.", restartListeningAfterSpeak);
          return;
        }
        
        if (pathname === '/tabs/menu' || pathname === '/tabs/menu/') {
          console.log('[Intent] Já está no menu, enviando intent pendente');
          if (setPendingContext) {
            setPendingContext({ mode: 'excluir_conta' });
          }
          speak("Abrindo confirmação de exclusão de conta.", restartListeningAfterSpeak);
        } else {
          console.log('[Intent] Navegando para menu para excluir conta');
          if (setPendingContext) {
            setPendingContext({ mode: 'excluir_conta' });
          }
          await checkAndNavigate('/tabs/menu', "Indo para o menu.");
        }
        return;

      case 'cadastro':
        await checkAndNavigate('/login', "Você já está na tela de login.");
        break;
        
      case 'cancelar_assinatura':
        speak('Cancelamento de assinatura ainda não implementado', restartListeningAfterSpeak);
        return;

      default:
        speak("Comando não reconhecido.", restartListeningAfterSpeak);
        return;
    }
  }, [ 
    temaAplicado, 
    mudaTema, 
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
    onOpenCamera,
    onSendAudio,
    user,
    logout,
    reproduzirTutorial
  ]);

  const getIntentDisplayName = useCallback((intent: string): string => {
    const intentNames: { [key: string]: string } = {
      'enviar_audio': 'enviar uma mensagem de áudio',
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
    stopCurrentAudio?: () => void, 
    setPendingIntent?: (intent: string) => void, 
    setPendingOriginalText?: (text: string) => void, 
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
      /^para\b/,
      /^pare\b/,
      /^parar\b/,
      /^cala a boca\b/,
      /^silêncio\b/,
      /^quieto\b/
    ];

    const backPatterns = [
      /^voltar\b/,
      /^volta\b/,
      /^retornar\b/,
      /^retorna\b/,
      /\bvoltar\b/,
      /\bvolta\b/
    ];
    
    const isWakeWord = wakePatterns.some(pattern => pattern.test(lowerText));
    const isStopCommand = stopPatterns.some(pattern => pattern.test(lowerText));
    const isBackCommand = backPatterns.some(pattern => pattern.test(lowerText));
    
    if (isWakeWord) {
      console.log('[Voice] ✅ Wake word detected:', trimmedText);
      lastProcessedCommandRef.current = trimmedText;
      lastProcessedTimeRef.current = now;
      
      if (voiceState === "listening_command") {
        console.log('[Voice] ⚠️ Wake word in listening_command - resetting to waiting_wake');
        if (stopCurrentAudio) stopCurrentAudio();
        isBusyRef.current = false;
        
        setVoiceState("waiting_wake");
        setRecognizedText("");
        return;
      }
      
      if (voiceState === "waiting_wake") {
        if (stopCurrentAudio) stopCurrentAudio();
        
        if (speak) {
          speak("Escutando", () => {
            setVoiceState("listening_command");
            setRecognizedText("");
            isBusyRef.current = false;
          });
        } else {
          console.warn('[Voice] speak function not available');
          setVoiceState("listening_command");
          setRecognizedText("");
          isBusyRef.current = false;
        }
        return;
      }
    }
    
    if (isStopCommand) {
      console.log('[Voice] 🛑 Stop command detected:', trimmedText);
      lastProcessedCommandRef.current = trimmedText;
      lastProcessedTimeRef.current = now;
      if (stopCurrentAudio) stopCurrentAudio();
      isBusyRef.current = false;
      
      setVoiceState("waiting_wake");
      setRecognizedText("");
      return;
    }

    if (isBackCommand) {
    console.log('[Voice] ⬅️ Back command detected:', trimmedText);
    lastProcessedCommandRef.current = trimmedText;
    lastProcessedTimeRef.current = now;
    
    if (stopCurrentAudio) stopCurrentAudio();
    
    if (router.canGoBack()) {
      speak("Voltando.", () => {
        router.back();
        setTimeout(() => {
          isBusyRef.current = false;
          setVoiceState("waiting_wake");
          setRecognizedText("");
        }, 600);
      });
    } else {
      speak("Não é possível voltar.", () => {
        isBusyRef.current = false;
        setVoiceState("waiting_wake");
        setRecognizedText("");
      });
    }
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

        if (prediction.notUnderstood) {
          if (speak) {
            speak("Desculpe, não entendi.", restartListeningAfterSpeak);
          } else {
            console.warn('[Voice] speak function not available');
            restartListeningAfterSpeak();
          }
        } else {
          executeIntent(prediction.intent, trimmedText, setPendingSpokenText, clearPending);
        }
      }
    } catch (error) {
      console.error('[Voice] Error processing input:', error);
      if (speak) {
        speak("Erro ao processar comando.", restartListeningAfterSpeak);
      } else {
        console.warn('[Voice] speak function not available');
        restartListeningAfterSpeak();
      }
    }

  }, [speak, setVoiceState, setRecognizedText, executeIntent, restartListeningAfterSpeak]);

  return {
    executeIntent,
    getIntentDisplayName,
    processCommand,
    isBusyRef,
  };
}