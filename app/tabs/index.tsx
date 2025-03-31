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
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  async function takePictureAndUpload() {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync();
        if (!photo) {
          Alert.alert('Erro', 'Não foi possível capturar a foto.');
          return;
        }

        console.log('Foto capturada:', photo.uri);

        const formData = new FormData();
        formData.append('image', {
          uri: photo.uri,
          type: 'image/jpeg',
          name: 'photo.jpg',
        } as any);

      } catch (error: unknown) {
        console.error('Erro ao enviar a foto:', error);
        
        if (error instanceof Error) {
          Alert.alert('Erro', 'Falha ao enviar a foto para o servidor: ' + error.message);
        } else {
          Alert.alert('Erro', 'Falha ao enviar a foto para o servidor: Erro desconhecido');
        }
      }
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#333" barStyle="light-content" />
      <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={toggleCameraFacing}>
            <Text style={styles.text}>Flip Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={takePictureAndUpload}>
            <Text style={styles.text}>Take Picture</Text>
          </TouchableOpacity>
        </View>
      </CameraView>
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