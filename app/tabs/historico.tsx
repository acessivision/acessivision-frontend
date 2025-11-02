import { useEffect, useState, useRef } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../components/ThemeContext';
import { useAuth } from '../../components/AuthContext';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { toTitleCase } from '../../utils/toTitleCase';
import { useSpeech } from '../../hooks/useSpeech';

// ✅ Imports modulares do Firebase v9+
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
  const { cores, getFontSize, getIconSize } = useTheme();
  const { user, isLoading: isAuthLoading } = useAuth();
  
  const isScreenFocused = useIsFocused();

  const [modalVisible, setModalVisible] = useState(false);
  const [tituloInput, setTituloInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState<StepType>('idle');

  // ✅ Estados para confirmação de exclusão
  const [conversaParaExcluir, setConversaParaExcluir] = useState<{ id: string; titulo: string } | null>(null);

  // ✅ Refs para timeouts
  const tituloProcessadoRef = useRef(false);
  const tituloTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmacaoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ✅ Usa o novo hook de voz
  const { 
    speak, 
    startListening, 
    stopListening,
    stopSpeaking,
    isListening,
    recognizedText,
    setRecognizedText 
  } = useSpeech({
    enabled: isScreenFocused && (modalVisible || !!conversaParaExcluir), // ✅ Ativa quando modal está aberto OU esperando confirmação
    mode: 'local',
  });

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
  // PROCESSAR RECONHECIMENTO DE VOZ
  // ===================================================================
  useEffect(() => {
    if (!recognizedText.trim()) return;

    const fala = recognizedText.toLowerCase().trim();
    console.log(`[Histórico] Step: ${step}, Fala: "${fala}"`);

    // ===== FLUXO DE CRIAÇÃO DE CONVERSA =====
    if (modalVisible) {
      // Passo 1: Detectar palavra "título"
      if (step === 'aguardandoPalavraTitulo' && (fala.includes('título') || fala.includes('titulo'))) {
        console.log("✅ Palavra 'título' detectada!");
        setStep('aguardandoTitulo');
        setRecognizedText('');
        tituloProcessadoRef.current = false;
        
        if (tituloTimeoutRef.current) {
          clearTimeout(tituloTimeoutRef.current);
          tituloTimeoutRef.current = null;
        }
        
        speak("Escutando o título. Fale e aguarde um momento.", () => {
          startListening(true);
        });
        return;
      }

      // Passo 2: Acumular texto falado com debounce
      if (step === 'aguardandoTitulo' && fala && !tituloProcessadoRef.current) {
        console.log(`📝 Acumulando título: "${fala}"`);
        
        if (tituloTimeoutRef.current) {
          clearTimeout(tituloTimeoutRef.current);
        }
        
        tituloTimeoutRef.current = setTimeout(() => {
          if (!tituloProcessadoRef.current && fala) {
            console.log(`✅ Título final capturado: "${fala}"`);
            tituloProcessadoRef.current = true;
            
            stopListening();
            
            speak(`Criando conversa com título: ${fala}`, () => {
              criarConversaComTitulo(fala);
            });
          }
        }, 2000);
        
        return;
      }
    }

    // ===== FLUXO DE EXCLUSÃO DE CONVERSA =====
    if (conversaParaExcluir && step === 'aguardandoConfirmacaoExclusao') {
      console.log(`🗑️ Processando resposta de exclusão: "${fala}"`);
      
      // Limpa timeout anterior
      if (confirmacaoTimeoutRef.current) {
        clearTimeout(confirmacaoTimeoutRef.current);
      }

      // Aguarda 1.5 segundos de silêncio antes de processar
      confirmacaoTimeoutRef.current = setTimeout(() => {
        const confirmWords = ['sim', 'confirmo', 'confirmar', 'isso', 'exato', 'certo', 'ok', 'yes', 'pode', 'quero'];
        const denyWords = ['não', 'nao', 'cancelar', 'cancel', 'errado', 'no', 'negativo', 'nunca'];
        
        const isConfirm = confirmWords.some(word => fala.includes(word));
        const isDeny = denyWords.some(word => fala.includes(word));
        
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

  }, [recognizedText, step, modalVisible, conversaParaExcluir]);

  // ✅ Cleanup dos timeouts
  useEffect(() => {
    return () => {
      if (tituloTimeoutRef.current) {
        clearTimeout(tituloTimeoutRef.current);
      }
      if (confirmacaoTimeoutRef.current) {
        clearTimeout(confirmacaoTimeoutRef.current);
      }
    };
  }, []);

  // ===================================================================
  // EXCLUIR CONVERSA - COM VOZ
  // ===================================================================
  const excluirConversa = (conversationId: string, titulo: string) => {
    if (!user) return;

    console.log(`🗑️ Iniciando fluxo de exclusão por voz para: ${titulo}`);
    
    // Define a conversa a ser excluída e inicia o fluxo de voz
    setConversaParaExcluir({ id: conversationId, titulo });
    setStep('aguardandoConfirmacaoExclusao');
    setRecognizedText('');
    
    // Fala a pergunta e inicia a escuta
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
  const criarConversaComTitulo = async (titulo: string) => {
    if (!user) return;
    
    const tituloFinal = titulo.trim();
    
    if (!tituloFinal) {
      Alert.alert('Atenção', 'Por favor, digite o título ou diga "título" para informá-lo por voz.');
      return;
    }

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
        {
          historico: arrayUnion(newConversationRef.id)
        },
        { merge: true }
      );

      speak(`Conversa ${tituloFinal} criada com sucesso!`);
      fecharModal();
      
      // ✅ Navega automaticamente para a nova conversa
      setTimeout(() => {
        router.push({
          pathname: '/conversa',
          params: { 
            conversaId: newConversationRef.id, 
            titulo: tituloFinal 
          }
        });
      }, 500);

    } catch (error) {
      console.error("❌ Erro ao criar conversa:", error);
      Alert.alert('Erro', 'Não foi possível criar a conversa. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const criarConversaManual = () => {
    criarConversaComTitulo(tituloInput);
  };

  // ===================================================================
  // ABRIR/FECHAR MODAL
  // ===================================================================
  const abrirModal = () => {
    setTituloInput('');
    setStep('aguardandoPalavraTitulo');
    setModalVisible(true);
    setIsSaving(false);
    setRecognizedText('');
    tituloProcessadoRef.current = false;
    
    setTimeout(() => {
      speak("Por favor, digite o título ou diga 'título' para informá-lo por voz.", () => {
        startListening(true);
      });
    }, 300);
  };

  const fecharModal = () => {
    stopSpeaking();
    
    setModalVisible(false);
    setTituloInput('');
    setStep('idle');
    setIsSaving(false);
    setRecognizedText('');
    tituloProcessadoRef.current = false;
    
    if (tituloTimeoutRef.current) {
      clearTimeout(tituloTimeoutRef.current);
      tituloTimeoutRef.current = null;
    }
    
    stopListening();
    
    setTimeout(() => {
      startListening(false);
    }, 500);
  };

  // Cancelar exclusão programaticamente
  const cancelarExclusao = () => {
    console.log('[Histórico] Cancelando exclusão manualmente');
    stopSpeaking();
    stopListening();
    
    if (confirmacaoTimeoutRef.current) {
      clearTimeout(confirmacaoTimeoutRef.current);
      confirmacaoTimeoutRef.current = null;
    }
    
    setConversaParaExcluir(null);
    setStep('idle');
    setRecognizedText('');
    
    setTimeout(() => {
      startListening(false);
    }, 500);
  };

  // ===================================================================
  // ESTILOS
  // ===================================================================
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
      color: cores.texto,
    },
    container: {
      flex: 1,
      padding: 16,
      backgroundColor: cores.fundo,
    },
    item: {
      padding: 16,
      marginBottom: 8,
      borderRadius: 8,
      backgroundColor: cores.barrasDeNavegacao,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    itemContent: {
      flex: 1,
      marginRight: 12,
    },
    itemText: {
      fontSize: getFontSize('medium'),
      color: cores.texto,
      fontWeight: '500',
    },
    itemDateText: {
      fontSize: getFontSize('small'),
      color: cores.texto || '#888',
      marginTop: 4,
    },
    deleteButton: {
      padding: 8,
      margin: -8,
    },
    empty: {
      fontSize: getFontSize('medium'),
      textAlign: 'center',
      marginTop: 20,
      color: cores.texto,
    },
    createButton: {
      backgroundColor: cores.barrasDeNavegacao,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 25,
      margin: 16,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    createButtonText: {
      color: cores.texto,
      fontSize: getFontSize('medium'),
      fontWeight: 'bold',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: cores.fundo,
      borderRadius: 20,
      padding: 28,
      width: '100%',
      maxWidth: 500,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 8,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: getFontSize('large'),
      fontWeight: 'bold',
      color: cores.texto,
    },
    closeButton: {
      padding: 4,
    },
    inputContainer: {
      marginBottom: 20,
    },
    label: {
      fontSize: getFontSize('medium'),
      color: cores.texto,
      marginBottom: 8,
      fontWeight: '500',
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: cores.texto,
    },
    input: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: getFontSize('medium'),
      color: cores.fundo,
    },
    micButton: {
      padding: 12,
      marginRight: 4,
    },
    listeningIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      backgroundColor: cores.fundo,
      borderRadius: 8,
      marginBottom: 16,
    },
    listeningText: {
      marginLeft: 8,
      color: cores.texto,
      fontSize: getFontSize('medium'),
      fontWeight: '500',
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: cores.texto,
      alignItems: 'center',
    },
    cancelButtonText: {
      color: cores.texto,
      fontSize: getFontSize('medium'),
      fontWeight: '600',
    },
    saveButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: cores.texto,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButtonText: {
      color: cores.fundo,
      fontSize: getFontSize('medium'),
      fontWeight: '600',
    },
    savingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      backgroundColor: cores.texto,
      borderRadius: 8,
      marginTop: 12,
    },
    savingText: {
      marginLeft: 8,
      color: cores.fundo,
      fontSize: getFontSize('medium'),
      fontWeight: '500',
    },
    deleteOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      zIndex: 1000,
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
      elevation: 8,
    },
    deleteTitle: {
      fontSize: getFontSize('large'),
      fontWeight: 'bold',
      marginBottom: 16,
      textAlign: 'center',
    },
    deleteMessage: {
      fontSize: getFontSize('medium'),
      textAlign: 'center',
      marginBottom: 8,
      lineHeight: 24,
    },
    recognizedTextBox: {
      padding: 12,
      borderRadius: 8,
      width: '100%',
    },
    recognizedTextLabel: {
      fontSize: getFontSize('small'),
      fontWeight: '600',
      marginBottom: 4,
    },
    recognizedTextContent: {
      fontSize: getFontSize('medium'),
      fontStyle: 'italic',
    },
    deleteButtonsContainer: {
      flexDirection: 'row',
      marginTop: 20,
      gap: 12,
      width: '100%',
    },
    deleteActionButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: cores.texto,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteActionText: {
      fontSize: getFontSize('medium'),
      fontWeight: '600',
      textAlign: 'center',
      color: '#000',
    },
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
        <Text style={styles.loginMessage}>
          Faça login para acessar o histórico
        </Text>
      </View>
    );
  }

  const aguardandoPalavraTitulo = step === 'aguardandoPalavraTitulo';
  const aguardandoConfirmacao = step === 'aguardandoConfirmacaoExclusao';

  return (
    <View style={[styles.container, { flex: 1 }]}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            onPress={() => router.push({
              pathname: '/conversa',
              params: { conversaId: item.id, titulo: item.titulo }
            })}
            style={styles.item}
          >
            <View style={styles.itemContent}>
              <Text style={styles.itemText}>
                {String(toTitleCase(item.titulo || 'Sem título'))}
              </Text>
              <Text style={styles.itemDateText}>
                Alterado em: {String(item.dataAlteracao?.toDate?.()?.toLocaleString?.() || 'Carregando...')}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.deleteButton} 
              onPress={(e) => {
                e.stopPropagation(); 
                excluirConversa(item.id, item.titulo);
              }}
            >
              <Ionicons 
                name="trash-outline" 
                size={getIconSize('medium')} 
                color={cores.perigo} 
              />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />

      {/* ✅ OVERLAY DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {conversaParaExcluir && aguardandoConfirmacao && (
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteModal}>
            <Ionicons 
              name="warning" 
              size={48} 
              color="#FF453A" 
              style={{ marginBottom: 16 }}
            />
            <Text style={[styles.deleteTitle, { color: cores.texto }]}>
              Confirmar Exclusão
            </Text>
            <Text style={[styles.deleteMessage, { color: cores.texto }]}>
              Tem certeza que deseja excluir a conversa "{conversaParaExcluir.titulo}"?
            </Text>
            
            {isListening && (
              <View style={[styles.listeningIndicator, { marginTop: 16 }]}>
                <ActivityIndicator size="small" color={cores.texto} />
                <Text style={[styles.listeningText, { color: cores.texto }]}>
                  Escutando...
                </Text>
              </View>
            )}

            {recognizedText && (
              <View style={[styles.recognizedTextBox, { backgroundColor: cores.barrasDeNavegacao, marginTop: 12 }]}>
                <Text style={[styles.recognizedTextLabel, { color: cores.texto }]}>
                  Você disse:
                </Text>
                <Text style={[styles.recognizedTextContent, { color: cores.texto }]}>
                  "{recognizedText}"
                </Text>
              </View>
            )}

            <View style={styles.deleteButtonsContainer}>
              <TouchableOpacity 
                style={[styles.deleteActionButton, { backgroundColor: cores.confirmar }]}
                onPress={cancelarExclusao}
              >
                <Text style={[styles.deleteActionText, { color: '#000' }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.deleteActionButton, { backgroundColor: cores.perigo }]}
                onPress={() => {
                  console.log('[Histórico] Confirmação manual via botão');
                  stopSpeaking();
                  stopListening();
                  
                  if (confirmacaoTimeoutRef.current) {
                    clearTimeout(confirmacaoTimeoutRef.current);
                    confirmacaoTimeoutRef.current = null;
                  }
                  
                  speak("Confirmado. Excluindo conversa.", () => {
                    deletarDocumentosDaConversa(conversaParaExcluir.id);
                    setConversaParaExcluir(null);
                    setStep('idle');
                    setRecognizedText('');
                  });
                }}
              >
                <Text style={[styles.deleteActionText, { color: '#fff' }]}>
                  Confirmar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={styles.createButton}
        onPress={abrirModal}
        accessibilityLabel="Criar nova conversa"
      >
        <Text style={styles.createButtonText}>
          Criar Nova Conversa
        </Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={fecharModal}
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]}
            activeOpacity={1} 
            onPress={fecharModal}
          />
          
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova Conversa</Text>
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={fecharModal}
                disabled={isSaving}
              >
                <Ionicons 
                  name="close" 
                  size={getIconSize('medium')} 
                  color={cores.texto} 
                />
              </TouchableOpacity>
            </View>

            {isListening && (
              <View style={styles.listeningIndicator}>
                <ActivityIndicator size="small" color={cores.texto} />
                <Text style={styles.listeningText}>
                  {aguardandoPalavraTitulo ? 'Aguardando "Título"...' : 'Ouvindo título...'}
                </Text>
              </View>
            )}

            {step === 'aguardandoTitulo' && recognizedText && (
              <View style={[styles.listeningIndicator, { backgroundColor: cores.barrasDeNavegacao }]}>
                <Text style={styles.listeningText}>
                  "{recognizedText}"
                </Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Título da Conversa</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={tituloInput}
                  onChangeText={(text) => {
                    setTituloInput(text);
                    if (step !== 'idle') {
                      setStep('idle');
                      stopListening();
                      tituloProcessadoRef.current = false;
                    }
                  }}
                  placeholder="Digite ou fale o título"
                  placeholderTextColor='#999'
                  editable={!isSaving}
                  autoFocus={false}
                />
                <TouchableOpacity 
                  style={styles.micButton}
                  onPress={() => {
                    setStep('aguardandoPalavraTitulo');
                    setRecognizedText('');
                    tituloProcessadoRef.current = false;
                    speak("Diga 'título' para começar", () => {
                      startListening(true);
                    });
                  }}
                  disabled={isListening || isSaving}
                >
                  <Ionicons 
                    name={isListening ? "mic" : "mic-outline"} 
                    size={getIconSize('medium')} 
                    color={cores.fundo} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {step === 'idle' && !isSaving && (
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={fecharModal}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.saveButton}
                  onPress={criarConversaManual}
                >
                  <Text style={styles.saveButtonText}>Salvar</Text>
                </TouchableOpacity>
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
    </View>
  );
};

export default HistoryScreen;