import React, { useEffect, useState, useRef, useCallback } from 'react';
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
import { useVoiceCommands } from '../../components/VoiceCommandContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import firestore from '@react-native-firebase/firestore';
import { useTalkBackState } from '../../hooks/useTalkBackState';

const SERVER_URL = 'https://www.acessivision.com.br/upload';

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
  
  const params = useLocalSearchParams<{ 
    conversaId: string, 
    titulo: string,
    speakLastMessage?: string 
  }>();
  
  const { conversaId, titulo, speakLastMessage } = params;
  const { cores, getIconSize } = useTheme();
  const flatListRef = useRef<FlatList>(null);

  // ✅ NOVO: Estado para controlar visibilidade do botão voltar para o TalkBack
  const { isActive: isTalkBackActive } = useTalkBackState();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(false);
  
  const recognitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRecognizedTextRef = useRef<string>('');
  const lastMessageCountRef = useRef<number>(0);

  const { 
    speak, 
    startListening, 
    stopListening,
    isListening,
    recognizedText,
    setRecognizedText
  } = useSpeech({
    enabled: isScreenFocused && micEnabled,
    mode: 'local',
  });

  const { 
    registerConversationCallbacks, 
    unregisterConversationCallbacks,
    setPendingContext 
  } = useVoiceCommands();

  const lastSpokenMessageIdRef = useRef<string | null>(null);
  const isFirstLoadRef = useRef<boolean>(true);
  const shouldSpeakNextMessageRef = useRef<boolean>(false);

  // ===================================================================
  // ATIVAR FLAG QUANDO RECEBER PARÂMETRO speakLastMessage
  // ===================================================================
  useEffect(() => {
    if (speakLastMessage === 'true' && isScreenFocused) {
      console.log('[Conversa] 🚩 Parâmetro speakLastMessage recebido - ATIVANDO flag');
      shouldSpeakNextMessageRef.current = true;
      
      router.setParams({ 
        speakLastMessage: undefined,
        timestamp: undefined
      });
    }
  }, [speakLastMessage, isScreenFocused]);

  // ===================================================================
  // REGISTRAR CALLBACKS QUANDO TELA ESTÁ EM FOCO
  // ===================================================================
  useEffect(() => {
    if (isScreenFocused && conversaId) {
      console.log('[Conversa] 🎤 Registrando callbacks de voz');
      
      setPendingContext({
        mode: 'chat',
        conversaId: conversaId
      });

      const callbacks = {
        onActivateMic: () => {
          console.log('[Conversa] ✅ Callback onActivateMic chamado');
          toggleMicrophone();
        },
        onTakePhoto: (question: string) => {
          console.log('[Conversa] 📸 Callback onTakePhoto chamado com:', question);
          handleTakePhotoFromVoice(question);
        },
        onOpenCamera: () => {
          console.log('[Conversa] 📷 Callback onOpenCamera chamado');
          handlePickImage();
        }
      };

      registerConversationCallbacks(callbacks);

      return () => {
        console.log('[Conversa] 🎤 Removendo callbacks de voz');
        unregisterConversationCallbacks();
        setPendingContext(null);
      };
    }
  }, [isScreenFocused, conversaId]);

  // ===================================================================
  // TIRAR FOTO POR COMANDO DE VOZ
  // ===================================================================
  const handleTakePhotoFromVoice = useCallback((question: string) => {
    console.log('[Conversa] 📸 Navegando para câmera com auto-foto');
    setMicEnabled(false);
    setRecognizedText('');
    lastRecognizedTextRef.current = '';
    
    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
    }
    
    router.replace({
      pathname: '/tabs',
      params: {
        mode: 'chat',
        conversaId: conversaId,
        autoTakePhoto: 'true',
        question: question,
        timestamp: Date.now().toString()
      }
    });
  }, [conversaId, router]);

  // ===================================================================
  // VOLTAR PARA TELA ANTERIOR
  // ===================================================================
  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/tabs/historico');
    }
  };

  // ===================================================================
  // CONTROLAR ESTADO QUANDO PERDE/GANHA FOCO
  // ===================================================================
  useEffect(() => {
    if (!isScreenFocused) {
      console.log('[Conversa] 🔴 Tela perdeu foco');
      setMessages([]);
      setActiveImage(null);
      setMicEnabled(false);
    } else {
      console.log('[Conversa] 🟢 Tela ganhou foco');
      console.log(`[Conversa] 🔍 shouldSpeakNextMessage: ${shouldSpeakNextMessageRef.current}`);
      console.log(`[Conversa] 🔍 isFirstLoad: ${isFirstLoadRef.current}`);
      console.log(`[Conversa] 🔍 lastSpokenMessageId: ${lastSpokenMessageIdRef.current}`);
      console.log(`[Conversa] 🔍 lastMessageCount: ${lastMessageCountRef.current}`);
    }
  }, [isScreenFocused]);

  // ===================================================================
  // BUSCAR MENSAGENS DO FIRESTORE
  // ===================================================================
  useEffect(() => {
    if (!conversaId || !isScreenFocused) return;

    console.log(`[Firestore] 🎧 Iniciando listener para ${conversaId}`);

    const unsubscribe = firestore()
      .collection('conversas')
      .doc(conversaId)
      .collection('mensagens')
      .orderBy('timestamp', 'asc')
      .onSnapshot(
        (snapshot) => {
          const msgs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Message[];
          
          console.log(`[Conversa] 📊 Total de mensagens: ${msgs.length}`);
          console.log(`[Conversa] 📊 Mensagens anteriores: ${lastMessageCountRef.current}`);
          
          const hasNewMessages = msgs.length > lastMessageCountRef.current && lastMessageCountRef.current > 0;
          
          setMessages(msgs);

          const lastApiMessage = [...msgs].reverse().find(m => m.sender === 'api');
          
          if (lastApiMessage) {
            console.log('═══════════════════════════════════════════════');
            console.log(`[Conversa] 🔍 ANÁLISE DE FALA`);
            console.log(`[Conversa] 📨 Message ID: ${lastApiMessage.id}`);
            console.log(`[Conversa] 🗣️ Last Spoken ID: ${lastSpokenMessageIdRef.current}`);
            console.log(`[Conversa] 🆕 isNewMessage: ${lastApiMessage.id !== lastSpokenMessageIdRef.current}`);
            console.log(`[Conversa] 🚩 shouldSpeakFlag: ${shouldSpeakNextMessageRef.current}`);
            console.log(`[Conversa] 1️⃣ isFirstLoad: ${isFirstLoadRef.current}`);
            console.log(`[Conversa] 📈 hasNewMessages: ${hasNewMessages}`);
            
            const isNewMessage = lastApiMessage.id !== lastSpokenMessageIdRef.current;
            const shouldSpeak = shouldSpeakNextMessageRef.current && isNewMessage;

            console.log(`[Conversa] 🎯 Decisão final: ${shouldSpeak ? '✅ FALAR' : '❌ NÃO FALAR'}`);
            console.log('═══════════════════════════════════════════════');

            if (shouldSpeak) {
              console.log('[Conversa] 🔊 PREPARANDO PARA FALAR:', lastApiMessage.text.substring(0, 50) + '...');
              lastSpokenMessageIdRef.current = lastApiMessage.id;
              shouldSpeakNextMessageRef.current = false;
              
              setTimeout(() => {
                console.log('[Conversa] 🔊 FALANDO AGORA!');
                speak(lastApiMessage.text);
              }, 3500);
            } else {
              if (isFirstLoadRef.current || lastSpokenMessageIdRef.current === null) {
                lastSpokenMessageIdRef.current = lastApiMessage.id;
                console.log('[Conversa] 📝 Primeira carga, marcando como já falada (SEM FALAR)');
              } else {
                console.log('[Conversa] ⏭️ Mensagem já foi falada anteriormente, ignorando');
              }
            }
          }

          lastMessageCountRef.current = msgs.length;
          isFirstLoadRef.current = false;

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
      console.log(`[Firestore] 🔇 Parando listener para ${conversaId}`);
      unsubscribe();
    };

  }, [conversaId, isScreenFocused, speak]);

  // ===================================================================
  // PROCESSAR RECONHECIMENTO DE VOZ COM DEBOUNCE
  // ===================================================================
  useEffect(() => {
    if (!recognizedText.trim() || !micEnabled) return;

    const textoAtual = recognizedText.trim();
    lastRecognizedTextRef.current = textoAtual;

    console.log("[Conversa] Texto sendo reconhecido:", textoAtual);

    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
    }

    recognitionTimeoutRef.current = setTimeout(() => {
      const textoFinal = lastRecognizedTextRef.current;
      
      if (!textoFinal) {
        console.log('[Conversa] Texto vazio após timeout, ignorando');
        return;
      }

      console.log("[Conversa] ✅ Texto final capturado:", textoFinal);

      if (!activeImage) {
        console.warn('[Conversa] Não há imagem ativa para enviar esta pergunta.');
        speak('Nenhuma imagem está ativa. Por favor, tire uma foto primeiro.');
        setRecognizedText('');
        setMicEnabled(false);
        return;
      }

      setMicEnabled(false);
      setRecognizedText('');
      lastRecognizedTextRef.current = '';
      
      enviarMensagem(textoFinal);
    }, 2000);

  }, [recognizedText, micEnabled, activeImage]);

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
      setRecognizedText('');
      lastRecognizedTextRef.current = '';
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
      }
      speak('Microfone ativado. Fale sua pergunta.');
    } else {
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
      }
      setRecognizedText('');
      lastRecognizedTextRef.current = '';
      speak('Microfone desativado.');
    }
  };

  // ===================================================================
  // NAVEGAR PARA TIRAR FOTO
  // ===================================================================
  const handlePickImage = () => {
    console.log('[Conversa] 📷 Navegando para câmera manualmente');
    
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
        conversaId: conversaId,
        timestamp: Date.now().toString()
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

    if (textOverride === undefined) {
      setInputText('');
    }
    
    setIsSending(true);

    try {
      const conversationDocRef = firestore()
        .collection('conversas')
        .doc(conversaId);
      
      const messagesCollectionRef = conversationDocRef.collection('mensagens');

      await messagesCollectionRef.add({
        sender: 'user',
        text: texto,
        imageUri: activeImage,
        timestamp: firestore.FieldValue.serverTimestamp(),
      });

      await conversationDocRef.update({
        dataAlteracao: firestore.FieldValue.serverTimestamp(),
      });
    
      console.log('[Upload] 🔄 Convertendo imagem para base64...');
      
      let base64Image: string;
      
      if (activeImage.startsWith('http')) {
        console.log('[Upload] 📥 Baixando imagem do Firebase Storage...');
        const response = await fetch(activeImage);
        const blob = await response.blob();
        
        base64Image = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            const base64Only = base64.split(',')[1];
            resolve(base64Only);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        console.log('[Upload] 📂 Lendo arquivo local...');
        const FileSystem = require('expo-file-system').default;
        base64Image = await FileSystem.readAsStringAsync(activeImage, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      console.log(`[Upload] ✅ Base64 pronto (${base64Image.length} caracteres)`);

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

      shouldSpeakNextMessageRef.current = true;
      console.log('[Conversa] 🚩 Flag ativada após enviar mensagem - resposta será falada');

      await messagesCollectionRef.add({
        sender: 'api',
        text: apiResponse,
        imageUri: null,
        timestamp: firestore.FieldValue.serverTimestamp(),
      });

      console.log('[Conversa] ✅ Resposta salva no Firestore, será falada pelo listener');

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
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={[styles.container, { backgroundColor: cores.fundo }]}>
        {/* ✅ BOTÃO VOLTAR COM CONTROLE DE ACESSIBILIDADE */}
        <TouchableOpacity 
          onPress={handleGoBack}
          style={[styles.header, { backgroundColor: cores.barrasDeNavegacao }]}
          accessibilityLabel="Voltar para tela anterior"
          accessibilityRole="button"
        >
          <Ionicons 
            name="arrow-back" 
            size={getIconSize('medium')} 
            color={cores.icone} 
          />
          <Text style={[styles.headerTitle, { color: cores.texto }]} numberOfLines={1}>
            Voltar
          </Text>
        </TouchableOpacity>

        <FlatList
          ref={flatListRef}
          style={{ paddingHorizontal: 10 }}
          data={messages}
          keyExtractor={item => item.id}
          accessible={false}
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

        {micEnabled && recognizedText && (
          <View style={[styles.listeningIndicator, { backgroundColor: cores.barrasDeNavegacao }]}>
            <ActivityIndicator size="small" color={cores.texto} />
            <Text style={[styles.listeningText, { color: cores.texto }]}>
              "{recognizedText}"
            </Text>
          </View>
        )}

        <View style={[styles.inputContainer, { backgroundColor: cores.barrasDeNavegacao }]}
          accessible={false}
        >
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
            placeholder="Escreva uma pergunta"
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            multiline
            editable={!micEnabled}
          />

          <TouchableOpacity 
            onPress={toggleMicrophone}
            style={styles.micButton}
            accessibilityLabel={micEnabled ? "Desativar microfone" : "Ativar microfone"}
            accessibilityRole="button"
          >
            <Ionicons 
              name={micEnabled ? 'mic' : 'mic-outline'}
              size={getIconSize('medium')}
              color={micEnabled ? '#FF453A' : cores.icone}
            />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => enviarMensagem()}
            disabled={isSending || micEnabled}
            style={styles.sendButton}
            accessibilityRole='button'
            accessibilityLabel="Enviar mensagem"
          >
            {isSending ? (
              <ActivityIndicator size="small" color={cores.texto} />
            ) : (
              <Ionicons 
                name="send" 
                size={getIconSize('medium')} 
                color={micEnabled ? '#666' : cores.icone}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
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
    marginBottom: 10,
    marginLeft: 5,
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