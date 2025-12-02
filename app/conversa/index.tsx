import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Platform,
  ActivityIndicator,
  Image,
  Alert,
  Keyboard,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../../components/ThemeContext';
import { useSpeech } from '../../hooks/useSpeech';
import { useVoiceCommands } from '../../components/VoiceCommandContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import firestore from '@react-native-firebase/firestore';
import { useMicrophone } from '../../components/MicrophoneContext';
import SpeechManager from '../../utils/speechManager';

const SERVER_URL = 'https://www.acessivision.com.br/upload';

// ✅ Tempo de silêncio antes de enviar automaticamente (3 segundos)
const SILENCE_TIMEOUT = 3000;

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

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  // ✅ Timer para detectar silêncio
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMessageCountRef = useRef<number>(0);
  const localListenerRef = useRef<((text: string) => void) | null>(null);

  const { disableMicrophone: disableGlobalMic, enableMicrophone: enableGlobalMic } = useMicrophone();

  const { 
    isMicrophoneEnabled: globalMicEnabled
  } = useMicrophone();

  const { 
    speak, 
    startListening, 
    stopListening,
    isListening,
    recognizedText,
    setRecognizedText
  } = useSpeech({
    enabled: false,
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

  useEffect(() => {
    if (!micEnabled) {
      setRecognizedText('');
      setInputText('');
    }
  }, [micEnabled, setRecognizedText]);

  useEffect(() => {
    if (!globalMicEnabled && micEnabled) {
      console.log('[Conversa] 🔴 Toggle global desligado, desativando mic local');
      setMicEnabled(false);
      stopListening();
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    }
  }, [globalMicEnabled, micEnabled, stopListening]);

  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        console.log('[Teclado] ⬆️ Teclado aberto - Altura:', e.endCoordinates.height);
        setKeyboardHeight(e.endCoordinates.height);
      }
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        console.log('[Teclado] ⬇️ Teclado fechado');
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

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
  // ✅ LISTENER LOCAL - Atualiza input e detecta silêncio
  // ===================================================================
  useEffect(() => {
    if (!micEnabled || !isScreenFocused) return;

    console.log('[Conversa] 🎧 Registrando listener LOCAL no SpeechManager');

    const localListener = (text: string) => {
      console.log('[Conversa] 📥 Texto recebido no listener LOCAL:', text);
      
      const normalizedText = text.trim();
      if (!normalizedText) return;

      // ✅ Atualiza o input diretamente
      setInputText(prev => {
        const newText = prev ? `${prev} ${normalizedText}` : normalizedText;
        console.log('[Conversa] 📝 Texto no input:', newText);
        return newText;
      });

      // ✅ Cancela timeout anterior e cria novo
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }

      // ✅ Após 3 segundos de silêncio, envia automaticamente
      silenceTimeoutRef.current = setTimeout(() => {
        console.log('[Conversa] ⏰ Silêncio detectado - Enviando automaticamente');
        
        setInputText(currentText => {
          const textoParaEnviar = currentText.trim();
          
          if (!textoParaEnviar) {
            speak('Nenhum texto foi reconhecido.');
            return '';
          }
          
          if (!activeImage) {
            speak('Tire uma foto primeiro.');
            return '';
          }
          
          // Desliga microfone e envia
          setMicEnabled(false);
          stopListening();
          setRecognizedText('');
          
          // Envia após um pequeno delay
          setTimeout(() => {
            enviarMensagem(textoParaEnviar);
          }, 100);
          
          return ''; // Limpa input
        });
      }, SILENCE_TIMEOUT);
    };

    localListenerRef.current = localListener;
    SpeechManager.addListener(localListener);

    return () => {
      if (localListenerRef.current) {
        SpeechManager.removeListener(localListenerRef.current);
        localListenerRef.current = null;
        console.log('[Conversa] 🧹 Listener LOCAL removido');
      }
      
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, [micEnabled, isScreenFocused, activeImage, speak, stopListening]);

  const toggleMicrophone = useCallback(() => {
    if (!globalMicEnabled) {
      Alert.alert('Microfone Desabilitado', 'Ative no cabeçalho primeiro.');
      speak('Microfone está desabilitado globalmente.');
      return;
    }
    
    if (!activeImage) {
      Alert.alert('Atenção', 'Tire uma foto primeiro.');
      speak('Tire uma foto primeiro.');
      return;
    }
    
    if (micEnabled) {
      setMicEnabled(false);
      setInputText('');
      stopListening();
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      speak('Microfone desativado.');
    } else {
      setMicEnabled(true);
      setRecognizedText('');
      setInputText('');
      
      speak('Gravando áudio. Fale sua pergunta.', () => {
        SpeechManager.startRecognition('local');
      });
    }
  }, [micEnabled, activeImage, globalMicEnabled, speak, stopListening, setRecognizedText]);

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
        },
        onSendAudio: () => {
          console.log('[Conversa] 🎙️ Callback onSendAudio chamado');
          
          if (!activeImage) {
            speak('Tire uma foto primeira.');
            return;
          }
          
          if (!micEnabled) {
            console.log('[Conversa] ✅ Ativando microfone via onSendAudio');
            setMicEnabled(true);
            setRecognizedText('');
            setInputText('');
            
            setTimeout(() => {
              speak('Gravando áudio. Fale sua pergunta.', () => {
                SpeechManager.startRecognition('local');
              });
            }, 300);
          }
        }
      };

      registerConversationCallbacks(callbacks);

      return () => {
        console.log('[Conversa] 🎤 Removendo callbacks de voz');
        unregisterConversationCallbacks();
        setPendingContext(null);
      };
    }
  }, [isScreenFocused, conversaId, activeImage, micEnabled, speak, registerConversationCallbacks, unregisterConversationCallbacks, setPendingContext, toggleMicrophone]);

  const handleTakePhotoFromVoice = useCallback((question: string) => {
    console.log('[Conversa] 📸 Navegando para câmera com auto-foto');
    setMicEnabled(false);
    setRecognizedText('');
    setInputText('');
    
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
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

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/tabs/historico');
    }
  };

  useEffect(() => {
    if (!isScreenFocused) {
      console.log('[Conversa] 🔴 Tela perdeu foco');
      setMessages([]);
      setActiveImage(null);
      setMicEnabled(false);
      setInputText('');
    } else {
      console.log('[Conversa] 🟢 Tela ganhou foco');
    }
  }, [isScreenFocused]);

  useEffect(() => {
    if (!conversaId || !isScreenFocused) return;

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
          
          setMessages(msgs);

          const lastApiMessage = [...msgs].reverse().find(m => m.sender === 'api');
          
          if (lastApiMessage) {
            const isNewMessage = lastApiMessage.id !== lastSpokenMessageIdRef.current;
            const shouldSpeak = shouldSpeakNextMessageRef.current && isNewMessage;

            if (shouldSpeak) {
              lastSpokenMessageIdRef.current = lastApiMessage.id;
              shouldSpeakNextMessageRef.current = false;
              
              setTimeout(() => {
                speak(lastApiMessage.text);
              }, 3500);
            } else {
              if (isFirstLoadRef.current || lastSpokenMessageIdRef.current === null) {
                lastSpokenMessageIdRef.current = lastApiMessage.id;
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
      unsubscribe();
    };

  }, [conversaId, isScreenFocused, speak]);

  const handlePickImage = () => {
    console.log('[Conversa] 📷 Navegando para câmera');
    
    setMicEnabled(false);
    setRecognizedText('');
    setInputText('');
    
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
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

  const enviarMensagem = async (textOverride?: string) => {
    const texto = (textOverride !== undefined ? textOverride : inputText).trim();

    if (!texto) {
      Alert.alert('Atenção', 'Por favor, digite ou fale uma pergunta.');
      return;
    }

    if (!activeImage) {
      Alert.alert('Erro', 'Não há uma imagem ativa.');
      return;
    }

    setInputText('');
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
        const FileSystem = require('expo-file-system').default;
        base64Image = await FileSystem.readAsStringAsync(activeImage, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

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

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Erro: ${response.status} - ${errorBody}`);
      }

      const data = await response.json();
      const apiResponse = data.description;

      if (!apiResponse) {
        throw new Error("Servidor não enviou 'description'.");
      }

      shouldSpeakNextMessageRef.current = true;

      await messagesCollectionRef.add({
        sender: 'api',
        text: apiResponse,
        imageUri: null,
        timestamp: firestore.FieldValue.serverTimestamp(),
      });

    } catch (error) {
      console.error('Erro ao enviar:', error);
      Alert.alert('Erro', 'Não foi possível enviar a mensagem.');
      speak('Erro ao enviar mensagem.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: cores.barrasDeNavegacao }]}>
      <View style={[styles.outerContainer, { backgroundColor: cores.fundo }]}>
        <TouchableOpacity 
          onPress={handleGoBack}
          style={[styles.header, { backgroundColor: cores.barrasDeNavegacao }]}
          accessibilityLabel="Voltar"
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
          style={styles.flatList}
          contentContainerStyle={[
            styles.flatListContent,
            { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 100 : 100 }
          ]}
          data={messages}
          keyExtractor={item => item.id}
          accessible={false}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const senderLabel = item.sender === 'user' ? "Você" : "Acessivision";
            const combinedLabel = `${senderLabel}. ${item.text || ''}`;

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

        <View 
          style={[
            styles.inputContainer, 
            { 
              backgroundColor: cores.barrasDeNavegacao,
              bottom: keyboardHeight 
            }
          ]}
          accessible={false}
        >
          <TouchableOpacity 
            onPress={handlePickImage}
            style={styles.imagePickerButton}
            accessibilityLabel={activeImage ? 'Foto ativa' : 'Tirar foto'}
          >
            {activeImage ? (
              <Image source={{ uri: activeImage }} style={styles.activeImagePreview} />
            ) : (
              <Ionicons name="camera" size={getIconSize('medium')} color={cores.icone} />
            )}
          </TouchableOpacity>

          <TextInput
            style={[styles.input, { color: cores.texto, backgroundColor: cores.fundo }]}
            placeholder="Escreva ou fale uma pergunta"
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            multiline
            editable={!micEnabled}
            maxLength={500}
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
            accessibilityLabel="Enviar"
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  outerContainer: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: '600' },
  flatList: { flex: 1 },
  flatListContent: { paddingHorizontal: 10, paddingTop: 10, flexGrow: 1 },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginVertical: 4,
  },
  userBubble: { alignSelf: 'flex-end' },
  apiBubble: { alignSelf: 'flex-start' },
  messageText: { fontSize: 16, lineHeight: 22 },
  messageImage: { width: 180, height: 180, borderRadius: 12, marginBottom: 8 },
  recordingText: { fontSize: 14, fontWeight: '500' },
  inputContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 12,
    minHeight: 80,
    gap: 4,
  },
  imagePickerButton: {
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 12,
    flexShrink: 0,
    borderWidth: 2,
    borderColor: '#555',
  },
  activeImagePreview: { width: 90, height: 90, borderRadius: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    maxHeight: 100,
    minHeight: 40,
  },
  micButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  sendButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
});

export default ConversationScreen;