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
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../../components/ThemeContext';
import { useSpeech } from '../../hooks/useSpeech';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useLayout } from '../../components/LayoutContext';

// ✅ Imports modulares do Firebase v9+
import { getFirestore, collection, doc, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, query } from '@react-native-firebase/firestore';

const SERVER_URL = 'https://acessivision.com.br/upload';

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
  const { cores, getIconSize } = useTheme();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  
  // ✅ Estado para controlar se o usuário quer usar o microfone
  const [micEnabled, setMicEnabled] = useState(false);
  
  // ✅ Ref para debounce do reconhecimento
  const recognitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRecognizedTextRef = useRef<string>('');

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

      const db = getFirestore();
      const messagesCollectionRef = collection(db, 'conversas', conversaId, 'mensagens');
      const q = query(messagesCollectionRef, orderBy('timestamp', 'asc'));
      
      const unsubscribe = onSnapshot(q,
        (snapshot) => {
          const msgs = snapshot.docs.map((docSnapshot) => ({
            id: docSnapshot.id,
            ...docSnapshot.data(),
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
      setMicEnabled(false);
    }

  }, [conversaId, isScreenFocused]);

  // ===================================================================
  // PROCESSAR RESULTADO DO RECONHECIMENTO DE VOZ COM DEBOUNCE
  // ===================================================================
  useEffect(() => {
    // Só processa se tiver texto e microfone estiver habilitado
    if (!recognizedText.trim() || !micEnabled) return;

    const textoAtual = recognizedText.trim();
    
    // ✅ Atualiza o último texto reconhecido
    lastRecognizedTextRef.current = textoAtual;

    console.log("[Conversa] Texto sendo reconhecido:", textoAtual);

    // ✅ Limpa timeout anterior
    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
    }

    // ✅ Aguarda 2 segundos de silêncio antes de processar
    recognitionTimeoutRef.current = setTimeout(() => {
      const textoFinal = lastRecognizedTextRef.current;
      
      if (!textoFinal) {
        console.log('[Conversa] Texto vazio após timeout, ignorando');
        return;
      }

      console.log("[Conversa] ✅ Texto final capturado:", textoFinal);

      // Verifica se tem imagem ativa
      if (!activeImage) {
        console.warn('[Conversa] Não há imagem ativa para enviar esta pergunta.');
        speak('Nenhuma imagem está ativa. Por favor, tire uma foto primeiro.');
        setRecognizedText('');
        setMicEnabled(false);
        return;
      }

      // Desativa o microfone e limpa o texto ANTES de enviar
      setMicEnabled(false);
      setRecognizedText('');
      lastRecognizedTextRef.current = '';
      
      // Envia a mensagem
      enviarMensagem(textoFinal);
    }, 2000); // ✅ 2 segundos de pausa para capturar frase completa

  }, [recognizedText, micEnabled, activeImage]);

  // ✅ Cleanup do timeout quando componente desmonta
  useEffect(() => {
    return () => {
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
      }
    };
  }, []);

  // ===================================================================
  // ALTERNAR MICROFONE
  // ===================================================================
  const toggleMicrophone = () => {
    console.log('[MIC] Toggle clicado. Estado atual:', micEnabled);
    
    if (!activeImage) {
      Alert.alert('Atenção', 'Por favor, tire uma foto antes de usar o microfone.');
      return;
    }
    
    const novoEstado = !micEnabled;
    setMicEnabled(novoEstado);
    
    if (novoEstado) {
      // ✅ Limpa estados ao ativar
      setRecognizedText('');
      lastRecognizedTextRef.current = '';
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
      }
      speak('Microfone ativado. Fale sua pergunta.');
    } else {
      // ✅ Limpa timeout ao desativar
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
      }
      setRecognizedText('');
      lastRecognizedTextRef.current = '';
    }
  };

  // ===================================================================
  // NAVEGAR PARA TIRAR FOTO
  // ===================================================================
  const handlePickImage = () => {
    // Desativa o microfone ao sair para tirar foto
    setMicEnabled(false);
    setRecognizedText('');
    lastRecognizedTextRef.current = '';
    
    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
    }
    
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
      const db = getFirestore();
      const conversationDocRef = doc(db, 'conversas', conversaId);
      const messagesCollectionRef = collection(conversationDocRef, 'mensagens');

      // 1. Salva mensagem do usuário no Firestore
      await addDoc(messagesCollectionRef, {
        sender: 'user',
        text: texto,
        imageUri: activeImage,
        timestamp: serverTimestamp(),
      });

      // 2. Atualiza data de alteração da conversa
      await updateDoc(conversationDocRef, {
        dataAlteracao: serverTimestamp(),
      });
    
      // ✅ 3. Converte a imagem para base64
      console.log('[Upload] 🔄 Convertendo imagem para base64...');
      
      // Se a imagem já é uma URL do Firebase Storage, precisamos fazer download
      let base64Image: string;
      
      if (activeImage.startsWith('http')) {
        // É uma URL do Firebase Storage - fazer download
        console.log('[Upload] 📥 Baixando imagem do Firebase Storage...');
        const response = await fetch(activeImage);
        const blob = await response.blob();
        
        // Converte blob para base64
        base64Image = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            // Remove o prefixo "data:image/...;base64,"
            const base64Only = base64.split(',')[1];
            resolve(base64Only);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        // É um arquivo local - ler diretamente
        console.log('[Upload] 📂 Lendo arquivo local...');
        const FileSystem = require('expo-file-system').default;
        base64Image = await FileSystem.readAsStringAsync(activeImage, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      console.log(`[Upload] ✅ Base64 pronto (${base64Image.length} caracteres)`);

      // ✅ 4. Envia como JSON (igual ao index.tsx)
      console.log('[Upload] 📤 Enviando requisição JSON para:', SERVER_URL);
      const response = await fetch(SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
          prompt: texto,
        }),
      });

      console.log('[Upload] 📥 Resposta recebida');
      console.log('[Upload] Status:', response.status);

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('[Upload] ❌ Erro do servidor:', errorBody);
        throw new Error(`Erro na resposta do servidor: ${response.status} - ${errorBody}`);
      }

      const data = await response.json();
      console.log('[Upload] 🎉 Resultado:', data);
      
      const apiResponse = data.description;

      if (!apiResponse) {
        throw new Error("O servidor respondeu, mas não enviou uma 'description'.");
      }

      console.log('[Upload] ✅ Descrição recebida:', apiResponse);

      // 5. Salva resposta da API no Firestore
      await addDoc(messagesCollectionRef, {
        sender: 'api',
        text: apiResponse,
        imageUri: null,
        timestamp: serverTimestamp(),
      });

      // ✅ Fala a resposta da API
      speak(apiResponse);

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      let errorMessage = 'Ocorreu um erro desconhecido.';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (errorMessage.includes('Network request failed')) {
          errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
        }
      }
      Alert.alert('Erro', 'Não foi possível enviar a mensagem: ' + errorMessage);
      speak('Erro ao enviar mensagem. Por favor, tente novamente.');
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

        {/* ✅ Indicador visual de reconhecimento de voz */}
        {micEnabled && recognizedText && (
          <View style={[styles.listeningIndicator, { backgroundColor: cores.barrasDeNavegacao }]}>
            <ActivityIndicator size="small" color={cores.texto} />
            <Text style={[styles.listeningText, { color: cores.texto }]}>
              "{recognizedText}"
            </Text>
          </View>
        )}

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
            editable={!micEnabled} // ✅ Desabilita input quando mic está ativo
          />

          <TouchableOpacity 
            onPress={toggleMicrophone}
            style={styles.micButton}
            accessibilityLabel={micEnabled ? "Desativar microfone" : "Ativar microfone"}
          >
            <Ionicons 
              name={micEnabled ? 'mic' : 'mic-outline'}
              size={getIconSize('medium')}
              color={micEnabled ? '#FF453A' : cores.icone} // ✅ Vermelho quando ativo
            />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => enviarMensagem()}
            disabled={isSending || micEnabled} // ✅ Desabilita send quando mic está ativo
            style={styles.sendButton}
            accessibilityHint="Enviar mensagem"
          >
            {isSending ? (
              <ActivityIndicator size="small" color={cores.texto} />
            ) : (
              <Ionicons 
                name="send" 
                size={getIconSize('medium')} 
                color={micEnabled ? '#666' : cores.icone} // ✅ Cinza quando mic ativo
              />
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
  listeningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 10,
    marginBottom: 8,
    borderRadius: 8,
  },
  listeningText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
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