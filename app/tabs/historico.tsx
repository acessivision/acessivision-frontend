import { useEffect, useState, useRef, useCallback } from 'react';
import { 
  FlatList, 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  AccessibilityInfo,
  findNodeHandle,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../components/ThemeContext';
import { useAuth } from '../../components/AuthContext';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { toTitleCase } from '../../utils/toTitleCase';
import { useSpeech } from '../../hooks/useSpeech';
import SpeechManager from '../../utils/speechManager';
import { useMicrophone } from '../../components/MicrophoneContext';

import { getFirestore, collection, query, where, orderBy, onSnapshot, doc, getDocs, writeBatch, deleteDoc, updateDoc, addDoc, serverTimestamp, setDoc, arrayUnion, arrayRemove, Timestamp } from '@react-native-firebase/firestore';

interface Conversation {
  id: string;
  titulo: string;
  dataCriacao: Timestamp;
  dataAlteracao: Timestamp;
}

type StepType = 'aguardandoPalavraTitulo' | 'aguardandoTitulo' | 'aguardandoConfirmacaoExclusao' | 'idle';

const HistoryScreen: React.FC = () => {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchText, setSearchText] = useState('');
  const [isSearchListening, setIsSearchListening] = useState(false);
  const [searchStep, setSearchStep] = useState<'idle' | 'aguardandoPalavraPesquisa' | 'aguardandoPesquisa'>('idle');
  const searchProcessadoRef = useRef(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { cores, getFontSize, getIconSize } = useTheme();
  const { user, isLoading: isAuthLoading } = useAuth();
  
  const isScreenFocused = useIsFocused();

  const [modalVisible, setModalVisible] = useState(false);
  const [tituloInput, setTituloInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState<StepType>('idle');

  const wasMicEnabledBeforeScreenRef = useRef(false);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [conversaParaEditar, setConversaParaEditar] = useState<{ id: string; titulo: string } | null>(null);
  const [editTituloInput, setEditTituloInput] = useState('');
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editStep, setEditStep] = useState<StepType>('idle');
  const editTituloProcessadoRef = useRef(false);
  const editTituloTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [conversaParaExcluir, setConversaParaExcluir] = useState<{ id: string; titulo: string } | null>(null);

  const tituloProcessadoRef = useRef(false);
  const tituloTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmacaoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const wasListeningBeforeModalRef = useRef(false);
  const deleteModalTitleRef = useRef(null);

  const isFocused = useIsFocused();

  const [shouldListenLocally, setShouldListenLocally] = useState(false);

  const isSpeakingRef = useRef(false);

  const hasActiveModal = modalVisible || editModalVisible || !!conversaParaExcluir || isSearchListening;

  const { 
    speak, 
    startListening, 
    stopListening,
    stopSpeaking,
    isListening,
    recognizedText,
    setRecognizedText 
  } = useSpeech({
    enabled: isScreenFocused && hasActiveModal, 
    mode: 'local',
  });

  const { isMicrophoneEnabled } = useMicrophone();

  const globalSpeech = useSpeech({
    enabled: isScreenFocused && !hasActiveModal,
    mode: 'global',
  });

  /*
  carrega as conversas do usuário
  */
  useEffect(() => {
    if (!user || isAuthLoading) return;

    const db = getFirestore();
    const conversasCollectionRef = collection(db, 'conversas');
    const q = query(
      conversasCollectionRef,
      where('ownerUid', '==', user.uid),
      orderBy('dataAlteracao', 'desc')
    );

    const unsubscribe = onSnapshot(q,
      (querySnapshot) => {
        const conversasArray: Conversation[] = [];
        querySnapshot.forEach((documentSnapshot) => {
          conversasArray.push({
            id: documentSnapshot.id,
            titulo: documentSnapshot.data().titulo,
            dataCriacao: documentSnapshot.data().dataCriacao,
            dataAlteracao: documentSnapshot.data().dataAlteracao,
          });
        });
        console.log(`✅ ${conversasArray.length} conversas encontradas`);
        setConversations(conversasArray);
      },
      (error) => {
        console.error('❌ Erro ao buscar conversas:', error);
        Alert.alert('Erro', 'Não foi possível carregar as conversas.');
      }
    );

    return () => unsubscribe();
  }, [user, isAuthLoading]);

  const filteredConversations = conversations.filter(conv => 
    conv.titulo.toLowerCase().includes(searchText.toLowerCase())
  );

  useEffect(() => {
    if (!isScreenFocused) return;
    
    const hasActiveModal = modalVisible || editModalVisible || !!conversaParaExcluir || isSearchListening;
    
    if (hasActiveModal) {
      console.log('[Histórico] 🛑 Modal aberto - parando reconhecimento local');
      SpeechManager.stopRecognition();
    } else {
      console.log('[Histórico] ▶️ Modal fechado - verificando se deve reativar');
      
      setTimeout(() => {
        if (isMicrophoneEnabled) {
          console.log('[Histórico] ✅ Microfone habilitado, reativando reconhecimento');
          SpeechManager.startRecognition('global');
        } else {
          console.log('[Histórico] 🔇 Microfone desabilitado, não reativando');
        }
      }, 300);
    }
  }, [modalVisible, editModalVisible, conversaParaExcluir, isSearchListening, isScreenFocused, isMicrophoneEnabled]);

useEffect(() => {
  if (!isScreenFocused) {
    console.log('[Histórico] ⏭️ Tela não focada, ignorando comando');
    return;
  }

  if (!globalSpeech.recognizedText.trim() || modalVisible || editModalVisible || conversaParaExcluir || isSearchListening) return;

  const textoAtual = globalSpeech.recognizedText.trim();
  const textoLower = textoAtual.toLowerCase();
  
  console.log(`[Histórico - Global] Texto sendo reconhecido: "${textoAtual}"`);

  if (textoLower.includes('pesquisar') || textoLower.includes('buscar') || textoLower.includes('procurar')) {
    console.log('[Histórico] 🔍 Comando "pesquisar" detectado');
    globalSpeech.setRecognizedText('');
    globalSpeech.stopListening();
    
    activateSearchMicrophone();
    return;
  }

  if (textoLower.includes('criar') && (textoLower.includes('conversa') || textoLower.includes('nova'))) {
    if (textoLower.includes('botão')) {
      console.log('[Histórico] ⚠️ Ignorando - é leitura do botão, não comando');
      globalSpeech.setRecognizedText('');
      return;
    }
    console.log('✅ Comando "criar nova conversa" detectado');
    globalSpeech.setRecognizedText('');
    globalSpeech.stopListening();
    wasListeningBeforeModalRef.current = true;
    
    setTimeout(() => {
      setTituloInput('');
      setStep('aguardandoPalavraTitulo');
      setModalVisible(true);
      setRecognizedText('');
      tituloProcessadoRef.current = false;
      
      setTimeout(() => {
        speak("Por favor, digite o título ou diga. 'título'. para informá-lo por voz.", () => {
          startListening(true);
        });
      }, 300);
    }, 200);
  }
}, [globalSpeech.recognizedText, modalVisible, editModalVisible, conversaParaExcluir, isSearchListening]);

  useEffect(() => {
    if (!recognizedText.trim()) return;

    const textoAtual = recognizedText.trim();
    const textoLower = textoAtual.toLowerCase();
    
    console.log(`[Histórico] Step: ${step}, EditStep: ${editStep}, Texto: "${textoAtual}"`);

    const screenReaderBlacklist = [
      'gravar título',
      'digite ou fale o título',
      'titulo da conversa',
      'nova conversa',
      'salvar',
      'cancelar',
      'fechar',
      'editar conversa',
      'editar título',
      'novo titulo',
      'excluir conversa',
      'confirmar exclusão',
      'botão',
      'campo de texto',
      'microfone',
      'aguardando título',
      'ouvindo título',
      'gravando título',
      'criar nova conversa botão',
    ];
    
    const isScreenReaderNoise = screenReaderBlacklist.some(phrase => 
      textoLower.includes(phrase)
    );
    
    if (isScreenReaderNoise) {
      console.log('⚠️ Ignorando ruído do leitor de tela:', textoAtual);
      setRecognizedText('');
      return;
    }

    if (modalVisible) {
      if (step === 'aguardandoPalavraTitulo') {
        if (isSpeakingRef.current) {
          console.log('⚠️ Ignorando - TTS ainda ativo');
          setRecognizedText('');
          return;
        }
        
        const tituloVariations = ['titulo', 'título', 'dítulo', 'ditulo', 'titu', 'it'];
        const containsTitulo = tituloVariations.some(v => textoLower.includes(v));
        
        if (containsTitulo) {
          console.log('✅ Palavra "título" detectada, mudando para aguardar o título');
          setStep('aguardandoTitulo');
          setRecognizedText('');
          tituloProcessadoRef.current = false;
          
          stopListening();
          isSpeakingRef.current = true;
          speak("Aguarde um momento e fale o título", () => {
            isSpeakingRef.current = false;
            setTimeout(() => {
              startListening(true);
            }, 500);
          });
          return;
        } else {
          console.log('⚠️ Aguardando palavra "título", recebeu:', textoAtual);
          setRecognizedText('');
          return;
        }
      }
      
      if (step === 'aguardandoTitulo' && textoAtual && !tituloProcessadoRef.current) {
        console.log(`📝 Acumulando título: "${textoAtual}"`);
        
        if (isSpeakingRef.current) {
          console.log('⚠️ Ignorando acumulação - TTS ainda ativo');
          setRecognizedText('');
          return;
        }
        
        const ttsBlacklist = [
          'aguarde um momento',
          'fale o título',
          'fale o titulo',
          'escutando',
          'processando',
          'por favor',
          'gravando título',
          'gravando titulo',
          'escutando o título',
          'fale e aguarde',
        ];
        
        const containsTTSPhrase = ttsBlacklist.some(phrase => 
          textoLower.includes(phrase)
        );
        
        if (containsTTSPhrase) {
          console.log('⚠️ Ignorando - texto contém frase do TTS');
          setRecognizedText('');
          return;
        }
        
        if (tituloTimeoutRef.current) {
          clearTimeout(tituloTimeoutRef.current);
        }
        
        tituloTimeoutRef.current = setTimeout(() => {
          if (!tituloProcessadoRef.current && textoAtual) {
            console.log(`✅ Título final capturado: "${textoAtual}"`);
            tituloProcessadoRef.current = true;
            stopListening();
            
            isSpeakingRef.current = true;
            
            speak(`Criando conversa com título: ${textoAtual}`, () => {
              setTimeout(() => {
                isSpeakingRef.current = false;
                criarConversaComTitulo(textoAtual);
              }, 300);
            });
          }
        }, 2000);
        return;
      }
    }

    if (editModalVisible) {
      if (editStep === 'aguardandoPalavraTitulo') {
        if (isSpeakingRef.current) {
          console.log('⚠️ [Edição] Ignorando - TTS ainda ativo');
          setRecognizedText('');
          return;
        }
        
        const tituloVariations = ['titulo', 'título', 'dítulo', 'ditulo', 'titu', 'it'];
        const containsTitulo = tituloVariations.some(v => textoLower.includes(v));
        
        if (containsTitulo) {
          console.log('✅ [Edição] Palavra "título" detectada, mudando para aguardar o título');
          setEditStep('aguardandoTitulo');
          setRecognizedText('');
          editTituloProcessadoRef.current = false;
          
          stopListening();
          isSpeakingRef.current = true;
          speak("Aguarde um momento e fale o novo título", () => {
            isSpeakingRef.current = false;
            setTimeout(() => {
              startListening(true);
            }, 500);
          });
          return;
        } else {
          console.log('⚠️ [Edição] Aguardando palavra "título", recebeu:', textoAtual);
          setRecognizedText('');
          return;
        }
      }
      
      if (editStep === 'aguardandoTitulo' && textoAtual && !editTituloProcessadoRef.current) {
        console.log(`📝 [Edição] Acumulando título: "${textoAtual}"`);
        
        if (isSpeakingRef.current) {
          console.log('⚠️ [Edição] Ignorando - TTS ainda ativo');
          setRecognizedText('');
          return;
        }
        
        const ttsBlacklist = [
          'aguarde um momento',
          'fale o novo título',
          'fale o novo titulo',
          'escutando',
          'processando',
          'novo título',
          'novo titulo',
          'gravando título',
          'gravando titulo',
          'escutando o título',
          'fale e aguarde',
        ];
        
        const containsTTSPhrase = ttsBlacklist.some(phrase => 
          textoLower.includes(phrase)
        );
        
        if (containsTTSPhrase) {
          console.log('⚠️ [Edição] Ignorando - texto contém frase do TTS');
          setRecognizedText('');
          return;
        }
        
        if (editTituloTimeoutRef.current) {
          clearTimeout(editTituloTimeoutRef.current);
        }
        
        editTituloTimeoutRef.current = setTimeout(() => {
          if (!editTituloProcessadoRef.current && textoAtual) {
            console.log(`✅ [Edição] Título final capturado: "${textoAtual}"`);
            editTituloProcessadoRef.current = true;
            stopListening();
            
            isSpeakingRef.current = true;
            
            speak(`Renomeando conversa para: ${textoAtual}`, () => {
              setTimeout(() => {
                isSpeakingRef.current = false;
                renomearConversaComTitulo(textoAtual);
              }, 300);
            });
          }
        }, 2000);
        return;
      }
    }

    if (conversaParaExcluir && step === 'aguardandoConfirmacaoExclusao') {
      console.log(`🗑️ Processando resposta de exclusão: "${textoAtual}"`);
      
      if (confirmacaoTimeoutRef.current) {
        clearTimeout(confirmacaoTimeoutRef.current);
      }

      confirmacaoTimeoutRef.current = setTimeout(() => {
        const confirmWords = ['sim', 'confirmo', 'confirmar', 'isso', 'exato', 'certo', 'ok', 'yes', 'pode', 'quero'];
        const denyWords = ['não', 'nao', 'cancelar', 'cancel', 'errado', 'no', 'negativo', 'nunca'];
        
        const isConfirm = confirmWords.some(word => textoLower.includes(word));
        const isDeny = denyWords.some(word => textoLower.includes(word));
        
        if (isConfirm) {
          console.log('✅ Confirmação de exclusão recebida');
          stopListening();
          setRecognizedText('');
          speak("Confirmado. Excluindo conversa.", () => {
            deletarDocumentosDaConversa(conversaParaExcluir.id);
            setConversaParaExcluir(null);
            setStep('idle');
          });
        } else if (isDeny) {
          console.log('❌ Exclusão cancelada pelo usuário');
          stopListening();
          setRecognizedText('');
          speak("Cancelado.", () => {
            setConversaParaExcluir(null);
            setStep('idle');
          });
        } else {
          console.log('⚠️ Resposta não reconhecida, perguntando novamente');
          setRecognizedText('');
          speak(`Não entendi. Você quer excluir a conversa ${conversaParaExcluir.titulo}? Diga sim ou não.`, () => {
            startListening(true);
          });
        }
      }, 1500);
      return;
    }

    if (isSearchListening && searchStep === 'aguardandoPesquisa') {
      if (textoAtual && !searchProcessadoRef.current) {
        console.log(`🔍 [Pesquisa] Acumulando termo: "${textoAtual}"`);
        
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }
        
        searchTimeoutRef.current = setTimeout(() => {
          if (!searchProcessadoRef.current && textoAtual) {
            console.log(`✅ [Pesquisa] Termo final capturado: "${textoAtual}"`);
            searchProcessadoRef.current = true;
            stopListening();
            
            setSearchText(textoAtual);
            setIsSearchListening(false);
            setSearchStep('idle');
            setRecognizedText('');
            
            setTimeout(() => {
              const resultadosFiltrados = conversations.filter(conv => 
                conv.titulo.toLowerCase().includes(textoAtual.toLowerCase())
              );
              
              let mensagem = '';
              
              if (resultadosFiltrados.length === 0) {
                mensagem = `Nenhuma conversa encontrada com título: ${textoAtual}`;
              } else if (resultadosFiltrados.length === 1) {
                mensagem = `Encontrado: ${resultadosFiltrados[0].titulo}. 1 de 1 na lista.`;
              } else {
                mensagem = `Encontrado: ${resultadosFiltrados[0].titulo}. 1 de ${resultadosFiltrados.length} na lista.`;
              }
              
              console.log(`[Pesquisa] 📢 Anunciando: ${mensagem}`);
              
              speak(mensagem, () => {
                setTimeout(() => {
                  if (wasListeningBeforeModalRef.current) {
                    console.log('[Histórico] ✅ Reativando microfone global após pesquisa');
                    globalSpeech.startListening(true);
                  }
                }, 500);
              });
            }, 100);
          }
        }, 2000);
        return;
      }
    }
  }, [recognizedText, step, editStep, modalVisible, editModalVisible, conversaParaExcluir, isSearchListening, searchStep]);


  useEffect(() => {
    return () => {
      if (tituloTimeoutRef.current) clearTimeout(tituloTimeoutRef.current);
      if (confirmacaoTimeoutRef.current) clearTimeout(confirmacaoTimeoutRef.current);
      if (editTituloTimeoutRef.current) clearTimeout(editTituloTimeoutRef.current);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (conversaParaExcluir && step === 'aguardandoConfirmacaoExclusao') {
      const timeoutId = setTimeout(() => {
        if (deleteModalTitleRef.current) {
          const reactTag = findNodeHandle(deleteModalTitleRef.current);
          if (reactTag) {
            AccessibilityInfo.setAccessibilityFocus(reactTag);
          }
        }
      }, 200);
      return () => clearTimeout(timeoutId);
    }
  }, [conversaParaExcluir, step]);

  useEffect(() => {
    if (isScreenFocused && !user && !isAuthLoading) {
      speak("Faça login para acessar o histórico");
    }
  }, [isScreenFocused, user, isAuthLoading, speak]);

  useEffect(() => {
    const hasActiveModal = modalVisible || editModalVisible || !!conversaParaExcluir || isSearchListening;
    
    if (hasActiveModal && !shouldListenLocally) {
      console.log('[Histórico] ✅ Ativando escuta local - modal aberto');
      setShouldListenLocally(true);
    } else if (!hasActiveModal && shouldListenLocally) {
      console.log('[Histórico] ❌ Desativando escuta local - modal fechado');
      setShouldListenLocally(false);
    }
  }, [modalVisible, editModalVisible, conversaParaExcluir, isSearchListening, shouldListenLocally]);

  const renomearConversaComTitulo = async (novoTitulo: string) => {
    if (!user || !conversaParaEditar) return;

    const tituloFinal = novoTitulo.trim();
    
    if (!tituloFinal) {
      Alert.alert('Atenção', 'O título não pode estar vazio.');
      return;
    }

    console.log(`✏️ Renomeando conversa ${conversaParaEditar.id} para "${tituloFinal}"`);
    setIsEditSaving(true);

    try {
      const db = getFirestore();
      const conversaDocRef = doc(collection(db, 'conversas'), conversaParaEditar.id);
      
      await updateDoc(conversaDocRef, {
        titulo: tituloFinal,
        dataAlteracao: serverTimestamp(),
      });

      console.log('✅ Conversa renomeada com sucesso');
      speak(`Conversa renomeada para ${tituloFinal}`);
      fecharEditModal();

    } catch (error) {
      console.error("❌ Erro ao renomear conversa:", error);
      Alert.alert('Erro', 'Não foi possível renomear a conversa. Tente novamente.');
    } finally {
      setIsEditSaving(false);
    }
  };

  const renomearConversaManual = () => {
    renomearConversaComTitulo(editTituloInput);
  };

  const excluirConversa = (conversationId: string, titulo: string) => {
    if (!user) return;

    console.log(`🗑️ Iniciando fluxo de exclusão por voz para: ${titulo}`);
    wasListeningBeforeModalRef.current = globalSpeech.isListening;
    
    globalSpeech.stopListening();
    stopSpeaking();
    
    setStep('aguardandoConfirmacaoExclusao');
    setRecognizedText('');
    isSpeakingRef.current = false;
    
    setTimeout(() => {
      setConversaParaExcluir({ id: conversationId, titulo });
      
      setTimeout(() => {
        isSpeakingRef.current = true;
        speak(`Tem certeza que deseja excluir a conversa ${titulo}? Diga sim ou não.`, () => {
          isSpeakingRef.current = false;
          setTimeout(() => {
            console.log('[Histórico] 🎤 Iniciando reconhecimento local APÓS TTS (exclusão)');
            startListening(true);
          }, 800);
        });
      }, 500);
    }, 300);
  };


  const deletarDocumentosDaConversa = async (conversationId: string) => {
    if (!user) return;

    console.log(`🗑️ Executando exclusão da conversa ${conversationId}...`);
    
    try {
      const db = getFirestore();
      const mensagensRef = collection(doc(collection(db, 'conversas'), conversationId), 'mensagens');
      const mensagensSnapshot = await getDocs(mensagensRef);

      if (!mensagensSnapshot.empty) {
        console.log(`   ...excluindo ${mensagensSnapshot.size} mensagens.`);
        const batch = writeBatch(db);
        mensagensSnapshot.docs.forEach((docSnapshot) => {
          batch.delete(docSnapshot.ref);
        });
        await batch.commit();
      }

      console.log('   ...excluindo documento principal da conversa.');
      const conversaDocRef = doc(collection(db, 'conversas'), conversationId);
      await deleteDoc(conversaDocRef);

      console.log('   ...removendo do histórico do usuário.');
      const userDocRef = doc(collection(db, 'usuarios'), user.uid);
      await updateDoc(userDocRef, {
        historico: arrayRemove(conversationId)
      });
      
      console.log('✅ Conversa excluída com sucesso.');
      speak('Conversa excluída com sucesso.');

      setTimeout(() => {
        if (wasListeningBeforeModalRef.current) {
          console.log('[Histórico] ✅ Reativando microfone global após exclusão');
          globalSpeech.startListening(true);
        }
      }, 500);

    } catch (error) {
      console.error("❌ Erro ao excluir conversa:", error);
      let errorMessage = "Erro desconhecido";
      if (error instanceof Error) errorMessage = error.message;
      Alert.alert('Erro', 'Não foi possível excluir a conversa: ' + errorMessage);
      speak('Erro ao excluir conversa.');
    }
  };

  const isNavigatingToConversaRef = useRef(false);
  const criarConversaComTitulo = async (titulo: string) => {
    if (!user) return;

    if (isNavigatingToConversaRef.current) {
      console.log('[Historico] ⚠️ Já está criando/navegando, ignorando');
      return;
    }
    
    const tituloLower = titulo.toLowerCase();
    const ttsBlacklist = [
      'escutando o título',
      'fale e aguarde',
      'digite o título',
      'título para informá-lo',
      'por favor',
    ];
    
    const containsTTSPhrase = ttsBlacklist.some(phrase => 
      tituloLower.includes(phrase)
    );
    
    if (containsTTSPhrase) {
      console.log('[Historico] ⚠️ Título contém frase do TTS, ignorando criação');
      return;
    }
    
    const tituloFinal = titulo.trim();
    
    if (!tituloFinal) {
      Alert.alert('Atenção', 'Por favor, digite o título ou diga "título" para informá-lo por voz.');
      return;
    }

    isNavigatingToConversaRef.current = true;

    console.log(`📝 Criando conversa "${tituloFinal}" para ${user.uid}`);
    setIsSaving(true);

    try {
      const db = getFirestore();
      const conversasCollectionRef = collection(db, 'conversas');
      
      const newConversationRef = await addDoc(conversasCollectionRef, {
        titulo: tituloFinal,
        dataCriacao: serverTimestamp(),
        dataAlteracao: serverTimestamp(),
        ownerUid: user.uid,
      });

      console.log('✅ Conversa criada com ID:', newConversationRef.id);

      const userDocRef = doc(collection(db, 'usuarios'), user.uid);
      await setDoc(
        userDocRef,
        { historico: arrayUnion(newConversationRef.id) },
        { merge: true }
      );

      speak(`Conversa ${tituloFinal} criada com sucesso!`);
      fecharModal();
      
      setTimeout(() => {
        router.push({
          pathname: '/conversa',
          params: { conversaId: newConversationRef.id, titulo: tituloFinal }
        });
        setTimeout(() => {
          isNavigatingToConversaRef.current = false;
        }, 1000);
      }, 500);

    } catch (error) {
      console.error("❌ Erro ao criar conversa:", error);
      Alert.alert('Erro', 'Não foi possível criar a conversa. Tente novamente.');
      isNavigatingToConversaRef.current = false;
    } finally {
      setIsSaving(false);
    }
  };

  const criarConversaManual = () => {
    criarConversaComTitulo(tituloInput);
  };

  const abrirModal = () => {
    console.log('[Histórico] 📂 Abrindo modal de criação');
    wasListeningBeforeModalRef.current = globalSpeech.isListening;
    console.log(`[Histórico] 🎤 Estado do microfone antes: ${wasListeningBeforeModalRef.current ? 'ATIVO' : 'INATIVO'}`);
    
    globalSpeech.stopListening();
    stopSpeaking();
    console.log('[Histórico] 🛑 Reconhecimento global pausado');
    
    setTituloInput('');
    setStep('aguardandoPalavraTitulo');
    setIsSaving(false);
    setRecognizedText('');
    tituloProcessadoRef.current = false;
    isSpeakingRef.current = false;
    
    setTimeout(() => {
      setModalVisible(true);
      
      setTimeout(() => {
        isSpeakingRef.current = true;
        speak("Por favor, digite o título ou diga. 'título'. para informá-lo por voz.", () => {
          isSpeakingRef.current = false;
          setTimeout(() => {
            console.log('[Histórico] 🎤 Iniciando reconhecimento local APÓS TTS');
            startListening(true);
          }, 800);
        });
      }, 500);
    }, 300);
  };

  const fecharModal = () => {
    console.log('[Histórico] 🚪 Fechando modal de criação');
    
    stopSpeaking();
    stopListening();
    
    setModalVisible(false);
    setTituloInput('');
    setStep('idle');
    setIsSaving(false);
    setRecognizedText('');
    tituloProcessadoRef.current = false;
    isSpeakingRef.current = false;
    
    if (tituloTimeoutRef.current) {
      clearTimeout(tituloTimeoutRef.current);
      tituloTimeoutRef.current = null;
    }
    
    setShouldListenLocally(false);
    
    setTimeout(() => {
      if (isScreenFocused && wasListeningBeforeModalRef.current) {
        console.log('[Histórico] ✅ Reativando microfone global (tela focada)');
        globalSpeech.startListening(false);
      } else if (!isScreenFocused) {
        console.log('[Histórico] ⏭️ Tela não focada, não reativando global');
      }
    }, 500);
  };

  const editarConversa = (conversationId: string, titulo: string) => {
    if (!user) return;

    console.log(`✏️ Iniciando edição da conversa: ${titulo}`);
    
    wasListeningBeforeModalRef.current = globalSpeech.isListening;
    globalSpeech.stopListening();
    stopSpeaking();
    
    setConversaParaEditar({ id: conversationId, titulo });
    setEditTituloInput(titulo);
    setEditStep('aguardandoPalavraTitulo');
    setRecognizedText('');
    editTituloProcessadoRef.current = false;
    isSpeakingRef.current = false;
    
    setTimeout(() => {
      setEditModalVisible(true);
      
      setTimeout(() => {
        isSpeakingRef.current = true;
        speak("Por favor, digite o novo título ou diga. 'título'. para informá-lo por voz.", () => {
          isSpeakingRef.current = false;
          setTimeout(() => {
            console.log('[Histórico] 🎤 Iniciando reconhecimento local APÓS TTS (edição)');
            startListening(true);
          }, 800);
        });
      }, 500);
    }, 300);
  };

  const fecharEditModal = () => {
    console.log('[Histórico] 🚪 Fechando modal de edição');
    stopSpeaking();
    stopListening();
    
    setEditModalVisible(false);
    setConversaParaEditar(null);
    setEditTituloInput('');
    setEditStep('idle');
    setIsEditSaving(false);
    setRecognizedText('');
    editTituloProcessadoRef.current = false;
    isSpeakingRef.current = false;
    
    if (editTituloTimeoutRef.current) {
      clearTimeout(editTituloTimeoutRef.current);
      editTituloTimeoutRef.current = null;
    }
    
    setShouldListenLocally(false);
    
    setTimeout(() => {
      if (wasListeningBeforeModalRef.current) {
        console.log('[Histórico] ✅ Reativando microfone global após fechar modal de edição');
        globalSpeech.startListening(true);
      }
    }, 500);
  };

  const cancelarExclusao = () => {
    console.log('[Histórico] ❌ Cancelando exclusão manualmente');
    stopSpeaking();
    stopListening();
    
    if (confirmacaoTimeoutRef.current) {
      clearTimeout(confirmacaoTimeoutRef.current);
      confirmacaoTimeoutRef.current = null;
    }
    
    setConversaParaExcluir(null);
    setStep('idle');
    setRecognizedText('');
    setShouldListenLocally(false);
    
    setTimeout(() => {
      if (wasListeningBeforeModalRef.current) {
        console.log('[Histórico] ✅ Reativando microfone global após cancelar exclusão');
        globalSpeech.startListening(true);
      }
    }, 500);
  };

  const activateSearchMicrophone = useCallback(() => {
    console.log('[Histórico] 🎤 Ativando microfone de pesquisa');
    wasListeningBeforeModalRef.current = globalSpeech.isListening;
    globalSpeech.stopListening();
    stopSpeaking();
    
    setSearchStep('aguardandoPesquisa');
    setRecognizedText('');
    searchProcessadoRef.current = false;
    isSpeakingRef.current = false;
    
    setTimeout(() => {
      setIsSearchListening(true);
      
      setTimeout(() => {
        isSpeakingRef.current = true;
        speak("Microfone de pesquisa ativado. Fale o termo de busca.", () => {
          isSpeakingRef.current = false;
          setTimeout(() => {
            console.log('[Histórico] 🎤 Iniciando reconhecimento local APÓS TTS (pesquisa)');
            startListening(true);
          }, 800);
        });
      }, 500);
    }, 300);
  }, [globalSpeech.isListening, globalSpeech.stopListening, speak, startListening, setRecognizedText, stopSpeaking]);

  const deactivateSearchMicrophone = useCallback(() => {
    console.log('[Histórico] 🔇 Desativando microfone de pesquisa');
    stopSpeaking();
    stopListening();
    setIsSearchListening(false);
    setSearchStep('idle');
    setRecognizedText('');
    searchProcessadoRef.current = false;
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    
    setTimeout(() => {
      if (wasListeningBeforeModalRef.current) {
        console.log('[Histórico] ✅ Reativando microfone global após desativar pesquisa');
        globalSpeech.startListening(true);
      }
    }, 500);
  }, [stopSpeaking, stopListening, setRecognizedText, globalSpeech.startListening]);

  const toggleSearchMicrophone = useCallback(() => {
    if (isSearchListening) {
      deactivateSearchMicrophone();
    } else {
      activateSearchMicrophone();
    }
  }, [isSearchListening, activateSearchMicrophone, deactivateSearchMicrophone]);

  const styles = StyleSheet.create({
    centered: { 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center', 
      padding: 20, 
      backgroundColor: cores.fundo 
    },
    loginMessage: { 
      fontSize: 18, 
      textAlign: 'center', 
      color: cores.texto 
    },
    container: { 
      flex: 1, 
      backgroundColor: cores.fundo 
    },
    searchContainer: { 
      paddingHorizontal: 16, 
      paddingVertical: 12, 
      backgroundColor: cores.barrasDeNavegacao, 
      borderBottomWidth: 1, 
      borderBottomColor: 'rgba(255, 255, 255, 0.1)' 
    },
    searchWrapper: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      backgroundColor: cores.fundo, 
      borderRadius: 8, 
      borderWidth: 1, 
      borderColor: cores.texto, 
      paddingHorizontal: 12 
    },
    searchInput: { 
      flex: 1, 
      paddingVertical: 10, 
      paddingHorizontal: 8, 
      fontSize: getFontSize('medium'), 
      color: cores.texto 
    },
    searchIcon: { 
      marginRight: 8 
    },
    searchMicButton: { 
      padding: 8 
    },
    clearButton: { 
      padding: 4 
    },
    listContainer: { 
      padding: 16, 
      paddingBottom: 8 
    },
    item: { 
      padding: 16, 
      marginBottom: 8, 
      borderRadius: 8, 
      backgroundColor: cores.barrasDeNavegacao, 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center' 
    },
    itemContent: { 
      flex: 1, 
      marginRight: 12 
    },
    itemText: { 
      fontSize: getFontSize('medium'), 
      color: cores.texto, 
      fontWeight: '500' 
    },
    itemDateText: {
      fontSize: getFontSize('small'), 
      color: cores.texto || '#888', 
      marginTop: 4 
    },
    itemActions: { 
      flexDirection: 'row', alignItems: 'center', gap: 4 },
    editButton: { 
      padding: 8, 
      margin: -8, 
      marginRight: 4 
    },
    deleteButton: { 
      padding: 8, 
      margin: -8 
    },
    emptyMessage: { 
      fontSize: getFontSize('medium'), 
      textAlign: 'center', 
      marginTop: 40, 
      color: cores.texto 
    },
    createButton: { 
      backgroundColor: cores.barrasDeNavegacao, 
      paddingVertical: 14, 
      paddingHorizontal: 20, 
      borderRadius: 25, 
      margin: 16,
      marginBottom: 24,
      alignItems: 'center', 
      justifyContent: 'center', 
      shadowColor: "#000", 
      shadowOffset: { width: 0, height: 2 }, 
      shadowOpacity: 0.25, 
      shadowRadius: 3.84, 
      elevation: 5 
    },
    createButtonText: { 
      color: cores.texto, 
      fontSize: getFontSize('medium'), 
      fontWeight: 'bold' 
    },
    modalOverlay: { 
      flex: 1, 
      backgroundColor: 'rgba(0,0,0,0.7)', 
      justifyContent: 'center', 
      alignItems: 'center', 
      padding: 20 
    },
    modalContent: { 
      backgroundColor: cores.fundo, 
      borderRadius: 20, 
      padding: 28, width: '100%', 
      maxWidth: 500, shadowColor: "#000", 
      shadowOffset: { width: 0, height: 4 }, 
      shadowOpacity: 0.3, 
      shadowRadius: 5, 
      elevation: 8 
    },
    modalHeader: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: 20 
    },
    modalTitle: { 
      fontSize: getFontSize('large'), 
      fontWeight: 'bold', 
      color: cores.texto 
    },
    closeButton: { 
      padding: 4 

    },
    inputContainer: { 
      marginBottom: 20 

    },
    label: { 
      fontSize: getFontSize('medium'),
      color: cores.texto, 
      marginBottom: 8, 
      fontWeight: '500' 
    },
    inputWrapper: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      backgroundColor: '#fff', 
      borderRadius: 8, 
      borderWidth: 1, 
      borderColor: cores.texto 
    },
    input: { 
      flex: 1, 
      paddingHorizontal: 16, 
      paddingVertical: 12, 
      fontSize: getFontSize('medium'), 
      color: '#000' 
    },
    micButton: { 
      padding: 12, 
      marginRight: 4 
    },
    listeningIndicator: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'center', 
      paddingVertical: 12, 
      backgroundColor: cores.fundo, 
      borderRadius: 8, 
      marginBottom: 16 
    },
    listeningText: { 
      marginLeft: 8, 
      color: cores.texto, 
      fontSize: getFontSize('medium'), 
      fontWeight: '500' 
    },
    modalActions: { 
      flexDirection: 'row', 
      gap: 12 
    },
    cancelButton: { 
      flex: 1, 
      paddingVertical: 12, 
      borderRadius: 8, 
      borderWidth: 1, 
      borderColor: cores.texto, 
      alignItems: 'center' 
    },
    cancelButtonText: { 
      color: cores.texto, 
      fontSize: getFontSize('medium'), 
      fontWeight: '600' 
    },
    saveButton: { 
      flex: 1, 
      paddingVertical: 12, 
      borderRadius: 8, 
      backgroundColor: cores.texto, 
      alignItems: 'center', 
      justifyContent: 'center' 
    },
    saveButtonText: { 
      color: cores.fundo, 
      fontSize: getFontSize('medium'), 
      fontWeight: '600' 
    },
    savingIndicator: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'center', 
      paddingVertical: 16, 
      backgroundColor: cores.texto, 
      borderRadius: 8, 
      marginTop: 12 
    },
    savingText: { 
      marginLeft: 8, 
      color: cores.fundo, 
      fontSize: getFontSize('medium'), 
      fontWeight: '500' 
    },
    deleteOverlay: { 
      ...StyleSheet.absoluteFillObject, 
      backgroundColor: 'rgba(0,0,0,0.8)', 
      justifyContent: 'center', 
      alignItems: 'center', 
      padding: 20, 
      zIndex: 1000 
    },
    deleteModal: { 
      backgroundColor: cores.fundo, 
      borderRadius: 20, 
      padding: 32, 
      width: '100%', 
      maxWidth: 500, 
      alignItems: 'center', 
      shadowColor: "#000", 
      shadowOffset: { width: 0, height: 4 }, 
      shadowOpacity: 0.3, 
      shadowRadius: 5, 
      elevation: 8 
    },
    deleteTitle: { 
      fontSize: getFontSize('large'), 
      fontWeight: 'bold', 
      marginBottom: 16, 
      textAlign: 'center' 
    },
    deleteMessage: { 
      fontSize: getFontSize('medium'), 
      textAlign: 'center', 
      marginBottom: 8, 
      lineHeight: 24 
    },
    recognizedTextBox: { 
      padding: 12, 
      borderRadius: 8, 
      width: '100%' 
    },
    recognizedTextLabel: { 
      fontSize: getFontSize('small'), 
      fontWeight: '600', 
      marginBottom: 4 
    },
    recognizedTextContent: { 
      fontSize: getFontSize('medium'), 
      fontStyle: 'italic' 
    },
    deleteButtonsContainer: { 
      flexDirection: 'row', 
      marginTop: 20, 
      gap: 12, 
      width: '100%' 
    },
    deleteActionButton: { 
      flex: 1, 
      paddingVertical: 12, 
      paddingHorizontal: 16, 
      borderRadius: 8, 
      borderWidth: 2, 
      borderColor: cores.texto, 
      alignItems: 'center', 
      justifyContent: 'center' 
    },
    deleteActionText: { 
      fontSize: getFontSize('medium'), 
      fontWeight: '600', 
      textAlign: 'center', 
      color: '#000' 
    },
  });

  if (isAuthLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loginMessage}>Faça login para acessar o histórico</Text>
      </View>
    );
  }

  const aguardandoPalavraTitulo = step === 'aguardandoPalavraTitulo';
  const aguardandoConfirmacao = step === 'aguardandoConfirmacaoExclusao';
  const editAguardandoPalavraTitulo = editStep === 'aguardandoPalavraTitulo';

  return (
  <View style={styles.container}>
    <View style={styles.searchContainer}>
      <View style={styles.searchWrapper}>
        <Ionicons name="search" size={getIconSize('medium')} color={cores.texto} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Pesquisar conversas..."
          placeholderTextColor="#999"
          value={searchText}
          onChangeText={(text) => {
            setSearchText(text);
            if (isSearchListening) {
              setIsSearchListening(false);
              setSearchStep('idle');
              stopListening();
              searchProcessadoRef.current = false;
            }
          }}
          autoCorrect={false}
          accessibilityLabel="Pesquisar conversas"
          editable={!isSearchListening}
        />
        {searchText.length > 0 && !isSearchListening && (
          <TouchableOpacity style={styles.clearButton} onPress={() => setSearchText('')} accessible={true} accessibilityLabel="Limpar pesquisa" accessibilityRole="button">
            <Ionicons name="close-circle" size={getIconSize('medium')} color={cores.texto} />
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={styles.searchMicButton} 
          onPress={toggleSearchMicrophone}
          accessible={true} 
          accessibilityLabel={isSearchListening ? "Desativar microfone de pesquisa" : "Pesquisar por voz"} 
          accessibilityRole="button"
        >
          <Ionicons 
            name={isSearchListening ? "mic" : "mic-outline"} 
            size={getIconSize('medium')} 
            color={isSearchListening ? '#FF453A' : cores.texto} 
          />
        </TouchableOpacity>
      </View>
      {isSearchListening && (
        <View style={[styles.listeningIndicator, { marginTop: 8 }]}>
          <ActivityIndicator size="small" color={cores.texto} />
          <Text style={styles.listeningText}>
            {recognizedText ? `"${recognizedText}"` : 'Ouvindo termo de busca...'}
          </Text>
        </View>
      )}
    </View>

    {filteredConversations.length > 0 ? (
      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        style={{ flex: 1 }}
        renderItem={({ item }) => (
          <TouchableOpacity 
            onPress={() => router.push({ pathname: '/conversa', params: { conversaId: item.id, titulo: item.titulo } })}
            style={styles.item}
            accessibilityLabel={`Conversa: ${toTitleCase(item.titulo || 'Sem título')}. Alterado em: ${item.dataAlteracao?.toDate?.()?.toLocaleString?.() || 'Carregando'}.`}
            accessibilityActions={[
              { name: 'activate', label: 'Abrir Conversa' },
              { name: 'magicTap', label: 'Editar Conversa' },
              { name: 'delete', label: 'Excluir Conversa' }
            ]}
            onAccessibilityAction={(event) => {
              const actionName = event.nativeEvent.actionName;
              if (actionName === 'activate') {
                router.push({ pathname: '/conversa', params: { conversaId: item.id, titulo: item.titulo } });
              } else if (actionName === 'magicTap') {
                editarConversa(item.id, item.titulo);
              } else if (actionName === 'delete') {
                excluirConversa(item.id, item.titulo);
              }
            }}
          >
            <View style={styles.itemContent}>
              <Text style={styles.itemText}>{String(toTitleCase(item.titulo || 'Sem título'))}</Text>
              <Text style={styles.itemDateText}>Alterado em: {String(item.dataAlteracao?.toDate?.()?.toLocaleString?.() || 'Carregando...')}</Text>
            </View>
            <View style={styles.itemActions}>
              <TouchableOpacity 
                style={styles.editButton} 
                onPress={(e) => { e.stopPropagation(); editarConversa(item.id, item.titulo); }}
                accessible={true}
                accessibilityLabel='Editar Título'
                accessibilityRole='button'
              >
                <MaterialIcons name="edit" size={getIconSize('medium')} color={cores.texto} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.deleteButton} 
                onPress={(e) => { e.stopPropagation(); excluirConversa(item.id, item.titulo); }}
                accessible={true}
                accessibilityLabel='Excluir Conversa'
                accessibilityRole='button'
              >
                <Ionicons name="trash-outline" size={getIconSize('medium')} color={cores.perigo} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />
    ) : (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={styles.emptyMessage}>
          {searchText.length > 0 ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa salva ainda'}
        </Text>
      </View>
    )}

    <TouchableOpacity 
      style={styles.createButton} 
      onPress={abrirModal} 
      accessibilityRole='button' 
      accessibilityLabel="Criar nova conversa"
    >
      <Text style={styles.createButtonText}>Criar Nova Conversa</Text>
    </TouchableOpacity>

      {conversaParaExcluir && aguardandoConfirmacao && (
        <View style={styles.deleteOverlay} importantForAccessibility="yes">
          <View style={styles.deleteModal}>
            <Ionicons name="warning" size={48} color="#FF453A" style={{ marginBottom: 16 }} />
            <Text ref={deleteModalTitleRef} style={[styles.deleteTitle, { color: cores.texto }]} accessibilityRole="header">Confirmar Exclusão</Text>
            <Text style={[styles.deleteMessage, { color: cores.texto }]}>Tem certeza que deseja excluir a conversa "{conversaParaExcluir.titulo}"?</Text>
            {isListening && (
              <View style={styles.listeningIndicator}>
                <ActivityIndicator size="small" color={cores.texto} />
                <Text style={styles.listeningText}>"Aguardando resposta..."</Text>
              </View>
            )}
            {recognizedText && (
              <View style={[styles.recognizedTextBox, { backgroundColor: cores.barrasDeNavegacao, marginTop: 12 }]}>
                <Text style={[styles.recognizedTextLabel, { color: cores.texto }]}>Você disse:</Text>
                <Text style={[styles.recognizedTextContent, { color: cores.texto }]}>"{recognizedText}"</Text>
              </View>
            )}
            <View style={styles.deleteButtonsContainer}>
              <TouchableOpacity style={[styles.deleteActionButton, { backgroundColor: cores.confirmar }]} onPress={cancelarExclusao}>
                <Text style={[styles.deleteActionText, { color: '#000' }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.deleteActionButton, { backgroundColor: cores.perigo }]}
                onPress={() => {
                  stopSpeaking();
                  stopListening();
                  if (confirmacaoTimeoutRef.current) { clearTimeout(confirmacaoTimeoutRef.current); confirmacaoTimeoutRef.current = null; }
                  speak("Confirmado. Excluindo conversa.", () => {
                    deletarDocumentosDaConversa(conversaParaExcluir.id);
                    setConversaParaExcluir(null);
                    setStep('idle');
                    setRecognizedText('');
                  });
                }}
              >
                <Text style={[styles.deleteActionText, { color: '#fff' }]}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <Modal visible={modalVisible} transparent={true} animationType="fade" onRequestClose={fecharModal} statusBarTranslucent={true}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]} activeOpacity={1} onPress={fecharModal} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova Conversa</Text>
              <TouchableOpacity style={styles.closeButton} onPress={fecharModal} disabled={isSaving} 
                accessibilityRole='button' 
                accessibilityLabel='fechar diálogo para criar conversa'
              >
                <Ionicons name="close" size={getIconSize('medium')} color={cores.texto} />
              </TouchableOpacity>
            </View>
            {isListening && (
              <View style={styles.listeningIndicator}>
                <ActivityIndicator size="small" color={cores.texto} />
                <Text style={styles.listeningText}>{aguardandoPalavraTitulo ? 'Aguardando "Título"...' : 'Ouvindo título...'}</Text>
              </View>
            )}
            {step === 'aguardandoTitulo' && recognizedText && (
              <View style={[styles.listeningIndicator, { backgroundColor: cores.barrasDeNavegacao }]}>
                <Text style={styles.listeningText}>"{recognizedText}"</Text>
              </View>
            )}
            <View style={styles.inputContainer}>
              <Text style={styles.label} accessibilityRole='text'>Título da Conversa</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={tituloInput}
                  onChangeText={(text) => { setTituloInput(text); if (step !== 'idle') { setStep('idle'); stopListening(); tituloProcessadoRef.current = false; } }}
                  placeholder="Digite ou fale o título"
                  placeholderTextColor='#999'
                  editable={!isSaving}
                  autoFocus={false}
                />
                <TouchableOpacity 
                  style={styles.micButton}
                  onPress={() => {
                    console.log('[Histórico] 🎤 Botão de microfone pressionado');
                    
                    if (step === 'aguardandoPalavraTitulo') {
                      console.log('[Histórico] ⚠️ Já está aguardando palavra "título"');
                      return;
                    }
                    
                    setStep('aguardandoPalavraTitulo');
                    setRecognizedText('');
                    tituloProcessadoRef.current = false;
                    
                    speak("Diga 'título' para começar.", () => {
                      startListening(true);
                    });
                  }}
                  disabled={isListening || isSaving}
                  accessibilityRole='button'
                  accessibilityLabel='Gravar título'
                >
                  <Ionicons 
                    name={isListening ? "mic" : "mic-outline"} 
                    size={getIconSize('medium')} 
                    color={cores.texto}
                  />
                </TouchableOpacity>
              </View>
            </View>
            {step === 'idle' && !isSaving && (
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={fecharModal}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={criarConversaManual}><Text style={styles.saveButtonText}>Salvar</Text></TouchableOpacity>
              </View>
            )}
            {isSaving && (
              <View style={styles.savingIndicator}>
                <ActivityIndicator size="small" color={cores.fundo} />
                <Text style={styles.savingText}>Salvando conversa...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={editModalVisible} transparent={true} animationType="fade" onRequestClose={fecharEditModal} statusBarTranslucent={true}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]} activeOpacity={1} onPress={fecharEditModal} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Conversa</Text>
              <TouchableOpacity style={styles.closeButton} onPress={fecharEditModal} disabled={isEditSaving}>
                <Ionicons name="close" size={getIconSize('medium')} color={cores.texto} />
              </TouchableOpacity>
            </View>
            {isListening && (
              <View style={styles.listeningIndicator}>
                <ActivityIndicator size="small" color={cores.texto} />
                <Text style={styles.listeningText}>{editAguardandoPalavraTitulo ? 'Aguardando "Título"...' : 'Ouvindo novo título...'}</Text>
              </View>
            )}
            {editStep === 'aguardandoTitulo' && recognizedText && (
              <View style={[styles.listeningIndicator, { backgroundColor: cores.barrasDeNavegacao }]}>
                <Text style={styles.listeningText}>"{recognizedText}"</Text>
              </View>
            )}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Novo Título</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={editTituloInput}
                  onChangeText={(text) => { setEditTituloInput(text); if (editStep !== 'idle') { setEditStep('idle'); stopListening(); editTituloProcessadoRef.current = false; } }}
                  placeholder="Digite ou fale o novo título"
                  placeholderTextColor='#999'
                  editable={!isEditSaving}
                  autoFocus={false}
                />
                <TouchableOpacity 
                  style={styles.micButton}
                  onPress={() => {
                    console.log('[Histórico] 🎤 [Edição] Botão de microfone pressionado');
                    
                    if (editStep === 'aguardandoPalavraTitulo') {
                      console.log('[Histórico] ⚠️ [Edição] Já está aguardando palavra "título"');
                      return;
                    }
                    
                    setEditStep('aguardandoPalavraTitulo');
                    setRecognizedText('');
                    editTituloProcessadoRef.current = false;
                    
                    speak("Diga 'título' para começar.", () => {
                      startListening(true);
                    });
                  }}
                  disabled={isListening || isEditSaving}
                  accessibilityRole='button'
                  accessibilityLabel='Gravar novo título'
                >
                  <Ionicons 
                    name={isListening ? "mic" : "mic-outline"} 
                    size={getIconSize('medium')} 
                    color={cores.fundo} 
                  />
                </TouchableOpacity>
              </View>
            </View>
            {editStep === 'idle' && !isEditSaving && (
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={fecharEditModal}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={renomearConversaManual}><Text style={styles.saveButtonText}>Salvar</Text></TouchableOpacity>
              </View>
            )}
            {isEditSaving && (
              <View style={styles.savingIndicator}>
                <ActivityIndicator size="small" color={cores.fundo} />
                <Text style={styles.savingText}>Salvando alterações...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default HistoryScreen;