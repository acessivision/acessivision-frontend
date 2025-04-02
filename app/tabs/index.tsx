import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useState, useRef } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View, Alert, StatusBar, Platform } from 'react-native';

export default function Index() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [description, setDescription] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

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

      const serverUrl = 'http://<IP da sua máquina>:3000/upload';
      console.log('Enviando requisição para:', serverUrl);

      const response = await fetch(serverUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server responded with status ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('Resposta do servidor:', result);
      setDescription(result.answer);
    } catch (error: unknown) {
      console.error('Erro ao enviar a foto:', error);
      Alert.alert('Erro', 'Falha ao enviar: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  }

  function clearDescription() {
    setDescription(null); // Clear the description when camera is tapped
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#333" barStyle="light-content" />
      <TouchableOpacity style={styles.camera} onPress={clearDescription} activeOpacity={1}>
        <CameraView style={StyleSheet.absoluteFill} facing={facing} ref={cameraRef}>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={toggleCameraFacing}>
              <Text style={styles.text}>Flip Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={takePictureAndUpload}>
              <Text style={styles.text}>Take Picture</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </TouchableOpacity>
      {description && (
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionText}>Descrição: {description}</Text>
        </View>
      )}
    </View>
  );
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
  descriptionContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 5,
  },
  descriptionText: {
    color: 'white',
    fontSize: 16,
  },
});