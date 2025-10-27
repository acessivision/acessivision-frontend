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
import firestore, { 
  collection, 
  doc, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  updateDoc,
  query // Import query as well
} from '@react-native-firebase/firestore';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../../components/ThemeContext';
import { useSpeech } from '../../hooks/useSpeech'; // ✅ Novo hook
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useLayout } from '../../components/LayoutContext';

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
  const isScreenFocused = useIsFocused();
  const { conversaId, titulo } = useLocalSearchParams<{ conversaId: string, titulo: string }>();
  const { headerHeight } = useLayout();
  const { cores, getFontSize, getIconSize } = useTheme();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  
  // ✅ Estado para controlar se o usuário quer usar o microfone
  const [micEnabled, setMicEnabled] = useState(false);

  // ✅ Usa o novo hook de voz
  const { 
    speak, 
    startListening, 
    stopListening,
    isListening,
    recognizedText,
    setRecognizedText
  } = useSpeech({
    enabled: isScreenFocused && micEnabled, // Só ativa quando usuário habilita
    mode: 'local',
  });

  // ===================================================================
  // BUSCAR MENSAGENS DO FIRESTORE
  // ===================================================================
  useEffect(() => {
    if (!conversaId) return;

    if (isScreenFocused) {
      console.log(`[Firestore] TELA EM FOCO: Iniciando listener para ${conversaId}`);

      const messagesCollectionRef = collection(firestore(), 'conversas', conversaId, 'mensagens');

      const q = query(messagesCollectionRef, orderBy('timestamp', 'asc'));
      
      const unsubscribe = onSnapshot(q,
        (snapshot) => {
          const msgs = snapshot.docs.map((doc: { id: any; data: () => any; }) => ({
            id: doc.id,
            ...doc.data(),
          })) as Message[];
          setMessages(msgs);
            
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
      setMicEnabled(false);
    }

  }, [conversaId, isScreenFocused]);

  // ===================================================================
  // PROCESSAR RESULTADO DO RECONHECIMENTO DE VOZ
  // ===================================================================
  useEffect(() => {
    // Só processa se tiver texto e microfone estiver habilitado
    if (!recognizedText.trim() || !micEnabled) return;

    console.log("[Conversa] Texto reconhecido:", recognizedText);

    // Verifica se tem imagem ativa
    if (!activeImage) {
      console.warn('[Conversa] Não há imagem ativa para enviar esta pergunta.');
      Alert.alert('Erro', 'Nenhuma imagem está ativa para enviar esta pergunta.');
      setRecognizedText('');
      return;
    }

    // Salva o texto antes de limpar
    const textoParaEnviar = recognizedText;
    
    // Desativa o microfone e limpa o texto ANTES de enviar
    setMicEnabled(false);
    setRecognizedText('');
    
    // Envia a mensagem
    enviarMensagem(textoParaEnviar);

  }, [recognizedText]); // ✅ Remove micEnabled e activeImage das dependências

  // ===================================================================
  // ALTERNAR MICROFONE
  // ===================================================================
  const toggleMicrophone = () => {
    console.log('[MIC] Toggle clicado. Estado atual:', micEnabled);
    setMicEnabled(prev => !prev);
  };

  // ===================================================================
  // NAVEGAR PARA TIRAR FOTO
  // ===================================================================
  const handlePickImage = () => {
    // Desativa o microfone ao sair para tirar foto
    setMicEnabled(false);
    
    router.push({
      pathname: '/tabs',
      params: {
        mode: 'chat',
        conversaId: conversaId
      }
    });
  };

  // ===================================================================
  // ENVIAR MENSAGEM
  // ===================================================================
  const enviarMensagem = async (textOverride?: string) => {
    const texto = (textOverride !== undefined ? textOverride : inputText).trim();

    if (!texto) {
      Alert.alert('Atenção', 'Por favor, digite ou fale uma pergunta.');
      return;
    }

    if (!activeImage) {
      Alert.alert('Erro', 'Não há uma imagem ativa para perguntar...');
      return;
    }

    // Limpa o input apenas se não veio do reconhecimento de voz
    if (textOverride === undefined) {
      setInputText('');
    }
    
    setIsSending(true);

    try {
      // --- References ---
      const conversationDocRef = doc(firestore(), 'conversas', conversaId);
      const messagesCollectionRef = collection(conversationDocRef, 'mensagens'); // Subcollection ref

      // 1. Salva mensagem do usuário no Firestore using addDoc
      await addDoc(messagesCollectionRef, {
        sender: 'user',
        text: texto,
        imageUri: activeImage,
        timestamp: serverTimestamp(), // Use serverTimestamp()
      });

      // 2. Atualiza data de alteração da conversa using updateDoc
      await updateDoc(conversationDocRef, {
        dataAlteracao: serverTimestamp(), // Use serverTimestamp()
      });
    
      // 3. Prepara FormData para enviar ao servidor
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

      // 4. Envia para o servidor
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

      // 5. Salva resposta da API no Firestore
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

  // ===================================================================
  // RENDER
  // ===================================================================
  return (
  <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: cores.fundo }]}
      // 2. Use 'height' for Android, 'padding' for iOS
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
    <View style={[styles.container, { backgroundColor: cores.fundo }]}>
      <FlatList
        ref={flatListRef}
        style={{ paddingHorizontal: 10 }}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const senderLabel = item.sender === 'user' ? "Sua mensagem" : "Acessivision";
          const imageDescription = item.imageUri ? "Contém imagem." : ""; 
          const textContent = item.text ? String(item.text) : "";
          const combinedLabel = [senderLabel, imageDescription, textContent].filter(Boolean).join(' ');

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
                <Text style={[styles.messageText, { color: cores.texto }]} accessible={false}>
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
          accessibilityLabel={activeImage ? 'Foto ativa. Toque para tirar uma nova foto' : 'Tirar foto'}
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
          accessibilityLabel={micEnabled ? "Desativar microfone" : "Ativar microfone"}
        >
          <Ionicons 
            name={micEnabled ? 'mic' : 'mic-outline'}
            size={getIconSize('medium')}
            color={micEnabled ? cores.texto : cores.icone}
          />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => enviarMensagem()}
          disabled={isSending}
          style={styles.sendButton}
          accessibilityHint="Enviar mensagem"
        >
          {isSending ? (
            <ActivityIndicator size="small" color={cores.texto} />
          ) : (
            <Ionicons name="send" size={getIconSize('medium')} color={cores.icone} />
          )}
        </TouchableOpacity>
      </View>
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
});

export default ConversationScreen;