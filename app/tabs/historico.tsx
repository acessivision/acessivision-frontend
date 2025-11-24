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

  // ✅ Estados para edição de conversa
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [conversaParaEditar, setConversaParaEditar] = useState<{ id: string; titulo: string } | null>(null);
  const [editTituloInput, setEditTituloInput] = useState('');
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editStep, setEditStep] = useState<StepType>('idle');
  const editTituloProcessadoRef = useRef(false);
  const editTituloTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ✅ Estados para confirmação de exclusão
  const [conversaParaExcluir, setConversaParaExcluir] = useState<{ id: string; titulo: string } | null>(null);

  // ✅ Refs para timeouts
  const tituloProcessadoRef = useRef(false);
  const tituloTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmacaoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const wasListeningBeforeModalRef = useRef(false);
  const deleteModalTitleRef = useRef(null);

  const isFocused = useIsFocused();
  const screenTitle = 'Histórico de Conversas';

  const [shouldListenLocally, setShouldListenLocally] = useState(false);

  const isSpeakingRef = useRef(false);

  // ✅ Hook de voz para modais (criação, edição e exclusão)
  const { 
    speak, 
    startListening, 
    stopListening,
    stopSpeaking,
    isListening,
    recognizedText,
    setRecognizedText 
  } = useSpeech({
    enabled: isScreenFocused && (modalVisible || editModalVisible || !!conversaParaExcluir || isSearchListening),
    mode: 'local',
  });

  // ✅ Hook separado para comandos globais
  const globalSpeech = useSpeech({
    enabled: isScreenFocused && !modalVisible && !editModalVisible && !conversaParaExcluir && !isSearchListening,
    mode: 'local',
  });

  useEffect(() => {
    if (isFocused) {
      const timer = setTimeout(() => {
        AccessibilityInfo.announceForAccessibility(screenTitle);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isFocused, screenTitle]);

  // ===================================================================
  // BUSCAR CONVERSAS DO FIRESTORE
  // ===================================================================
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

  // ===================================================================
  // FILTRAR CONVERSAS POR PESQUISA
  // ===================================================================
  const filteredConversations = conversations.filter(conv => 
    conv.titulo.toLowerCase().includes(searchText.toLowerCase())
  );

  // ===================================================================
// PROCESSAR COMANDOS GLOBAIS COM DEBOUNCE (fora de modais)
// ===================================================================
useEffect(() => {
  if (!globalSpeech.recognizedText.trim() || modalVisible || editModalVisible || conversaParaExcluir || isSearchListening) return;

  const textoAtual = globalSpeech.recognizedText.trim();
  const textoLower = textoAtual.toLowerCase();
  
  console.log(`[Histórico - Global] Texto sendo reconhecido: "${textoAtual}"`);

  // ✅ NOVO: Detectar comando "pesquisar"
  if (textoLower.includes('pesquisar') || textoLower.includes('buscar') || textoLower.includes('procurar')) {
    console.log('[Histórico] 🔍 Comando "pesquisar" detectado');
    globalSpeech.setRecognizedText('');
    globalSpeech.stopListening();
    
    // Ativa o microfone de pesquisa
    activateSearchMicrophone();
    return;
  }

  // ✅ Detectar comando "criar nova conversa"
  if (textoLower.includes('criar') && (textoLower.includes('conversa') || textoLower.includes('nova'))) {
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
        speak("Por favor, digite o título ou diga 'título' para informá-lo por voz.", () => {
          startListening(true);
        });
      }, 300);
    }, 200);
  }
}, [globalSpeech.recognizedText, modalVisible, editModalVisible, conversaParaExcluir, isSearchListening]);

