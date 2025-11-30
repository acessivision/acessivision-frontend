/**
 * voiceHelpers.ts
 * Funções auxiliares para Text-to-Speech (TTS) e Speech-to-Text (STT)
 * Reutilizáveis em diferentes componentes
 */

import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Alert } from 'react-native';

// ===================================================================
// TIPOS
// ===================================================================
export interface VoiceConfig {
  language?: string;
  rate?: number;
  pitch?: number;
}

export interface RecognitionConfig {
  lang?: string;
  interimResults?: boolean;
  continuous?: boolean;
  maxAlternatives?: number;
}

// ===================================================================
// TEXT-TO-SPEECH (FALAR)
// ===================================================================

/**
 * Fala um texto usando síntese de voz
 * @param texto - O texto a ser falado
 * @param callback - Função chamada quando a fala termina
 * @param config - Configurações opcionais de voz
 */
export const falar = (
  texto: string,
  callback?: () => void,
  config?: VoiceConfig
) => {
  Speech.stop();
  
  Speech.speak(texto, {
    language: config?.language || 'pt-BR',
    rate: config?.rate || 1.0,
    pitch: config?.pitch || 1.0,
    onDone: () => {
      if (callback) callback();
    },
    onStopped: () => {
      if (callback) callback();
    },
  });
};

/**
 * Para qualquer fala em andamento
 */
export const pararFala = () => {
  try {
    Speech.stop();
  } catch (e) {
    console.warn('Erro ao parar fala:', e);
  }
};

/**
 * Verifica se está falando no momento
 */
export const estaFalando = async (): Promise<boolean> => {
  try {
    return await Speech.isSpeakingAsync();
  } catch (e) {
    console.warn('Erro ao verificar se está falando:', e);
    return false;
  }
};

// ===================================================================
// SPEECH-TO-TEXT (OUVIR)
// ===================================================================

/**
 * Inicia o reconhecimento de voz
 * @param shouldStart - Condição para iniciar (ex: tela em foco)
 * @param config - Configurações opcionais de reconhecimento
 * @returns Promise que resolve quando o reconhecimento inicia
 */
export const ouvir = async (
  shouldStart: boolean = true,
  config?: RecognitionConfig
): Promise<boolean> => {
  try {
    if (!shouldStart) {
      console.log('[VoiceHelper] Condição não atendida, não iniciando reconhecimento');
      return false;
    }

    // Pede permissão
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    
    if (!granted) {
      console.warn('Permissão para reconhecimento de fala negada');
      Alert.alert(
        'Permissão negada',
        'Precisamos do microfone para capturar sua voz.'
      );
      return false;
    }

    // Inicia reconhecimento
    await ExpoSpeechRecognitionModule.start({
      lang: config?.lang || 'pt-BR',
      interimResults: config?.interimResults ?? false,
      continuous: config?.continuous ?? true,
      maxAlternatives: config?.maxAlternatives ?? 1,
    });

    console.log('[VoiceHelper] Reconhecimento iniciado');
    return true;
    
  } catch (e) {
    console.error('Erro ao iniciar reconhecimento:', e);
    return false;
  }
};

/**
 * Para o reconhecimento de voz
 */
export const pararReconhecimento = () => {
  try {
    ExpoSpeechRecognitionModule.stop();
    console.log('[VoiceHelper] Reconhecimento parado');
  } catch (e) {
    console.warn('Erro ao parar reconhecimento:', e);
  }
};

/**
 * Para tanto a fala quanto o reconhecimento
 */
export const pararTudo = () => {
  pararFala();
  pararReconhecimento();
};

// ===================================================================
// FUNÇÕES UTILITÁRIAS
// ===================================================================

/**
 * Verifica se uma string contém alguma das palavras-chave
 * @param texto - Texto a ser verificado
 * @param palavras - Array de palavras-chave
 * @returns true se encontrar alguma palavra
 */
export const contemPalavra = (texto: string, palavras: string[]): boolean => {
  const textoLower = texto.toLowerCase();
  return palavras.some(palavra => textoLower.includes(palavra.toLowerCase()));
};

/**
 * Remove espaços extras de um texto (útil para emails/senhas)
 * @param texto - Texto a ser limpo
 * @returns Texto sem espaços
 */
export const removerEspacos = (texto: string): string => {
  return texto.replace(/\s+/g, '');
};

/**
 * Normaliza texto removendo acentos (útil para comparações)
 * @param texto - Texto a ser normalizado
 * @returns Texto sem acentos
 */
export const normalizarTexto = (texto: string): string => {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

/**
 * Verifica se o texto parece ser um eco do próprio app
 * @param texto - Texto capturado
 * @param palavrasDoApp - Palavras que o app costuma falar
 * @returns true se parecer ser eco
 */
export const ehEco = (texto: string, palavrasDoApp: string[]): boolean => {
  return contemPalavra(texto, palavrasDoApp);
};

export const RECONHECIMENTO_CONTINUO: RecognitionConfig = {
  lang: 'pt-BR',
  interimResults: false,
  continuous: true,
  maxAlternatives: 1,
};


export const RECONHECIMENTO_UNICO: RecognitionConfig = {
  lang: 'pt-BR',
  interimResults: false,
  continuous: true,
  maxAlternatives: 1,
};

export const VOZ_PADRAO: VoiceConfig = {
  language: 'pt-BR',
  rate: 1.0,
  pitch: 1.0,
};

// ===================================================================
// EXEMPLO DE USO
// ===================================================================

/**
 * Exemplo de como usar em um componente:
 * 
 * import { falar, ouvir, pararTudo, contemPalavra } from '@/utils/voiceHelpers';
 * 
 * // Falar e depois ouvir
 * falar("Qual é o seu nome?", () => ouvir(true));
 * 
 * // Processar resultado
 * useSpeechRecognitionEvent("result", (event) => {
 *   const texto = event.results[0]?.transcript || "";
 *   
 *   if (contemPalavra(texto, ["cancelar", "sair"])) {
 *     pararTudo();
 *     return;
 *   }
 *   
 *   // Processa o texto...
 * });
 * 
 * // Cleanup
 * useEffect(() => {
 *   return () => pararTudo();
 * }, []);
 */