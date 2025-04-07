import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useState, useRef, useEffect } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View, Alert, StatusBar, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system'; // Para salvar o blob no mobile

export default function Index() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(err => console.error('Erro ao descarregar som:', err));
      }
    };
  }, [sound]);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to use the camera</Text>
        <Button onPress={requestPermission} title="Grant Permission" />
      </View>
    );
  }

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  async function takePictureAndUpload() {
    if (!cameraRef.current) {
      Alert.alert('Erro', 'Camera não está pronta.');
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

      console.log('Foto capturada:', photo.uri || 'Base64 disponível');

      let formData = new FormData();
      if (Platform.OS === 'web') {
        const base64Data = photo.base64;
        if (!base64Data) {
          Alert.alert('Erro', 'Dados da foto não disponíveis.');
          return;
        }
        const byteString = atob(base64Data.split(',')[1]);
        const mimeString = base64Data.split(',')[0].split(':')[1].split(';')[0];
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

      const serverUrl = 'http://192.168.15.14:3000/upload';
      console.log('Enviando requisição para:', serverUrl);

      const response = await fetch(serverUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Erro do servidor:', errorText);
        throw new Error(`Server responded with status ${response.status}: ${errorText}`);
      }

      // Recebe o áudio como blob
      const audioBlob = await response.blob();
      console.log('Blob recebido:', audioBlob);

      // Limpa o som anterior, se existir
      if (sound) {
        await sound.unloadAsync();
      }

      let audioUri;
      if (Platform.OS === 'web') {
        // Na web, usa URL.createObjectURL
        audioUri = URL.createObjectURL(audioBlob);
      } else {
        // No mobile, salva o blob como arquivo temporário
        const tempFile = `${FileSystem.cacheDirectory}temp-audio.mp3`;
        const base64Audio = await blobToBase64(audioBlob);
        await FileSystem.writeAsStringAsync(tempFile, base64Audio, {
          encoding: FileSystem.EncodingType.Base64,
        });
        audioUri = tempFile;
      }

      // Carrega e reproduz o áudio
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      );
      setSound(newSound);

      // Limpeza na web
      if (Platform.OS === 'web') {
        newSound.setOnPlaybackStatusUpdate(status => {
          if (status.isLoaded && !status.isPlaying && status.didJustFinish) {
            URL.revokeObjectURL(audioUri);
          }
        });
      }

    } catch (error: unknown) {
      console.error('Erro ao enviar a foto ou reproduzir áudio:', error);
      Alert.alert('Erro', 'Falha ao processar: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  }

  async function clearAudio() {
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#333" barStyle="light-content" />
      <TouchableOpacity style={styles.camera} onPress={clearAudio} activeOpacity={1}>
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
}

// Função auxiliar para converter blob em base64
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = (reader.result as string).split(',')[1]; // Remove o prefixo "data:audio/mpeg;base64,"
      resolve(base64data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#333',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
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