// ===================================================================
// PROCESSAR RECONHECIMENTO DE VOZ COM DEBOUNCE (dentro de modais)
// ===================================================================
useEffect(() => {
  if (!recognizedText.trim()) return;

  const textoAtual = recognizedText.trim();
  const textoLower = textoAtual.toLowerCase();
  
  console.log(`[Histórico] Step: ${step}, EditStep: ${editStep}, Texto: "${textoAtual}"`);

  // ===== FLUXO DE CRIAÇÃO DE CONVERSA =====
  if (modalVisible) {
    if (step === 'aguardandoPalavraTitulo' && (textoLower.includes('título') || textoLower.includes('titulo'))) {
      console.log("✅ Palavra 'título' detectada!");
      
      // ✅ NOVO: Ignora se ainda está falando
      if (isSpeakingRef.current) {
        console.log('⚠️ Ignorando - TTS ainda ativo');
        setRecognizedText('');
        return;
      }
      
      setStep('aguardandoTitulo');
      setRecognizedText('');
      tituloProcessadoRef.current = false;
      
      if (tituloTimeoutRef.current) {
        clearTimeout(tituloTimeoutRef.current);
        tituloTimeoutRef.current = null;
      }
      
      isSpeakingRef.current = true; // ✅ NOVO: Marca que está falando
      
      speak("Escutando o título. Fale e aguarde um momento.", () => {
        setTimeout(() => {
          isSpeakingRef.current = false;
          startListening(true);
        }, 500);
      });
      return;
    }

    if (step === 'aguardandoTitulo' && textoAtual && !tituloProcessadoRef.current) {
      console.log(`📝 Acumulando título: "${textoAtual}"`);
      
      // ✅ NOVO: Ignora se ainda está falando
      if (isSpeakingRef.current) {
        console.log('⚠️ Ignorando acumulação - TTS ainda ativo');
        setRecognizedText('');
        return;
      }
      
      // ✅ NOVO: Ignora se o texto contém frases do TTS
      const ttsBlacklist = [
        'escutando o título',
        'fale e aguarde',
        'digite o título',
        'título para informá-lo',
        'por favor',
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
          
          isSpeakingRef.current = true; // ✅ NOVO: Marca que está falando
          
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

  // ===== FLUXO DE EDIÇÃO DE CONVERSA =====
  if (editModalVisible) {
    if (editStep === 'aguardandoPalavraTitulo' && (textoLower.includes('título') || textoLower.includes('titulo'))) {
      console.log("✅ [Edição] Palavra 'título' detectada!");
      
      // ✅ NOVO: Ignora se ainda está falando
      if (isSpeakingRef.current) {
        console.log('⚠️ [Edição] Ignorando - TTS ainda ativo');
        setRecognizedText('');
        return;
      }
      
      setEditStep('aguardandoTitulo');
      setRecognizedText('');
      editTituloProcessadoRef.current = false;
      
      if (editTituloTimeoutRef.current) {
        clearTimeout(editTituloTimeoutRef.current);
        editTituloTimeoutRef.current = null;
      }
      
      isSpeakingRef.current = true;
      
      speak("Escutando o novo título. Fale e aguarde um momento.", () => {
        setTimeout(() => {
          isSpeakingRef.current = false;
          startListening(true);
        }, 500);
      });
      return;
    }

    if (editStep === 'aguardandoTitulo' && textoAtual && !editTituloProcessadoRef.current) {
      console.log(`📝 [Edição] Acumulando título: "${textoAtual}"`);
      
      // ✅ NOVO: Ignora se ainda está falando
      if (isSpeakingRef.current) {
        console.log('⚠️ [Edição] Ignorando - TTS ainda ativo');
        setRecognizedText('');
        return;
      }
      
      // ✅ NOVO: Blacklist de frases do TTS
      const ttsBlacklist = [
        'escutando',
        'fale e aguarde',
        'digite',
        'novo título',
        'título para informá-lo',
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


  // ===== FLUXO DE EXCLUSÃO DE CONVERSA =====
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

  // ===== FLUXO DE PESQUISA POR VOZ =====
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
          
          // Aplica o filtro de pesquisa
          setSearchText(textoAtual);
          setIsSearchListening(false);
          setSearchStep('idle');
          setRecognizedText('');
          
          // Aguarda um momento para o filtro ser aplicado antes de anunciar
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
              // Reativa microfone global após pesquisa
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

  // ✅ Cleanup dos timeouts
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

  // ===================================================================
  // EDITAR CONVERSA
  // ===================================================================
  const editarConversa = (conversationId: string, titulo: string) => {
    if (!user) return;

    console.log(`✏️ Iniciando edição da conversa: ${titulo}`);
    
    wasListeningBeforeModalRef.current = globalSpeech.isListening;
    globalSpeech.stopListening();
    
    setConversaParaEditar({ id: conversationId, titulo });
    setEditTituloInput(titulo);
    setEditStep('aguardandoPalavraTitulo');
    setEditModalVisible(true);
    setRecognizedText('');
    editTituloProcessadoRef.current = false;
    
    setTimeout(() => {
      speak(`Editando conversa: ${titulo}. Digite o novo título ou diga 'título' para informá-lo por voz.`, () => {
        startListening(true);
      });
    }, 300);
  };

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
    isSpeakingRef.current = false; // ✅ NOVO: Reset
    
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

  // ===================================================================
  // EXCLUIR CONVERSA - COM VOZ
  // ===================================================================
  const excluirConversa = (conversationId: string, titulo: string) => {
    if (!user) return;

    console.log(`🗑️ Iniciando fluxo de exclusão por voz para: ${titulo}`);
    wasListeningBeforeModalRef.current = globalSpeech.isListening;
    
    setConversaParaExcluir({ id: conversationId, titulo });
    setStep('aguardandoConfirmacaoExclusao');
    setRecognizedText('');
    
    setTimeout(() => {
      speak(`Tem certeza que deseja excluir a conversa ${titulo}? Diga sim ou não.`, () => {
        startListening(true);
      });
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

  // ===================================================================
  // CRIAR CONVERSA NO FIRESTORE
  // ===================================================================
  const isNavigatingToConversaRef = useRef(false);
  const criarConversaComTitulo = async (titulo: string) => {
    if (!user) return;

    if (isNavigatingToConversaRef.current) {
      console.log('[Historico] ⚠️ Já está criando/navegando, ignorando');
      return;
    }
    
    // ✅ NOVO: Previne criação se título contém frases do TTS
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

    // ✅ NOVO: Previne múltiplas criações simultâneas
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
      }, 500);

    } catch (error) {
      console.error("❌ Erro ao criar conversa:", error);
      Alert.alert('Erro', 'Não foi possível criar a conversa. Tente novamente.');
      isNavigatingToConversaRef.current = false; // ✅ NOVO: Reset em caso de erro
    } finally {
      setIsSaving(false);
    }
  };

  const criarConversaManual = () => {
    criarConversaComTitulo(tituloInput);
  };

  // ===================================================================
  // ABRIR/FECHAR MODAL DE CRIAÇÃO
  // ===================================================================
  const abrirModal = () => {
    wasListeningBeforeModalRef.current = globalSpeech.isListening;
    console.log(`[Histórico] Abrindo modal. Microfone estava: ${wasListeningBeforeModalRef.current ? 'ATIVO' : 'INATIVO'}`);
    
    globalSpeech.stopListening();
    console.log('[Histórico] 🛑 Reconhecimento global pausado antes de abrir modal');
    
    setTituloInput('');
    setStep('aguardandoPalavraTitulo');
    setModalVisible(true);
    setIsSaving(false);
    setRecognizedText('');
    tituloProcessadoRef.current = false;
    
    setTimeout(() => {
      console.log('[Histórico] 🔊 Falando instrução após pausar reconhecimento');
      isSpeakingRef.current = true; // ✅ NOVO: Marca que está falando
      
      speak("Por favor, digite o título ou diga 'título' para informá-lo por voz.", () => {
        console.log('[Histórico] 🎤 Iniciando escuta local após falar');
        
        // ✅ NOVO: Aguarda um pouco antes de reativar escuta
        setTimeout(() => {
          isSpeakingRef.current = false;
          startListening(true);
        }, 500);
      });
    }, 500);
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
    isSpeakingRef.current = false; // ✅ NOVO: Reset
    
    if (tituloTimeoutRef.current) {
      clearTimeout(tituloTimeoutRef.current);
      tituloTimeoutRef.current = null;
    }
    
    setShouldListenLocally(false);
    
    setTimeout(() => {
      if (wasListeningBeforeModalRef.current) {
        console.log('[Histórico] ✅ Reativando microfone global após fechar modal');
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
    
    setIsSearchListening(true);
    setSearchStep('aguardandoPesquisa');
    setRecognizedText('');
    searchProcessadoRef.current = false;
    
    setTimeout(() => {
      speak("Microfone de pesquisa ativado. Fale o termo de busca.", () => {
        startListening(true);
      });
    }, 300);
  }, [globalSpeech.isListening, globalSpeech.stopListening, speak, startListening, setRecognizedText]);

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
    
    // Reativa microfone global se estava ativo
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

  // ===================================================================
  // ESTILOS
  // ===================================================================
  const styles = StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: cores.fundo },
    loginMessage: { fontSize: 18, textAlign: 'center', color: cores.texto },
    container: { flex: 1, backgroundColor: cores.fundo },
    searchContainer: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: cores.barrasDeNavegacao, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)' },
    searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.fundo, borderRadius: 8, borderWidth: 1, borderColor: cores.texto, paddingHorizontal: 12 },
    searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: getFontSize('medium'), color: cores.texto },
    searchIcon: { marginRight: 8 },
    searchMicButton: { padding: 8 },
    clearButton: { padding: 4 },
    listContainer: { flex: 1, padding: 16 },
    item: { padding: 16, marginBottom: 8, borderRadius: 8, backgroundColor: cores.barrasDeNavegacao, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    itemContent: { flex: 1, marginRight: 12 },
    itemText: { fontSize: getFontSize('medium'), color: cores.texto, fontWeight: '500' },
    itemDateText: { fontSize: getFontSize('small'), color: cores.texto || '#888', marginTop: 4 },
    itemActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    editButton: { padding: 8, margin: -8, marginRight: 4 },
    deleteButton: { padding: 8, margin: -8 },
    emptyMessage: { fontSize: getFontSize('medium'), textAlign: 'center', marginTop: 40, color: cores.texto },
    createButton: { backgroundColor: cores.barrasDeNavegacao, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 25, margin: 16, alignItems: 'center', justifyContent: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
    createButtonText: { color: cores.texto, fontSize: getFontSize('medium'), fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: cores.fundo, borderRadius: 20, padding: 28, width: '100%', maxWidth: 500, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 8 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: getFontSize('large'), fontWeight: 'bold', color: cores.texto },
    closeButton: { padding: 4 },
    inputContainer: { marginBottom: 20 },
    label: { fontSize: getFontSize('medium'), color: cores.texto, marginBottom: 8, fontWeight: '500' },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: cores.texto },
    input: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, fontSize: getFontSize('medium'), color: '#000' },
    micButton: { padding: 12, marginRight: 4 },
    listeningIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, backgroundColor: cores.fundo, borderRadius: 8, marginBottom: 16 },
    listeningText: { marginLeft: 8, color: cores.texto, fontSize: getFontSize('medium'), fontWeight: '500' },
    modalActions: { flexDirection: 'row', gap: 12 },
    cancelButton: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: cores.texto, alignItems: 'center' },
    cancelButtonText: { color: cores.texto, fontSize: getFontSize('medium'), fontWeight: '600' },
    saveButton: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: cores.texto, alignItems: 'center', justifyContent: 'center' },
    saveButtonText: { color: cores.fundo, fontSize: getFontSize('medium'), fontWeight: '600' },
    savingIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, backgroundColor: cores.texto, borderRadius: 8, marginTop: 12 },
    savingText: { marginLeft: 8, color: cores.fundo, fontSize: getFontSize('medium'), fontWeight: '500' },
    deleteOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 1000 },
    deleteModal: { backgroundColor: cores.fundo, borderRadius: 20, padding: 32, width: '100%', maxWidth: 500, alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 8 },
    deleteTitle: { fontSize: getFontSize('large'), fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
    deleteMessage: { fontSize: getFontSize('medium'), textAlign: 'center', marginBottom: 8, lineHeight: 24 },
    recognizedTextBox: { padding: 12, borderRadius: 8, width: '100%' },
    recognizedTextLabel: { fontSize: getFontSize('small'), fontWeight: '600', marginBottom: 4 },
    recognizedTextContent: { fontSize: getFontSize('medium'), fontStyle: 'italic' },
    deleteButtonsContainer: { flexDirection: 'row', marginTop: 20, gap: 12, width: '100%' },
    deleteActionButton: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, borderWidth: 2, borderColor: cores.texto, alignItems: 'center', justifyContent: 'center' },
    deleteActionText: { fontSize: getFontSize('medium'), fontWeight: '600', textAlign: 'center', color: '#000' },
  });

  // ===================================================================
  // RENDERIZAÇÃO
  // ===================================================================
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
    <View style={[styles.container, { flex: 1 }]}>
      {/* BARRA DE PESQUISA */}
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

      {/* LISTA DE CONVERSAS */}
      <View style={{ flex: 1 }}>
        {filteredConversations.length > 0 ? (
          <FlatList
            data={filteredConversations}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
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
                    accessibilityLabel='Editar Conversa'
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
            <Text style={styles.emptyMessage}>{searchText.length > 0 ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa salva ainda'}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.createButton} onPress={abrirModal} accessibilityRole='button' accessibilityLabel="Criar nova conversa">
          <Text style={styles.createButtonText}>Criar Nova Conversa</Text>
        </TouchableOpacity>
      </View>

      {/* OVERLAY DE CONFIRMAÇÃO DE EXCLUSÃO */}
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

      {/* MODAL DE CRIAÇÃO */}
      <Modal visible={modalVisible} transparent={true} animationType="fade" onRequestClose={fecharModal} statusBarTranslucent={true}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]} activeOpacity={1} onPress={fecharModal} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova Conversa</Text>
              <TouchableOpacity style={styles.closeButton} onPress={fecharModal} disabled={isSaving}>
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
              <Text style={styles.label}>Título da Conversa</Text>
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
                  onPress={() => { setStep('aguardandoPalavraTitulo'); setRecognizedText(''); tituloProcessadoRef.current = false; speak("Diga 'título' para começar", () => { startListening(true); }); }}
                  disabled={isListening || isSaving}
                >
                  <Ionicons name={isListening ? "mic" : "mic-outline"} size={getIconSize('medium')} color={cores.fundo} />
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

      {/* MODAL DE EDIÇÃO */}
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
                  onPress={() => { setEditStep('aguardandoPalavraTitulo'); setRecognizedText(''); editTituloProcessadoRef.current = false; speak("Diga 'título' para começar", () => { startListening(true); }); }}
                  disabled={isListening || isEditSaving}
                >
                  <Ionicons name={isListening ? "mic" : "mic-outline"} size={getIconSize('medium')} color={cores.fundo} />
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