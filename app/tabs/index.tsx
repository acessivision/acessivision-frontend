import { useAudioPlayer, type AudioSource } from 'expo-audio';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../../components/ThemeContext';

interface Photo {
  uri: string;
  base64?: string;
}

const SERVER_URL = `http://${process.env.EXPO_PUBLIC_IP}:3000/upload`;

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () =>
      resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const CameraScreen: React.FC = () => {
  const { cores, temaAplicado } = useTheme();
  const [audioSource, setAudioSource] = useState<AudioSource | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const isFocused = useIsFocused();

  const player = useAudioPlayer(audioSource);

  useEffect(() => {
    if (player && audioSource) {
      try {
        // Reset position to the start before playing
        player.seekTo(0);
        player.play();
      } catch (error) {
        console.error('Erro ao reproduzir áudio:', error);
      }
    }
  }, [audioSource, player]);

  const createFormData = (photo: Photo): FormData => {
    const formData = new FormData();
    formData.append('file', {
      uri: photo.uri,
      type: 'image/jpeg',
      name: 'photo.jpg',
    } as any);
    return formData;
  };

  const processAudioResponse = async (audioBlob: Blob): Promise<void> => {
    try {
      const tempFile = `${FileSystem.cacheDirectory}temp-audio.mp3`;
      const base64Audio = await blobToBase64(audioBlob);
      await FileSystem.writeAsStringAsync(tempFile, base64Audio, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setAudioSource({ uri: tempFile });
    } catch (error) {
      console.error('Erro ao processar áudio:', error);
    }
  };

  const takePictureAndUpload = async (): Promise<void> => {
    if (!cameraRef.current) {
      Alert.alert('Erro', 'Câmera não está pronta.');
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
      if (!photo) {
        Alert.alert('Erro', 'Não foi possível capturar a foto.');
        return;
      }

      const formData = createFormData(photo);
      const response = await fetch(SERVER_URL, { method: 'POST', body: formData });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro do servidor: ${response.status} - ${errorText}`);
      }

      const audioBlob = await response.blob();
      await processAudioResponse(audioBlob);
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Erro desconhecido');
    }
  };

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: cores.barrasDeNavegacao }]}>
        <Text style={[styles.message, { color: cores.texto }]}>
          Precisamos da sua permissão para usar a câmera
        </Text>
        <Button onPress={requestPermission} title="Conceder Permissão" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: cores.barrasDeNavegacao }]}>
      <StatusBar
        backgroundColor={cores.barrasDeNavegacao}
        barStyle={temaAplicado === 'dark' ? 'light-content' : 'dark-content'}
      />
      {isFocused && (
        <TouchableOpacity style={styles.camera} activeOpacity={1}>
          <CameraView style={StyleSheet.absoluteFill} ref={cameraRef}>
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.button} onPress={takePictureAndUpload}>
                <Image
                  source={
                    temaAplicado === 'dark'
                      ? require('../../assets/images/icone-camera-escuro.png')
                      : require('../../assets/images/icone-camera-claro.png')
                  }
                  style={styles.iconeCamera}
                />
              </TouchableOpacity>
            </View>
          </CameraView>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  message: { textAlign: 'center', paddingBottom: 10 },
  camera: { flex: 1 },
  buttonContainer: { flex: 1, flexDirection: 'row', backgroundColor: 'transparent', margin: 40 },
  button: { flex: 1, alignSelf: 'flex-end', alignItems: 'center' },
  iconeCamera: { width: 100, height: 100 },
});

export default CameraScreen;
