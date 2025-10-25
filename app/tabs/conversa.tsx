import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import { useRoute, useIsFocused } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useAuth } from '../../components/AuthContext';
import { useTheme } from '../../components/ThemeContext';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useNavigation } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SERVER_URL = `http://${process.env.EXPO_PUBLIC_IP}:3000/upload`;

interface Message {
  id: string;
  sender: 'user' | 'api';
  text: string;
  timestamp: any;
  imageUri?: string;
}

const ConversationScreen: React.FC = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const isScreenFocused = useIsFocused();
  const { conversaId, titulo } = useLocalSearchParams<{ conversaId: string, titulo: string }>();
  const { user } = useAuth();
  const { cores, getFontSize, getIconSize } = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const { top } = useSafeAreaInsets();
  const headerHeight = Platform.OS === 'ios' ? top + 44 : 56;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  
  // Estado para controlar manualmente o microfone
  const [userWantsMic, setUserWantsMic] = useState(false);

  // CRÍTICO: Passa autoStart: false para desabilitar o comportamento automático do hook
  const { isListening, startListening, stopListening } = useSpeechRecognition({
    isFocused: isScreenFocused && userWantsMic, // Só permite quando tela focada E usuário quer
    onFinalResult: (text: string) => {
      setInputText(prev => prev + text);
      // Desativa o microfone após receber o resultado
      setUserWantsMic(false);
    },
    autoStart: false, // DESABILITA o auto-start do hook
  });

  // Sincroniza o estado do microfone com a intenção do usuário
  useEffect(() => {
    if (!isScreenFocused) {
      // Se a tela não está focada, desliga tudo
      setUserWantsMic(false);
      if (isListening) {
        stopListening();
      }
      return;
    }

    // Se o usuário quer o microfone e não está escutando, inicia
    if (userWantsMic && !isListening) {
      console.log('[MIC] Usuário quer microfone, iniciando...');
      startListening();
    } 
    // Se o usuário NÃO quer o microfone mas está escutando, para
    else if (!userWantsMic && isListening) {
      console.log('[MIC] Usuário não quer microfone, parando...');
      stopListening();
    }
  }, [userWantsMic, isListening, isScreenFocused]);

  useEffect(() => {
    if (!conversaId) return;

    if (isScreenFocused) {
      console.log(`[Firestore] TELA EM FOCO: Iniciando listener para ${conversaId}`);
      
      const unsubscribe = firestore()
        .collection('conversas')
        .doc(conversaId)
        .collection('mensagens')
        .orderBy('timestamp', 'asc')
        .onSnapshot(
          (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            })) as Message[];
            
            setMessages(msgs);

            const lastUserImageMsg = [...msgs].reverse().find(m => m.sender === 'user' && m.imageUri);
            if (lastUserImageMsg && lastUserImageMsg.imageUri) {
              setActiveImage(lastUserImageMsg.imageUri); 
            }
          },
          (error) => {
            console.error(`❌ Erro ao buscar mensagens:`, error);
          }
        );

      return () => {
        console.log(`[Firestore] TELA PERDEU O FOCO: Parando listener para ${conversaId}`);
        unsubscribe();
      };

    } else {
      setMessages([]);
      setActiveImage(null);
      setUserWantsMic(false);
    }

  }, [conversaId, isScreenFocused]);

  // Função para alternar o microfone
  const toggleMicrophone = () => {
    console.log('[MIC] Toggle clicado. Estado atual userWantsMic:', userWantsMic, 'isListening:', isListening);
    setUserWantsMic(prev => !prev);
  };

  const handlePickImage = () => {
    // Desativa o microfone ao sair para tirar foto
    setUserWantsMic(false);
    
    router.push({
      pathname: '/tabs',
      params: {
        mode: 'chat',
        conversaId: conversaId
      }
    });
  };

  const enviarMensagem = async () => {
    const texto = inputText.trim();

    if (!texto) {
      Alert.alert('Atenção', 'Por favor, digite uma pergunta.');
      return;
    }

    if (!activeImage) {
      Alert.alert('Erro', 'Não há uma imagem ativa para perguntar. Por favor, tire uma foto primeiro.');
      return;
    }

    setInputText('');
    setIsSending(true);
    // Desativa o microfone ao enviar mensagem
    setUserWantsMic(false);

    try {
      await firestore()
        .collection('conversas')
        .doc(conversaId)
        .collection('mensagens')
        .add({
          sender: 'user',
          text: texto,
          imageUri: activeImage, 
          timestamp: firestore.FieldValue.serverTimestamp(),
        });
    
      const formData = new FormData();
      formData.append('prompt', texto);
      
      const filename = activeImage.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      formData.append('file', {
        uri: Platform.OS === 'android' ? activeImage : activeImage.replace('file://', ''),
        name: filename,
        type,
      } as any);

      const response = await fetch(SERVER_URL, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Erro na resposta do servidor: ${response.status} - ${errorBody}`);
      }

      const data = await response.json();
      const apiResponse = data.description;

      if (!apiResponse) {
        throw new Error("O servidor respondeu, mas não enviou uma 'description'.");
      }

      await firestore()
        .collection('conversas')
        .doc(conversaId)
        .collection('mensagens')
        .add({
          sender: 'api',
          text: apiResponse,
          imageUri: null,
          timestamp: firestore.FieldValue.serverTimestamp(),
        });

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      let errorMessage = 'Ocorreu um erro desconhecido.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      Alert.alert('Erro', 'Não foi possível enviar a mensagem: ' + errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: cores.fundo }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
    >
      <FlatList
        ref={flatListRef} 
        style={{ flex: 1, paddingHorizontal: 10 }}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const senderLabel = item.sender === 'user' ? "Sua mensagem" : "Acessivision";
          const imageDescription = item.imageUri ? "Contém imagem." : ""; 
          const textContent = item.text ? String(item.text) : "";
          const accessibilityLabelParts = [senderLabel];
          if (imageDescription) accessibilityLabelParts.push(imageDescription);
          if (textContent) accessibilityLabelParts.push(textContent);
          const combinedLabel = accessibilityLabelParts.join(' '); 

          return (
            <View
              style={[
                styles.messageBubble,
                item.sender === 'user' ? styles.userBubble : styles.apiBubble,
                { backgroundColor: item.sender === 'user' ? cores.mensagemUsuario : 'transparent' }
              ]}
              accessible={true}
              accessibilityLabel={combinedLabel}
            >
              {item.imageUri && (
                <Image 
                  source={{ uri: item.imageUri }} 
                  style={styles.messageImage}
                  resizeMode="cover"
                />
              )}

              {item.text && (
                <Text 
                  style={[styles.messageText, { color: cores.texto }]}
                  accessible={false} 
                >
                  {String(item.text)} 
                </Text>
              )}
            </View>
          );
        }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
      
      <View style={[styles.inputContainer, { backgroundColor: cores.barrasDeNavegacao }]}>
        <TouchableOpacity 
          onPress={handlePickImage}
          style={styles.imagePickerButton}
          accessibilityLabel='Nova foto'
        >
          {activeImage ? (
            <Image source={{ uri: activeImage }} style={styles.activeImagePreview} />
          ) : (
            <Ionicons name="camera" size={getIconSize('medium')} color={cores.icone} />
          )}
        </TouchableOpacity>
        
        <TextInput
          style={[styles.input, { color: cores.texto, backgroundColor: cores.fundo }]}
          placeholder="Faça uma pergunta..."
          placeholderTextColor="#999"
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        
        <TouchableOpacity 
          onPress={toggleMicrophone} 
          style={styles.micButton}
          accessibilityLabel={userWantsMic ? "Desativar microfone" : "Ativar microfone"}
        >
          <Ionicons 
            name={userWantsMic ? 'mic' : 'mic-outline'}
            size={getIconSize('medium')}
            color={userWantsMic ? cores.texto : cores.icone}
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={enviarMensagem} 
          disabled={isSending} 
          style={styles.sendButton}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={cores.texto} />
          ) : (
            <Ionicons name="send" size={getIconSize('medium')} color={cores.icone} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginVertical: 4,
  },
  userBubble: { 
    alignSelf: 'flex-end', 
  },
  apiBubble: { 
    alignSelf: 'flex-start', 
  },
  messageText: { 
    fontSize: 16 
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end', 
    paddingHorizontal: 8,
    paddingVertical: 8,
    minHeight: 70,
  },
  imagePickerButton: { 
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333', 
    marginRight: 8,
    marginBottom: 4,
  },
  activeImagePreview: { 
    width: 90,
    height: 90,
  },
  input: { 
    flex: 1, 
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    maxHeight: 120,
    marginBottom: 4,
  },
  micButton: {
    padding: 10,
    marginBottom: 4,
  },
  sendButton: {
    padding: 10,
    marginBottom: 4,
  },
  senderNameLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
});

export default ConversationScreen;