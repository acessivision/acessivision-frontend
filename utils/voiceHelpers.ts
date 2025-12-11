import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Alert } from 'react-native';

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

export const pararFala = () => {
  try {
    Speech.stop();
  } catch (e) {
    console.warn('Erro ao parar fala:', e);
  }
};

export const estaFalando = async (): Promise<boolean> => {
  try {
    return await Speech.isSpeakingAsync();
  } catch (e) {
    console.warn('Erro ao verificar se está falando:', e);
    return false;
  }
};

export const ouvir = async (
  shouldStart: boolean = true,
  config?: RecognitionConfig
): Promise<boolean> => {
  try {
    if (!shouldStart) {
      console.log('[VoiceHelper] Condição não atendida, não iniciando reconhecimento');
      return false;
    }

    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    
    if (!granted) {
      console.warn('Permissão para reconhecimento de fala negada');
      Alert.alert(
        'Permissão negada',
        'Precisamos do microfone para capturar sua voz.'
      );
      return false;
    }

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

export const pararReconhecimento = () => {
  try {
    ExpoSpeechRecognitionModule.stop();
    console.log('[VoiceHelper] Reconhecimento parado');
  } catch (e) {
    console.warn('Erro ao parar reconhecimento:', e);
  }
};

export const pararTudo = () => {
  pararFala();
  pararReconhecimento();
};

export const contemPalavra = (texto: string, palavras: string[]): boolean => {
  const textoLower = texto.toLowerCase();
  return palavras.some(palavra => textoLower.includes(palavra.toLowerCase()));
};

export const removerEspacos = (texto: string): string => {
  return texto.replace(/\s+/g, '');
};

export const normalizarTexto = (texto: string): string => {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

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
