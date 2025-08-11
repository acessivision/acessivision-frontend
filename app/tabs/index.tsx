import { useAudioPlayer, type AudioSource } from 'expo-audio';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface Photo {
  uri: string;
  base64?: string;
}

const SERVER_URL = `http://${process.env.EXPO_PUBLIC_IP}:3000/upload`;

// Função auxiliar para converter blob em base64
const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const CameraScreen: React.FC = () => {
  const [facing, setFacing] = useState<CameraType>('back');
  const [audioSource, setAudioSource] = useState<AudioSource | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const audioUriRef = useRef<string | null>(null); // Armazena a URL para limpeza no web

  // Chame useAudioPlayer incondicionalmente
  const player = useAudioPlayer(audioSource);

  // Reproduzir áudio quando audioSource mudar
  useEffect(() => {
    if (player && audioSource) {
      // Verificar o tipo de audioSource
      let uri: string | undefined;
      if (typeof audioSource === 'string') {
        uri = audioSource;
      } else if (typeof audioSource === 'object' && audioSource.uri) {
        uri = audioSource.uri;
      }

      if (uri) {
        try {
          console.log('Tentando reproduzir áudio:', uri);
          player.play();
          console.log('O áudio foi reproduzido');
        } catch (error) {
          console.error('Erro ao reproduzir áudio:', error);
        }
      } else {
        console.log('Não reproduzindo: uri inválido', { audioSource });
      }
    } else {
      console.log('Não reproduzindo: player ou audioSource inválido', { player, audioSource });
    }
  }, [audioSource, player]);

  // Limpar URL.createObjectURL quando o componente desmontar
  useEffect(() => {
    return () => {
      console.log('Limpando URL do audioSource');
      if (audioUriRef.current && Platform.OS === 'web') {
        URL.revokeObjectURL(audioUriRef.current);
      }
    };
  }, []); // Sem dependências, executa apenas na desmontagem

  // Alternar entre câmera frontal e traseira
  const toggleCameraFacing = useCallback(() => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  }, []);

  // Criar FormData para upload da foto
  const createFormData = (photo: Photo): FormData => {
    const formData = new FormData();
    if (Platform.OS === 'web' && photo.base64) {
      const byteString = atob(photo.base64.split(',')[1]);
      const mimeString = photo.base64.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      formData.append('file', blob, 'photo.jpg');
    } else {
      formData.append('file', {
        uri: photo.uri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      } as any);
    }
    return formData;
  };

  // Processar e reproduzir áudio retornado
  const processAudioResponse = async (audioBlob: Blob): Promise<void> => {
    let audioUri: string;

    if (Platform.OS === 'web') {
      audioUri = URL.createObjectURL(audioBlob);
    } else {
      const tempFile = `${FileSystem.cacheDirectory}temp-audio.mp3`;
      const base64Audio = await blobToBase64(audioBlob);
      await FileSystem.writeAsStringAsync(tempFile, base64Audio, {
        encoding: FileSystem.EncodingType.Base64,
      });
      audioUri = tempFile;
    }

    setAudioSource({ uri: audioUri } as AudioSource);
  };

  // Tirar foto e enviar para o servidor
  const takePictureAndUpload = async (): Promise<void> => {
    if (!cameraRef.current) {
      Alert.alert('Erro', 'Câmera não está pronta.');
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: Platform.OS === 'web',
      });

      if (!photo) {
        Alert.alert('Erro', 'Não foi possível capturar a foto.');
        return;
      }
      console.log('Foto capturada:', photo);

      const formData = createFormData(photo);
      const response = await fetch(SERVER_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro do servidor: ${response.status} - ${errorText}`);
      }

      const audioBlob = await response.blob();
      await processAudioResponse(audioBlob);
    } catch (error) {
      console.error('Erro ao processar foto ou áudio:', error);
      Alert.alert(
        'Erro',
        error instanceof Error ? error.message : 'Erro desconhecido'
      );
    }
  };

  // Renderizar tela de permissão
  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>
          Precisamos da sua permissão para usar a câmera
        </Text>
        <Button onPress={requestPermission} title="Conceder Permissão" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#333" barStyle="light-content" />
      <TouchableOpacity style={styles.camera} activeOpacity={1}>
        <CameraView style={StyleSheet.absoluteFill} facing={facing} ref={cameraRef}>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={toggleCameraFacing}>
              <Text style={styles.text}>Virar Câmera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={takePictureAndUpload}>
              <Text style={styles.text}>Tirar Foto</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </TouchableOpacity>
    </View>
  );
};

// Estilos
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#333',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: '#fff',
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    margin: 64,
  },
  button: {
    flex: 1,
    alignSelf: 'flex-end',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
});

export default CameraScreen;