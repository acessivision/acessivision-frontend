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

  const { isListening, startListening, stopListening } = useSpeechRecognition({
    isFocused: isScreenFocused,
    onFinalResult: (text: string) => setInputText(text),
  });

  useEffect(() => {
    if (!conversaId) return;

    // 1. Só ativa o listener se a tela estiver EM FOCO
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
            // Este erro agora só vai disparar se houver um problema real
            // (não mais por causa da exclusão em outra tela)
            console.error(`❌ Erro ao buscar mensagens:`, error);
          }
        );

      // 2. Retorna a função de cleanup
      //    (Será chamada quando a tela perder o foco)
      return () => {
        console.log(`[Firestore] TELA PERDEU O FOCO: Parando listener para ${conversaId}`);
        unsubscribe();
      };

    } else {
      // 3. (Opcional) Se a tela não está em foco, limpa as mensagens
      //    para evitar "piscar" dados antigos quando voltar.
      setMessages([]);
      setActiveImage(null);
    }

  }, [conversaId, isScreenFocused]);

  const handlePickImage = () => {
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

    // 1. Validação (Texto)
    if (!texto) {
      Alert.alert('Atenção', 'Por favor, digite uma pergunta.');
      return;
    }

    // 2. Validação (Imagem)
    //    (activeImage é populado pelo seu useEffect)
    if (!activeImage) {
      Alert.alert('Erro', 'Não há uma imagem ativa para perguntar. Por favor, tire uma foto primeiro.');
      return;
    }

    setInputText('');
    setIsSending(true);
    stopListening();

    try {
      // 3. Salva a pergunta do usuário no Firestore
      await firestore()
        .collection('conversas')
        .doc(conversaId)
        .collection('mensagens')
        .add({
          sender: 'user',
          text: texto,
          // Anexa a ÚLTIMA foto ativa. 
          // (Se a foto já está no Storage, isso é só a URL, não um novo upload)
          imageUri: activeImage, 
          timestamp: firestore.FieldValue.serverTimestamp(),
        });
    
      // 4. Prepara o FormData para o seu backend
      const formData = new FormData();
      formData.append('prompt', texto);
      
      // Converte a URI da imagem (que pode ser http ou file://) 
      // para o formato de upload
      const filename = activeImage.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      formData.append('file', {
        uri: Platform.OS === 'android' ? activeImage : activeImage.replace('file://', ''),
        name: filename,
        type,
      } as any);

      // 5. Chama o seu backend (que chama o Moondream)
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

      // 6. Salva a resposta do Bot no Firestore
      await firestore()
        .collection('conversas')
        .doc(conversaId)
        .collection('mensagens')
        .add({
          sender: 'api', // <-- 'api' para bater com o renderItem
          text: apiResponse,
          imageUri: null, // A api não envia imagem
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
      {/* 1. COMPONENTE DE LISTA */}
      <FlatList
        ref={flatListRef} 
        style={{ flex: 1, paddingHorizontal: 10 }}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageBubble,
              item.sender === 'user' ? styles.userBubble : styles.apiBubble,
              { backgroundColor: item.sender === 'user' ? cores.mensagemUsuario : 'transparent' } // Mude 'transparent' para sua cor do bot
            ]}
          >
            {/* ADICIONE ISSO: Se a mensagem tiver uma imagem, mostre-a */}
            {item.imageUri && (
              <Image 
                source={{ uri: item.imageUri }} 
                style={styles.messageImage} // Você precisa criar esse estilo
                resizeMode="cover"
              />
            )}

            {/* Mostra o texto (se houver) */}
            {item.text && (
              <Text style={[styles.messageText, { color: cores.texto }]}>
                {String(item.text)} 
              </Text>
            )}
          </View>
        )}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
      
      {/* 2. COMPONENTE DE INPUT (sem espaços antes) */}
      <View style={[styles.inputContainer, { backgroundColor: cores.barrasDeNavegacao }]}>
        <TouchableOpacity onPress={handlePickImage} style={styles.imagePickerButton}>
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
        <TouchableOpacity onPress={isListening ? stopListening : startListening} style={styles.micButton}>
          <Ionicons 
            name={isListening ? 'mic' : 'mic-outline'}
            size={getIconSize('medium')}
            color={isListening ? cores.texto : cores.icone}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={enviarMensagem} disabled={isSending} style={styles.sendButton}>
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
    width: 200, // ou '100%'
    height: 200,
    borderRadius: 12,
    marginBottom: 8, // Espaço entre a imagem e o texto
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end', // Alinha na parte de baixo (bom para multiline)
    paddingHorizontal: 8,
    paddingVertical: 8,
    minHeight: 60,
  },
  imagePickerButton: { // NOVO
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333', // Cor de fundo para o ícone
    marginRight: 8,
    marginBottom: 2, // Alinha com o input
  },
  activeImagePreview: { // NOVO
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  input: { 
    flex: 1, 
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    maxHeight: 120,
    marginBottom: 2,
  },
  micButton: {
    padding: 10,
    marginBottom: 2,
  },
  sendButton: {
    padding: 10,
    marginBottom: 2,
  }
});

export default ConversationScreen;